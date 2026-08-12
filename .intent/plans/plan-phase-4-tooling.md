---
id: plan-phase-4-tooling
title: Phase 4 — Developer Tooling
type: plan
status: active
created: 2026-08-12T00:00:00+00:00
updated: 2026-08-12T00:00:00+00:00
decisions:
  - DEC-0007
  - DEC-0008
  - DEC-0009
  - DEC-0010
systems:
  - sys-ssh-terminal
  - sys-snippets
  - sys-status-board
  - sys-release-manager
constraints: []
tags: []
---

Add four developer-focused sections to the unified admin desktop: SSH Terminal, Snippets, Status Board, and Release Manager. These are standalone sections in the sidebar alongside TCG, Kora, VL, and Vault — no auth gate, available to any logged-in user.

## Sections

### SSH Terminal [`sys-ssh-terminal`]
A tabbed SSH terminal within the app. Uses the existing `ssh2` dependency already in `apps/desktop/package.json`. Replaces the current workflow of opening a separate terminal client to connect to Heimdall or the deploy server. Connections are defined in settings (host, user, key) and stored in userData.

### Snippets [`sys-snippets`]
A searchable library of saved text snippets — bash commands, SQL queries, curl calls, cron expressions, whatever. Stored locally in `userData/snippets.json`. Like Vault but for text, not credentials. One-click copy. Optionally tagged and categorised.

### Status Board [`sys-status-board`]
A single "is everything up" view. Polls the TCG API, Kora API, Heimdall SSH, and optionally individual Docker services. Shows last-checked time, response time, and colour-coded up/degraded/down state. Auto-refreshes on a configurable interval.

### Release Manager [`sys-release-manager`]
Shows the current installed app version, the version on the update feed, recent release tags from the GitHub API, and lets you trigger a `workflow_dispatch` build from within the app. Also exposes a "Check for updates now" button wired to `electron-updater`.

## Sequencing

Any order — these are independent. Suggested order: Status Board (no new IPC needed, renderer-only for most of it) → Snippets (same storage pattern as Vault, low effort) → Release Manager (GitHub API + one new IPC channel) → SSH Terminal (most complex — xterm.js, main-process IPC, connection management).

## Tasks

### SSH Terminal
- [ ] Add `xterm` and `xterm-addon-fit` to `apps/desktop/package.json`
- [ ] Add `sys-ssh-terminal` section to sidebar and router (`/ssh/*`)
- [ ] Main process: `src/main/ssh/ssh.service.js` — connection lifecycle, channel multiplexing
- [ ] Main process: `src/main/ssh/ssh.handlers.js` — IPC: `ssh:connect`, `ssh:disconnect`, `ssh:data`, `ssh:resize`
- [ ] Preload: add `sshAPI` to context bridge
- [ ] Renderer: `SshTerminalPage.tsx` — connection list sidebar, active tab per connection, xterm instance per tab
- [ ] Renderer: `SshConnectionsPage.tsx` (Settings sub-page) — add/edit/delete saved connections
- [ ] Connection config stored in `userData/ssh-connections.json` (host, port, username, auth method, key path or password reference to Vault)

### Snippets
- [ ] Main process: `src/main/snippets/snippets.service.js` — CRUD on `userData/snippets.json`
- [ ] Main process: `src/main/snippets/snippets.handlers.js` — IPC: `snippets:list`, `snippets:save`, `snippets:delete`
- [ ] Preload: add `snippetsAPI` to context bridge
- [ ] Renderer: `SnippetsPage.tsx` — searchable list, category sidebar, add/edit modal, one-click copy
- [ ] No encryption needed — snippets are not secrets

### Status Board
- [ ] Renderer: `StatusBoardPage.tsx` — polling loop, service tiles, last-checked badge
- [ ] IPC: `status:check` — main process pings each endpoint (avoids CORS for HTTP checks); SSH check via `ssh2` connection attempt
- [ ] Configuration: which endpoints to check stored in `userData/status-targets.json`
- [ ] Default targets: TCG API (`/health`), Kora API (`/health`), Heimdall SSH

### Release Manager
- [ ] IPC: `release:checkUpdate` — calls `autoUpdater.checkForUpdates()`, returns result
- [ ] IPC: `release:getInstalledVersion` — returns `app.getVersion()`
- [ ] IPC: `release:triggerWorkflowDispatch` — GitHub API `POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches` using a stored PAT
- [ ] Renderer: `ReleaseManagerPage.tsx` — installed version, feed version, release history list, trigger build button
- [ ] GitHub PAT stored in Vault (fetched via `vault:getPassword` by ID)

## Definition of done

- All four sections navigable from the sidebar with no auth gate
- SSH Terminal connects to Heimdall and the deploy server from saved connections
- Snippets: add, edit, delete, search, copy — all working
- Status Board shows live state for at least TCG API, Kora API, Heimdall
- Release Manager shows correct installed version, can trigger a build, surfaces update-available notification
