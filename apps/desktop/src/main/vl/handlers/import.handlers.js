// FILE: apps/desktop/src/main/ipc/handlers/import.handlers.js
//
// UPDATED (2026-03-13)
//
// CHANGES:
// - CHANGED: Await async importImagesToWorkspace() calls.
// - CHANGED: Keep import flow serial and explicit for lower-memory machines.
// - ADDED: Safety guard for oversized blob batches.
// - KEPT: Track temp files created from blob imports and delete them after import completes.
// - KEPT: Avoid mutating payload arrays (build a new `allPaths` array instead).
// - KEPT: Cleanup runs in `finally` so temp files are removed on success OR error.
// - NOTE: Cleanup ignores ENOENT (if temp files were moved/renamed by the import pipeline).

import { dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import { ensureWorkspaceOnStartup } from "../services/workspace.service.js";
import {
  importImagesToWorkspace,
  importBlobsToTempFiles,
} from "../services/import.service.js";

const MAX_BLOB_FILES_PER_IMPORT = 100; // safety guard for low-memory systems

export async function pickImages() {
  const workspacePath = ensureWorkspaceOnStartup();

  const result = await dialog.showOpenDialog({
    title: "Import Images into SBF Vision Lab",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePaths?.length) {
    return { ok: false, canceled: true };
  }

  try {
    // CHANGED: service is async now
    return await importImagesToWorkspace(workspacePath, result.filePaths);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

// Small helper: best-effort unlink with safe ignore of "already gone".
async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    // If the import pipeline moved/renamed the file, unlink will fail with ENOENT.
    if (err?.code === "ENOENT") return;

    // Surface other issues (permissions, locks, etc.) but don't break the import result.
    console.warn(
      "[VisionLab][main] temp cleanup failed:",
      filePath,
      err?.message || err
    );
  }
}

export async function importImages(_evt, payload) {
  const workspacePath = ensureWorkspaceOnStartup();

  const payloadPaths = Array.isArray(payload?.filePaths) ? payload.filePaths : [];
  const fileBlobs = Array.isArray(payload?.fileBlobs) ? payload.fileBlobs : [];

  console.log("[VisionLab][main] importImages called:", {
    filePaths: payloadPaths.length,
    fileBlobs: fileBlobs.length,
  });

  // ADDED: guard against huge in-memory blob imports on low-RAM systems.
  if (fileBlobs.length > MAX_BLOB_FILES_PER_IMPORT) {
    return {
      ok: false,
      error: `Too many dropped image blobs in one import (${fileBlobs.length}). Limit is ${MAX_BLOB_FILES_PER_IMPORT}.`,
    };
  }

  // Track temp files created from blobs so we can clean them up.
  const createdTempPaths = [];

  // Do not mutate payloadPaths; build a new list we pass to the importer.
  let allPaths = [...payloadPaths];

  try {
    // Blob fallback import (base64 -> temp file -> pipeline)
    if (fileBlobs.length) {
      const tmpPaths = importBlobsToTempFiles(workspacePath, fileBlobs) || [];

      // Track for cleanup, and include as import sources.
      createdTempPaths.push(...tmpPaths);
      allPaths = allPaths.concat(tmpPaths);
    }

    // CHANGED: service is async now
    const res = await importImagesToWorkspace(workspacePath, allPaths);

    console.log("[VisionLab][main] import result:", res?.counts || res);
    return res;
  } catch (err) {
    console.error("[VisionLab][main] importImages error:", err);
    return { ok: false, error: String(err?.message || err) };
  } finally {
    // Always attempt to cleanup temp files created for blob imports.
    // We only delete files we created (never user-selected originals).
    if (createdTempPaths.length) {
      console.log("[VisionLab][main] cleaning temp files:", createdTempPaths.length);

      // Best-effort cleanup. Do not throw from finally.
      await Promise.allSettled(createdTempPaths.map((p) => safeUnlink(p)));
    }
  }
}