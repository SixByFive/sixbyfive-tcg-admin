---
id: sys-snippets
title: Snippets
type: system
created: 2026-08-12T00:00:00+00:00
updated: 2026-08-12T00:00:00+00:00
plans:
  - plan-phase-4-tooling
decisions:
  - DEC-0008
tags: []
---

A searchable local library of saved text snippets — bash commands, SQL queries, curl calls, cron expressions, API request templates, etc. Stored in `userData/snippets.json`. No encryption; snippets are not secrets (use Vault for passwords).

## Status: planned

## Data model

Each snippet:

```ts
interface Snippet {
  id: string          // UUID
  title: string       // Short display name
  body: string        // The snippet text (multi-line)
  language?: string   // Optional syntax hint: "bash", "sql", "json", "text"
  category?: string   // User-defined group label
  tags?: string[]     // Free-form tags for search
  createdAt: string   // ISO timestamp
  updatedAt: string   // ISO timestamp
}
```

## Storage

`userData/snippets.json` — same pattern as `userData/vault.json`. No encryption. Main process reads/writes; renderer accesses via IPC only.

## IPC channels

| Channel | Payload |
|---|---|
| `snippets:list` | → `Snippet[]` |
| `snippets:save` | `Snippet (partial, id optional)` → saved `Snippet` |
| `snippets:delete` | `{ id }` → `void` |

## Renderer

`SnippetsPage.tsx` — single-page layout:

- Left sidebar: category list + "All" + search box
- Right panel: snippet cards — title, truncated body preview, language badge, copy button
- Add/Edit modal: title, body (textarea with monospace font), language select, category, tags
- Copy button decodes nothing — just copies `snippet.body` to clipboard directly

## No auth gate

Available to any logged-in user of the desktop shell. No separate connection required.

## Files to create

- `apps/desktop/src/main/snippets/snippets.service.js`
- `apps/desktop/src/main/snippets/snippets.handlers.js`
- `apps/desktop/src/renderer/src/pages/SnippetsPage.tsx`
- Route `/snippets` in `router/index.tsx`
- Snippets section in `Sidebar.tsx`
- Preload: `snippetsAPI` on `window.snippets`
