// FILE: apps/desktop/src/main/ipc/handlers/datasetBrowser.handlers.js
//
// Purpose:
//   IPC handlers for the Dataset Browser page.
//
// IPC channels:
//   visionlab:listDatasetCards    -> { ok, sets, totalCards, totalImages }
//   visionlab:deleteDatasetImage  -> { ok, deleted: { identity, finish } }

import { ensureWorkspaceOnStartup } from "../services/workspace.service.js";
import { listDatasetCards, deleteDatasetImage } from "../services/datasetBrowser.service.js";

export async function listDatasetCardsHandler(_evt) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    if (!workspacePath) return { ok: false, error: "Workspace path is not set." };
    return listDatasetCards(workspacePath);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function deleteDatasetImageHandler(_evt, payload) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    if (!workspacePath) return { ok: false, error: "Workspace path is not set." };

    const { cardId, filename } = payload || {};
    if (!cardId || !filename) {
      return { ok: false, error: "Missing cardId or filename in payload." };
    }

    return deleteDatasetImage(workspacePath, cardId, filename);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export async function getDatasetImageThumbHandler(_evt, payload) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    if (!workspacePath) return { ok: false, error: "Workspace path is not set." };

    const { cardId, filename } = payload || {};
    if (!cardId || !filename) return { ok: false, error: "Missing cardId or filename." };

    const { getDatasetImageThumb } = await import("../services/datasetBrowser.service.js");
    return getDatasetImageThumb(workspacePath, cardId, filename);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}