// FILE: apps/desktop/src/main/services/settings.service.js
//
// UPDATED (2026-03-18)
//
// CHANGES:
//   - ADD: deployment mode fields (deploymentMode, fenrirWorkspacePath, heimdall*)
//   - ADD: getEffectiveWorkspacePath() — use this everywhere instead of
//          readSettings().workspacePath so Fenrir mode is transparent
//   - KEEP: all existing exports unchanged

import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");

const DEFAULT_SETTINGS = {
  workspacePath: null,

  // ── Deployment ──────────────────────────────────────────────────────────────
  // "local"            — everything on this PC (original behaviour)
  // "fenrir"           — workspace on Fenrir, training still local
  // "fenrir+heimdall"  — workspace on Fenrir, training on Heimdall via SSH
  deploymentMode: "local",

  // Fenrir share path as Windows sees it from this PC
  // e.g. "\\\\192.168.0.131\\storage\\SBF Vision Lab Workspace"
  fenrirWorkspacePath: "",

  // Heimdall SSH
  heimdallHost:     "",
  heimdallPort:     22,
  heimdallUser:     "",
  heimdallPassword: "",   // stored in plain settings.json — local file, acceptable

  // Path to the workspace as Heimdall sees it (Fenrir mounted at /mnt/fenrir)
  // e.g. "/mnt/fenrir/SBF Vision Lab Workspace"
  heimdallWorkspacePath: "",

  // Git repo — cloned onto Heimdall by the bootstrap process
  // e.g. "https://github.com/yourname/sbf-vision-lab.git"
  heimdallRepoUrl:    "",
  // Where to clone it on Heimdall, e.g. "/home/ryan/sbf-vision-lab"
  heimdallRepoDir:    "",
  heimdallRepoBranch: "main",
};

export function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(next) {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the workspace path that all handlers should use.
 *
 * - "local"           → settings.workspacePath
 * - "fenrir"          → settings.fenrirWorkspacePath (falls back to workspacePath)
 * - "fenrir+heimdall" → settings.fenrirWorkspacePath (falls back to workspacePath)
 *
 * Replace all direct `readSettings().workspacePath` calls in handlers with this.
 */
export function getEffectiveWorkspacePath() {
  const s = readSettings();
  const mode = s.deploymentMode || "local";
  if (mode === "fenrir" || mode === "fenrir+heimdall") {
    return s.fenrirWorkspacePath || s.workspacePath || null;
  }
  return s.workspacePath || null;
}