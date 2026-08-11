// FILE: apps/desktop/src/main/ipc/handlers/split.handlers.js
//
// UPDATED (2026-03-01)
//
// Purpose:
//   IPC wrapper for splitTrainingDatasets.service.js
//
// IPC:
//   visionlab:splitTrainingDatasets({ clean, prefer, valRatio, seed, minPerFinishWarn, minPerIdentityWarn, minPerIdentityTrain })
//
// Returns:
//   report { ok, counts, health, used, ... }

import { ensureWorkspaceOnStartup } from "../services/workspace.service.js";
import { splitTrainingDatasets } from "../services/splitTrainingDatasets.service.js";

export async function splitTrainingDatasetsHandler(_evt, payload) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    if (!workspacePath) return { ok: false, error: "Workspace path is not set." };

    const opts = payload && typeof payload === "object" ? payload : {};

    return splitTrainingDatasets(workspacePath, {
      clean: opts.clean !== false,
      prefer: opts.prefer === "copy" ? "copy" : "hardlink",
      valRatio:
        typeof opts.valRatio === "number" ? opts.valRatio : Number(opts.valRatio),
      seed: opts.seed ?? "visionlab-v1",

      minPerFinishWarn: Number.isFinite(Number(opts.minPerFinishWarn))
        ? Number(opts.minPerFinishWarn)
        : 50,

      minPerIdentityWarn: Number.isFinite(Number(opts.minPerIdentityWarn))
        ? Number(opts.minPerIdentityWarn)
        : 5,

      // ADDED: skip identity classes that are too small to train well
      minPerIdentityTrain: Number.isFinite(Number(opts.minPerIdentityTrain))
        ? Math.max(1, Number(opts.minPerIdentityTrain))
        : 1,
    });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}