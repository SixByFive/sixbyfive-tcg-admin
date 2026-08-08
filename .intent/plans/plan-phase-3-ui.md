---
id: plan-phase-3-ui
title: Phase 3 — UI Polish & Design System
type: plan
status: draft
created: "2026-08-09T00:00:00+00:00"
updated: "2026-08-09T00:00:00+00:00"
decisions:
  - DEC-0003
tags: []
---

Unify and improve the visual design across all three sections. The goal is a noticeably cleaner, more consistent look — not a brand new design language, but a deliberate upgrade over what exists.

## Design direction

- Tighter, more considered spacing (less padding waste, better information density)
- Consistent typography scale (one heading style, one body style, one label style — no ad-hoc font sizes)
- Sidebar redesign: section switcher at the top with icons, collapsible, section label above nav group
- Subtle surface hierarchy: window chrome → sidebar → content area → card — each one step lighter/darker
- Dark-mode first (already the case), but make it intentional
- Remove visual noise: fewer borders, more whitespace as separator

## Tasks

### Design tokens & base styles
- [ ] **Audit Tailwind CSS variables** in `apps/desktop/src/renderer/src/index.css` — clean up unused vars, add missing semantic tokens (e.g. `--sidebar-bg`, `--card-bg`, `--surface-hover`)
- [ ] **Typography scale** — establish 4 text styles used everywhere: `text-xs` (labels/metadata), `text-sm` (body/table), `text-base` (page headings), `text-lg` (section titles); remove any ad-hoc size overrides

### Sidebar
- [ ] **Section switcher** — icon tabs at top of sidebar; active section highlighted; tooltips on hover
- [ ] **Nav item style** — single line, icon + label, subtle active indicator (left border or background pill)
- [ ] **Collapse/expand** — sidebar can collapse to icon-only mode for more content width
- [ ] **Bottom slot** — user avatar / logout; admin key badge; connection status dots for each system

### Shared components
- [ ] **`<PageHeader>`** — consistent page title + breadcrumb + action slot used by every page
- [ ] **`<DataTable>`** — unified table with pagination, loading skeleton, empty state; replaces per-page table implementations
- [ ] **`<StatTile>`** — shared stat card used by all dashboards (count + label + trend)
- [ ] **`<Badge>`** — status badges (active/inactive/pending) with consistent colour mapping
- [ ] **`<EmptyState>`** — consistent empty/no-results state with icon + message

### Per-section polish
- [ ] **TCG Admin** — migrate existing pages to use `<PageHeader>`, `<DataTable>`, `<StatTile>`; clean up any inline styles
- [ ] **Kora Admin** — built in Phase 1 already using Tailwind; minor alignment fixes only
- [ ] **Vision Lab** — was restyled functionally in Phase 2; apply full design system pass here

### Login screen
- [ ] **Redesign login** — product wordmark, clean card layout, subtle animated background or gradient; clearly shows which systems are connected

## Definition of done

- All three sections visually consistent — a designer picking up the app would not identify them as three separate products
- Sidebar collapses cleanly and works at all three section levels
- `<DataTable>`, `<PageHeader>`, `<StatTile>` used across all pages with no per-page reimplementations
- Dark mode is crisp, not just "dark colours slapped on"
