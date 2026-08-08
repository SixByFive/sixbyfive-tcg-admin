---
id: sys-kora-admin
title: Kora Admin
type: system
created: "2026-08-09T00:00:00+00:00"
updated: "2026-08-09T00:00:00+00:00"
plans:
  - plan-phase-1-kora-admin
  - plan-phase-3-ui
decisions:
  - DEC-0004
  - DEC-0005
  - DEC-0006
tags: []
---

Admin panel for the Kora care platform API (`H:\care-platform-api`). A new section in the unified desktop — no frontend exists yet. Modelled after the TCG Admin pattern (pages + sidebar + typed API client).

## Status: not started

## Kora API overview

NestJS + PostgreSQL (multi-tenant: one platform DB + one DB per care home). Auth via JWT (email/password → access + refresh tokens). Admin users have `role: ADMIN` in the platform DB.

## GDPR boundary

This panel is **platform administration only**. Resident-level data (young people, care records, medication, incidents, etc.) must never be surfaced here — that data belongs to authorised care staff via the Kora application, not a developer admin tool. Similarly, raw `TenantDatabase` connection strings and DB-level provisioning actions are excluded. See [[DEC-0006]].

## Planned pages

| Page | Covers |
|---|---|
| Dashboard | Org count, home count, user count, recent registrations |
| Organisations | List and view care organisations |
| Homes | List care homes with org, slug, provisioning status (DB exists yes/no — no care data) |
| Users | Platform users with role badges |
| Audit | System event log |
| Docker | Container/service health — same pattern as TCG `DockerPage` |

## API client

A new `packages/kora-client` will be added to the monorepo alongside the existing `packages/api-client`. It will follow the same pattern: typed fetch wrapper, token injection, refresh callback.

The Kora API base URL is configurable (dev vs production) and stored in desktop settings.

## Auth

See [[sys-auth]] — Credential Set 2. Kora login uses the same email/password → JWT flow as TCG but against the Kora API.

## API source

`H:\care-platform-api\src\` — NestJS modules for the entities above. Auth endpoints at `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`.

## Files (to be created)

- `packages/kora-client/src/` — typed API client
- `apps/desktop/src/renderer/src/pages/kora/` — page components
- `apps/desktop/src/renderer/src/context/KoraAuthContext.tsx`
- `apps/desktop/src/renderer/src/router/kora.tsx` — sub-router
