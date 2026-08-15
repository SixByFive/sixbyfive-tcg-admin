import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { app } from 'electron'
import { getDecryptedPassword } from '../vault/vault.service.js'

const PROJECTS_FILE = path.join(app.getPath('userData'), 'release-projects.json')
const RELEASES_FILE = path.join(app.getPath('userData'), 'release-history.json')
const GITHUB_API    = 'https://api.github.com'

// ── Projects ──────────────────────────────────────────────────────────────────

function loadProjects() {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) return []
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'))
  } catch { return [] }
}

function persistProjects(projects) {
  fs.mkdirSync(path.dirname(PROJECTS_FILE), { recursive: true })
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8')
}

export function listProjects() {
  return loadProjects()
}

export function saveProject({ id, name, description, githubOwner, githubRepo, workflowFile, defaultBranch, patVaultId }) {
  const projects = loadProjects()
  const now = new Date().toISOString()
  const existingIdx = id ? projects.findIndex(p => p.id === id) : -1
  let resultId

  if (existingIdx >= 0) {
    resultId = projects[existingIdx].id
    projects[existingIdx] = {
      ...projects[existingIdx],
      name:          name          ?? projects[existingIdx].name,
      description:   description   ?? projects[existingIdx].description,
      githubOwner:   githubOwner   ?? projects[existingIdx].githubOwner,
      githubRepo:    githubRepo    ?? projects[existingIdx].githubRepo,
      workflowFile:  workflowFile  ?? projects[existingIdx].workflowFile,
      defaultBranch: defaultBranch ?? projects[existingIdx].defaultBranch,
      patVaultId:    patVaultId    ?? projects[existingIdx].patVaultId,
      updatedAt: now,
    }
  } else {
    resultId = crypto.randomUUID()
    projects.push({ id: resultId, name: name ?? '', description: description ?? '', githubOwner: githubOwner ?? '', githubRepo: githubRepo ?? '', workflowFile: workflowFile ?? '', defaultBranch: defaultBranch ?? 'main', patVaultId: patVaultId ?? '', createdAt: now, updatedAt: now })
  }

  persistProjects(projects)
  return { ok: true, id: resultId }
}

export function deleteProject(id) {
  persistProjects(loadProjects().filter(p => p.id !== id))
  // Also remove all releases for this project
  persistReleases(loadReleases().filter(r => r.projectId !== id))
  return { ok: true }
}

// ── Releases ──────────────────────────────────────────────────────────────────

function loadReleases() {
  try {
    if (!fs.existsSync(RELEASES_FILE)) return []
    return JSON.parse(fs.readFileSync(RELEASES_FILE, 'utf-8'))
  } catch { return [] }
}

function persistReleases(releases) {
  fs.mkdirSync(path.dirname(RELEASES_FILE), { recursive: true })
  fs.writeFileSync(RELEASES_FILE, JSON.stringify(releases, null, 2), 'utf-8')
}

export function listReleases(projectId) {
  return loadReleases().filter(r => r.projectId === projectId)
}

export function saveRelease({ id, projectId, version, title, notes, status, releasedAt, gitTag, repoUrl, workflowUrl }) {
  const releases = loadReleases()
  const now = new Date().toISOString()
  const existingIdx = id ? releases.findIndex(r => r.id === id) : -1
  let resultId

  if (existingIdx >= 0) {
    resultId = releases[existingIdx].id
    const prev = releases[existingIdx]
    releases[existingIdx] = {
      ...prev,
      version:     version     !== undefined ? version     : prev.version,
      title:       title       !== undefined ? title       : prev.title,
      notes:       notes       !== undefined ? notes       : prev.notes,
      status:      status      !== undefined ? status      : prev.status,
      releasedAt:  releasedAt  !== undefined ? releasedAt  : prev.releasedAt,
      gitTag:      gitTag      !== undefined ? gitTag      : prev.gitTag,
      repoUrl:     repoUrl     !== undefined ? repoUrl     : prev.repoUrl,
      workflowUrl: workflowUrl !== undefined ? workflowUrl : prev.workflowUrl,
      updatedAt: now,
    }
  } else {
    resultId = crypto.randomUUID()
    releases.push({ id: resultId, projectId, version: version ?? '', title: title ?? '', notes: notes ?? '', status: status ?? 'draft', releasedAt: releasedAt ?? null, gitTag: gitTag ?? '', repoUrl: repoUrl ?? '', workflowUrl: workflowUrl ?? '', createdAt: now, updatedAt: now })
  }

  persistReleases(releases)
  return { ok: true, id: resultId }
}

export function deleteRelease(id) {
  persistReleases(loadReleases().filter(r => r.id !== id))
  return { ok: true }
}

// ── GitHub (optional per project) ────────────────────────────────────────────

function getProject(projectId) {
  const project = loadProjects().find(p => p.id === projectId)
  if (!project) throw new Error('Project not found')
  return project
}

function getPat(project) {
  if (!project.patVaultId) throw new Error('No GitHub PAT configured for this project.')
  const pat = getDecryptedPassword(project.patVaultId)
  if (!pat) throw new Error('Could not decrypt GitHub PAT from Vault.')
  return pat
}

async function githubFetch(url, pat, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub ${res.status}: ${body || res.statusText}`)
  }
  return res.status === 204 ? null : res.json()
}

export async function listTags(projectId) {
  const p   = getProject(projectId)
  const pat = getPat(p)
  const data = await githubFetch(`${GITHUB_API}/repos/${p.githubOwner}/${p.githubRepo}/tags?per_page=10`, pat)
  return data.map(t => ({ name: t.name, sha: t.commit?.sha?.slice(0, 7) ?? '' }))
}

export async function listWorkflowRuns(projectId) {
  const p   = getProject(projectId)
  const pat = getPat(p)
  const data = await githubFetch(
    `${GITHUB_API}/repos/${p.githubOwner}/${p.githubRepo}/actions/workflows/${p.workflowFile}/runs?per_page=8`,
    pat
  )
  return (data.workflow_runs ?? []).map(r => ({
    id: r.id, displayTitle: r.display_title, status: r.status, conclusion: r.conclusion,
    createdAt: r.created_at, headBranch: r.head_branch, runNumber: r.run_number,
    url: r.html_url,
  }))
}

export async function triggerWorkflow(projectId, ref) {
  const p   = getProject(projectId)
  const pat = getPat(p)
  await githubFetch(
    `${GITHUB_API}/repos/${p.githubOwner}/${p.githubRepo}/actions/workflows/${p.workflowFile}/dispatches`,
    pat,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref }) }
  )
  return { ok: true }
}
