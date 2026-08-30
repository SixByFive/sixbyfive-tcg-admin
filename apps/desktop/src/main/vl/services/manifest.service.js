// FILE: apps/desktop/src/main/services/manifest.service.js
//
// UPDATED (2026-03-14) — IN-MEMORY MANIFEST + ASYNC WRITES
//
// CHANGES:
// - ADD: In-memory manifest cache (_manifestCache). After the first load, all
//        reads are instant Map lookups — zero network I/O per request.
// - ADD: getManifestCached(workspacePath) — returns the in-memory copy, loading
//        from disk once if not yet cached.
// - ADD: writeManifestAsync(workspacePath, manifest) — updates the in-memory
//        copy immediately (so subsequent reads see the change), then schedules
//        a debounced async disk write that runs in the background without
//        blocking the main process thread.
// - ADD: flushManifest(workspacePath) — force an immediate async disk write,
//        used on app quit / workspace change.
// - KEEP: readManifest / writeManifest still exist for compatibility with any
//         callers not yet updated, but readManifest now returns from cache,
//         and writeManifest delegates to writeManifestAsync.
// - KEEP: atomicWriteJson, readJson, all helpers — unchanged.

import path from "node:path";
import fs from "node:fs";

export function getManifestPath(workspacePath) {
  return path.join(workspacePath, "datasets", "dataset.json");
}

export function createEmptyManifest() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    counters: { nextImageNumber: 1 },
    classes: [],
    images: [],
  };
}

export function normalizeStamp(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-+]/g, "")
    .replace(/^[_-]+|[_-]+$/g, "");
}

export function normalizeFinish(f) {
  const v = String(f || "").trim().toLowerCase();
  if (!v) return null;
  return v.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_");
}

export function healManifest(maybe) {
  const m = maybe && typeof maybe === "object" ? maybe : {};
  let changed = false;

  if (typeof m.version !== "number") { m.version = 1; changed = true; }
  if (!m.createdAt) { m.createdAt = new Date().toISOString(); changed = true; }
  if (!m.updatedAt) { m.updatedAt = new Date().toISOString(); changed = true; }

  if (!m.counters || typeof m.counters !== "object") {
    m.counters = { nextImageNumber: 1 }; changed = true;
  }
  if (typeof m.counters.nextImageNumber !== "number" || m.counters.nextImageNumber < 1) {
    m.counters.nextImageNumber = 1; changed = true;
  }

  if (!Array.isArray(m.classes)) { m.classes = []; changed = true; }
  if (!Array.isArray(m.images)) { m.images = []; changed = true; }

  for (const img of m.images) {
    if (!img || typeof img !== "object") continue;

    if (!("id" in img)) { img.id = null; changed = true; }
    if (!("file" in img)) { img.file = null; changed = true; }
    if (!("rawFile" in img)) { img.rawFile = null; changed = true; }
    if (!("hash" in img)) { img.hash = null; changed = true; }
    if (!("class" in img)) { img.class = null; changed = true; }
    if (!("addedAt" in img)) { img.addedAt = null; changed = true; }
    if (!("source" in img)) { img.source = "local"; changed = true; }
    if (!("r2Key" in img)) { img.r2Key = null; changed = true; }
    if (!("cachedAt" in img)) { img.cachedAt = null; changed = true; }
    if (!("storage" in img)) { img.storage = null; changed = true; }
    if (!("processedFile" in img)) { img.processedFile = null; changed = true; }

    if (!("card" in img) || !img.card || typeof img.card !== "object") {
      img.card = { setCode: "", number: "", name: "", total: "" }; changed = true;
    } else {
      if (!("setCode" in img.card)) { img.card.setCode = ""; changed = true; }
      if (!("number" in img.card)) { img.card.number = ""; changed = true; }
      if (!("name" in img.card)) { img.card.name = ""; changed = true; }
      if (!("total" in img.card)) { img.card.total = ""; changed = true; }
    }

    if (!("bbox" in img)) {
      img.bbox = null; changed = true;
    }

    if (!("finish" in img)) {
      img.finish = null; changed = true;
    } else {
      const nf = img.finish == null ? null : normalizeFinish(img.finish);
      if (nf !== img.finish) { img.finish = nf; changed = true; }
    }

    if (!("stamps" in img)) {
      img.stamps = []; changed = true;
    } else if (!Array.isArray(img.stamps)) {
      img.stamps = []; changed = true;
    } else {
      const norm = img.stamps.map(normalizeStamp).filter(Boolean);
      const uniq = Array.from(new Set(norm)).sort();
      if (JSON.stringify(uniq) !== JSON.stringify(img.stamps)) {
        img.stamps = uniq; changed = true;
      }
    }
  }

  if (changed) m._changed = true;
  return m;
}

