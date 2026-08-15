import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { Client } from 'ssh2'
import { getDecryptedPassword } from '../vault/vault.service.js'

const CONNECTIONS_FILE = path.join(app.getPath('userData'), 'ssh-connections.json')

// Active SSH sessions keyed by tabId
const sessions = new Map()

// ── Saved connections ──────────────────────────────────────────────────────

export function listConnections() {
  try {
    if (!fs.existsSync(CONNECTIONS_FILE)) return []
    return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveConnection(conn) {
  const all = listConnections()
  const idx = all.findIndex(c => c.id === conn.id)
  if (idx >= 0) all[idx] = conn
  else all.push({ ...conn, id: conn.id || crypto.randomUUID() })
  fs.mkdirSync(path.dirname(CONNECTIONS_FILE), { recursive: true })
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(all, null, 2), 'utf-8')
  return { ok: true }
}

export function deleteConnection(id) {
  const all = listConnections().filter(c => c.id !== id)
  fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(all, null, 2), 'utf-8')
  return { ok: true }
}

// ── Active session lifecycle ───────────────────────────────────────────────

export function connect({ connectionId, tabId, webContents }) {
  const conn = listConnections().find(c => c.id === connectionId)
  if (!conn) throw new Error(`Connection "${connectionId}" not found`)

  // Clean up any existing session for this tab
  disconnect({ tabId })

  const client = new Client()
  sessions.set(tabId, client)

  function emit(channel, payload) {
    if (!webContents.isDestroyed()) {
      webContents.send(channel, payload)
    }
  }

  client.on('ready', () => {
    emit('ssh:status', { tabId, status: 'connected' })

    client.shell({ term: 'xterm-256color' }, (err, stream) => {
      if (err) {
        emit('ssh:status', { tabId, status: 'error', message: err.message })
        client.end()
        return
      }

      sessions.set(tabId, { client, stream, label: conn.label, host: conn.host })

      stream.on('data', data => {
        emit('ssh:data', { tabId, data: data.toString('binary') })
      })

      stream.stderr.on('data', data => {
        emit('ssh:data', { tabId, data: data.toString('binary') })
      })

      stream.on('close', () => {
        emit('ssh:status', { tabId, status: 'disconnected' })
        sessions.delete(tabId)
        client.end()
      })
    })
  })

  client.on('error', err => {
    emit('ssh:status', { tabId, status: 'error', message: err.message })
    sessions.delete(tabId)
  })

  client.on('close', () => {
    emit('ssh:status', { tabId, status: 'disconnected' })
    sessions.delete(tabId)
  })

  // Build auth config
  const authConfig = {
    host:     conn.host,
    port:     conn.port || 22,
    username: conn.username,
    readyTimeout: 10000,
  }

  if (conn.authMethod === 'key') {
    try {
      authConfig.privateKey = fs.readFileSync(conn.keyPath)
    } catch (e) {
      throw new Error(`Cannot read key file: ${conn.keyPath} — ${e.message}`)
    }
  } else {
    const pw = getDecryptedPassword(conn.vaultId)
    if (!pw) throw new Error('Could not decrypt password from Vault. Check the Vault entry ID.')
    authConfig.password = pw
  }

  client.connect(authConfig)
}

export function disconnect({ tabId }) {
  const session = sessions.get(tabId)
  if (!session) return
  sessions.delete(tabId)
  try {
    if (session.stream) session.stream.close()
    if (session.client) session.client.end()
    else if (session.end) session.end() // bare Client (pre-shell)
  } catch {
    // ignore
  }
}

export function sendInput({ tabId, data }) {
  const session = sessions.get(tabId)
  if (!session?.stream) return
  session.stream.write(data)
}

export function resizeTerminal({ tabId, cols, rows }) {
  const session = sessions.get(tabId)
  if (!session?.stream) return
  session.stream.setWindow(rows, cols, 0, 0)
}

export function getConnectedTabs() {
  return [...sessions.entries()]
    .filter(([, s]) => s.stream)
    .map(([tabId, s]) => ({ tabId, label: s.label ?? tabId, host: s.host ?? '' }))
}

export function disconnectAll() {
  for (const [tabId] of sessions) {
    disconnect({ tabId })
  }
}
