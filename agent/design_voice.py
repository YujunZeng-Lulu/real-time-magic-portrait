"""
Create a custom elderly Cantonese voice with MiniMax Voice Design (run once).

    python design_voice.py
    python design_voice.py "your own description of the voice"

It saves a preview to voice_preview.mp3 and prints a voice ID. If you like the
preview, put the ID in .env as MINIMAX_VOICE_ID and set MINIMAX_PITCH=0 (the
designed voice already sounds old, so it needs no lowering). If you don't,
run it again with a tweaked description.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")

PROMPT = (
    "A grandfather in his late seventies speaking old-fashioned colloquial "
    "Cantonese. Warm, slightly hoarse and gravelly voice, unhurried and gentle, "
    "with a soft affectionate chuckle, like an old man talking to his grandchild."
)
PREVIEW = "乖孫，食咗飯未呀？阿公舊陣時日日都要早早起身去飲茶㗎。"


def main() -> None:
    key = os.getenv("MINIMAX_API_KEY")
    if not key:
        sys.exit("Set MINIMAX_API_KEY in .env first.")

    base = os.getenv("MINIMAX_BASE_URL", "https://api.minimax.io").rstrip("/")
    body = {
        "prompt": sys.argv[1] if len(sys.argv) > 1 else PROMPT,
        "preview_text": PREVIEW,
    }
    req = urllib.request.Request(
        f"{base}/v1/voice_design",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.load(resp)

    status = data.get("base_resp", {})
    if status.get("status_code", 0) != 0:
        sys.exit(f"MiniMax error: {status}")

    voice_id = data["voice_id"]
    preview = HERE / "voice_preview.mp3"
    preview.write_bytes(bytes.fromhex(data["trial_audio"]))

    print(f"Preview saved to {preview}")
    print(f"\nAdd this to .env:\nMINIMAX_VOICE_ID={voice_id}\nMINIMAX_PITCH=0")


if __name__ == "__main__":
    main()
