// FILE: apps/desktop/src/main/services/remote-runner.service.js

import fs from "node:fs";
import path from "node:path";
import { BrowserWindow } from "electron";
import { Client } from "ssh2";
import { readSettings } from "./settings.service.js";
import { exportTrainingDatasets } from "./exportTrainingDatasets.service.js";

let _activeJob = null;

function getMainWindow() {
  return BrowserWindow.getAllWindows()[0] || null;
}

function emit(channel, payload) {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function makeJobId() {
  return `remote_${Date.now()}`;
}

function getLogPath(workspacePath, jobId) {
  const logsDir = path.join(workspacePath, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  return path.join(logsDir, `${jobId}.log`);
}

function getLocalWorkspace(s) {
  const mode = s.deploymentMode || "local";
  if (mode === "fenrir" || mode === "fenrir+heimdall") {
    return s.fenrirWorkspacePath || s.workspacePath || null;
  }
  return s.workspacePath || null;
}

function getTrainerPaths(repoDir) {
  const trainerDir           = `${repoDir}/vision-trainer`;
  const venvPython           = `${trainerDir}/.venv/bin/python`;
  const requirements         = `${trainerDir}/requirements-heimdall.txt`;
  const requirementsFallback = `${trainerDir}/requirements.txt`;
  const toolsDir             = `${trainerDir}/tools`;
  const pipeline             = `${toolsDir}/run_training_pipeline.py`;
  return { trainerDir, venvPython, requirements, requirementsFallback, toolsDir, pipeline };
}

function openSsh(s) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => resolve(conn));
    conn.on("error", reject);
    conn.connect({
      host: s.heimdallHost, port: s.heimdallPort ?? 22,
      username: s.heimdallUser, password: s.heimdallPassword,
      readyTimeout: 10000,
    });
  });
}

function runCommand(conn, cmd, onData) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on("data",        (d) => onData(d.toString("utf8")));
      stream.stderr.on("data", (d) => onData(`[stderr] ${d.toString("utf8")}`));
      stream.on("close",       (code) => resolve(code));
    });
  });
}

function validateSettings(s) {
  const required = {
    heimdallHost: s.heimdallHost, heimdallUser: s.heimdallUser,
    heimdallPassword: s.heimdallPassword, heimdallWorkspacePath: s.heimdallWorkspacePath,
    heimdallRepoDir: s.heimdallRepoDir, heimdallRepoUrl: s.heimdallRepoUrl,
  };
  return Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
}

