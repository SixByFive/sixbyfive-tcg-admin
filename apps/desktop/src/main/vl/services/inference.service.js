// FILE: apps/desktop/src/main/vl/services/inference.service.js
//
// Manages a long-lived Python inference server subprocess.
// The server loads YOLO + EasyOCR once on startup (slow), then handles
// jobs quickly via stdin/stdout JSON lines.

import { randomUUID } from "node:crypto";
import path from "node:path";
import { spawn } from "node:child_process";
import { app } from "electron";
import fs from "node:fs";

let _proc      = null;
let _ready     = false;
let _buffer    = "";
let _pending   = new Map(); // id → { resolve, reject }
let _startupP  = null;      // Promise that resolves when server is ready

function getScriptPath(workspacePath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "vision-trainer", "tools", "inference_server.py");
  }
  // Dev: vision-trainer lives one level up from the workspace folder.
  // workspace = H:\SBF-Vision-Lab\<name>  →  parent = H:\SBF-Vision-Lab
  const parent = path.dirname(workspacePath);
  return path.join(parent, "vision-trainer", "tools", "inference_server.py");
}

function onStdoutLine(line) {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  if ("ready" in msg) {
    if (msg.ready) {
      _ready = true;
    } else {
      const err = new Error(msg.error || "Inference server failed to start");
      for (const [, p] of _pending) p.reject(err);
      _pending.clear();
    }
    return;
  }

  const p = _pending.get(msg.id);
  if (p) {
    _pending.delete(msg.id);
    p.resolve(msg);
  }
}

function spawnServer(workspacePath) {
  if (_startupP) return _startupP;

  const scriptPath = getScriptPath(workspacePath);
  if (!fs.existsSync(scriptPath)) {
    _startupP = Promise.reject(new Error(`Inference script not found: ${scriptPath}`));
    return _startupP;
  }

  const python = process.platform === "win32" ? "python" : "python3";

  _startupP = new Promise((resolve, reject) => {
    console.log(`[inference] spawning: ${python} ${scriptPath}`);
    _proc = spawn(python, [scriptPath, "--workspace", workspacePath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Buffer stdout and split on newlines
    _proc.stdout.on("data", (chunk) => {
      _buffer += chunk.toString("utf8");
      const parts = _buffer.split("\n");
      _buffer = parts.pop();
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        onStdoutLine(trimmed);
        // Resolve startup on first ready signal
        if (!_ready && trimmed.includes('"ready"')) {
          try {
            const msg = JSON.parse(trimmed);
            if (msg.ready) resolve();
            else reject(new Error(msg.error || "not ready"));
          } catch {}
        } else if (_ready && !_startupP) {
          resolve();
        }
      }
    });

    _proc.stderr.on("data", (d) => {
      console.log("[inference]", d.toString("utf8").trimEnd());
    });

    _proc.on("error", (err) => {
      console.error("[inference] spawn error:", err.message);
      _proc = null; _ready = false; _startupP = null;
      reject(err);
      for (const [, p] of _pending) p.reject(err);
      _pending.clear();
    });

    _proc.on("close", (code) => {
      console.log(`[inference] exited (code ${code})`);
      const err = new Error(`Inference server exited (code ${code})`);
      if (!_ready) reject(err);
      _proc = null; _ready = false; _startupP = null;
      for (const [, p] of _pending) p.reject(err);
      _pending.clear();
    });
  });

  return _startupP;
}

/**
 * Identify a card from a data URL image.
 * Returns { ok, name, number, total, detectedClasses, confidences } or { ok: false, error }.
 */
export async function identify(workspacePath, imageDataUrl) {
  if (!_proc) {
    await spawnServer(workspacePath);
  } else if (_startupP) {
    await _startupP;
  }

  const b64 = imageDataUrl.replace(/^data:[^;]+;base64,/, "");

  return new Promise((resolve, reject) => {
    const id  = randomUUID();
    _pending.set(id, { resolve, reject });
    _proc.stdin.write(JSON.stringify({ id, imageB64: b64 }) + "\n");
  });
}

export function stopInferenceServer() {
  if (_proc) {
    try { _proc.kill(); } catch {}
    _proc = null; _ready = false; _startupP = null;
  }
}
