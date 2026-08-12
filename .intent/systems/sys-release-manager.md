---
id: sys-release-manager
title: Release Manager
type: system
created: 2026-08-12T00:00:00+00:00
updated: 2026-08-12T00:00:00+00:00
plans:
  - plan-phase-4-tooling
decisions:
  - DEC-0010
tags: []
---

Shows the current installed app version, the version available on the self-hosted update feed, recent release history from GitHub, and lets you trigger a new build via `workflow_dispatch` without opening GitHub in a browser. Exposes a "Check for updates now" button wired directly to `electron-updater`.

## Status: planned

## What it shows

| Item | Source |
|---|---|
| Installed version | `app.getVersion()` via IPC |
| Feed version | Parse `latest.yml` from `https://backendtcg.sixbyfive.com/admin-updates/latest.yml` |
| Recent tags | GitHub API `GET /repos/sixbyfive/sixbyfive-tcg-admin/tags` |
| CI workflow status | GitHub API `GET /repos/.../actions/runs` filtered to `release-desktop.yml` |

## GitHub PAT

A fine-grained PAT with `Contents: read` and `Actions: write` on `sixbyfive-tcg-admin` is needed to list tags, read workflow runs, and dispatch workflows. The PAT is stored as a Vault entry — the release manager fetches it at use time via `vault:getPassword` with a configured Vault entry ID. The ID is stored in `userData/release-settings.json`.

This avoids hardcoding a token anywhere outside the DPAPI-encrypted Vault store.

## IPC channels

| Channel | Direction | Payload |
|---|---|---|
| `release:getInstalledVersion` | renderer → main | → `string` |
| `release:checkForUpdates` | renderer → main | → `{ updateAvailable: boolean, version?: string }` |
| `release:triggerWorkflow` | renderer → main | `{ ref: string }` → `void` |
| `release:getSettings` | renderer → main | → `ReleaseSettings` |
| `release:saveSettings` | renderer → main | `ReleaseSettings` → `void` |

```ts
interface ReleaseSettings {
  githubOwner: string        // "sixbyfive" (or org)
  githubRepo: string         // "sixbyfive-tcg-admin"
  workflowFile: string       // "release-desktop.yml"
  patVaultId: string         // Vault entry ID for the GitHub PAT
  defaultBranch: string      // "main"
}
```

## Renderer: `ReleaseManagerPage.tsx`

Layout:
- **Version row** — installed version badge, feed version badge, "Update available" banner when feed > installed
- **Check for updates** button — calls `release:checkForUpdates`, shows result inline
- **Trigger build** panel — ref input (default: `main`), "Run workflow" button, confirmation before firing
- **Recent releases** list — tag name, date, link to GitHub tag; sourced from GitHub API
- **Recent workflow runs** — run name, status (queued / in_progress / completed), started time, conclusion (success / failure)
- **Settings** link — opens settings modal for PAT vault ID, repo details

## Files to create

- `apps/desktop/src/main/release/release.service.js` — version reads, update checks, GitHub API calls, workflow dispatch
- `apps/desktop/src/main/release/release.handlers.js`
- `apps/desktop/src/renderer/src/pages/ReleaseManagerPage.tsx`
- Route `/release` in `router/index.tsx`
- Release section in `Sidebar.tsx`
- Preload: `releaseAPI` on `window.release`
