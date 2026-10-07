# 魔法相框 Magic Portrait 📷

[English](README.md) · **中文**

一个浮在电脑桌面上的小小金色相框。点一下照片，里面的人就会"活过来"：一个实时数字人，用你熟悉的语言和你聊天，嘴型跟着声音一起动，就像《哈利·波特》里会动的照片。

我做它，是为了能再和已经离开的爷爷说说话。你也可以为你爱的人做一个。

<a href="https://www.loom.com/share/6badd65e006f4c7db1b111bc1f733f3e">
  <img src="https://cdn.loom.com/sessions/thumbnails/6badd65e006f4c7db1b111bc1f733f3e-with-play.gif" width="360" alt="演示视频：和魔法相框里的爷爷聊天">
</a>

**[▶️ 在 Loom 上观看演示视频](https://www.loom.com/share/6badd65e006f4c7db1b111bc1f733f3e)**

<p>
  <img src="assets/icons/come.png" width="120" alt="打开图标：阿公牵着孙女去买菜">
  &nbsp;
  <img src="assets/icons/go.png" width="120" alt="关闭图标：阿公在夕阳下挥手道别">
</p>

> ⚠️ 这是 AI 扮演的角色。声音和对话都是生成的，不是真人录音。

---

## 工作原理

```
你的麦克风 ─► 语音识别 ─► 大模型（性格 + 回忆）─► 语音合成 ─► Spatius ─► 相框
```

| 部分 | 作用 | 默认 |
|---|---|---|
| **Spatius** | 实时数字人，在本地渲染，口型跟着声音走 | — |
| **LiveKit Agents** | 实时语音通道 | LiveKit Cloud（免费额度） |
| **大脑** | 性格和回忆，来自两个文本文件 | DeepSeek |
| **声音** | 语音合成 | Azure 语音（免费额度，粤语） |
| **相框** | 置顶浮动的小窗口 | Electron |

```
magic-portrait/
├── .env.example               ← 复制成 .env，填入你的密钥
├── agent/                     ← "大脑"（Python）
│   ├── agent.py
│   ├── design_voice.py        ← 可选：用 MiniMax 设计声音
│   └── persona/
│       ├── personality.md     ← 模板：他是谁、怎么说话
│       └── knowledge.md       ← 模板：他的回忆
├── widget/                    ← 浮动相框（Electron）
├── scripts/
│   ├── start.command          ← 双击打开
│   ├── stop.command           ← 双击强制关闭
│   └── fix-electron.sh        ← 修复常见的 Electron 安装问题
└── assets/icons/              ← 像素风启动图标
```

---

## 1. 准备工作

- 一台 Mac（在 Apple 芯片上测试过）。Windows 和 Linux 大部分功能应该也能用，但一键启动脚本只支持 macOS。
- **Python 3.10+** 和 **Node.js 20+**。可以用 `python3 --version` 和 `node --version` 查看版本。
- 下面这些账号和密钥。免费额度就够起步：

| 服务 | 用途 | 在哪里获取 |
|---|---|---|
| LiveKit Cloud | 语音房间、语音识别 | <https://cloud.livekit.io> → Settings → API Keys |
| Spatius | 数字人 | <https://app.spatius.ai/apps> |
| DeepSeek | 大脑 | <https://platform.deepseek.com> |
| Azure 语音 | 声音 | <https://portal.azure.com> → 创建 **语音服务**，定价层选 **Free F0** |

## 2. 安装

```bash
git clone https://github.com/YujunZeng-Lulu/real-time-magic-portrait.git
cd real-time-magic-portrait
cp .env.example .env
open -e .env                     # 填入密钥后保存
```

```bash
# 大脑
cd agent
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python agent.py download-files

# 相框
cd ../widget
npm install
npm run build
```

> **遇到 "Electron failed to install correctly"？** 新版 npm 可能会拦截或弄坏 Electron 的下载。先运行 `npm approve-scripts electron`，再运行 `../scripts/fix-electron.sh`。

## 3. 运行

双击 **`scripts/start.command`**。第一次打开时 macOS 可能会拦截：右键点它，选 **打开**，再点一次 **打开** 确认。

也可以在终端里运行：

```bash
./scripts/start.command
```

相框会出现在屏幕右下角。**点一下照片**就能开始说话，照片会从黑白慢慢变成彩色。建议戴耳机，否则数字人可能会听到自己的声音。

| 操作 | 方法 |
|---|---|
| 说话 | 点照片 |
| 静音 / 挂断 | 鼠标移到相框上，点 🎙 / **End** |
| 隐藏 / 显示 | **⌃ Control + ⌥ Option + G**（可在 `WIDGET_SHORTCUT` 里修改） |
| 移动 | 拖动顶部的小横条 |
| 退出 | 点相框上的 **×**，或双击 `scripts/stop.command` |

---

## 4. 换成你自己的数字人

1. 在 **Spatius Studio** 里用照片创建数字人，或者从 Avatar Library 里选一个。
2. 把它的 **Avatar ID** 填进 `.env`：
   ```
   SPATIUS_AVATAR_ID=你的头像ID
   ```
   这个头像必须属于 `SPATIUS_APP_ID` 对应的那个 Spatius App。
3. 关掉相框再重新打开。

**"黑白魔法照片"效果**：待机时照片是黑白的，开始说话时变成彩色。设置 `WIDGET_LOOK=plain` 可以去掉相框和滤镜。想要泛黄的老照片色调，把 `widget/src/style.css` 里的 `grayscale(1)` 改成 `sepia(0.85)`。

## 5. 设置性格和回忆

数字人的性格来自 `agent/persona/` 里的两个文件：

| 文件 | 写什么 |
|---|---|
| `personality.md` | 他是谁、怎么说话、用什么语言、怎么跟你打招呼 |
| `knowledge.md` | 回忆：家乡、工作、做过的菜、你们一起做过的事、口头禅 |

**保护家人隐私**：把模板复制成 `*.local.md`。这两个文件不会被上传到 GitHub，程序会优先读取它们。

```bash
cd agent/persona
cp personality.md personality.local.md
cp knowledge.md knowledge.local.md
open -e personality.local.md knowledge.local.md
```

把所有 `[方括号]` 里的内容换成你家人的信息，保存后**关掉相框再重新打开**。

以后修改的三种方法：
```bash
open -e agent/persona/knowledge.local.md                         # 用文本编辑打开
nano agent/persona/knowledge.local.md                            # 在终端里编辑（Ctrl+O 保存，Ctrl+X 退出）
echo "- 每个星期天带我去海边" >> agent/persona/knowledge.local.md   # 只加一条
```
注意要用 `>>`（加到末尾）。只写一个 `>` 会覆盖掉整个文件。

**小贴士：**
- 越具体越好。"每个星期天傍晚带我去海边吃炒螺" 比 "带我去海边" 真实得多。
- 两个文件加起来控制在几页以内，因为每次回答都会带上它们。
- 想换语言，就改 `personality.md` 里"How you speak"那条规则，再把 `.env` 里的 `STT_LANGUAGE` 和 `AZURE_VOICE` 改成对应的语言。

## 6. 换声音

| 选项 | 费用 | 说明 |
|---|---|---|
| **Azure**（`TTS_PROVIDER=azure`） | 免费额度 | 真正的粤语声音。用 `AZURE_RATE`、`AZURE_PITCH` 调慢、调低，听起来更像老人 |
| **MiniMax**（`TTS_PROVIDER=minimax`） | 按量付费 | 用文字描述设计声音：`python agent/design_voice.py "八十岁的阿公，慢、温和、有点沙哑"` |
| **ElevenLabs**（`TTS_PROVIDER=elevenlabs`） | 付费 | 用录音克隆真实的声音 |

如果你还保留着家人的录音，克隆出来的声音可以很像他。请只克隆你有权使用的声音。

---

## 常见问题

| 现象 | 解决办法 |
|---|---|
| 相框显示 **Missing in .env** | 对应的密钥是空的。检查 `=` 两边有没有空格 |
| 数字人出现了，但不回答 | 看日志：`grep -E "ERROR\|Exception" agent.log` |
| 改 `.env` 之前就启动了 | 全部关掉再重新打开。两部分都只在启动时读取一次 `.env` |
| `Could not find Opus library` | 保持 `SPATIUS_AUDIO_FORMAT=pcm_s16le`，或运行 `brew install opus` |
| 有声音，但嘴不动 | Electron 版本太旧。运行 `npm install --save-dev electron@latest`，再运行 `scripts/fix-electron.sh` |
| MiniMax 报 `insufficient balance` | API 需要按量付费的余额，订阅套餐的 credits 不能用 |
| 数字人自己跟自己说话 | 戴耳机 |

调试相框：在 `widget/` 里运行 `WIDGET_DEVTOOLS=1 npm start`，会打开开发者工具。

## 隐私与安全

- `.env` 里存着你所有的密钥，已被 git 忽略。不要提交它，也不要出现在截图或视频里。
- `*.local.md` 人设文件也被 git 忽略了，家人的信息只留在你自己的电脑上。
- push 之前运行 `git status`，确认列表里没有这两类文件。

---

## 致谢

本项目的实时数字人由 **[Spatius](https://www.spatius.ai/)** 提供支持：它在本地渲染数字人形象，并让口型和声音实时同步。感谢 Spatius 团队提供的 [AvatarKit](https://docs.spatius.ai/) 和 [LiveKit Agents 插件](https://docs.livekit.io/agents/models/avatar/plugins/spatius/)。

同时使用了 [LiveKit Agents](https://github.com/livekit/agents)、[DeepSeek](https://www.deepseek.com/)、[Azure AI 语音](https://azure.microsoft.com/products/ai-services/ai-speech)、[Electron](https://www.electronjs.org/) 和 [Vite](https://vitejs.dev/)。在 Claude 的帮助下完成。

数字人素材在 Spatius Studio 中创建，不包含在本仓库里。第三方 SDK 遵循它们各自的许可证和条款。

## 许可证

[MIT](LICENSE) © 2026 Yujun Lulu Zeng
