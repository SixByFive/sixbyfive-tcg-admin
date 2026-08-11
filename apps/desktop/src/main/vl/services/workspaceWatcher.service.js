// FILE: apps/desktop/src/main/services/workspaceWatcher.service.js
//
// NEW (2026-03-01)
//
// Purpose:
// - Watch workspace dataset folders for changes (add/remove/rename)
// - Notify renderer to refresh its list so deleted files disappear immediately
//
// Requires: chokidar (recommended)
//   npm i chokidar
//
// If you don't want chokidar, you can use fs.watch, but chokidar is far more reliable cross-platform.

import chokidar from "chokidar";
import path from "node:path";

let watcher = null;

/**
 * Start a single watcher instance for the workspace.
 * @param {Electron.WebContents} webContents - window.webContents to emit events to
 * @param {string} workspacePath
 */
export function startWorkspaceWatcher(webContents, workspacePath) {
  if (!webContents || !workspacePath) return;

  // Prevent multiple watchers
  if (watcher) return;

  const datasetsPath = path.join(workspacePath, "datasets");

  // Watch the dataset roots you care about
  const watchPaths = [
    path.join(datasetsPath, "raw"),
    path.join(datasetsPath, "processed"),
    path.join(datasetsPath, "finish_raw"),
    path.join(datasetsPath, "finish_explicit"),
  ];

  watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 50,
    },
  });

  const emitChange = (type, filePath) => {
    try {
      webContents.send("visionlab:workspace-changed", {
        type,
        filePath,
      });
    } catch {
      // Window closed; ignore
    }
  };

  watcher
    .on("add", (p) => emitChange("add", p))
    .on("unlink", (p) => emitChange("unlink", p))
    .on("change", (p) => emitChange("change", p))
    .on("addDir", (p) => emitChange("addDir", p))
    .on("unlinkDir", (p) => emitChange("unlinkDir", p))
    .on("error", (err) => {
      console.warn("[VisionLab][watcher] error:", err?.message || err);
    });

  console.log("[VisionLab][watcher] started:", watchPaths);
}

export async function stopWorkspaceWatcher() {
  if (!watcher) return;
  await watcher.close();
  watcher = null;
  console.log("[VisionLab][watcher] stopped");
}