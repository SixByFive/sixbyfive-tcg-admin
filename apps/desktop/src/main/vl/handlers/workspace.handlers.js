// FILE: apps/desktop/src/main/ipc/handlers/workspace.handlers.js
//
// NEW (2026-02-28)
// - Extracted IPC handlers from main/index.js
// - No behaviour changes

import { dialog } from "electron";
import fs from "node:fs";

import {
  ensureWorkspaceOnStartup,
  ensureWorkspaceStructure,
} from "../services/workspace.service.js";

import {
  readSettings,
  writeSettings,
  getEffectiveWorkspacePath,
} from "../services/settings.service.js";

import { shellOpenFolder } from "../services/preview.service.js";

export async function getWorkspace() {
  const workspacePath = ensureWorkspaceOnStartup();
  return { workspacePath };
}

export async function selectWorkspace() {
  const result = await dialog.showOpenDialog({
    title: "Select SBF Vision Lab Workspace Folder",
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || !result.filePaths?.length) {
    return { ok: false, canceled: true };
  }

  const workspacePath = result.filePaths[0];

  try {
    fs.mkdirSync(workspacePath, { recursive: true });
    ensureWorkspaceStructure(workspacePath);

    const settings = readSettings();
    const next = { ...settings, workspacePath };
    const saved = writeSettings(next);

    if (!saved) return { ok: false, error: "Failed to save settings." };

    return { ok: true, workspacePath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function openWorkspace() {
  const workspacePath = getEffectiveWorkspacePath();
  if (!workspacePath) return { ok: false, error: "No workspace selected." };

  try {
    await shellOpenFolder(workspacePath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}