export async function bootstrapHeimdall({ force = false } = {}) {
  const s = readSettings();
  const missing = validateSettings(s);
  if (missing.length) return { ok: false, error: `Missing settings: ${missing.join(", ")}` };

  const localWorkspace = getLocalWorkspace(s);
  const logPath = getLogPath(localWorkspace, `bootstrap_${Date.now()}`);
  const logStream = fs.createWriteStream(logPath, { flags: "w", encoding: "utf8" });

  const log = (text) => {
    logStream.write(text);
    emit("training:remote-line", { jobId: "bootstrap", line: text.trimEnd() });
  };

  emit("training:remote-status", { jobId: "bootstrap", status: "running", message: "Connecting to Heimdall…" });

  let conn;
  try { conn = await openSsh(s); }
  catch (err) { logStream.end(); return { ok: false, error: `SSH failed: ${err.message}` }; }

  const { heimdallRepoUrl, heimdallRepoDir, heimdallRepoBranch = "main" } = s;
  const { trainerDir, venvPython, requirements, requirementsFallback } = getTrainerPaths(heimdallRepoDir);

  const steps = [];

  if (force) {
    steps.push([`rm -rf "${heimdallRepoDir}"`, "Removing existing repo for fresh install…"]);
  }

  steps.push(
    [
      `if [ -d "${heimdallRepoDir}/.git" ]; then`
      + ` echo "Repo exists — pulling latest from ${heimdallRepoBranch}…";`
      + ` git -C "${heimdallRepoDir}" pull origin ${heimdallRepoBranch};`
      + ` else echo "Cloning ${heimdallRepoUrl}…";`
      + ` git clone --branch ${heimdallRepoBranch} "${heimdallRepoUrl}" "${heimdallRepoDir}";`
      + ` fi`,
      "Setting up repo (git clone / pull)…",
    ],
    [
      `if [ -d "${trainerDir}/.venv" ]; then`
      + ` echo "Venv already exists — skipping";`
      + ` else echo "Creating venv…";`
      + ` python3 -m venv "${trainerDir}/.venv";`
      + ` fi`,
      "Setting up Python venv…",
    ],
    [
      `echo "Installing requirements…"`
      + ` && "${venvPython}" -m pip install --upgrade pip --quiet`
      + ` && if [ -f "${requirements}" ];`
      + ` then echo "Using ${requirements}…" && "${venvPython}" -m pip install -r "${requirements}";`
      + ` else echo "Falling back to ${requirementsFallback}…" && "${venvPython}" -m pip install -r "${requirementsFallback}";`
      + ` fi`,
      "Installing Python dependencies (tensorflow, numpy, pillow…)…",
    ],
  );

  log(`=== Heimdall bootstrap ===\n=== ${new Date().toISOString()} ===\n`);
  log(`=== Repo: ${heimdallRepoUrl} → ${heimdallRepoDir} ===\n\n`);

  let ok = true;
  for (const [cmd, label] of steps) {
    log(`\n--- ${label} ---\n`);
    emit("training:remote-status", { jobId: "bootstrap", status: "running", message: label });
    try {
      const code = await runCommand(conn, cmd, log);
      if (code !== 0) { log(`\n[ERROR] Step failed (exit ${code})\n`); ok = false; break; }
    } catch (err) {
      log(`\n[ERROR] ${err.message}\n`); ok = false; break;
    }
  }

  if (ok) {
    const { pipeline } = getTrainerPaths(heimdallRepoDir);
    log(`\n--- Verifying pipeline at ${pipeline} ---\n`);
    const code = await runCommand(conn, `test -f "${pipeline}" && echo OK || echo MISSING`, log).catch(() => 1);
    if (code !== 0) { log(`[ERROR] Pipeline script not found.\n`); ok = false; }
  }

  log(`\n=== Bootstrap ${ok ? "SUCCEEDED ✓" : "FAILED ✗"} ===\n`);
  logStream.end();
  conn.end();

  emit("training:remote-status", {
    jobId: "bootstrap",
    status: ok ? "done" : "error",
    message: ok ? "Heimdall is ready — pipeline installed and verified" : "Bootstrap failed — check the log",
    logPath,
  });

  return { ok, logPath };
}

