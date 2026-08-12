---
id: sys-status-board
title: Status Board
type: system
created: 2026-08-12T00:00:00+00:00
updated: 2026-08-12T00:00:00+00:00
plans:
  - plan-phase-4-tooling
decisions:
  - DEC-0009
tags: []
---

A consolidated "is everything up" view. Polls configured endpoints and SSH hosts on a timer, displays colour-coded up/degraded/down state with last-checked time and response latency. No WebSockets or push; all polling is pull-based from the main process.

## Status: planned

## Why main process does the checking

HTTP checks fired from the renderer hit Electron's CORS policy for cross-origin requests. Running checks in the main process avoids this entirely, and the SSH reachability check needs Node.js (`ssh2`) anyway. The renderer only displays results pushed to it.

## Default targets

| Label | Type | Check |
|---|---|---|
| TCG API | HTTP | `GET https://backendtcg.sixbyfive.com/health` |
| Kora API | HTTP | `GET https://api.koraplatform.co.uk/health` (or configured `VITE_KORA_API_URL`) |
| Heimdall | SSH | TCP connect to saved SSH connection host:port (no shell) |
| Deploy server | SSH | TCP connect to `$DEPLOY_HOST:22` |

Additional targets can be added in settings — any HTTP URL or SSH connection reference.

## Status states

| State | Colour | Meaning |
|---|---|---|
| `up` | Green | HTTP 2xx or TCP connect succeeded |
| `degraded` | Amber | HTTP 2xx but response time > threshold (default 2000 ms) |
| `down` | Red | Connection refused, timeout, or non-2xx response |
| `unknown` | Grey | Never checked or check in progress |

## Data flow

```
Renderer loads StatusBoardPage
  → IPC: status:checkAll
Main process checks each target (HTTP fetch / TCP connect)
  → IPC push: status:results  { results: ServiceStatus[] }
Renderer updates tiles
Auto-refresh: renderer fires status:checkAll every N seconds (configurable, default 60)
```

## IPC channels

| Channel | Direction | Payload |
|---|---|---|
| `status:checkAll` | renderer → main | void |
| `status:results` | main → renderer | `ServiceStatus[]` |
| `status:getTargets` | renderer → main | → `StatusTarget[]` |
| `status:saveTarget` | renderer → main | `StatusTarget` |
| `status:deleteTarget` | renderer → main | `{ id }` |

```ts
interface StatusTarget {
  id: string
  label: string
  type: 'http' | 'ssh'
  url?: string          // HTTP targets
  sshConnectionId?: string  // References sys-ssh-terminal saved connection
  degradedThresholdMs?: number
}

interface ServiceStatus {
  targetId: string
  state: 'up' | 'degraded' | 'down' | 'unknown'
  responseMs?: number
  checkedAt: string
  error?: string
}
```

## Target storage

`userData/status-targets.json` — same pattern as other local data files. Default targets seeded on first run if file doesn't exist.

## Renderer

`StatusBoardPage.tsx`:
- Grid of service tiles (label, state indicator, response time, last-checked time)
- "Check now" button triggers immediate `status:checkAll`
- Auto-refresh interval selector (30s / 60s / 5m / off)
- Add target modal

## Files to create

- `apps/desktop/src/main/status/status.service.js`
- `apps/desktop/src/main/status/status.handlers.js`
- `apps/desktop/src/renderer/src/pages/StatusBoardPage.tsx`
- Route `/status` in `router/index.tsx`
- Status section in `Sidebar.tsx`
- Preload: `statusAPI` on `window.status`
