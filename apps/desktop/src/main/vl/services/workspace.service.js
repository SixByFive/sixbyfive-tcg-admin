// FILE: apps/desktop/src/main/services/workspace.service.js
//
// UPDATED (2026-03-14) — CACHE WORKSPACE PATH
//
// CHANGES:
// - ADD: _cachedWorkspacePath — set once on first real call, returned instantly
//        on every subsequent call. Eliminates 5-10 synchronous network I/O
//        operations (readSettings, mkdirSync, ensureWorkspaceStructure) that
//        were blocking the main process thread on every IPC handler invocation.
// - ADD: getWorkspacePath() — zero-cost getter for handlers that just need the
//        path and know startup has already run.
// - ADD: invalidateWorkspaceCache() — call when the user selects a new workspace
//        so the next ensureWorkspaceOnStartup() re-initialises properly.
// - KEEP: All existing logic unchanged — first call still does full structure
//         creation, manifest heal, settings sync, etc.

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { app } from "electron";

import { readSettings, writeSettings } from "./settings.service.js";
import {
  getManifestPath,
  createEmptyManifest,
  readJson,
  atomicWriteJson,
  healManifest,
} from "./manifest.service.js";

/* ─────────────────────────────────────────────
   Workspace path cache
   ───────────────────────────────────────────── */

let _cachedWorkspacePath = null;

/**
 * Returns the cached workspace path.
 * Only valid after ensureWorkspaceOnStartup() has been called at least once.
 * Use in handlers that run after app startup.
 */
export function getWorkspacePath() {
  if (!_cachedWorkspacePath) {
    throw new Error(
      "getWorkspacePath() called before ensureWorkspaceOnStartup(). " +
      "Call ensureWorkspaceOnStartup() during app startup."
    );
  }
  return _cachedWorkspacePath;
}

/**
 * Call this when the user selects a new workspace so the next
 * ensureWorkspaceOnStartup() re-initialises from scratch.
 */
export function invalidateWorkspaceCache() {
  _cachedWorkspacePath = null;
}

export function getDefaultWorkspacePath() {
  return path.join(app.getPath("documents"), "SBF Vision Lab Workspace");
}

/**
 * Canonical workspace structure + dataset manifest creation.
 * IMPORTANT: datasets/raw stores imported images and renamed canonical filenames.
 *            processedFile is a logical marker for pipeline steps, not a folder move.
 */
export function ensureWorkspaceStructure(workspacePath) {
  const folders = [
    "datasets",
    "datasets/raw",
    "datasets/processed",
    "datasets/splits",
    "exports",
    "exports/tfjs",
    "exports/tflite",
    "models",
    "runs",
    "logs",
  ];

  for (const f of folders) {
    fs.mkdirSync(path.join(workspacePath, f), { recursive: true });
  }

  const marker = path.join(workspacePath, "SBF_VISION_LAB_WORKSPACE.txt");
  if (!fs.existsSync(marker)) {
    fs.writeFileSync(
      marker,
      [
        "SBF Vision Lab Workspace",
        "",
        "This folder is managed by SBF Vision Lab.",
        "It stores datasets, exports, training runs and logs.",
        "",
        "Safe to backup. Don't rename folders inside unless you know what you're doing.",
      ].join(os.EOL),
      "utf8"
    );
  }

  // Ensure dataset manifest exists and is healed
  const manifestPath = getManifestPath(workspacePath);

  if (!fs.existsSync(manifestPath)) {
    const manifest = createEmptyManifest();
    atomicWriteJson(manifestPath, manifest);
  } else {
    try {
      const m = readJson(manifestPath);
      const healed = healManifest(m);
      if (healed._changed) {
        delete healed._changed;
        healed.updatedAt = new Date().toISOString();
        atomicWriteJson(manifestPath, healed);
      }
    } catch {
      const backup = manifestPath.replace(/\.json$/i, `.corrupt.${Date.now()}.json`);
      try { fs.copyFileSync(manifestPath, backup); } catch {}
      const manifest = createEmptyManifest();
      atomicWriteJson(manifestPath, manifest);
    }
  }
}

/**
 * Resolve, initialise, and cache the workspace path.
 *
 * FIRST CALL: reads settings, creates folders, heals manifest — normal startup cost.
 * SUBSEQUENT CALLS: returns the cached path instantly, zero I/O.
 *
 * Call invalidateWorkspaceCache() before this if the user has changed workspace.
 */
export function ensureWorkspaceOnStartup() {
  if (_cachedWorkspacePath) return _cachedWorkspacePath;

  const settings = readSettings();

  let workspacePath = settings.workspacePath || null;
  if (!workspacePath) workspacePath = getDefaultWorkspacePath();

  fs.mkdirSync(workspacePath, { recursive: true });
  ensureWorkspaceStructure(workspacePath);

  if (settings.workspacePath !== workspacePath) {
    writeSettings({ ...settings, workspacePath });
  }

  _cachedWorkspacePath = workspacePath;
  return _cachedWorkspacePath;
}