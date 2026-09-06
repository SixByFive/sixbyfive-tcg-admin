import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import crypto from 'node:crypto'
import { app } from 'electron'

const TARGETS_FILE   = path.join(app.getPath('userData'), 'status-targets.json')
const VL_SETTINGS    = path.join(app.getPath('userData'), 'settings.json')
const CHECK_TIMEOUT_MS     = 5000
const DEGRADED_THRESHOLD_MS = 2000

function buildDefaults() {
  const defaults = [
    { id: 'tcg-api',  label: 'TCG API',  type: 'http', url: 'https://backendtcg.sixbyfive.com', degradedThresholdMs: DEGRADED_THRESHOLD_MS },
    { id: 'kora-api', label: 'Kora API', type: 'http', url: 'https://api.koraplatform.co.uk',   degradedThresholdMs: DEGRADED_THRESHOLD_MS },
  ]
  try {
    if (fs.existsSync(VL_SETTINGS)) {
      const vl = JSON.parse(fs.readFileSync(VL_SETTINGS, 'utf-8'))
      if (vl.heimdallHost) {
        defaults.push({
          id: 'heimdall',
          label: 'Heimdall',
          type: 'tcp',
          host: vl.heimdallHost,
          port: vl.heimdallPort ?? 22,
          degradedThresholdMs: DEGRADED_THRESHOLD_MS,
        })
      }
    }
  } catch {}
  return defaults
}

function loadTargets() {
  try {
    if (!fs.existsSync(TARGETS_FILE)) return buildDefaults()
    const targets = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf-8'))
    // Heal any entries that were saved with a blank id by the old bug
    let dirty = false
    for (const t of targets) {
      if (!t.id) { t.id = crypto.randomUUID(); dirty = true }
    }
    if (dirty) persist(targets)
    return targets
  } catch {
    return buildDefaults()
  }
}

function persist(targets) {
  fs.mkdirSync(path.dirname(TARGETS_FILE), { recursive: true })
  fs.writeFileSync(TARGETS_FILE, JSON.stringify(targets, null, 2), 'utf-8')
}

export function getTargets() {
  return loadTargets()
}

export function saveTarget(target) {
  const targets = loadTargets()
  const entry = { ...target, id: target.id || crypto.randomUUID() }
  if (target.id) {
    // Edit: replace the existing entry
    const idx = targets.findIndex(t => t.id === target.id)
    if (idx >= 0) targets[idx] = entry
    else targets.push(entry)
  } else {
    // New target: always append (blank id cannot match an existing entry)
    targets.push(entry)
  }
  persist(targets)
  return { ok: true }
}

export function deleteTarget(id) {
  persist(loadTargets().filter(t => t.id !== id))
  return { ok: true }
}

async function checkHttp(target) {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
  try {
    const res = await fetch(target.url, { signal: controller.signal })
    const responseMs = Date.now() - start
    clearTimeout(timer)
    const threshold = target.degradedThresholdMs ?? DEGRADED_THRESHOLD_MS
    // Any HTTP response = server reachable; only connection failures/timeouts = down
    const state = responseMs > threshold ? 'degraded' : 'up'
    return { targetId: target.id, state, responseMs, statusCode: res.status, checkedAt: new Date().toISOString(), error: null }
  } catch (err) {
    clearTimeout(timer)
    return {
      targetId: target.id,
      state: 'down',
      responseMs: Date.now() - start,
      statusCode: null,
      checkedAt: new Date().toISOString(),
      error: err.name === 'AbortError' ? 'Timed out' : err.message,
    }
  }
}

function checkTcp(target) {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = net.createConnection({ host: target.host, port: target.port })
    const timer = setTimeout(() => {
      socket.destroy()
      resolve({ targetId: target.id, state: 'down', responseMs: Date.now() - start, statusCode: null, checkedAt: new Date().toISOString(), error: 'Timed out' })
    }, CHECK_TIMEOUT_MS)

    socket.once('connect', () => {
      const responseMs = Date.now() - start
      clearTimeout(timer)
      socket.destroy()
      const threshold = target.degradedThresholdMs ?? DEGRADED_THRESHOLD_MS
      resolve({ targetId: target.id, state: responseMs > threshold ? 'degraded' : 'up', responseMs, statusCode: null, checkedAt: new Date().toISOString(), error: null })
    })

    socket.once('error', (err) => {
      clearTimeout(timer)
      socket.destroy()
      resolve({ targetId: target.id, state: 'down', responseMs: Date.now() - start, statusCode: null, checkedAt: new Date().toISOString(), error: err.message })
    })
  })
}

export async function checkAll() {
  const targets = loadTargets()
  return Promise.all(targets.map(t => t.type === 'http' ? checkHttp(t) : checkTcp(t)))
}
