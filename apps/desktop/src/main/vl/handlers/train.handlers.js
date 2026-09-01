// FILE: apps/desktop/src/main/ipc/handlers/train.handlers.js

import path from "node:path";
import { app } from "electron";
import { BrowserWindow } from "electron";
import { readSettings, getEffectiveWorkspacePath } from "../services/settings.service.js";
import { exportTrainingDatasets } from "../services/exportTrainingDatasets.service.js";
import {
  startRemoteTrainingJob,
  getActiveJob,
  cancelRemoteJob,
  readLogTail,
} from "../services/remote-runner.service.js";

let _localProc = null;

function getMainWindow() {
  return BrowserWindow.getAllWindows()[0] || null;
}

function emitToRenderer(channel, payload) {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function getBundledTrainerPath() {
  const isPackaged = app.isPackaged;
  const ext = process.platform === "win32" ? ".exe" : "";
  if (isPackaged) {
    return path.join(process.resourcesPath, "vision-trainer", `vision-trainer${ext}`);
  }
  // Dev: vision-trainer source lives in the repo root alongside apps/
  const repoRoot = path.resolve(app.getAppPath(), "..", "..");
  return path.join(repoRoot, "vision-trainer", "dist", "vision-trainer", `vision-trainer${ext}`);
}

export async function startTraining(_, args = {}) {
  try {
    const settings = readSettings();
    const mode = settings.deploymentMode || "local";

    console.log("[startTraining] mode:", mode);

    if (mode === "fenrir+heimdall") {
      console.log("[startTraining] routing to remote runner");
      return await startRemoteTrainingJob();
    }

    if (_localProc) {
      return { ok: false, error: "Training already running." };
    }

    const workspacePath = getEffectiveWorkspacePath();
    if (!workspacePath) {
      return { ok: false, error: "No workspace selected." };
    }

    // Export training datasets from manifest into detection_raw / finish_raw / stamps_raw before training
    try {
      const exportResult = await exportTrainingDatasets(workspacePath, { clean: true, prefer: "copy" });
      if (!exportResult.ok) {
        return { ok: false, error: `Dataset export failed: ${exportResult.errors?.join(", ") || "unknown error"}` };
      }
    } catch (exportErr) {
      return { ok: false, error: `Dataset export crashed: ${exportErr.message}` };
    }

    const trainerExe = getBundledTrainerPath();
    const { spawn } = await import("node:child_process");

    const cmdArgs = ["--workspace", workspacePath];
    if (args.only) cmdArgs.push("--only", args.only);
    if (args.noExport) cmdArgs.push("--no-export");

    emitToRenderer("visionlab:train:status", { status: "starting" });

    return new Promise((resolve) => {
      let proc;
      try {
        proc = spawn(trainerExe, cmdArgs, { stdio: ["ignore", "pipe", "pipe"] });
      } catch (err) {
        resolve({ ok: false, error: `Failed to start trainer: ${err.message}` });
        return;
      }

      _localProc = proc;

      proc.stdout.on("data", (d) => emitToRenderer("visionlab:train:stdout", d.toString("utf8")));
      proc.stderr.on("data", (d) => emitToRenderer("visionlab:train:stderr", d.toString("utf8")));
      proc.on("error", (err) => { emitToRenderer("visionlab:train:status", { status: "error", error: err.message }); _localProc = null; });
      proc.on("close", (code) => { _localProc = null; emitToRenderer("visionlab:train:status", { status: code === 0 ? "done" : "error", exitCode: code }); });

      resolve({ ok: true, local: true });
    });

  } catch (err) {
    console.error("[startTraining] CRASHED:", err);
    return { ok: false, error: err.message };
  }
}

export async function stopTraining() {
  if (_localProc) {
    _localProc.kill();
    _localProc = null;
    return { ok: true };
  }
  return cancelRemoteJob();
}

export async function getRemoteJob() {
  return getActiveJob() ?? { jobId: null, status: "idle" };
}

export async function cancelJob() {
  return cancelRemoteJob();
}

export async function readJobLog(_, { logPath, lines = 200 } = {}) {
  if (!logPath) return { ok: false, error: "No logPath provided" };
  return readLogTail(logPath, lines);
}