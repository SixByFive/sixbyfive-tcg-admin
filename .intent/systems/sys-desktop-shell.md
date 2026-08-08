---
id: sys-desktop-shell
title: Desktop Shell
type: system
created: "2026-08-09T00:00:00+00:00"
updated: "2026-08-09T00:00:00+00:00"
plans:
  - plan-unified-desktop
  - plan-phase-2-vision-lab
decisions:
  - DEC-0001
  - DEC-0002
  - DEC-0003
tags: []
---

The Electron frame that hosts all three product sections (TCG Admin, Vision Lab, Kora Admin) in a single window. Handles the main process, IPC bridges, auto-update, and native module lifecycle.

## Status: evolving

Currently ships as `apps/desktop` in the `sixbyfive-tcg-admin` pnpm monorepo. The goal is to expand this into the unified shell without breaking the existing TCG admin functionality.

## Responsibilities

- Single `BrowserWindow` with section-level navigation in the sidebar
- Auto-update via `electron-updater` (already wired, targets `backendtcg.sixbyfive.com/admin-updates/`)
- IPC channel registry — TCG admin channels already exist; Vision Lab channels (training jobs, SSH, sharp processing) will be added here
- Native module hosting: `sharp`, `tesseract.js`, `ssh2` run in the main process (Vision Lab scope)
- Window chrome: traffic-light controls, title bar, drag region

## Electron version

Pinned to `33.4.11` today. Upgrading to `39.x` (Vision Lab's version) is required before native modules from both products can co-exist on the same binary. See [[DEC-0002]].

## Files (current)

- `apps/desktop/src/main/index.ts` — main process entry
- `apps/desktop/src/preload/index.ts` — context bridge
- `apps/desktop/electron.vite.config.ts`
- `apps/desktop/package.json` — Electron + builder config

## Planned additions

- IPC handlers for Vision Lab (training, SSH tunnels, image processing, tesseract)
- Tray icon or badge for background training job status
- Electron version bump: 33 → 39
