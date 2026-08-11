// FILE: apps/desktop/src/main/vault/vault.service.js
//
// Local credential vault — persisted to userData/vault.json.
// Passwords are encrypted with Electron safeStorage (Windows DPAPI,
// macOS Keychain, Linux libsecret). Entries without passwords store null.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { app, safeStorage } from 'electron'

const VAULT_FILE = path.join(app.getPath('userData'), 'vault.json')

function canEncrypt() {
  return safeStorage.isEncryptionAvailable()
}

function loadRaw() {
  try {
    if (!fs.existsSync(VAULT_FILE)) return []
    return JSON.parse(fs.readFileSync(VAULT_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function persist(entries) {
  fs.mkdirSync(path.dirname(VAULT_FILE), { recursive: true })
  fs.writeFileSync(VAULT_FILE, JSON.stringify(entries, null, 2), 'utf-8')
}

// Returns all entries with encrypted blobs stripped — just metadata
export function listEntries() {
  return loadRaw().map(({ encryptedPassword, ...rest }) => ({
    ...rest,
    hasPassword: !!encryptedPassword,
  }))
}

// Decrypt and return the plaintext password for one entry
export function getDecryptedPassword(id) {
  const entry = loadRaw().find(e => e.id === id)
  if (!entry?.encryptedPassword) return null
  if (!canEncrypt()) return null
  try {
    return safeStorage.decryptString(Buffer.from(entry.encryptedPassword, 'base64'))
  } catch {
    return null
  }
}

// Create or update an entry. Pass plaintext password (or omit to leave unchanged).
export function saveEntry({ id, name, url, username, password, notes, category }) {
  if (!canEncrypt() && password) {
    return { ok: false, error: 'safeStorage is not available on this system.' }
  }

  const entries = loadRaw()
  const now = new Date().toISOString()

  const encryptPassword = (plain) =>
    plain ? safeStorage.encryptString(plain).toString('base64') : null

  const existingIdx = id ? entries.findIndex(e => e.id === id) : -1

  if (existingIdx >= 0) {
    const prev = entries[existingIdx]
    entries[existingIdx] = {
      ...prev,
      name:              name     !== undefined ? name     : prev.name,
      url:               url      !== undefined ? url      : prev.url,
      username:          username !== undefined ? username : prev.username,
      encryptedPassword: password !== undefined ? encryptPassword(password) : prev.encryptedPassword,
      notes:             notes    !== undefined ? notes    : prev.notes,
      category:          category !== undefined ? category : prev.category,
      updatedAt: now,
    }
  } else {
    entries.push({
      id: crypto.randomUUID(),
      name:              name     ?? '',
      url:               url      ?? '',
      username:          username ?? '',
      encryptedPassword: password ? encryptPassword(password) : null,
      notes:             notes    ?? '',
      category:          category ?? '',
      createdAt: now,
      updatedAt: now,
    })
  }

  persist(entries)
  return { ok: true }
}

export function deleteEntry(id) {
  persist(loadRaw().filter(e => e.id !== id))
  return { ok: true }
}

export function isEncryptionAvailable() {
  return canEncrypt()
}
