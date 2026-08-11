// FILE: apps/desktop/src/main/ipc/handlers/process.handlers.js
//
// UPDATED (2026-03-14) — REMOVE PRUNE FROM HOT PATH
//
// CHANGES:
// - REMOVE: pruneMissingImages() from updateImageMeta and renameRawFiles.
//           It did fs.existsSync on every image file across the network share
//           on every save/rename — 200-1000 synchronous network stat calls.
// - KEEP: pruneMissingImages only in getProcessItems (user-triggered load/refresh).
// - KEEP: All rename, patch, write logic unchanged.

import { ensureWorkspaceOnStartup } from "../services/workspace.service.js";
import {
  readManifest,
  writeManifest,
  applyMetaPatchToImage,
  isLabeled,
  normalizeDatasetRel,
  resolveAbsFromManifestFile,
  buildCanonicalRawFilename,
  safeSlug,
  normalizeFinish,
} from "../services/manifest.service.js";

import {
  setCachedManifest,
  invalidateThumbnailCache,
} from "./preview.handlers.js";

import fs from "node:fs";
import path from "node:path";

function ensureDir(dirAbs) {
  if (!fs.existsSync(dirAbs)) fs.mkdirSync(dirAbs, { recursive: true });
}

function uniquePath(dirAbs, baseName) {
  const ext = path.extname(baseName);
  const stem = ext ? baseName.slice(0, -ext.length) : baseName;

  let candidate = path.join(dirAbs, baseName);
  if (!fs.existsSync(candidate)) return { abs: candidate, name: baseName };

  for (let i = 2; i < 10000; i++) {
    const nextName = `${stem}_${i}${ext}`;
    const nextAbs = path.join(dirAbs, nextName);
    if (!fs.existsSync(nextAbs)) return { abs: nextAbs, name: nextName };
  }

  throw new Error("Could not find a unique filename for processed output");
}

// Only called from getProcessItems (explicit load/refresh), never from hot handlers.
function pruneMissingImages(workspacePath, manifest) {
  const before = Array.isArray(manifest.images) ? manifest.images.length : 0;
  if (!before) return { changed: false, removed: 0, cleared: 0 };

  const kept = [];
  let removed = 0;
  let cleared = 0;

  for (const img of manifest.images) {
    const fileAbs = resolveAbsFromManifestFile(workspacePath, img?.file);
    const fileExists = !!fileAbs && fs.existsSync(fileAbs);

    const rawRel = normalizeDatasetRel(img?.rawFile || "");
    const rawAbs = rawRel ? path.join(workspacePath, "datasets", rawRel) : null;
    const rawExists = !!rawAbs && fs.existsSync(rawAbs);

    if (!fileExists && img?.file) {
      img.file = null;
      if (img?.processedFile) img.processedFile = null;
      cleared++;
    }

    if (!rawExists && img?.rawFile) {
      img.rawFile = null;
      cleared++;
    }

    const stillHasSomething = fileExists || rawExists || img.file || img.rawFile;
    if (!stillHasSomething) {
      removed++;
      continue;
    }

    kept.push(img);
  }

  if (removed || cleared) {
    manifest.images = kept;
    return { changed: true, removed, cleared };
  }

  return { changed: false, removed: 0, cleared: 0 };
}

function getProcessedSubdir(img) {
  const finish = normalizeFinish(img?.finish) || "unknown";
  const finishDir = safeSlug(finish) || "unknown";
  return finishDir;
}

function writeAndCache(workspacePath, manifest) {
  writeManifest(workspacePath, manifest);
  setCachedManifest(workspacePath, manifest);
}

/* ─────────────────────────────────────────────
   getProcessItems — prune runs here only
   ───────────────────────────────────────────── */

export async function getProcessItems() {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    const manifest = readManifest(workspacePath);

    const pruned = pruneMissingImages(workspacePath, manifest);
    if (pruned.changed) {
      writeAndCache(workspacePath, manifest);
      console.log("[VisionLab][main] pruned:", {
        removed: pruned.removed,
        cleared: pruned.cleared,
      });
    } else {
      setCachedManifest(workspacePath, manifest);
    }

    const images = (manifest.images || []).slice().sort((a, b) => {
      const ap = a?.processedFile ? 1 : 0;
      const bp = b?.processedFile ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });

    return { ok: true, workspacePath, images };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/* ─────────────────────────────────────────────
   updateImageMeta — no prune, just patch + write
   ───────────────────────────────────────────── */

export async function updateImageMeta(_evt, payload) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    const id = String(payload?.id || "").trim();
    const patch = payload?.patch || null;

    if (!id) return { ok: false, error: "Missing id" };

    const manifest = readManifest(workspacePath);

    const idx = (manifest.images || []).findIndex((x) => String(x?.id || "") === id);
    if (idx === -1) return { ok: false, error: `Image not found: ${id}` };

    const next = applyMetaPatchToImage(manifest.images[idx], patch);
    manifest.images[idx] = next;
    writeAndCache(workspacePath, manifest);

    return { ok: true, image: next };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/* ─────────────────────────────────────────────
   renameRawFiles — no prune, just move + write
   ───────────────────────────────────────────── */

export async function renameRawFiles(_evt, payload) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    const ids = Array.isArray(payload?.ids) ? payload.ids.map(String) : [];
    if (!ids.length) return { ok: false, error: "No ids provided" };

    const manifest = readManifest(workspacePath);
    const byId = new Map(
      (manifest.images || []).map((img) => [String(img?.id || ""), img])
    );

    const results = { ok: true, renamed: [], moved: [], skipped: [], errors: [] };

    const processedRoot = path.join(workspacePath, "datasets", "processed");
    ensureDir(processedRoot);

    for (const id of ids) {
      const img = byId.get(id);
      if (!img) { results.skipped.push({ id, reason: "Not found" }); continue; }

      const fileKey = normalizeDatasetRel(img.file || "");
      if (!fileKey.startsWith("raw/")) {
        results.skipped.push({ id, reason: "Not in raw/" });
        continue;
      }

      if (!isLabeled(img)) {
        results.skipped.push({ id, reason: "Missing set/number/name/finish" });
        continue;
      }

      const abs = resolveAbsFromManifestFile(workspacePath, img.file);
      if (!abs || !fs.existsSync(abs)) {
        results.errors.push({ id, error: "File missing on disk" });
        continue;
      }

      if (!img.rawFile) {
        img.rawFile = normalizeDatasetRel(img.file || "");
      }

      const canonicalName = buildCanonicalRawFilename(img, abs);
      const subdirPosix = getProcessedSubdir(img);
      const targetDirAbs = path.join(processedRoot, subdirPosix);

      ensureDir(targetDirAbs);

      let target;
      try {
        target = uniquePath(targetDirAbs, canonicalName);
      } catch (e) {
        results.errors.push({ id, error: String(e?.message || e) });
        continue;
      }

      await fs.promises.rename(abs, target.abs);

      invalidateThumbnailCache(id);

      const processedRel = path.posix.join("processed", subdirPosix, target.name);
      img.file = processedRel;
      img.processedFile = processedRel;

      results.renamed.push({ id, file: img.file });
      results.moved.push({ id, processedFile: img.processedFile });
    }

    if (results.renamed.length || results.moved.length) {
      writeAndCache(workspacePath, manifest);
    }

    results.counts = {
      renamed: results.renamed.length,
      moved: results.moved.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
    };

    return results;
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}