export async function startRemoteTrainingJob() {
  try {
    console.log("[startRemoteTrainingJob] starting...");

    if (_activeJob) return { ok: false, error: "A job is already running." };

    console.log("[startRemoteTrainingJob] reading settings...");
    const s = readSettings();

    console.log("[startRemoteTrainingJob] validating settings...");
    const missing = validateSettings(s);
    if (missing.length) return { ok: false, error: `Missing settings: ${missing.join(", ")}` };

    const { heimdallRepoDir, heimdallWorkspacePath } = s;
    const { venvPython, toolsDir, pipeline } = getTrainerPaths(heimdallRepoDir);

    console.log("[startRemoteTrainingJob] resolving local workspace...");
    const localWorkspace = getLocalWorkspace(s);
    console.log("[startRemoteTrainingJob] localWorkspace:", localWorkspace);

    const jobId = makeJobId();
    console.log("[startRemoteTrainingJob] jobId:", jobId);

    console.log("[startRemoteTrainingJob] creating log file...");
    const logPath = getLogPath(localWorkspace, jobId);
    console.log("[startRemoteTrainingJob] logPath:", logPath);

    const logStream = fs.createWriteStream(logPath, { flags: "w", encoding: "utf8" });

    const log = (text) => {
      logStream.write(text);
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length) emit("training:remote-line", { jobId, line: lines[lines.length - 1] });
    };

    emit("training:remote-status", { jobId, status: "connecting", message: "Connecting to Heimdall…" });

    console.log("[startRemoteTrainingJob] opening SSH connection to", s.heimdallHost);
    let conn;
    try { conn = await openSsh(s); }
    catch (err) { logStream.end(); return { ok: false, error: `SSH failed: ${err.message}` }; }
    console.log("[startRemoteTrainingJob] SSH connected");

    // Auto-bootstrap if pipeline missing
    const repoMissing = await new Promise((resolve) => {
        conn.exec(`test -f "${pipeline}"`, (err, stream) => {
            if (err) return resolve(true);
            // Must consume stdout/stderr or 'close' never fires
            stream.on("data", () => {});
            stream.stderr.on("data", () => {});
            stream.on("close", (code) => resolve(code !== 0));
        });
    });
    console.log("[startRemoteTrainingJob] repoMissing:", repoMissing);

    if (repoMissing) {
      log(`Pipeline not found — running bootstrap first…\n\n`);
      emit("training:remote-status", { jobId, status: "running", message: "First run — setting up Heimdall…" });
      conn.end();
      const bootstrap = await bootstrapHeimdall();
      if (!bootstrap.ok) {
        logStream.end();
        return { ok: false, error: "Auto-bootstrap failed. Open Settings → Infrastructure and click 'Set up Heimdall' to see the full log." };
      }
      try { conn = await openSsh(s); }
      catch (err) { logStream.end(); return { ok: false, error: `SSH reconnect failed: ${err.message}` }; }
    }

    // Export training datasets from manifest into identity_raw / finish_raw before training
    log(`=== Exporting training datasets from manifest…\n`);
    emit("training:remote-status", { jobId, status: "running", message: "Exporting training datasets…" });
    try {
      const exportResult = await exportTrainingDatasets(localWorkspace, { clean: true, prefer: "copy" });
      log(`[export] ok=${exportResult.ok} identity=${exportResult.counts?.identityFiles ?? 0} finish=${exportResult.counts?.finishFiles ?? 0}\n`);
      if (!exportResult.ok) {
        logStream.end(); conn.end();
        return { ok: false, error: `Dataset export failed: ${exportResult.errors?.join(", ") || "unknown error"}` };
      }
    } catch (exportErr) {
      logStream.end(); conn.end();
      return { ok: false, error: `Dataset export crashed: ${exportErr.message}` };
    }

    const cmd = `cd "${toolsDir}" && "${venvPython}" run_training_pipeline.py --workspace "${heimdallWorkspacePath}" 2>&1`;
    console.log("[startRemoteTrainingJob] running command:", cmd);

    logStream.write(`=== Remote training job ${jobId} ===\n`);
    logStream.write(`=== Started: ${new Date().toISOString()} ===\n`);
    logStream.write(`=== ${cmd} ===\n\n`);

    return new Promise((resolve) => {
      conn.exec(cmd, (err, stream) => {
        if (err) {
          console.error("[startRemoteTrainingJob] exec failed:", err);
          conn.end(); logStream.end();
          resolve({ ok: false, error: `SSH exec failed: ${err.message}` });
          return;
        }

        console.log("[startRemoteTrainingJob] pipeline exec started, resolving with jobId");
        _activeJob = { jobId, status: "running", logPath, conn, startedAt: Date.now() };
        emit("training:remote-status", { jobId, status: "running", message: "Pipeline running on Heimdall", logPath });

        stream.on("data",        (d) => log(d.toString("utf8")));
        stream.stderr.on("data", (d) => log(`[stderr] ${d.toString("utf8")}`));

        stream.on("close", (code) => {
          console.log("[startRemoteTrainingJob] pipeline closed, exit code:", code);
          logStream.write(`\n=== Finished: ${new Date().toISOString()} exit=${code} ===\n`);
          logStream.end();
          const succeeded = code === 0;
          if (_activeJob) _activeJob.status = succeeded ? "done" : "error";
          emit("training:remote-status", {
            jobId, status: succeeded ? "done" : "error", exitCode: code,
            message: succeeded ? "Training complete — models saved to Fenrir" : `Pipeline exited with code ${code}`,
            logPath,
          });
          conn.end();
          _activeJob = null;
        });

        resolve({ ok: true, jobId, logPath });
      });
    });

  } catch (err) {
    console.error("[startRemoteTrainingJob] CRASHED:", err);
    return { ok: false, error: err.message };
  }
}

export function getActiveJob() {
  if (!_activeJob) return null;
  return { jobId: _activeJob.jobId, status: _activeJob.status, logPath: _activeJob.logPath, startedAt: _activeJob.startedAt };
}

export function cancelRemoteJob() {
  if (!_activeJob) return { ok: false, error: "No active job" };
  try { _activeJob.conn.end(); _activeJob.status = "cancelled"; _activeJob = null; return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
}

export function readLogTail(logPath, lines = 200) {
  try {
    if (!fs.existsSync(logPath)) return { ok: true, lines: [] };
    const all = fs.readFileSync(logPath, "utf8").split("\n");
    return { ok: true, lines: all.slice(-lines) };
  } catch (e) { return { ok: false, error: e.message }; }
}