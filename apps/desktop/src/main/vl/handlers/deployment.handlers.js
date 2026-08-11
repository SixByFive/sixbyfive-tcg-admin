// FILE: apps/desktop/src/main/ipc/handlers/deployment.handlers.js
//
// NEW (2026-03-18)
//
// Purpose:
//   IPC handlers for reading/saving infrastructure settings and managing
//   the Heimdall connection + bootstrap.

import { Client } from "ssh2";
import { readSettings, writeSettings } from "../services/settings.service.js";
import { bootstrapHeimdall } from "../services/remote-runner.service.js";

// ─── Get / save config ────────────────────────────────────────────────────────

export async function getDeploymentConfig() {
  const s = readSettings();
  return {
    deploymentMode:        s.deploymentMode        ?? "local",
    fenrirWorkspacePath:   s.fenrirWorkspacePath   ?? "",
    heimdallHost:          s.heimdallHost          ?? "",
    heimdallPort:          s.heimdallPort          ?? 22,
    heimdallUser:          s.heimdallUser          ?? "",
    heimdallPasswordSet:   !!(s.heimdallPassword),
    heimdallWorkspacePath: s.heimdallWorkspacePath ?? "",
    heimdallRepoUrl:       s.heimdallRepoUrl       ?? "",
    heimdallRepoDir:       s.heimdallRepoDir       ?? "",
    heimdallRepoBranch:    s.heimdallRepoBranch    ?? "main",
  };
}

export async function saveDeploymentConfig(_, config) {
  const current = readSettings();
  const updated = { ...current };

  const fields = [
    "deploymentMode",
    "fenrirWorkspacePath",
    "heimdallHost",
    "heimdallPort",
    "heimdallUser",
    "heimdallWorkspacePath",
    "heimdallRepoUrl",
    "heimdallRepoDir",
    "heimdallRepoBranch",
  ];

  for (const f of fields) {
    if (config[f] !== undefined) updated[f] = config[f];
  }

  // Only overwrite password if a non-empty value was sent
  if (config.heimdallPassword?.trim()) {
    updated.heimdallPassword = config.heimdallPassword;
  }

  return writeSettings(updated) ? { ok: true } : { ok: false, error: "Failed to write settings" };
}

// ─── Connection test ─────────────────────────────────────────────────────────

export async function testHeimdallConnection() {
  const s = readSettings();

  if (!s.heimdallHost || !s.heimdallUser || !s.heimdallPassword) {
    return { ok: false, message: "Host, user, and password are required." };
  }

  // Derive paths the same way remote-runner does
  const pipelinePath = s.heimdallRepoDir
    ? `${s.heimdallRepoDir}/vision-trainer/tools/run_training_pipeline.py`
    : null;
  const venvPython = s.heimdallRepoDir
    ? `${s.heimdallRepoDir}/vision-trainer/.venv/bin/python`
    : null;

  return new Promise((resolve) => {
    const conn = new Client();
    let resolved = false;

    const done = (result) => {
      if (resolved) return;
      resolved = true;
      conn.end();
      resolve(result);
    };

    conn.on("ready", () => {
      const wsCheck       = s.heimdallWorkspacePath
        ? `test -d "${s.heimdallWorkspacePath}" && echo WS_OK || echo WS_MISSING`
        : `echo WS_OK`;
      const pipelineCheck = pipelinePath
        ? `test -f "${pipelinePath}" && echo PIPELINE_OK || echo PIPELINE_MISSING`
        : `echo PIPELINE_MISSING`;
      const venvCheck     = venvPython
        ? `test -f "${venvPython}" && echo VENV_OK || echo VENV_MISSING`
        : `echo VENV_MISSING`;

      conn.exec(`${wsCheck} && ${pipelineCheck} && ${venvCheck}`, (err, stream) => {
        if (err) { done({ ok: false, message: `SSH exec error: ${err.message}` }); return; }

        let out = "";
        stream.on("data",  (d) => (out += d.toString()));
        stream.on("close", () => {
          const wsOk       = out.includes("WS_OK");
          const pipelineOk = out.includes("PIPELINE_OK");
          const venvOk     = out.includes("VENV_OK");

          if (!wsOk) {
            done({ ok: false, message: `Connected, but workspace not found at ${s.heimdallWorkspacePath} — is Fenrir mounted?` });
          } else if (!pipelineOk || !venvOk) {
            done({ ok: true, needsBootstrap: true, message: `Connected — workspace ✓  pipeline ${pipelineOk ? "✓" : "✗"}  venv ${venvOk ? "✓" : "✗"}  — click "Set up Heimdall" to install.` });
          } else {
            done({ ok: true, needsBootstrap: false, message: `${s.heimdallUser}@${s.heimdallHost} — workspace ✓  pipeline ✓  venv ✓` });
          }
        });
      });
    });

    conn.on("error", (err) => done({ ok: false, message: `Connection failed: ${err.message}` }));

    conn.connect({
      host: s.heimdallHost, port: s.heimdallPort ?? 22,
      username: s.heimdallUser, password: s.heimdallPassword,
      readyTimeout: 8000,
    });
  });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export async function runBootstrap(_, { force = false } = {}) {
  return bootstrapHeimdall({ force });
}