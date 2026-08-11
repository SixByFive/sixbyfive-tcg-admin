// FILE: apps/desktop/src/main/services/import.service.js
//
// UPDATED (2026-03-13)
//
// CHANGES
// - CHANGED: sha256File() now streams files instead of reading entire files into memory.
// - CHANGED: importImagesToWorkspace() is now async and awaits stream hashing.
// - CHANGED: blob temp import remains serial to avoid stacking memory spikes.
// - ADDED: optional maxFilesPerRun guard for safer imports on low-memory machines.
// - KEPT: SHA-256 hashing + duplicate detection
// - KEPT: import into datasets/raw with canonical ids
// - KEPT: blob fallback import helper

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

import { ensureWorkspaceStructure } from "./workspace.service.js";
import { readManifest, writeManifest } from "./manifest.service.js";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_MAX_FILES_PER_RUN = 250; // safety guard for low-memory machines

function isLikelyImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.has(ext);
}

/**
 * Stream file contents into the hash instead of loading the entire file into RAM.
 */
function sha256FileStream(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function nextRawFilename(manifest, originalPath) {
  const ext = path.extname(originalPath).toLowerCase() || ".jpg";
  const num = manifest.counters.nextImageNumber;
  const base = `img_${String(num).padStart(6, "0")}${ext}`;
  manifest.counters.nextImageNumber += 1;
  return base;
}

/**
 * Imports base64 blobs into temp files under datasets/raw,
 * returning absolute file paths to feed into importImagesToWorkspace().
 *
 * NOTE:
 * This still decodes base64 in memory, which is unavoidable with the current payload shape.
 * The bigger long-term fix is to stop sending large image batches as base64 from the renderer,
 * and instead pass file paths directly whenever possible.
 */
export function importBlobsToTempFiles(workspacePath, fileBlobs) {
  const outPaths = [];
  const rawDir = path.join(workspacePath, "datasets", "raw");

  fs.mkdirSync(rawDir, { recursive: true });

  for (const b of fileBlobs || []) {
    try {
      const originalName = (b?.name || "dropped.jpg").toString();
      const dataBase64 = (b?.dataBase64 || "").toString();

      if (!dataBase64) {
        console.warn("[VisionLab][main] blob missing dataBase64, skipping:", originalName);
        continue;
      }

      let ext = path.extname(originalName || "").toLowerCase();
      if (!SUPPORTED_IMAGE_EXTENSIONS.has(ext)) ext = ".jpg";

      const tmpName = `drop_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
      const tmpPath = path.join(rawDir, tmpName);

      // NOTE:
      // This still materializes the decoded bytes in memory once.
      // Keep this loop serial to reduce peak memory pressure.
      const buf = Buffer.from(dataBase64, "base64");

      fs.writeFileSync(tmpPath, buf);
      outPaths.push(tmpPath);

      console.log(
        "[VisionLab][main] wrote blob temp file:",
        tmpPath,
        "bytes:",
        buf.length
      );
    } catch (err) {
      console.error(
        "[VisionLab][main] failed writing blob temp file:",
        String(err?.message || err)
      );
    }
  }

  return outPaths;
}

/**
 * Imports files into datasets/raw and registers them in dataset.json.
 * NOTE: does NOT delete source files.
 *
 * IMPORTANT:
 * This is now async because hashing is stream-based.
 */
export async function importImagesToWorkspace(workspacePath, filePaths, options = {}) {
  ensureWorkspaceStructure(workspacePath);

  const maxFilesPerRun =
    Number.isInteger(options.maxFilesPerRun) && options.maxFilesPerRun > 0
      ? options.maxFilesPerRun
      : DEFAULT_MAX_FILES_PER_RUN;

  const manifest = readManifest(workspacePath);

  const byHash = new Map();
  for (const img of manifest.images) {
    if (img?.hash) byHash.set(img.hash, img);
  }

  const rawDir = path.join(workspacePath, "datasets", "raw");

  const normalizedFilePaths = Array.isArray(filePaths) ? filePaths : [];

  const results = {
    ok: true,
    workspacePath,
    imported: [],
    duplicates: [],
    skipped: [],
    errors: [],
  };

  if (normalizedFilePaths.length > maxFilesPerRun) {
    results.ok = false;
    results.errors.push({
      error: `Import batch too large. Received ${normalizedFilePaths.length} files, limit is ${maxFilesPerRun}.`,
    });

    results.counts = {
      imported: 0,
      duplicates: 0,
      skipped: 0,
      errors: results.errors.length,
      totalInput: normalizedFilePaths.length,
    };

    return results;
  }

  // Process files one-by-one to keep peak memory low.
  for (const src of normalizedFilePaths) {
    try {
      if (!src || typeof src !== "string") {
        results.skipped.push({ path: src, reason: "Invalid path" });
        continue;
      }

      if (!fs.existsSync(src)) {
        results.skipped.push({ path: src, reason: "File does not exist" });
        continue;
      }

      const stat = fs.statSync(src);
      if (!stat.isFile()) {
        results.skipped.push({ path: src, reason: "Not a file" });
        continue;
      }

      if (!isLikelyImageFile(src)) {
        results.skipped.push({ path: src, reason: "Unsupported file type" });
        continue;
      }

      // Stream-based hashing avoids loading the full file into RAM.
      const hash = await sha256FileStream(src);
      const existing = byHash.get(hash);

      if (existing) {
        results.duplicates.push({
          path: src,
          existingId: existing.id,
          existingFile: existing.file,
          hash,
        });
        continue;
      }

      const filename = nextRawFilename(manifest, src);
      const destAbs = path.join(rawDir, filename);

      // Copy into workspace
      fs.copyFileSync(src, destAbs);

      const relFile = path.posix.join("raw", filename);
      const id = path.basename(filename, path.extname(filename)); // img_000001

      const record = {
        id,
        file: relFile,
        hash,
        class: null,
        addedAt: new Date().toISOString(),
        originalName: path.basename(src),
        sizeBytes: stat.size,

        // IMPORTANT: required fields by Dataset Stats + Process page
        source: "local",
        r2Key: null,
        cachedAt: null,
        storage: null,

        processedFile: null,

        card: { setCode: "", number: "", name: "" },
        finish: null,
        stamps: [],
      };

      manifest.images.push(record);
      byHash.set(hash, record);
      results.imported.push(record);
    } catch (err) {
      results.errors.push({
        path: src,
        error: String(err?.message || err),
      });
    }
  }

  if (
    results.imported.length > 0 ||
    results.duplicates.length > 0 ||
    results.skipped.length > 0
  ) {
    writeManifest(workspacePath, manifest);
  }

  results.counts = {
    imported: results.imported.length,
    duplicates: results.duplicates.length,
    skipped: results.skipped.length,
    errors: results.errors.length,
    totalInput: normalizedFilePaths.length,
  };

  return results;
}