/* ─────────────────────────────────────────────
   JSON I/O (kept synchronous for startup only)
   ───────────────────────────────────────────── */

export function readJson(p) {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

export function atomicWriteJson(p, data) {
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp.${path.basename(p)}.${process.pid}.${Date.now()}`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, p);
}

/* ─────────────────────────────────────────────
   Async JSON write (background, non-blocking)
   ───────────────────────────────────────────── */

async function atomicWriteJsonAsync(p, data) {
  const dir = path.dirname(p);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp.${path.basename(p)}.${process.pid}.${Date.now()}`);
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.promises.rename(tmp, p);
}

/* ─────────────────────────────────────────────
   In-memory manifest cache
   ───────────────────────────────────────────── */

// workspacePath → manifest object
const _manifestCache = new Map();

// workspacePath → pending debounce timer
const _writeTimers = new Map();

// workspacePath → last in-flight write promise (for flush)
const _writePromises = new Map();

const WRITE_DEBOUNCE_MS = 800; // coalesce rapid successive writes

/**
 * Load manifest from disk once, cache it, return the cached copy on all
 * subsequent calls. Zero network I/O after the first load.
 */
export function getManifestCached(workspacePath) {
  if (_manifestCache.has(workspacePath)) {
    return _manifestCache.get(workspacePath);
  }

  // First call — read from disk (this is the only blocking network read
  // after startup, and it only happens once per session).
  const manifestPath = getManifestPath(workspacePath);
  const m = readJson(manifestPath);
  const healed = healManifest(m);

  if (healed._changed) {
    delete healed._changed;
    healed.updatedAt = new Date().toISOString();
    // Schedule an async write to persist the heal — don't block here.
    _scheduleWrite(workspacePath, healed);
  }

  _manifestCache.set(workspacePath, healed);
  return healed;
}

/**
 * Update the in-memory manifest immediately, then schedule a debounced
 * background write. The calling handler returns to the renderer instantly;
 * the disk write happens in the background.
 */
export function writeManifestAsync(workspacePath, manifest) {
  manifest.updatedAt = new Date().toISOString();
  _manifestCache.set(workspacePath, manifest);
  _scheduleWrite(workspacePath, manifest);
}

/**
 * Invalidate the cache for a workspace (e.g. after user changes workspace).
 */
export function invalidateManifestCache(workspacePath) {
  _manifestCache.delete(workspacePath);
  // Cancel any pending write for this workspace
  const t = _writeTimers.get(workspacePath);
  if (t) { clearTimeout(t); _writeTimers.delete(workspacePath); }
}

/**
 * Force an immediate write to disk (use on app quit / workspace switch).
 * Returns a promise that resolves when the write is complete.
 */
export async function flushManifest(workspacePath) {
  // Cancel pending debounce
  const t = _writeTimers.get(workspacePath);
  if (t) { clearTimeout(t); _writeTimers.delete(workspacePath); }

  // Wait for any in-flight write
  const inflight = _writePromises.get(workspacePath);
  if (inflight) { try { await inflight; } catch {} }

  // Write current in-memory state now
  const manifest = _manifestCache.get(workspacePath);
  if (!manifest) return;

  await _doWrite(workspacePath, manifest);
}

function _scheduleWrite(workspacePath, manifest) {
  // Cancel existing debounce
  const existing = _writeTimers.get(workspacePath);
  if (existing) clearTimeout(existing);

  const t = setTimeout(() => {
    _writeTimers.delete(workspacePath);
    const p = _doWrite(workspacePath, manifest);
    _writePromises.set(workspacePath, p);
    p.finally(() => {
      if (_writePromises.get(workspacePath) === p) {
        _writePromises.delete(workspacePath);
      }
    });
  }, WRITE_DEBOUNCE_MS);

  _writeTimers.set(workspacePath, t);
}

