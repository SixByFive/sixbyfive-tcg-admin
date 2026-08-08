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

One login screen, one form, one submit. The same credentials authenticate against both the TCG API and the Kora API simultaneously.

## Status: partial — TCG auth complete, Kora auth not yet started

## Login flow

1. User enters email + password
2. `tcgAuthApi.login()` and `koraAuthApi.login()` fire in parallel
3. Each success stores a refresh token and unlocks its section
4. Both fail → "invalid credentials" on the login screen
5. One fails → that section shows a locked banner; the other works normally
6. After login, the TCG admin key prompt appears if no key is stored (existing behaviour)

## Token refresh

Each backend refreshes its own access token independently. A Kora expiry only affects the Kora section; TCG keeps working, and vice versa.

## TCG credentials

- **API:** `backendtcg.sixbyfive.com`
- **Flow:** email + password → JWT access + refresh token
- **Admin key:** shared server key on top of JWT; stored as `tcga_admin_key`; auto-prompted on 401 via `AdminKeyProvider`
- **Persistence:** `tcga_refresh` in localStorage; access token in-memory
- **Gate:** `isAdmin === true` or `role === 'ADMIN'`

## Kora credentials

- **API:** configurable `kora_base_url`
- **Flow:** same email + password → JWT access + refresh token from Kora API
- **Persistence:** `kora_refresh` in localStorage; access token in-memory
- **Gate:** `role === 'ADMIN'` in Kora platform DB

## Files (current — TCG only)

- `apps/desktop/src/renderer/src/context/AuthContext.tsx`
- `apps/desktop/src/renderer/src/context/AdminKeyContext.tsx`
- `apps/desktop/src/renderer/src/pages/LoginPage.tsx`
- `packages/api-client/src/`

## Planned additions

- `packages/kora-client/src/auth.ts`
- `apps/desktop/src/renderer/src/context/KoraAuthContext.tsx`
- `LoginPage.tsx` — parallel login calls added to existing form
