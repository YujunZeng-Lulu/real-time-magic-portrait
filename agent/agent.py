"""
Voice + personality for your Spatius avatar.

Pipeline:  your mic → STT → LLM (persona + knowledge) → TTS (your voice) → Spatius → widget

Run:
    python agent.py download-files   # once, fetches the VAD model
    python agent.py dev              # starts the agent and waits for the widget
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli, inference
from livekit.plugins import silero, spatius

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")

AGENT_NAME = "avatar-widget"  # the widget dispatches this name; keep them in sync
logger = logging.getLogger(AGENT_NAME)


# ── Personality & knowledge ──────────────────────────────────────────────


def build_instructions() -> str:
    """Join persona/personality.md and persona/knowledge.md into one system prompt."""
    persona_dir = HERE / "persona"
    parts = []
    for name in ("personality", "knowledge"):
        # Your private copy (git-ignored) wins over the public template.
        path = persona_dir / f"{name}.local.md"
        if not path.exists():
            path = persona_dir / f"{name}.md"
        if path.exists():
            logger.info("persona: %s", path.name)
            parts.append(path.read_text(encoding="utf-8").strip())
        else:
            logger.warning("missing %s, skipping", path)
    return "\n\n".join(parts) or "You are a friendly voice assistant. Keep answers short."


class Companion(Agent):
    def __init__(self) -> None:
        super().__init__(instructions=build_instructions())

    async def on_enter(self) -> None:
        # Greeting style lives in personality.md, so it stays in character.
        self.session.generate_reply(instructions="Greet the user now, following your greeting rules.")


# ── Voice ────────────────────────────────────────────────────────────────


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    return float(raw) if raw else default


def _tts_provider() -> str:
    """TTS_PROVIDER picks the voice service; if unset, use whichever key is filled in."""
    explicit = (os.getenv("TTS_PROVIDER") or "").strip().lower()
    if explicit:
        return explicit
    for provider, key in (
        ("azure", "AZURE_SPEECH_KEY"),
        ("minimax", "MINIMAX_API_KEY"),
        ("elevenlabs", "ELEVENLABS_API_KEY"),
    ):
        if os.getenv(key):
            return provider
    return "inference"


def build_tts():
    """Azure (free Cantonese), MiniMax (designed Cantonese), ElevenLabs, or LiveKit Inference."""
    provider = _tts_provider()

    if provider == "azure":
        from livekit.plugins import azure
        from livekit.plugins.azure.tts import ProsodyConfig

        voice = os.getenv("AZURE_VOICE", "zh-HK-WanLungNeural")
        logger.info("voice: Azure %s", voice)
        return azure.TTS(
            voice=voice,
            language=os.getenv("AZURE_LANGUAGE", "zh-HK"),
            sample_rate=24000,
            # Slower and lower so he sounds like an old man (rate 0.5–2.0;
            # pitch: x-low | low | medium | high | x-high).
            prosody=ProsodyConfig(
                rate=_float_env("AZURE_RATE", 0.85),
                pitch=os.getenv("AZURE_PITCH", "low"),
            ),
        )

    if provider == "minimax":
        from livekit.plugins import minimax

        # A designed voice (make one with design_voice.py). Falls back to a
        # stock Cantonese male voice, slowed down and lowered to sound older.
        voice = os.getenv("MINIMAX_VOICE_ID") or "Cantonese_PlayfulMan"
        logger.info("voice: MiniMax %s", voice)
        return minimax.TTS(
            model=os.getenv("MINIMAX_MODEL", "speech-2.8-turbo"),
            voice=voice,
            language_boost="Chinese,Yue",  # read the text as Cantonese, not Mandarin
            speed=_float_env("MINIMAX_SPEED", 0.88),
            pitch=int(_float_env("MINIMAX_PITCH", -2)),
            audio_format="pcm",
            sample_rate=24000,
        )

    if provider == "elevenlabs":
        from livekit.plugins import elevenlabs

        voice_id = os.getenv("ELEVENLABS_VOICE_ID")
        if not voice_id:
            raise RuntimeError("ELEVENLABS_API_KEY is set but ELEVENLABS_VOICE_ID is empty")
        logger.info("voice: ElevenLabs %s", voice_id)
        return elevenlabs.TTS(
            voice_id=voice_id,
            model=os.getenv("ELEVENLABS_MODEL", "eleven_flash_v2_5"),
            # Spatius' Opus path accepts 8k/12k/16k/24k/48k only; ElevenLabs'
            # default (mp3 22.05 kHz) would be rejected, so ask for 24 kHz PCM.
            encoding="pcm_24000",
            voice_settings=elevenlabs.VoiceSettings(
                stability=_float_env("ELEVENLABS_STABILITY", 0.45),
                similarity_boost=_float_env("ELEVENLABS_SIMILARITY", 0.8),
                style=_float_env("ELEVENLABS_STYLE", 0.2),
                speed=_float_env("ELEVENLABS_SPEED", 1.0),
                use_speaker_boost=True,
            ),
        )

    model = os.getenv("TTS_MODEL", "cartesia/sonic-3")
    voice = os.getenv("TTS_VOICE", "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc")
    logger.info("voice: %s %s", model, voice)
    return inference.TTS(model, voice=voice, sample_rate=24000)


# ── Brain ────────────────────────────────────────────────────────────────


def build_llm():
    """DeepSeek (or any OpenAI-compatible API) if a key is set, else LiveKit Inference."""
    if os.getenv("DEEPSEEK_API_KEY"):
        from livekit.plugins import openai

        model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
        logger.info("brain: DeepSeek %s", model)
        return openai.LLM(
            model=model,
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
            api_key=os.getenv("DEEPSEEK_API_KEY"),
        )
    return inference.LLM(os.getenv("LLM_MODEL", "openai/gpt-4.1"))


# ── Session ──────────────────────────────────────────────────────────────

server = AgentServer()


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    # Join the room first: the Spatius avatar needs our room identity to start.
    await ctx.connect()

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=inference.STT(
            os.getenv("STT_MODEL", "deepgram/nova-3"),
            language=os.getenv("STT_LANGUAGE", "zh-HK"),  # Cantonese
        ),
        llm=build_llm(),
        tts=build_tts(),
    )

    # Reads SPATIUS_API_KEY / SPATIUS_APP_ID / SPATIUS_AVATAR_ID from .env.
    avatar = spatius.AvatarSession()
    await avatar.start(session, room=ctx.room)

    await session.start(agent=Companion(), room=ctx.room)


if __name__ == "__main__":
    cli.run_app(server)
