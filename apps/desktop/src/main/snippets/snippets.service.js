import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'

const SNIPPETS_FILE = path.join(app.getPath('userData'), 'snippets.json')

const DEFAULT_SNIPPETS = [
  {
    title: 'SSH into server',
    body: 'ssh -i ~/.ssh/id_rsa ubuntu@<host>',
    language: 'bash',
    category: 'SSH',
    tags: ['ssh', 'connect'],
  },
  {
    title: 'SSH with port forwarding',
    body: 'ssh -L <local_port>:localhost:<remote_port> ubuntu@<host>',
    language: 'bash',
    category: 'SSH',
    tags: ['ssh', 'tunnel', 'port-forward'],
  },
  {
    title: 'Copy file to server (scp)',
    body: 'scp -i ~/.ssh/id_rsa <local_file> ubuntu@<host>:<remote_path>',
    language: 'bash',
    category: 'SSH',
    tags: ['ssh', 'scp', 'upload'],
  },
]

function seed() {
  const now = new Date().toISOString()
  const snippets = DEFAULT_SNIPPETS.map(s => ({
    ...s,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }))
  fs.mkdirSync(path.dirname(SNIPPETS_FILE), { recursive: true })
  fs.writeFileSync(SNIPPETS_FILE, JSON.stringify(snippets, null, 2), 'utf-8')
  return snippets
}

function load() {
  try {
    if (!fs.existsSync(SNIPPETS_FILE)) return seed()
    return JSON.parse(fs.readFileSync(SNIPPETS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function persist(snippets) {
  fs.mkdirSync(path.dirname(SNIPPETS_FILE), { recursive: true })
  fs.writeFileSync(SNIPPETS_FILE, JSON.stringify(snippets, null, 2), 'utf-8')
}

export function listSnippets() {
  return load()
}

export function saveSnippet({ id, title, body, language, category, tags }) {
  const snippets = load()
  const now = new Date().toISOString()
  const idx = id ? snippets.findIndex(s => s.id === id) : -1

  if (idx >= 0) {
    snippets[idx] = { ...snippets[idx], title, body, language, category, tags, updatedAt: now }
  } else {
    snippets.push({ id: crypto.randomUUID(), title, body, language: language ?? '', category: category ?? '', tags: tags ?? [], createdAt: now, updatedAt: now })
  }

  persist(snippets)
  return { ok: true }
}

export function deleteSnippet(id) {
  persist(load().filter(s => s.id !== id))
  return { ok: true }
}
