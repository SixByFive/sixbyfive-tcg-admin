// FILE: apps/desktop/src/main/ipc/handlers/model.handlers.js
//
// NEW (2026-03-04)
//
// Purpose:
//   IPC handlers for TFJS model inference support in the Test page.
//
// Handlers:
//   visionlab:listModels       -> lists available TFJS models (identity/finish) from workspace/tfjs/
//   visionlab:readModelFile    -> reads a model file (model.json, labels.json, .bin shard) as needed
//
// Why read via IPC instead of a custom protocol?
//   - No CSP changes needed
//   - No protocol registration complexity
//   - model.json and labels.json are small (JSON parsed in renderer)
//   - .bin shards are read as ArrayBuffer and loaded into TFJS via IOHandler
//   - Works identically on Windows/macOS/Linux

import fs from "node:fs";
import path from "node:path";

import { ensureWorkspaceOnStartup } from "../services/workspace.service.js";

const TFJS_MODEL_NAMES = ["identity", "finish"];

/**
 * List available TFJS models under workspace/tfjs/
 *
 * Returns: {
 *   ok: true,
 *   models: [
 *     { name: "finish",   hasModelJson: true, hasLabels: true, shardFiles: ["group1-shard1of1.bin"], ... },
 *     { name: "identity", hasModelJson: true, hasLabels: true, shardFiles: [...], ... },
 *   ]
 * }
 */
export async function listModels() {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    if (!workspacePath) return { ok: false, error: "Workspace path is not set." };

    const tfjsRoot = path.join(workspacePath, "tfjs");

    const models = [];

    for (const name of TFJS_MODEL_NAMES) {
      const modelDir = path.join(tfjsRoot, name);
      const modelJsonPath = path.join(modelDir, "model.json");
      const labelsPath = path.join(modelDir, "labels.json");

      const hasModelJson = fs.existsSync(modelJsonPath);
      const hasLabels = fs.existsSync(labelsPath);

      // Find .bin shard files
      let shardFiles = [];
      let totalWeightBytes = 0;
      let numClasses = 0;
      let labels = [];

      if (hasModelJson) {
        try {
          const files = fs.readdirSync(modelDir);
          shardFiles = files.filter((f) => f.endsWith(".bin")).sort();
          totalWeightBytes = shardFiles.reduce((sum, f) => {
            try {
              return sum + fs.statSync(path.join(modelDir, f)).size;
            } catch {
              return sum;
            }
          }, 0);
        } catch {}
      }

      if (hasLabels) {
        try {
          const raw = fs.readFileSync(labelsPath, "utf8");
          labels = JSON.parse(raw);
          numClasses = Array.isArray(labels) ? labels.length : 0;
        } catch {}
      }

      models.push({
        name,
        dir: modelDir,
        hasModelJson,
        hasLabels,
        shardFiles,
        totalWeightBytes,
        numClasses,
        labels,
        ready: hasModelJson && hasLabels && shardFiles.length > 0,
      });
    }

    return { ok: true, models };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * Read a single file from a TFJS model directory.
 *
 * payload: { modelName: "finish" | "identity", fileName: "model.json" | "labels.json" | "group1-shard1of1.bin" }
 *
 * Returns:
 *   For .json files:  { ok, type: "json", data: <parsed object> }
 *   For .bin files:   { ok, type: "binary", data: <Buffer as ArrayBuffer via structured clone> }
 */
export async function readModelFile(_evt, payload) {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    if (!workspacePath) return { ok: false, error: "Workspace path is not set." };

    const modelName = String(payload?.modelName || "").trim();
    const fileName = String(payload?.fileName || "").trim();

    if (!modelName || !TFJS_MODEL_NAMES.includes(modelName)) {
      return { ok: false, error: `Invalid model name: ${modelName}` };
    }

    // Prevent path traversal
    if (fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
      return { ok: false, error: `Invalid file name: ${fileName}` };
    }

    const filePath = path.join(workspacePath, "tfjs", modelName, fileName);

    if (!fs.existsSync(filePath)) {
      return { ok: false, error: `File not found: ${fileName} in tfjs/${modelName}/` };
    }

    if (fileName.endsWith(".json")) {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      return { ok: true, type: "json", data };
    }

    if (fileName.endsWith(".bin")) {
      // Read as Buffer -> Electron IPC will structured-clone it as ArrayBuffer
      const buf = fs.readFileSync(filePath);
      // Convert Node Buffer to ArrayBuffer for clean IPC transfer
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return { ok: true, type: "binary", data: ab };
    }

    return { ok: false, error: `Unsupported file type: ${fileName}` };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}