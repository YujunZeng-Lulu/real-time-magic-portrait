// Electron main process: the floating window, the keyboard shortcut, and
// LiveKit token minting (so API secrets never reach the renderer).

const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const crypto = require('node:crypto')
const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  session,
  systemPreferences,
} = require('electron')

require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') })

const AGENT_NAME = 'avatar-widget' // must match AGENT_NAME in agent/agent.py
const IS_DEV = process.argv.includes('--dev')
const DEV_URL = 'http://localhost:5199'
const DIST = path.resolve(__dirname, '..', 'dist')

const WIDTH = 300
const HEIGHT = 400

let win = null

// ── Config check ─────────────────────────────────────────────────────────

function missingEnv() {
  const required = [
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'SPATIUS_APP_ID',
    'SPATIUS_AVATAR_ID',
  ]
  return required.filter((k) => !process.env[k])
}

// ── Serve the built UI over http (AvatarKit needs .wasm with the right MIME) ─

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

function serveDist() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      reject(new Error('dist/ not found. Run "npm start" (it builds first).'))
      return
    }
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      let file = path.normalize(path.join(DIST, urlPath))
      if (!file.startsWith(DIST)) {
        res.writeHead(403).end()
        return
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404).end()
          return
        }
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        })
        res.end(data)
      })
    })
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
    server.on('error', reject)
  })
}

// ── LiveKit session for the renderer ─────────────────────────────────────

async function createSession() {
  const { AccessToken, AgentDispatchClient, RoomServiceClient } = await import('livekit-server-sdk')
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env

  const roomName = `widget-${crypto.randomBytes(4).toString('hex')}`
  const identity = `me-${crypto.randomBytes(3).toString('hex')}`
  const httpUrl = LIVEKIT_URL.replace(/^ws/, 'http')

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, ttl: '1h' })
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })
  const token = await at.toJwt()

  // Create the room and ask the Python agent (by name) to join it.
  const rooms = new RoomServiceClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  await rooms.createRoom({ name: roomName, emptyTimeout: 60 })
  const dispatch = new AgentDispatchClient(httpUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  await dispatch.createDispatch(roomName, AGENT_NAME)

  return { url: LIVEKIT_URL, token, roomName }
}

// ── Window ───────────────────────────────────────────────────────────────

async function createWindow() {
  const { workArea } = screen.getPrimaryDisplay()

  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: workArea.x + workArea.width - WIDTH - 24,
    y: workArea.y + workArea.height - HEIGHT - 24,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    minWidth: 180,
    minHeight: 240,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    maximizable: false,
    title: 'Avatar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  // Float above other windows, including full-screen apps, on every desktop.
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const url = IS_DEV ? DEV_URL : await serveDist()
  await win.loadURL(url)
  if (IS_DEV || process.env.WIDGET_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' })
}

function toggleWindow() {
  if (!win) return
  if (win.isVisible()) win.hide()
  else win.showInactive()
}

// ── IPC ──────────────────────────────────────────────────────────────────

ipcMain.handle('widget:config', () => ({
  appId: process.env.SPATIUS_APP_ID || '',
  avatarId: process.env.SPATIUS_AVATAR_ID || '',
  region: process.env.SPATIUS_REGION || '',
  shortcut: process.env.WIDGET_SHORTCUT || 'CommandOrControl+Shift+A',
  look: process.env.WIDGET_LOOK || 'portrait',
  missing: missingEnv(),
}))

ipcMain.handle('widget:session', async () => {
  if (process.platform === 'darwin') {
    await systemPreferences.askForMediaAccess('microphone')
  }
  return createSession()
})

ipcMain.on('widget:hide', () => win && win.hide())
ipcMain.on('widget:quit', () => app.quit())

// ── App lifecycle ────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Allow the microphone for our own page only.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'media')
  })

  if (process.platform === 'darwin') app.dock.hide()

  await createWindow()

  const shortcut = process.env.WIDGET_SHORTCUT || 'CommandOrControl+Shift+A'
  if (!globalShortcut.register(shortcut, toggleWindow)) {
    console.warn(`Could not register shortcut ${shortcut} (already in use?)`)
  }
})

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => app.quit())
