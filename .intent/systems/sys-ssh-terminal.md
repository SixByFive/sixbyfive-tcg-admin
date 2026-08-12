---
id: sys-ssh-terminal
title: SSH Terminal
type: system
created: 2026-08-12T00:00:00+00:00
updated: 2026-08-12T00:00:00+00:00
plans:
  - plan-phase-4-tooling
decisions:
  - DEC-0007
tags: []
---

A multi-tab SSH terminal section inside the admin desktop. Replaces the separate terminal client workflow for connecting to Heimdall and the deploy server. Uses the `ssh2` package already present as a production dependency.

## Status: planned

## Architecture

SSH I/O runs entirely in the main process. The renderer hosts an `xterm.js` instance per tab and communicates via IPC. This keeps SSH sockets out of the sandboxed renderer and avoids exposing raw Node streams through the context bridge.

```
Renderer (xterm.js)
  ↕ IPC  (ssh:data, ssh:input, ssh:resize, ssh:connect, ssh:disconnect)
Main process (ssh2 client)
  ↕ TCP
Remote SSH server
```

## Saved connections

Stored in `userData/ssh-connections.json`. Each entry:

| Field | Notes |
|---|---|
| `id` | UUID |
| `label` | Display name ("Heimdall", "Deploy server") |
| `host` | Hostname or IP |
| `port` | Default 22 |
| `username` | SSH user |
| `authMethod` | `"key"` or `"password"` |
| `keyPath` | Absolute path to private key file (auth method: key) |
| `vaultId` | ID of a Vault entry whose password is used (auth method: password) |

No private key material is stored in the JSON — only the path. Password auth references a Vault entry so the password is DPAPI-encrypted at rest.

## IPC channels

| Channel | Direction | Payload |
|---|---|---|
| `ssh:connect` | renderer → main | `{ connectionId, tabId }` |
| `ssh:disconnect` | renderer → main | `{ tabId }` |
| `ssh:input` | renderer → main | `{ tabId, data: string }` |
| `ssh:resize` | renderer → main | `{ tabId, cols, rows }` |
| `ssh:data` | main → renderer | `{ tabId, data: string }` |
| `ssh:status` | main → renderer | `{ tabId, status: 'connected'\|'disconnected'\|'error', message? }` |

## Renderer pages

- `SshTerminalPage.tsx` — main terminal view; connection picker on left, xterm tabs on right
- Nested under `/ssh/terminal`

## Settings pages

- `SshConnectionsPage.tsx` — list, add, edit, delete saved connections
- Nested under `/ssh/connections`

## Dependencies

| Package | Already in `package.json`? |
|---|---|
| `ssh2` | Yes |
| `xterm` | No — add to devDependencies |
| `xterm-addon-fit` | No — add to devDependencies |

## Files to create

- `apps/desktop/src/main/ssh/ssh.service.js` — connection lifecycle, multiplexing by tabId
- `apps/desktop/src/main/ssh/ssh.handlers.js` — registers IPC channels
- `apps/desktop/src/renderer/src/pages/ssh/SshTerminalPage.tsx`
- `apps/desktop/src/renderer/src/pages/ssh/SshConnectionsPage.tsx`
- Routes under `/ssh/*` in `router/index.tsx`
- SSH section in `Sidebar.tsx`