async function _doWrite(workspacePath, manifest) {
  try {
    const manifestPath = getManifestPath(workspacePath);
    await atomicWriteJsonAsync(manifestPath, manifest);
  } catch (err) {
    console.error("[VisionLab][manifest] Background write failed:", err.message);
  }
}

/* ─────────────────────────────────────────────
   Legacy API — kept for compatibility
   readManifest now reads from cache (fast).
   writeManifest now delegates to async write.
   ───────────────────────────────────────────── */

export function readManifest(workspacePath) {
  return getManifestCached(workspacePath);
}

export function writeManifest(workspacePath, manifest) {
  writeManifestAsync(workspacePath, manifest);
}

/* ─────────────────────────────────────────────
   Shared helpers (unchanged)
   ───────────────────────────────────────────── */

export function isLabeled(img) {
  return (
    !!String(img?.card?.setCode || "").trim() &&
    !!String(img?.card?.number || "").trim() &&
    !!String(img?.card?.name || "").trim() &&
    !!String(img?.finish || "").trim()
  );
}

export function isBboxLabeled(img) {
  const b = img?.bbox;
  return !!(b && Array.isArray(b.card) && b.card.length === 4 &&
            Array.isArray(b.nameRegion) && b.nameRegion.length === 4 &&
            Array.isArray(b.numberRegion) && b.numberRegion.length === 4);
}

export function safeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]+/g, "")
    .replace(/^[_-]+|[_-]+$/g, "");
}

export function normalizeDatasetRel(f) {
  return String(f || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^datasets\//, "");
}

export function resolveAbsFromManifestFile(workspacePath, manifestFile) {
  if (!manifestFile) return null;
  const rel = normalizeDatasetRel(manifestFile);
  return path.join(workspacePath, "datasets", rel);
}

export function buildCanonicalRawFilename(img, currentFileAbs) {
  const ext = path.extname(currentFileAbs || "").toLowerCase() || ".jpg";
  const setCode = safeSlug(img?.card?.setCode);
  const number = safeSlug(img?.card?.number);
  const name = safeSlug(img?.card?.name);
  const finish = normalizeFinish(img?.finish) || "unknown";
  const stampsArr = Array.isArray(img?.stamps) ? img.stamps : [];
  const stampsNorm = stampsArr.map(normalizeStamp).filter(Boolean);
  const stampsUniq = Array.from(new Set(stampsNorm)).sort();
  const stampPart = stampsUniq.length ? stampsUniq.join("+") : "nostamp";
  const id = safeSlug(img?.id || "img");
  return `${setCode}-${number}__${name}__${finish}__${stampPart}__${id}${ext}`;
}

export function applyMetaPatchToImage(img, patch) {
  const next = { ...img };
  if (patch && typeof patch === "object") {
    if ("finish" in patch) {
      next.finish = patch.finish == null ? null : normalizeFinish(patch.finish);
    }
    if ("stamps" in patch) {
      const arr = Array.isArray(patch.stamps) ? patch.stamps : [];
      const norm = arr.map(normalizeStamp).filter(Boolean);
      next.stamps = Array.from(new Set(norm)).sort();
    }
    if ("card" in patch) {
      const c = patch.card && typeof patch.card === "object" ? patch.card : {};
      next.card = {
        ...(next.card || { setCode: "", number: "", name: "", total: "" }),
        setCode: String(c.setCode ?? next.card?.setCode ?? ""),
        number: String(c.number ?? next.card?.number ?? ""),
        name: String(c.name ?? next.card?.name ?? ""),
        total: String(c.total ?? next.card?.total ?? ""),
      };
    }
    if ("bbox" in patch) {
      const b = patch.bbox;
      if (b === null) {
        next.bbox = null;
      } else if (b && typeof b === "object") {
        const validBox = (v) => Array.isArray(v) && v.length === 4 ? v.map(Number) : null;
        next.bbox = {
          card:         validBox(b.card)         ?? next.bbox?.card         ?? null,
          nameRegion:   validBox(b.nameRegion)   ?? next.bbox?.nameRegion   ?? null,
          numberRegion: validBox(b.numberRegion) ?? next.bbox?.numberRegion ?? null,
        };
      }
    }
  }
  return next;
}

export function mimeFromExt(ext) {
  const e = String(ext || "").toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
}