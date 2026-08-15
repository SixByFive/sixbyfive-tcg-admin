import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const SUPABASE_URL      = 'https://sunwtthpifuqncukgguq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Bi7mx1Et06oAGQQR6PI9gA_2R4BoGMc'

// Config file allows overriding the baked-in values if needed
const CONFIG_FILE = path.join(app.getPath('userData'), 'permissions-config.json')

export function getConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY }
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
    return {
      supabaseUrl:     saved.supabaseUrl     || SUPABASE_URL,
      supabaseAnonKey: saved.supabaseAnonKey || SUPABASE_ANON_KEY,
    }
  } catch {
    return { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY }
  }
}

export function saveConfig(config) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
  return { ok: true }
}

export async function fetchPermissionsForEmail(email) {
  const { supabaseUrl, supabaseAnonKey } = getConfig()

  // Not configured → grant everything so no one gets accidentally locked out
  if (!supabaseUrl || !supabaseAnonKey) return ['*']

  try {
    const url = `${supabaseUrl}/rest/v1/admin_user_roles?email=eq.${encodeURIComponent(email)}&select=admin_roles(permissions)`
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) throw new Error(`Supabase error ${res.status}`)

    const rows = await res.json()
    if (!rows || rows.length === 0) return ['*'] // user not in table → full access fallback

    const permissions = rows[0]?.admin_roles?.permissions
    return Array.isArray(permissions) ? permissions : ['*']
  } catch (err) {
    console.error('[permissions] fetch failed:', err.message)
    return ['*'] // fail open so app remains usable
  }
}

export async function listRoles() {
  const { supabaseUrl, supabaseAnonKey } = getConfig()
  if (!supabaseUrl || !supabaseAnonKey) return []

  try {
    const url = `${supabaseUrl}/rest/v1/admin_roles?select=id,name,label,permissions&order=name`
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Accept': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Supabase error ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[permissions] listRoles failed:', err.message)
    return []
  }
}
