---
id: sys-vision-lab
title: Vision Lab
type: system
created: "2026-08-09T00:00:00+00:00"
updated: "2026-08-09T00:00:00+00:00"
plans:
  - plan-phase-2-vision-lab
  - plan-phase-3-ui
decisions:
  - DEC-0002
  - DEC-0003
tags: []
---

ML training and testing tool for the SixByFive card recognition model. Currently a standalone Electron app in `H:\SBF-Vision-Lab`. Will be absorbed into the unified desktop as a dedicated section.

## Status: standalone — merge pending

## Source repo

`H:\SBF-Vision-Lab\apps\desktop` — Electron 39 + React JSX (no TypeScript) + custom CSS. No Tailwind, no shared design system.

## Pages

| Page | Purpose |
|---|---|
| Dataset Browser | Browse and manage the local image dataset |
| Dataset | Dataset stats and metadata |
| Process | Run image pre-processing pipelines |
| Train | Launch local or remote (SSH) training jobs |
| Test | Run inference on test images |
| Results | View training run results and metrics |
| Export | Export models or datasets |
| Settings | Infrastructure config (remote GPU host, SSH keys, paths) |

## Heavy dependencies (all run in main process)

| Package | Purpose |
|---|---|
| `@tensorflow/tfjs` | Local model training / inference |
| `sharp` | Image pre-processing (resize, normalise) |
| `tesseract.js` | OCR for card text extraction |
| `ssh2` | SSH tunnel to remote GPU host for remote training jobs |
| `chokidar` | File system watching for dataset changes |

These are native modules — they must be compiled against the target Electron version. All IPC is already isolated in the Vision Lab main process; the IPC handlers will be extracted and registered in the combined main process.

## Migration notes

- JSX → TSX: files are simple enough to migrate; no complex types needed initially
- CSS → Tailwind: page-level CSS files replaced with Tailwind utility classes
- No auth: Vision Lab has no auth; the section is available to any logged-in user of the shell
- IPC channels: `vlChannels.*` namespace to be defined in the combined preload
- Electron 39 already used by Vision Lab — the combined app will target 39 (see [[DEC-0002]])

## Files (source — pre-merge)

- `H:\SBF-Vision-Lab\apps\desktop\src\renderer\src\pages\*.jsx`
- `H:\SBF-Vision-Lab\apps\desktop\src\renderer\src\components\*.jsx`
- `H:\SBF-Vision-Lab\apps\desktop\src\renderer\src\hooks\*.js`
- `H:\SBF-Vision-Lab\apps\desktop\src\main\` — IPC handlers to be extracted
