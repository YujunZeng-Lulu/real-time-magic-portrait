// Renderer: loads your Spatius avatar, then connects it to the voice agent
// through LiveKit when you press Talk.

import { AvatarManager, AvatarSDK, AvatarView, DrivingServiceMode } from '@spatius/avatarkit'
import { AvatarPlayer, LiveKitProvider } from '@spatius/avatarkit-rtc'

const $ = (id) => document.getElementById(id)
const ui = {
  widget: $('widget'),
  frame: $('frame'),
  stage: $('stage'),
  status: $('status'),
  call: $('call'),
  mic: $('mic'),
  hide: $('hide'),
  quit: $('quit'),
}

let avatar = null // loaded avatar asset (cached by the SDK)
let view = null // AvatarView rendering into #stage
let player = null // AvatarPlayer bridging the LiveKit room and the view
let muted = false
let busy = false

// ── UI helpers ───────────────────────────────────────────────────────────

function setState(state, message) {
  ui.widget.dataset.state = state
  if (message !== undefined) ui.status.textContent = message
  ui.call.disabled = state === 'loading' || state === 'connecting'
  ui.call.textContent = state === 'live' ? 'End' : 'Talk'
  ui.mic.hidden = state !== 'live'
}

function fail(error, prefix = 'Error') {
  console.error(error)
  const msg = error && error.message ? error.message : String(error)
  setState('error', `${prefix}: ${msg}`)
  ui.call.disabled = !view
}

function setSpeaking(speaking) {
  ui.widget.dataset.speaking = speaking ? 'true' : 'false'
}

// ── Avatar view ──────────────────────────────────────────────────────────

async function createView() {
  view = new AvatarView(avatar, ui.stage)
  // React to the avatar talking (subtle pulse under it).
  view.controller.onConversationState = (s) => setSpeaking(s === 'playing')
  await new Promise((resolve) => {
    view.onFirstRendering = resolve
  })
}

async function boot() {
  const config = await window.widget.config()
  ui.widget.dataset.look = config.look
  if (config.missing.length) {
    setState('error', `Missing in .env: ${config.missing.join(', ')}`)
    return
  }

  setState('loading', 'Starting renderer…')
  await AvatarSDK.initialize(config.appId, {
    drivingServiceMode: DrivingServiceMode.rtc,
    ...(config.region ? { region: config.region } : {}),
  })

  avatar = await AvatarManager.shared.load(config.avatarId, (p) => {
    if (p.type === 'downloading') {
      ui.status.textContent = `Loading avatar… ${Math.round((p.progress ?? 0) * 100)}%`
    }
  })
  await createView()

  const key = config.shortcut.replace('CommandOrControl', navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl')
  setState('idle', `Click the picture to talk · ${key} hides me`)
}

// ── Conversation ─────────────────────────────────────────────────────────

async function startTalking() {
  setState('connecting', 'Waking up…')
  const session = await window.widget.session() // { url, token, roomName }

  player = new AvatarPlayer(new LiveKitProvider(), view)
  player.on('disconnected', () => {
    // The agent left or the network dropped: go back to idle.
    if (player) void stopTalking('Call ended')
  })
  player.on('error', (e) => fail(e, 'Connection'))
  player.on('stalled', async () => {
    try {
      await player.reconnect()
    } catch (e) {
      fail(e, 'Reconnect failed')
    }
  })

  await player.connect(session)
  await player.startPublishing() // starts the microphone
  muted = false
  ui.mic.setAttribute('aria-pressed', 'false')
  setState('live', 'Listening…')
}

async function stopTalking(message = 'Click the picture to talk again') {
  const p = player
  player = null
  setSpeaking(false)
  try {
    await p?.stopPublishing()
  } catch {}
  try {
    await p?.disconnect()
  } catch {}
  // Fresh view so the avatar returns to its idle animation cleanly.
  try {
    view?.dispose()
  } catch {}
  await createView()
  setState('idle', message)
}

async function toggleMic() {
  if (!player) return
  muted = !muted
  ui.mic.setAttribute('aria-pressed', String(muted))
  ui.mic.title = muted ? 'Unmute' : 'Mute'
  try {
    if (muted) await player.stopPublishing()
    else await player.startPublishing()
    ui.status.textContent = muted ? 'Muted' : 'Listening…'
  } catch (e) {
    fail(e, 'Microphone')
  }
}

// ── Wiring ───────────────────────────────────────────────────────────────

// Clicking the picture wakes him up (only starts a call, never ends one).
ui.frame.addEventListener('click', () => {
  if (!player && !ui.call.disabled) ui.call.click()
})

ui.call.addEventListener('click', async () => {
  if (busy) return
  busy = true
  try {
    if (player) await stopTalking()
    else await startTalking()
  } catch (e) {
    if (player) await stopTalking().catch(() => {})
    fail(e, 'Could not connect')
  } finally {
    busy = false
  }
})
ui.mic.addEventListener('click', toggleMic)
ui.hide.addEventListener('click', () => window.widget.hide())
ui.quit.addEventListener('click', () => window.widget.quit())

window.addEventListener('beforeunload', () => {
  void player?.disconnect()
  view?.dispose()
})

boot().catch((e) => fail(e, 'Could not load avatar'))
