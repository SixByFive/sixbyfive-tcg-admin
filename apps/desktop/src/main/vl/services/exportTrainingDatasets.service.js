// FILE: apps/desktop/src/main/services/exportTrainingDatasets.service.js
//
// Exports training datasets from the Vision Lab manifest into:
//
//   datasets/detection_raw/          — YOLO format (card + nameRegion + numberRegion)
//     images/  *.jpg
//     labels/  *.txt  (class cx cy w h, all values normalized 0–1)
//
//   datasets/finish_raw/<finish>/    — classifier, one folder per finish
//
//   datasets/stamps_raw/<stamp>/     — classifier, one folder per stamp
//                                      ("none" for images with no stamps)
//
// YOLO class map:
//   0 = card
//   1 = nameRegion
//   2 = numberRegion
//
// Notes:
// - Images are resized to max 512px (longest side) before export.
// - Detection export skips images without bbox annotations.
// - Finish/stamp export skips images without processedFile.
// - All three datasets are cleaned and rebuilt on each call (clean: true default).

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  readManifest,
  isLabeled,
  isBboxLabeled,
  normalizeDatasetRel,
  resolveAbsFromManifestFile,
  safeSlug,
  normalizeFinish,
  normalizeStamp,
} from "./manifest.service.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

function ensureDir(abs) {
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
}

function rmDir(abs) {
  try { fs.rmSync(abs, { recursive: true, force: true }); } catch {}
}

async function resizeAndCopy(srcAbs, dstAbs, cardBbox = null) {
  ensureDir(path.dirname(dstAbs));
  try {
    let pipeline = sharp(srcAbs);
    // Crop to card bbox before resizing so classifiers train on card-only pixels
    if (cardBbox && Array.isArray(cardBbox) && cardBbox.length === 4) {
      const [x, y, w, h] = cardBbox.map(Math.round);
      if (w > 4 && h > 4) {
        pipeline = pipeline.extract({ left: Math.max(0, x), top: Math.max(0, y), width: w, height: h });
      }
    }
    await pipeline
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toFile(dstAbs);
    return "resize";
  } catch {
    fs.copyFileSync(srcAbs, dstAbs);
    return "copy_fallback";
  }
}

async function getImageDimensions(srcAbs) {
  try {
    const meta = await sharp(srcAbs).metadata();
    return { w: meta.width, h: meta.height };
  } catch {
    return null;
  }
}

// bbox is [x, y, w, h] in pixels (top-left origin, pre-resize)
// We re-derive cx/cy/nw/nh from pixel values but we need the *resized* dims.
// Since we resize to fit 512px on the longest side, scale factor is the same
// for both axes — the YOLO ratios are invariant to uniform scaling, so we can
// compute them from original pixel dimensions directly.
function toYoloLine(classId, bbox, imgW, imgH) {
  const [x, y, w, h] = bbox;
  const cx = (x + w / 2) / imgW;
  const cy = (y + h / 2) / imgH;
  const nw = w / imgW;
  const nh = h / imgH;
  return `${classId} ${cx.toFixed(6)} ${cy.toFixed(6)} ${nw.toFixed(6)} ${nh.toFixed(6)}`;
}

function getFinishKey(img) {
  return safeSlug(normalizeFinish(img?.finish) || "unknown") || "unknown";
}

