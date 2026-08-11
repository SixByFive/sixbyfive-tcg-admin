// FILE: apps/desktop/src/main/services/exportTrainingDatasets.service.js
//
// NEW (2026-03-01)
// UPDATED (2026-03-28) — resize images to 512px on export to reduce network load
//
// Purpose:
//   Export training datasets from the Vision Lab manifest into:
//     - datasets/identity_raw/<set-number>/file.jpg
//     - datasets/finish_raw/<finish>/file.jpg
//
// Notes:
// - Resizes images to max 512px (longest side) using sharp before writing.
//   The model trains at 224px so full-res 7MB images are wasteful on the network.
// - Falls back to plain copy if sharp fails.
// - Only includes PROCESSED + LABELED images (so finish/name/set/number exist).
// - Expects canonical filename pattern you already use:
//     "<setCode>-<number>__<name>__<finish>__<stamps>__<id>.jpg"

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  readManifest,
  isLabeled,
  normalizeDatasetRel,
  resolveAbsFromManifestFile,
  safeSlug,
  normalizeFinish,
} from "./manifest.service.js";

function ensureDir(abs) {
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
}

function rmDir(abs) {
  try {
    fs.rmSync(abs, { recursive: true, force: true });
  } catch {}
}

function linkOrCopy(srcAbs, dstAbs, prefer = "hardlink") {
  if (fs.existsSync(dstAbs)) return { modeUsed: "skip_exists" };

  ensureDir(path.dirname(dstAbs));

  if (prefer === "hardlink") {
    try {
      fs.linkSync(srcAbs, dstAbs);
      return { modeUsed: "hardlink" };
    } catch {
      // fall through
    }
  }

  fs.copyFileSync(srcAbs, dstAbs);
  return { modeUsed: "copy" };
}

/**
 * Resize image to max 512px on longest side and write as JPEG.
 * Falls back to plain copy if sharp fails.
 */
async function resizeAndCopy(srcAbs, dstAbs) {
  ensureDir(path.dirname(dstAbs));
  try {
    await sharp(srcAbs)
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toFile(dstAbs);
    return { modeUsed: "resize" };
  } catch {
    fs.copyFileSync(srcAbs, dstAbs);
    return { modeUsed: "copy_fallback" };
  }
}

function getIdentityKey(img) {
  const setCode = safeSlug(img?.card?.setCode) || "unknown_set";
  const number = safeSlug(img?.card?.number) || "000";
  return `${setCode}-${number}`;
}

function getFinishKey(img) {
  const fin = normalizeFinish(img?.finish) || "unknown";
  return safeSlug(fin) || "unknown";
}

/**
 * @param {string} workspacePath
 * @param {{
 *   clean?: boolean,
 *   prefer?: "hardlink" | "copy",
 *   includeProcessedOnly?: boolean
 * }} opts
 */
export async function exportTrainingDatasets(workspacePath, opts = {}) {
  const datasetsRoot = path.join(workspacePath, "datasets");

  const identityRawAbs = path.join(datasetsRoot, "identity_raw");
  const finishRawAbs = path.join(datasetsRoot, "finish_raw");

  const clean = opts.clean !== false; // default true
  const prefer = opts.prefer === "copy" ? "copy" : "hardlink";
  const includeProcessedOnly = opts.includeProcessedOnly !== false; // default true

  const report = {
    ok: true,
    workspacePath,
    prefer,
    includeProcessedOnly,
    paths: { identityRawAbs, finishRawAbs },
    used: { hardlink: 0, copy: 0, skip_exists: 0, resize: 0, copy_fallback: 0 },
    counts: {
      scanned: 0,
      eligible: 0,
      identityFiles: 0,
      finishFiles: 0,
      skipped: 0,
      missingOnDisk: 0,
      errors: 0,
    },
    errors: [],
  };

  const manifest = readManifest(workspacePath);
  const images = Array.isArray(manifest.images) ? manifest.images : [];
  report.counts.scanned = images.length;

  if (clean) {
    rmDir(identityRawAbs);
    rmDir(finishRawAbs);
  }
  ensureDir(identityRawAbs);
  ensureDir(finishRawAbs);

  for (const img of images) {
    try {
      if (!img || typeof img !== "object") {
        report.counts.skipped++;
        continue;
      }

      if (!isLabeled(img)) {
        report.counts.skipped++;
        continue;
      }

      // Require processed marker so we only train from finalized images
      if (includeProcessedOnly && !img.processedFile) {
        report.counts.skipped++;
        continue;
      }

      const rel = normalizeDatasetRel(img.file || "");
      if (includeProcessedOnly && !rel.startsWith("processed/")) {
        report.counts.skipped++;
        continue;
      }

      const srcAbs = resolveAbsFromManifestFile(workspacePath, img.file);
      if (!srcAbs || !fs.existsSync(srcAbs)) {
        report.counts.missingOnDisk++;
        continue;
      }

      report.counts.eligible++;

      // Normalise to .jpg for resized outputs
      const base = path.basename(srcAbs, path.extname(srcAbs)) + ".jpg";

      // identity_raw/<set-number>/<file>
      const identityKey = getIdentityKey(img);
      const dstIdAbs = path.join(identityRawAbs, identityKey, base);
      let r1;
      if (fs.existsSync(dstIdAbs)) {
        r1 = { modeUsed: "skip_exists" };
      } else {
        r1 = await resizeAndCopy(srcAbs, dstIdAbs);
      }
      report.used[r1.modeUsed] = (report.used[r1.modeUsed] || 0) + 1;
      report.counts.identityFiles++;

      // finish_raw/<finish>/<file>
      const finishKey = getFinishKey(img);
      const dstFinAbs = path.join(finishRawAbs, finishKey, base);
      let r2;
      if (fs.existsSync(dstFinAbs)) {
        r2 = { modeUsed: "skip_exists" };
      } else {
        r2 = await resizeAndCopy(srcAbs, dstFinAbs);
      }
      report.used[r2.modeUsed] = (report.used[r2.modeUsed] || 0) + 1;
      report.counts.finishFiles++;
    } catch (e) {
      report.counts.errors++;
      report.errors.push(String(e?.message || e));
    }
  }

  // Basic sanity
  const hasIdentity = fs.existsSync(identityRawAbs) && fs.readdirSync(identityRawAbs).length > 0;
  const hasFinish = fs.existsSync(finishRawAbs) && fs.readdirSync(finishRawAbs).length > 0;

  if (!hasIdentity || !hasFinish) {
    report.ok = false;
    report.errors.push(
      "No exported data. Ensure you have PROCESSED + LABELED images (processedFile set) before exporting."
    );
  }

  return report;
}