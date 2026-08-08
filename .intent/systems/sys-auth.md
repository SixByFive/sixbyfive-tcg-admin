---
id: sys-auth
title: Authentication
type: system
created: "2026-08-09T00:00:00+00:00"
updated: "2026-08-09T00:00:00+00:00"
plans:
  - plan-unified-desktop
  - plan-phase-1-kora-admin
decisions:
  - DEC-0004
tags: []
---

One login form, two backends. The user enters email + password once; the app attempts authentication against both the TCG API and the Kora API in parallel. Each success unlocks its section independently.

## Status: partial — TCG auth complete, Kora auth not yet started

## Login flow

1. User enters email + password on the login screen
2. `tcgAuthApi.login()` and `koraAuthApi.login()` fire in parallel
3. TCG success → access token in-memory, refresh token in `localStorage` (`tcga_refresh`), user stored in `AuthContext`
4. Kora success → access token in-memory, refresh token in `localStorage` (`kora_refresh`), user stored in `KoraAuthContext`
5. If both fail → login screen shows "invalid credentials"
6. If one fails → that section appears locked in the sidebar; the other section is available
7. TCG admin key prompt appears after login if no key is stored (unchanged existing behaviour)

## Credential Set 1 — TCG Admin

- **API:** `backendtcg.sixbyfive.com`
- **Login:** email + password → JWT access token + refresh token
- **Admin key:** separate shared API key for admin-tier calls; stored as `tcga_admin_key`; auto-prompted on 401 via `AdminKeyProvider`
- **Persistence:** `tcga_refresh` in localStorage; access token in-memory
- **Gate:** user must have `isAdmin === true` or `role === 'ADMIN'`

## Credential Set 2 — Kora Admin

- **API:** configurable base URL stored as `kora_base_url`; defaults to production Kora endpoint
- **Login:** same email + password → JWT access token + refresh token from Kora API
- **Admin key:** none
- **Persistence:** `kora_refresh` in localStorage; access token in-memory
- **Gate:** user must have `role === 'ADMIN'` in Kora platform DB

## Fallback: "Connect Kora"

If the user's password differs between systems, the sidebar shows a "Connect Kora" option that opens a minimal credential panel for Kora-specific credentials only. This is the edge case, not the primary path.

## Token refresh

Each backend's refresh runs independently on the same interval mechanism. A Kora token expiry only prompts re-auth for the Kora section; TCG keeps working.

## Files (current — TCG only)

- `apps/desktop/src/renderer/src/context/AuthContext.tsx`
- `apps/desktop/src/renderer/src/context/AdminKeyContext.tsx`
- `apps/desktop/src/renderer/src/pages/LoginPage.tsx`
- `packages/api-client/src/` — apiClient with token injection and refresh callback

## Planned additions

- `packages/kora-client/src/auth.ts` — Kora login, refresh, me
- `apps/desktop/src/renderer/src/context/KoraAuthContext.tsx`
- `LoginPage.tsx` updated: single form, parallel login calls, graceful partial-success handling
