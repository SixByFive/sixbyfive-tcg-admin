---
id: plan-unified-desktop
title: Unified SixByFive Admin Desktop
type: plan
status: active
created: "2026-08-09T00:00:00+00:00"
updated: "2026-08-09T00:00:00+00:00"
decisions:
  - DEC-0001
  - DEC-0002
  - DEC-0003
  - DEC-0004
tags: []
---

Combine TCG Admin dashboard, Vision Lab, and a new Kora Admin panel into a single Electron desktop application with a unified design system. The existing TCG admin monorepo (`sixbyfive-tcg-admin`) is the base.

## Phases

### Phase 1 — Kora Admin section [`plan-phase-1-kora-admin`]
Add the Kora care platform admin panel as a new section. Lowest risk: no existing code is touched, just additive work.

### Phase 2 — Vision Lab merge [`plan-phase-2-vision-lab`]
Absorb the Vision Lab standalone app into the monorepo. Requires Electron version bump and main-process IPC changes.

### Phase 3 — UI polish & design system [`plan-phase-3-ui`]
Unify the visual language across all three sections. Cleaner sidebar, consistent components, improved typography and spacing.

## Sequencing rationale

Phase 1 first because it's purely additive — the Kora section can be built and used without touching any existing code. Phase 2 second because the Electron upgrade (required for Vision Lab native deps) carries the most risk and should land before the UI work so that polish isn't done twice. Phase 3 last because it touches every component.

## Constraints

- The `admin-mobile` Expo app in the monorepo must not be broken at any phase
- Auto-update must keep working throughout — no release should ship without a working update check
- The TCG admin section must remain fully functional during all phases (no feature freeze)

## Success criteria

- One desktop app installs and auto-updates
- Three sections navigable from a single sidebar
- TCG Admin and Kora Admin each have independent login flows that work independently
- Vision Lab trains and tests models with the same capability as the standalone app
- The UI is noticeably cleaner and more consistent than either existing app
