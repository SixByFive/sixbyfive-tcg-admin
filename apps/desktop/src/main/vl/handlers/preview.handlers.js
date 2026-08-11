// FILE: apps/desktop/src/main/ipc/handlers/preview.handlers.js
//
// UPDATED (2026-03-14) — PERFORMANCE OVERHAUL
//
// CHANGES:
// - ADD: In-process manifest cache — manifest.json is no longer read from disk/network
//        on every thumbnail request. Invalidated whenever writeManifest is called.
// - ADD: getThumbnailDataUrl — returns a ~160px-wide JPEG thumbnail via sharp.
//        Thumbnails are cached in memory (LRU, 500 item cap) so repeated
//        requests for the same image never hit the network share again.
// - ADD: getImageDataUrl now also uses the manifest cache (no repeated disk reads).
// - KEEP: getImageDataUrl still returns full-res for the preview panel.
// - KEEP: same IPC surface — no changes to preload or ipc.js needed beyond
//         registering the new getThumbnailDataUrl handler.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

import { ensureWorkspaceOnStartup } from "../services/workspace.service.js";
import {
  readManifest,
  resolveAbsFromManifestFile,
  mimeFromExt,
} from "../services/manifest.service.js";

/* ─────────────────────────────────────────────
   Manifest cache
   One read per workspace load, not one per request.
   Call invalidateManifestCache() from any handler
   that calls writeManifest().
   ───────────────────────────────────────────── */

let _cachedWorkspacePath = null;
let _cachedManifest = null;

export function invalidateManifestCache() {
  _cachedManifest = null;
}

function getCachedManifest(workspacePath) {
  if (_cachedManifest && _cachedWorkspacePath === workspacePath) {
    return _cachedManifest;
  }
  _cachedManifest = readManifest(workspacePath);
  _cachedWorkspacePath = workspacePath;
  return _cachedManifest;
}

// Call this from process.handlers.js after every writeManifest() call.
// Export so other handlers can use it.
export function setCachedManifest(workspacePath, manifest) {
  _cachedWorkspacePath = workspacePath;
  _cachedManifest = manifest;
}

/* ─────────────────────────────────────────────
   Thumbnail LRU cache
   Keeps resized JPEGs in memory so the network
   share is only hit once per image per session.
   ───────────────────────────────────────────── */

const THUMB_CACHE_MAX = 500;
const THUMB_WIDTH = 160; // px — enough for the list column thumbnail

const _thumbCache = new Map(); // id → base64 string

function getThumbFromCache(id) {
  if (!_thumbCache.has(id)) return null;
  // Move to end (LRU)
  const v = _thumbCache.get(id);
  _thumbCache.delete(id);
  _thumbCache.set(id, v);
  return v;
}

function setThumbInCache(id, b64) {
  if (_thumbCache.has(id)) _thumbCache.delete(id);
  _thumbCache.set(id, b64);
  // Evict oldest if over cap
  if (_thumbCache.size > THUMB_CACHE_MAX) {
    const oldest = _thumbCache.keys().next().value;
    _thumbCache.delete(oldest);
  }
}

export function invalidateThumbnailCache(id) {
  if (id) _thumbCache.delete(id);
  else _thumbCache.clear();
}

/* ─────────────────────────────────────────────
   In-flight coalescing
   If two requests for the same thumbnail arrive
   simultaneously (e.g. scroll + prefetch), only
   one hits the disk. The second awaits the first.
   ───────────────────────────────────────────── */

const _thumbInFlight = new Map(); // id → Promise<base64>

/* ─────────────────────────────────────────────
   Helper: resolve image abs path from manifest
   ───────────────────────────────────────────── */

function resolveImageAbs(workspacePath, id) {
  const manifest = getCachedManifest(workspacePath);
  const img = (manifest.images || []).find((x) => String(x?.id || "") === id);
  if (!img) return { error: `Not found: ${id}` };

  const abs = resolveAbsFromManifestFile(workspacePath, img.file);
  if (!abs || !fs.existsSync(abs)) return { error: "Image file missing on disk" };

  return { abs, img };
}

/* ─────────────────────────────────────────────
   Handler: getThumbnailDataUrl
   Returns a ~160px JPEG thumbnail as a data URL.
   Cached in memory after first fetch.
   ───────────────────────────────────────────── */

export async function getThumbnailDataUrl(_evt, payload) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    const id = String(payload?.id || "").trim();
    if (!id) return { ok: false, error: "Missing id" };

    // 1. Memory cache hit — instant return, zero I/O
    const cached = getThumbFromCache(id);
    if (cached) {
      return { ok: true, dataUrl: `data:image/jpeg;base64,${cached}` };
    }

    // 2. Coalesce in-flight duplicates
    if (_thumbInFlight.has(id)) {
      const b64 = await _thumbInFlight.get(id);
      return b64
        ? { ok: true, dataUrl: `data:image/jpeg;base64,${b64}` }
        : { ok: false, error: "Thumbnail generation failed" };
    }

    // 3. Generate thumbnail
    const work = (async () => {
      const { abs, error } = resolveImageAbs(workspacePath, id);
      if (error) return null;

      try {
        const buf = await sharp(abs)
          .resize(THUMB_WIDTH, null, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 75, mozjpeg: false })
          .toBuffer();

        const b64 = buf.toString("base64");
        setThumbInCache(id, b64);
        return b64;
      } catch {
        return null;
      }
    })();

    _thumbInFlight.set(id, work);
    try {
      const b64 = await work;
      return b64
        ? { ok: true, dataUrl: `data:image/jpeg;base64,${b64}` }
        : { ok: false, error: "Thumbnail generation failed" };
    } finally {
      _thumbInFlight.delete(id);
    }
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/* ─────────────────────────────────────────────
   Handler: getImageDataUrl  (full-res, unchanged)
   Still used by the preview panel on the right.
   Now uses manifest cache so it doesn't re-parse
   dataset.json from the network share each time.
   ───────────────────────────────────────────── */

export async function getImageDataUrl(_evt, payload) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    const id = String(payload?.id || "").trim();
    if (!id) return { ok: false, error: "Missing id" };

    const { abs, error } = resolveImageAbs(workspacePath, id);
    if (error) return { ok: false, error };

    const mime = mimeFromExt(path.extname(abs));
    const buf = fs.readFileSync(abs);
    const b64 = buf.toString("base64");

    return { ok: true, dataUrl: `data:${mime};base64,${b64}` };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}