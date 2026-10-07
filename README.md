# Magic Portrait 📷

**English** · [中文](README.zh-CN.md)

A little gold picture frame that floats on your desktop. Click the photo and the
person inside comes to life: a real-time digital human who talks with you, lips
moving with every word, like the moving portraits in Harry Potter.

I built it so I could talk to my late grandpa again. You can make one for
someone you love.

<a href="https://www.loom.com/share/6badd65e006f4c7db1b111bc1f733f3e">
  <img src="https://cdn.loom.com/sessions/thumbnails/6badd65e006f4c7db1b111bc1f733f3e-with-play.gif" width="360" alt="Demo video: talking to my grandpa in the magic portrait">
</a>

**[▶️ Watch the demo on Loom](https://www.loom.com/share/6badd65e006f4c7db1b111bc1f733f3e)**

<p>
  <img src="assets/icons/come.png" width="120" alt="Open icon: grandpa walking to the market with his granddaughter">
  &nbsp;
  <img src="assets/icons/go.png" width="120" alt="Close icon: grandpa waving goodbye at sunset">
</p>

> ⚠️ This is an AI character. The voice and words are generated; they are not
> recordings of a real person.

---

## How it works

```
your mic ─► speech-to-text ─► LLM (personality + memories) ─► text-to-speech ─► Spatius ─► the frame
```

| Part | What it does | Default |
|---|---|---|
| **Spatius** | Real-time digital human, rendered on your device, lip-synced to the voice | — |
| **LiveKit Agents** | Real-time voice pipeline | LiveKit Cloud (free tier) |
| **Brain** | Personality and memories, from two text files | DeepSeek |
| **Voice** | Text-to-speech | Azure Speech (free tier, Cantonese) |
| **Frame** | Floating, always-on-top window | Electron |

```
magic-portrait/
├── .env.example               ← copy to .env and add your keys
├── agent/                     ← the "brain" (Python)
│   ├── agent.py
│   ├── design_voice.py        ← optional: design a voice with MiniMax
│   └── persona/
│       ├── personality.md     ← template: who they are, how they talk
│       └── knowledge.md       ← template: their memories
├── widget/                    ← the floating frame (Electron)
├── scripts/
│   ├── start.command          ← double-click to open
│   ├── stop.command           ← double-click to force-close
│   └── fix-electron.sh        ← fixes a common Electron install issue
└── assets/icons/              ← pixel-art launcher icons
```

---

## 1. What you need

- A Mac (tested on Apple Silicon). Windows and Linux should mostly work, but
  the launcher scripts are macOS-only.
- **Python 3.10+** and **Node.js 20+**. Check with `python3 --version` and `node --version`.
- Accounts and keys. Free tiers are enough to start:

| Service | What for | Where |
|---|---|---|
| LiveKit Cloud | Voice rooms, speech-to-text | <https://cloud.livekit.io> → Settings → API Keys |
| Spatius | The digital human | <https://app.spatius.ai/apps> |
| DeepSeek | The brain | <https://platform.deepseek.com> |
| Azure Speech | The voice | <https://portal.azure.com> → create **Speech service**, tier **Free F0** |

## 2. Install

```bash
git clone https://github.com/YujunZeng-Lulu/real-time-magic-portrait.git
cd real-time-magic-portrait
cp .env.example .env
open -e .env                     # paste your keys, then save
```

```bash
# the brain
cd agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python agent.py download-files

# the frame
cd ../widget
npm install
npm run build
```

> **"Electron failed to install correctly"?** Newer npm versions can block or
> break Electron's download. Run `npm approve-scripts electron`, then
> `../scripts/fix-electron.sh`.

## 3. Run

Double-click **`scripts/start.command`**. The first time, macOS may block it:
right-click it, choose **Open**, then click **Open** again.

Or run it from Terminal:

```bash
./scripts/start.command
```

The frame appears in the bottom-right corner. **Click the photo** to talk; it
fades from black-and-white into colour. Use headphones, or the avatar may hear
itself.

| Action | How |
|---|---|
| Talk | Click the photo |
| Mute / hang up | Hover over the frame, then use 🎙 / **End** |
| Hide / show | **⌃ Control + ⌥ Option + G** (set with `WIDGET_SHORTCUT`) |
| Move | Drag the bar at the top |
| Quit | **×** on the frame, or double-click `scripts/stop.command` |

---

## 4. Use your own digital human

1. In **Spatius Studio**, create an avatar from a photo, or pick one from the
   Avatar Library.
2. Copy its **Avatar ID** into `.env`:
   ```
   SPATIUS_AVATAR_ID=your-avatar-id
   ```
   The avatar must belong to the same Spatius App as `SPATIUS_APP_ID`.
3. Quit and reopen the frame.

**Black-and-white "magic photo" effect:** while idle the photo is shown in
black-and-white, and it turns to colour when you talk. Set `WIDGET_LOOK=plain`
for no frame and no filter. For a sepia look, change `grayscale(1)` to
`sepia(0.85)` in `widget/src/style.css`.

## 5. Give them a personality and memories

The avatar's character comes from two files in `agent/persona/`:

| File | What goes in it |
|---|---|
| `personality.md` | Who they are, how they speak, which language, how they greet you |
| `knowledge.md` | Memories: hometown, job, food they cooked, things you did together, their sayings |

**Keep your family's memories private:** copy the templates to `*.local.md`.
These files are git-ignored, and the app uses them instead of the templates.

```bash
cd agent/persona
cp personality.md personality.local.md
cp knowledge.md knowledge.local.md
open -e personality.local.md knowledge.local.md
```

Replace everything in `[brackets]`, save, then **quit and reopen** the frame.

Three ways to edit later:
```bash
open -e agent/persona/knowledge.local.md                         # TextEdit
nano agent/persona/knowledge.local.md                            # in Terminal (Ctrl+O save, Ctrl+X exit)
echo "- Took me to the seaside every Sunday" >> agent/persona/knowledge.local.md   # add one line
```
Use `>>` (append). A single `>` overwrites the whole file.

**Tips:**
- Be specific. "Every Sunday evening he took me to the seaside for fried snails"
  feels far more real than "he took me to the beach".
- Keep both files to a few pages. They're sent with every reply.
- For another language, change the "How you speak" rule in `personality.md`,
  then set `STT_LANGUAGE` and `AZURE_VOICE` in `.env` to match.

## 6. Change the voice

| Option | Cost | Notes |
|---|---|---|
| **Azure** (`TTS_PROVIDER=azure`) | Free tier | Real Cantonese voices. Tune with `AZURE_RATE` and `AZURE_PITCH` to sound older |
| **MiniMax** (`TTS_PROVIDER=minimax`) | Pay-as-you-go | Design a voice from a description: `python agent/design_voice.py "an 80-year-old grandpa, slow, warm, a bit hoarse"` |
| **ElevenLabs** (`TTS_PROVIDER=elevenlabs`) | Paid | Clone a real voice from a recording |

If you still have recordings of your loved one, a cloned voice can sound like
them. Please only clone a voice you have the right to use.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Frame says **Missing in .env** | That key is empty. Check for spaces around `=` |
| Avatar appears but never answers | Check `agent.log` with `grep -E "ERROR\|Exception" agent.log` |
| Agent started before you edited `.env` | Quit everything and reopen. Both parts read `.env` only at startup |
| `Could not find Opus library` | Keep `SPATIUS_AUDIO_FORMAT=pcm_s16le`, or run `brew install opus` |
| Sound but the lips don't move | Electron is too old. Run `npm install --save-dev electron@latest`, then `scripts/fix-electron.sh` |
| `insufficient balance` from MiniMax | The API needs pay-as-you-go balance. Subscription or plan credits don't work |
| It talks to itself | Use headphones |

Debug the frame by running `WIDGET_DEVTOOLS=1 npm start` in `widget/`.

## Privacy and security

- `.env` holds all your keys and is git-ignored. Never commit it or show it in screenshots or videos.
- `*.local.md` persona files are git-ignored too, so your family's details stay on your computer.
- Before pushing, run `git status` and check that neither appears in the list.

---

## Acknowledgements

The real-time digital human in this project is powered by
**[Spatius](https://www.spatius.ai/)**, which renders the avatar on-device and
lip-syncs it to speech. Thanks to the Spatius team for
[AvatarKit](https://docs.spatius.ai/) and the
[LiveKit Agents plugin](https://docs.livekit.io/agents/models/avatar/plugins/spatius/).

Also built with [LiveKit Agents](https://github.com/livekit/agents),
[DeepSeek](https://www.deepseek.com/),
[Azure AI Speech](https://azure.microsoft.com/products/ai-services/ai-speech),
[Electron](https://www.electronjs.org/) and
[Vite](https://vitejs.dev/). Built with the help of Claude.

Avatar assets are created in Spatius Studio and are not included in this
repository. Third-party SDKs are subject to their own licenses and terms.

## License

[MIT](LICENSE) © 2026 Yujun Lulu Zeng
