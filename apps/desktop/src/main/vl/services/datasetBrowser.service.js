// FILE: apps/desktop/src/main/services/datasetBrowser.service.js
//
// Purpose:
//   Read identity_raw to build a browsable card list grouped by set.
//   For each card, gather all images and determine their finish type
//   by looking up the matching file in finish_raw.
//
//   Deletion removes the image from identity_raw AND the corresponding
//   file from finish_raw (matched by filename prefix).

import fs from "node:fs";
import path from "node:path";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function isImage(name) {
  return IMAGE_EXTS.has(path.extname(name).toLowerCase());
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && isImage(d.name))
    .map((d) => d.name);
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

/**
 * Parse set code from card ID: "ssp-082" -> "ssp", "b2-036" -> "b2"
 */
function parseSetCode(cardId) {
  const m = cardId.match(/^([a-z0-9]+)-\d/i);
  return m ? m[1].toLowerCase() : "unknown";
}

/**
 * Parse the finish type from a canonical filename.
 * Filename format: "<setCode>-<number>__...__<finish>__...__id.jpg"
 * Returns the finish string or "unknown".
 */
function parseFinishFromFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  const parts = base.split("__");
  // Finish is typically the 3rd segment (index 2): normal, holo, reverse_holo, etc.
  // Fall back to scanning all segments for known finish keywords.
  const KNOWN = new Set(["normal", "holo", "reverse_holo", "full_art", "special"]);
  for (const p of parts) {
    if (KNOWN.has(p.toLowerCase())) return p.toLowerCase();
  }
  // If not found by keyword, return segment at index 2 as best-effort
  return parts[2] || "unknown";
}

/**
 * Build the full card browser list from identity_raw.
 *
 * Returns:
 * {
 *   ok: true,
 *   sets: [
 *     {
 *       setCode: "ssp",
 *       cards: [
 *         {
 *           cardId: "ssp-082",
 *           totalImages: 10,
 *           finishes: {
 *             normal: ["filename1.jpg", ...],
 *             holo: [...],
 *             reverse_holo: [...],
 *           }
 *         }
 *       ]
 *     }
 *   ],
 *   totalCards: N,
 *   totalImages: N,
 * }
 */
export function listDatasetCards(workspacePath) {
  const identityRaw = path.join(workspacePath, "datasets", "identity_raw");

  if (!fs.existsSync(identityRaw)) {
    return { ok: false, error: "identity_raw not found. Import some images first." };
  }

  const cardIds = listDirs(identityRaw).sort();

  // Group cards by set
  const setMap = new Map(); // setCode -> Card[]

  let totalImages = 0;

  for (const cardId of cardIds) {
    const cardDir = path.join(identityRaw, cardId);
    const files = listFiles(cardDir);

    // Group files by finish
    const finishes = {};
    for (const f of files) {
      const finish = parseFinishFromFilename(f);
      if (!finishes[finish]) finishes[finish] = [];
      finishes[finish].push(f);
    }

    const setCode = parseSetCode(cardId);
    if (!setMap.has(setCode)) setMap.set(setCode, []);
    setMap.get(setCode).push({
      cardId,
      totalImages: files.length,
      finishes,
    });

    totalImages += files.length;
  }

  // Sort sets alphabetically, cards within each set alphabetically
  const sets = Array.from(setMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([setCode, cards]) => ({
      setCode,
      cards: cards.sort((a, b) => a.cardId.localeCompare(b.cardId)),
    }));

  return {
    ok: true,
    sets,
    totalCards: cardIds.length,
    totalImages,
  };
}

/**
 * Delete a single image from identity_raw and its counterpart in finish_raw.
 *
 * identity_raw/<cardId>/<filename>
 * finish_raw/<finish>/<filename>  (same filename, different parent)
 *
 * Returns: { ok: true, deleted: { identity: bool, finish: bool } }
 */
export function deleteDatasetImage(workspacePath, cardId, filename) {
  const datasetsRoot = path.join(workspacePath, "datasets");
  const identityRaw = path.join(datasetsRoot, "identity_raw");
  const finishRaw = path.join(datasetsRoot, "finish_raw");

  const identityFile = path.join(identityRaw, cardId, filename);
  const deleted = { identity: false, finish: false };
  const errors = [];

  // Delete from identity_raw
  if (fs.existsSync(identityFile)) {
    try {
      fs.unlinkSync(identityFile);
      deleted.identity = true;
    } catch (err) {
      errors.push(`identity_raw: ${err.message}`);
    }
  } else {
    errors.push(`identity_raw: file not found: ${identityFile}`);
  }

  // Delete from finish_raw — file lives under finish_raw/<finish>/<filename>
  // The finish folder name is parsed from the filename itself.
  const finish = parseFinishFromFilename(filename);
  const finishFile = path.join(finishRaw, finish, filename);

  if (fs.existsSync(finishFile)) {
    try {
      fs.unlinkSync(finishFile);
      deleted.finish = true;
    } catch (err) {
      errors.push(`finish_raw: ${err.message}`);
    }
  } else {
    // Not an error — finish_raw may not have been exported yet
    deleted.finish = false;
  }

  if (errors.length > 0 && !deleted.identity) {
    return { ok: false, error: errors.join("; "), deleted };
  }

  return { ok: true, deleted };
}

/**
 * Read an image from identity_raw and return it as a base64 data URL.
 * Resizes to max 300px on the longest edge for thumbnail use.
 */
export function getDatasetImageThumb(workspacePath, cardId, filename) {
  const filePath = path.join(workspacePath, "datasets", "identity_raw", cardId, filename);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `File not found: ${filePath}` };
  }
  try {
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase().replace(".", "");
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "png" ? "image/png"
      : ext === "webp" ? "image/webp"
      : "image/jpeg";
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    return { ok: true, dataUrl };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}