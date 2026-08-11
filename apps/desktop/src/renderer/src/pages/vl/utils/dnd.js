// FILE: apps/desktop/src/renderer/src/utils/dnd.js
//
// UPDATED (2026-03-13)
// - ADD: skipped reasons so UI can explain why files were not imported.

import { arrayBufferToBase64 } from "./base64";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_SINGLE_BLOB_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BLOB_BYTES = 150 * 1024 * 1024;
const MAX_BLOB_FILE_COUNT = 50;

function getExtension(name) {
  const value = String(name || "").toLowerCase();
  const idx = value.lastIndexOf(".");
  return idx >= 0 ? value.slice(idx) : "";
}

function isSupportedImageName(name) {
  return SUPPORTED_EXTENSIONS.has(getExtension(name));
}

export async function extractDroppedFiles(e) {
  const dt = e.dataTransfer;
  const filePaths = [];
  const fileBlobs = [];
  const skipped = [];

  const items = Array.from(dt?.items || []);
  const files = Array.from(dt?.files || []);

  const fileLike = [];
  const seenPathKeys = new Set();
  let totalBlobBytes = 0;
  let warningMessage = "";

  for (const item of items) {
    if (item?.kind !== "file") continue;
    const f = item.getAsFile?.();
    if (f) fileLike.push(f);
  }

  if (!fileLike.length && files.length) {
    fileLike.push(...files);
  }

  for (const f of fileLike) {
    if (!f) continue;

    const name = String(f?.name || "dropped-file");
    const maybePath = f?.path;

    if (!isSupportedImageName(name)) {
      skipped.push({ name, reason: "Unsupported file type" });
      continue;
    }

    if (typeof maybePath === "string" && maybePath.length > 0) {
      if (!seenPathKeys.has(maybePath)) {
        seenPathKeys.add(maybePath);
        filePaths.push(maybePath);
      } else {
        skipped.push({ name, reason: "Duplicate dropped path" });
      }
      continue;
    }

    if (fileBlobs.length >= MAX_BLOB_FILE_COUNT) {
      skipped.push({ name, reason: "Too many pathless dropped files in one batch" });
      warningMessage = "Some dropped files were skipped because the blob file-count limit was reached.";
      break;
    }

    try {
      let buf = await f.arrayBuffer();

      if (buf.byteLength > MAX_SINGLE_BLOB_BYTES) {
        skipped.push({
          name,
          reason: `File exceeds ${MAX_SINGLE_BLOB_BYTES / (1024 * 1024)}MB blob limit`,
        });
        buf = null;
        continue;
      }

      if (totalBlobBytes + buf.byteLength > MAX_TOTAL_BLOB_BYTES) {
        skipped.push({
          name,
          reason: "Total blob payload limit reached for this drop",
        });
        warningMessage =
          "Some dropped files were skipped because the total drag/drop payload limit was reached.";
        buf = null;
        break;
      }

      const dataBase64 = arrayBufferToBase64(buf);
      totalBlobBytes += buf.byteLength;

      fileBlobs.push({
        name,
        dataBase64,
      });

      buf = null;
    } catch (err) {
      skipped.push({
        name,
        reason: `Read failed: ${String(err?.message || err)}`,
      });
    }
  }

  console.log("[VisionLab][renderer] extractDroppedFiles result:", {
    totalDropped: fileLike.length,
    filePaths: filePaths.length,
    fileBlobs: fileBlobs.length,
    skipped: skipped.length,
    totalBlobBytes,
  });

  return { filePaths, fileBlobs, skipped, warningMessage };
}
