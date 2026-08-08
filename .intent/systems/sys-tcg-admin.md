---
id: sys-tcg-admin
title: TCG Admin
type: system
created: "2026-08-09T00:00:00+00:00"
updated: "2026-08-09T00:00:00+00:00"
plans:
  - plan-unified-desktop
  - plan-phase-3-ui
decisions:
  - DEC-0003
tags: []
---

The existing admin dashboard for the SixByFive TCG marketplace. The most complete section — 20+ pages, fully working. No new features planned in this project; the work here is navigation restructuring and UI polish.

## Status: complete (feature scope); UI polish pending

## Pages (current)

| Route | Page |
|---|---|
| `/` | Dashboard |
| `/users` | Users |
| `/orders` | Orders |
| `/trades` | Trades |
| `/marketplace` | Marketplace listings |
| `/financials` | Financials |
| `/reported-users` | Reported users |
| `/audit-logs` | Audit logs |
| `/notifications` | Notifications |
| `/binders` | Binders |
| `/collections` | Collections |
| `/products` | Products |
| `/subscriptions` | Subscriptions |
| `/withdrawals` | Withdrawals |
| `/proof-queue` | Proof queue |
| `/reviews` | Reviews |
| `/sets` | Sets |
| `/services` | Services |
| `/docker` | Docker |
| `/mailboxes` | Mailboxes |

## API

Calls `backendtcg.sixbyfive.com` via `packages/api-client`. Needs JWT access token + `X-Admin-Key` header on every request. Auto-refresh via `apiClient.setRefreshCallback`.

## Files

- `apps/desktop/src/renderer/src/pages/*` — all page components
- `apps/desktop/src/renderer/src/router/index.tsx`
- `apps/desktop/src/renderer/src/components/AppShell.tsx`
- `apps/desktop/src/renderer/src/components/Sidebar.tsx` (to be updated for section nav)
- `packages/api-client/`
- `packages/types/`

## Planned changes

- Sidebar restructured to include section switcher (see [[DEC-0003]])
- Routes namespaced under `/tcg/` once multi-section routing is in place
- UI components migrated to unified design system (see [[plan-phase-3-ui]])
