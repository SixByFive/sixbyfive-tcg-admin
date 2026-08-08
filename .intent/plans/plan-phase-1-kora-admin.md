---
id: plan-phase-1-kora-admin
title: Phase 1 — Kora Admin Section
type: plan
status: active
created: "2026-08-09T00:00:00+00:00"
updated: "2026-08-09T00:00:00+00:00"
decisions:
  - DEC-0003
  - DEC-0004
  - DEC-0005
  - DEC-0006
tags: []
---

Add the Kora care platform admin panel as a new section in the existing desktop app. Fully additive — no existing TCG admin code is modified except the router and sidebar.

## Scope note

Resident-level data (young people, care records) and raw tenancy/database provisioning details are excluded from this panel. Viewing that data in a standalone desktop tool would breach GDPR — resident records must only be accessed through the Kora application by authorised staff. This panel covers platform administration only: organisations, homes (as entities, not their care data), and platform users.

## Tasks

- [ ] **Rename app package** — `apps/desktop/package.json`: `@tcg-admin/desktop` → `@sixbyfive/desktop`; update turbo and workspace references
- [ ] **Section switcher in sidebar** — add a top-level section selector (TCG Admin | Vision Lab | Kora Admin) to `Sidebar.tsx`; Vision Lab shows as "coming soon" and Kora shows as locked until credentials are set
- [ ] **Route namespacing** — prefix all existing TCG routes with `/tcg/` (e.g. `/users` → `/tcg/users`); update all `<Link>` and `navigate()` calls; no page component changes needed
- [ ] **`packages/kora-client`** — scaffold new workspace package: KoraApiClient, auth endpoints (login, refresh, me), typed entity fetchers for orgs, homes, users
- [ ] **`KoraAuthContext`** — new context following `AuthContext.tsx` pattern; `kora_refresh` in localStorage; checks `role === 'ADMIN'`; exposes `koraUser`, `koraLogin`, `koraLogout`
- [ ] **Login screen update** — single email + password form fires parallel login calls to both TCG and Kora APIs; each success unlocks its section; add a "Connect Kora" fallback in the sidebar for the edge case where credentials differ between systems
- [ ] **Kora sub-router** — `apps/desktop/src/renderer/src/router/kora.tsx`; routes under `/kora/*`
- [ ] **Kora Dashboard page** — org count, home count, user count stat tiles; recent registrations list
- [ ] **Kora Organisations page** — paginated table, search, view/expand row
- [ ] **Kora Homes page** — list all care homes with org, slug, and provisioning status (DB exists yes/no); no care data
- [ ] **Kora Users page** — platform users with role badges (ADMIN, ORG_MANAGER, etc.)
- [ ] **Kora Audit page** — system event log (if Kora API exposes one)
- [ ] **Kora Docker page** — container/service health status; same pattern as the existing TCG `DockerPage.tsx`
- [ ] **Kora section locked state** — if `KoraAuthContext` has no user, Kora pages redirect to a "Connect Kora" screen rather than showing an error

## API endpoints to implement in kora-client

Reference `H:\care-platform-api\src\` for exact paths. Priority order:

1. `POST /auth/login` + `POST /auth/refresh` + `GET /auth/me`
2. `GET /organisations` + `GET /organisations/:id`
3. `GET /homes` + `GET /homes/:id`
4. `GET /users`
5. Docker / health endpoints

## Definition of done

- Kora section fully navigable with real data from a running Kora API instance
- TCG admin section completely unaffected
- Kora login/logout works independently of TCG login
- Sidebar shows all three sections; Kora locks gracefully if not connected
- No resident or tenancy DB data exposed anywhere in the panel
