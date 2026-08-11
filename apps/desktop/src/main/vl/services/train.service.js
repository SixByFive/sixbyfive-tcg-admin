// FILE: apps/desktop/src/main/services/train.service.js
//
// Runs the vision-trainer Python pipeline and streams output.
//
// UPDATED (2026-03-01)
// CHANGES:
// - FIX: Strong guards so path.join never receives null/undefined
// - KEPT: Uses trainer .venv if present
// - KEPT: Streams stdout/stderr + close callback

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function resolvePythonExe(trainerRoot) {
  const win = path.join(trainerRoot, ".venv", "Scripts", "python.exe");
  if (exists(win)) return win;

  const nix = path.join(trainerRoot, ".venv", "bin", "python");
  if (exists(nix)) return nix;

  return "python";
}

export function runTrainingPipeline({
  workspacePath,
  trainerRoot,
  configPath,
  only,
  noExport,
  onStdout,
  onStderr,
  onClose,
}) {
  // Guards (prevents "Received null" path errors)
  if (!workspacePath || typeof workspacePath !== "string") {
    throw new Error(`Invalid workspacePath: ${String(workspacePath)}`);
  }
  if (!trainerRoot || typeof trainerRoot !== "string") {
    throw new Error(`Invalid trainerRoot: ${String(trainerRoot)}`);
  }

  const pipelineScript = path.join(trainerRoot, "tools", "run_training_pipeline.py");
  if (!exists(pipelineScript)) {
    throw new Error(`Training pipeline not found: ${pipelineScript}`);
  }

  const pythonExe = resolvePythonExe(trainerRoot);

  const args = [pipelineScript, "--workspace", workspacePath];

  if (configPath) {
    if (typeof configPath !== "string") {
      throw new Error(`Invalid configPath: ${String(configPath)}`);
    }
    args.push("--config", configPath);
  }

  if (only) args.push("--only", only);
  if (noExport) args.push("--no-export");

  const proc = spawn(pythonExe, args, {
    cwd: trainerRoot,
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });

  proc.stdout.on("data", (buf) => onStdout?.(buf.toString("utf-8")));
  proc.stderr.on("data", (buf) => onStderr?.(buf.toString("utf-8")));
  proc.on("close", (code) => onClose?.(code ?? 0));

  return proc;
}