function getStampKeys(img) {
  const stamps = Array.isArray(img?.stamps) ? img.stamps : [];
  const norm = stamps.map(normalizeStamp).filter(Boolean);
  const uniq = Array.from(new Set(norm));
  return uniq.length > 0 ? uniq : ["none"];
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * @param {string} workspacePath
 * @param {{
 *   clean?: boolean,
 *   prefer?: "hardlink" | "copy",
 *   includeProcessedOnly?: boolean
 * }} opts
 */
export async function exportTrainingDatasets(workspacePath, opts = {}) {
  const datasetsRoot     = path.join(workspacePath, "datasets");
  const detectionRawAbs  = path.join(datasetsRoot, "detection_raw");
  const finishRawAbs     = path.join(datasetsRoot, "finish_raw");
  const stampsRawAbs     = path.join(datasetsRoot, "stamps_raw");

  const clean               = opts.clean !== false;
  const includeProcessedOnly = opts.includeProcessedOnly !== false;

  const report = {
    ok: true,
    workspacePath,
    paths: { detectionRawAbs, finishRawAbs, stampsRawAbs },
    counts: {
      scanned: 0,
      eligible: 0,
      detectionFiles: 0,
      finishFiles: 0,
      stampFiles: 0,
      skippedNoBbox: 0,
      skippedUnlabeled: 0,
      skippedMissingFile: 0,
      errors: 0,
    },
    errors: [],
  };

  const manifest = readManifest(workspacePath);
  const images   = Array.isArray(manifest.images) ? manifest.images : [];
  report.counts.scanned = images.length;

  if (clean) {
    rmDir(detectionRawAbs);
    rmDir(finishRawAbs);
    rmDir(stampsRawAbs);
  }

  ensureDir(path.join(detectionRawAbs, "images"));
  ensureDir(path.join(detectionRawAbs, "labels"));
  ensureDir(finishRawAbs);
  ensureDir(stampsRawAbs);

  for (const img of images) {
    try {
      if (!img || typeof img !== "object") continue;

      const srcAbs = resolveAbsFromManifestFile(workspacePath, img.file);
      if (!srcAbs || !fs.existsSync(srcAbs)) {
        report.counts.skippedMissingFile++;
        continue;
      }

      const rel = normalizeDatasetRel(img.file || "");
      if (includeProcessedOnly && !rel.startsWith("processed/")) {
        report.counts.skippedUnlabeled++;
        continue;
      }

      const base = path.basename(srcAbs, path.extname(srcAbs)) + ".jpg";

      // ── Detection (YOLO) ───────────────────────────────────────────────────
      // Requires bbox annotation
      if (isBboxLabeled(img)) {
        const dims = await getImageDimensions(srcAbs);
        if (dims) {
          const imgDst   = path.join(detectionRawAbs, "images", base);
          const labelDst = path.join(detectionRawAbs, "labels", base.replace(/\.jpg$/, ".txt"));

          if (!fs.existsSync(imgDst)) {
            await resizeAndCopy(srcAbs, imgDst);
          }

          if (!fs.existsSync(labelDst)) {
            const lines = [
              toYoloLine(0, img.bbox.card,         dims.w, dims.h),
              toYoloLine(1, img.bbox.nameRegion,   dims.w, dims.h),
              toYoloLine(2, img.bbox.numberRegion, dims.w, dims.h),
            ];
            fs.writeFileSync(labelDst, lines.join("\n") + "\n", "utf8");
          }

          report.counts.detectionFiles++;
        }
      } else {
        report.counts.skippedNoBbox++;
      }

      // Finish and stamp exports require full labeling
      if (!isLabeled(img)) {
        report.counts.skippedUnlabeled++;
        continue;
      }

      report.counts.eligible++;

      // Card bbox crop — used by finish and stamps classifiers when available
      const cardBbox = Array.isArray(img.bbox?.card) && img.bbox.card.length === 4
        ? img.bbox.card
        : null;

      // ── Finish classifier ──────────────────────────────────────────────────
      const finishKey = getFinishKey(img);
      const finishDst = path.join(finishRawAbs, finishKey, base);
      if (!fs.existsSync(finishDst)) {
        await resizeAndCopy(srcAbs, finishDst, cardBbox);
      }
      report.counts.finishFiles++;

      // ── Stamps classifier ──────────────────────────────────────────────────
      for (const stampKey of getStampKeys(img)) {
        const stampDst = path.join(stampsRawAbs, stampKey, base);
        if (!fs.existsSync(stampDst)) {
          await resizeAndCopy(srcAbs, stampDst, cardBbox);
        }
        report.counts.stampFiles++;
      }
    } catch (e) {
      report.counts.errors++;
      report.errors.push(String(e?.message || e));
    }
  }

  const hasDetection = fs.readdirSync(path.join(detectionRawAbs, "images")).length > 0;
  const hasFinish    = fs.existsSync(finishRawAbs) && fs.readdirSync(finishRawAbs).length > 0;
  const hasStamps    = fs.existsSync(stampsRawAbs) && fs.readdirSync(stampsRawAbs).length > 0;

  if (!hasDetection && !hasFinish && !hasStamps) {
    report.ok = false;
    report.errors.push(
      "No data exported. Add PROCESSED + LABELED images with bbox annotations before training."
    );
  }

  return report;
}
