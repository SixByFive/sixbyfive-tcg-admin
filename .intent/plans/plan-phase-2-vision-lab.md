---
id: plan-phase-2-vision-lab
title: Phase 2 — Vision Lab Merge
type: plan
status: draft
created: "2026-08-09T00:00:00+00:00"
updated: "2026-08-09T00:00:00+00:00"
decisions:
  - DEC-0002
  - DEC-0003
tags: []
---

Absorb the SixByFive Vision Lab (`H:\SBF-Vision-Lab\apps\desktop`) into the unified desktop. The main challenges are the Electron version bump and the main-process native module/IPC migration.

## Tasks

### Electron upgrade (do first, before any Vision Lab code lands)
- [ ] **Bump Electron** — `apps/desktop/package.json`: `33.4.11` → `^39.0.0`
- [ ] **Rebuild deps** — run `pnpm install` then verify all TCG admin pages still work
- [ ] **Smoke test** — manual check of 5+ TCG admin pages, auto-update ping

### Main process — native deps
- [ ] **Add Vision Lab native deps** to `apps/desktop/package.json`: `sharp`, `tesseract.js`, `ssh2`, `chokidar`, `@tensorflow/tfjs`
- [ ] **Extract Vision Lab IPC handlers** from `H:\SBF-Vision-Lab\apps\desktop\src\main\` — copy into `apps/desktop/src/main/` under a `vl/` subdirectory
- [ ] **Register VL IPC channels** in the combined main process entry (`src/main/index.ts`)
- [ ] **Extend preload** — add `vlChannels` namespace to the context bridge alongside existing `tcgChannels` (or equivalent)

### Renderer — page migration
- [ ] **Copy VL page files** from `H:\SBF-Vision-Lab\apps\desktop\src\renderer\src\` into `apps/desktop/src/renderer/src/pages/vl/` and `components/vl/`
- [ ] **Rename `.jsx` → `.tsx`** — minimal TS (add `any` types where needed; clean up later in Phase 3)
- [ ] **Remove VL custom CSS imports** — strip `import '../assets/*.css'` from copied files
- [ ] **Restyle with Tailwind** — replace class names with Tailwind equivalents; aim for functional parity first, polish in Phase 3
- [ ] **VL hooks migration** — `useWorkspace.js`, `useImporter.js` → `.ts`, update IPC calls to use new bridge
- [ ] **VL sub-router** — `apps/desktop/src/renderer/src/router/vl.tsx`; routes under `/vl/*`
- [ ] **Sidebar VL section** — replace the "coming soon" placeholder from Phase 1 with real VL nav items

### Validation
- [ ] **Train page** — verify a local training job completes end-to-end
- [ ] **SSH / remote job** — verify remote job dispatch and progress polling works
- [ ] **Dataset browser** — verify file watching and image display work
- [ ] **Test page** — verify inference runs on a sample image

## Definition of done

- Vision Lab section fully functional in the combined app
- All native deps build correctly against Electron 39
- TCG admin and Kora admin sections unaffected
- No remaining imports from `H:\SBF-Vision-Lab`
