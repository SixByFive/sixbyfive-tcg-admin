// FILE: apps/desktop/src/main/ipc/handlers/export.handlers.js
//
// UPDATED (2026-03-01)
//
// FIXES:
// - FIX: Do NOT always return ok:true. Preserve the service result (ok/error).
// - KEPT: opts pass-through.

import { ensureWorkspaceOnStartup } from "../services/workspace.service.js";
import { exportTrainingDatasets } from "../services/exportTrainingDatasets.service.js";

export async function exportTrainingDatasetsHandler(_evt, payload) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    if (!workspacePath) return { ok: false, error: "Workspace path is not set." };

    const opts = payload && typeof payload === "object" ? payload : {};
    const res = exportTrainingDatasets(workspacePath, opts);

    // IMPORTANT: exportTrainingDatasets should return { ok, ... }.
    // If it doesn't, we normalize here.
    if (!res || typeof res !== "object") {
      return { ok: false, error: "exportTrainingDatasets returned no result." };
    }

    if (typeof res.ok === "boolean") return res;

    // fallback: treat as success if no ok provided
    return { ok: true, ...res };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}