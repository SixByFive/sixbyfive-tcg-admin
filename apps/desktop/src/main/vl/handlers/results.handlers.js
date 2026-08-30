// FILE: apps/desktop/src/main/ipc/handlers/results.handlers.js
//
// NEW (2026-03-05)
//
// IPC handlers for reading training results from the workspace.
//
// Uses readSettings() to get workspace path (same pattern as other handlers).

import fs from "node:fs";
import path from "node:path";
import { readSettings } from "../services/settings.service.js";

function getWorkspacePath() {
  const settings = readSettings();
  return settings?.workspacePath || null;
}

/**
 * List all training runs, sorted newest first.
 */
export async function listTrainingRuns() {
  const ws = getWorkspacePath();
  if (!ws) return { ok: false, error: "No workspace selected" };

  const reportsDir = path.join(ws, "reports");
  if (!fs.existsSync(reportsDir)) return { ok: true, runs: [] };

  try {
    const files = fs.readdirSync(reportsDir).filter(
      (f) => f.startsWith("training_run_") && f.endsWith(".json")
    );

    const runs = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(reportsDir, file), "utf-8");
        const report = JSON.parse(raw);
        const runId = report.runId || file.replace("training_run_", "").replace(".json", "");

        runs.push({
          runId,
          file,
          startedAt: report.startedAt || null,
          finishedAt: report.finishedAt || null,
          ok: report.ok || false,
          config: report.config || null,
          steps: summarizeSteps(report.steps || {}),
        });
      } catch {
        // Skip malformed files
      }
    }

    runs.sort((a, b) => (b.runId || "").localeCompare(a.runId || ""));
    return { ok: true, runs };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

function summarizeSteps(steps) {
  const summary = {};

  for (const key of ["train_detection", "train_finish", "train_stamps"]) {
    const s = steps[key];
    if (!s) continue;
    const name = key.replace("train_", "");
    summary[name] = {
      ok: s.ok || false,
      numClasses: s.numClasses || null,
      valAccuracy: s.val_accuracy || null,
      valTop3: s.val_top3 || null,
      valTop5: s.val_top5 || null,
      // YOLO metrics
      mAP50: s.mAP50 || null,
      mAP50_95: s.mAP50_95 || null,
      warnings: (s.warnings || []).length,
    };
  }

  for (const key of ["eval_finish", "eval_stamps"]) {
    const s = steps[key];
    if (!s) continue;
    const name = key.replace("eval_", "");
    if (!summary[name]) summary[name] = {};
    summary[name].evalTop1 = s.top1 || null;
    summary[name].evalTop3 = s.top3 || null;
    summary[name].evalTop5 = s.top5 || null;
    summary[name].evalExamples = s.evaluated_examples || null;
  }

  return summary;
}

/**
 * Get detailed results for a specific training run.
 */
export async function getTrainingRunDetail(_event, runId) {
  const ws = getWorkspacePath();
  if (!ws) return { ok: false, error: "No workspace selected" };

  const reportsDir = path.join(ws, "reports");
  const runFile = path.join(reportsDir, `training_run_${runId}.json`);

  if (!fs.existsSync(runFile)) {
    return { ok: false, error: `Run report not found: ${runFile}` };
  }

  try {
    const raw = fs.readFileSync(runFile, "utf-8");
    const report = JSON.parse(raw);

    const detail = { ok: true, report, metrics: {}, history: {} };

    for (const classifier of ["finish", "stamps"]) {
      const metricsPath = path.join(reportsDir, classifier, runId, "metrics.json");
      if (fs.existsSync(metricsPath)) {
        try { detail.metrics[classifier] = JSON.parse(fs.readFileSync(metricsPath, "utf-8")); } catch {}
      }

      const classReportPath = path.join(reportsDir, classifier, runId, "classification_report.json");
      if (fs.existsSync(classReportPath)) {
        try { detail.metrics[`${classifier}_classReport`] = JSON.parse(fs.readFileSync(classReportPath, "utf-8")); } catch {}
      }

      const historyPath = path.join(ws, "models", classifier, "train_history.json");
      if (fs.existsSync(historyPath)) {
        try { detail.history[classifier] = JSON.parse(fs.readFileSync(historyPath, "utf-8")); } catch {}
      }
    }

    return detail;
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * Get current model status (config, labels, accuracy, file existence).
 */
export async function getModelStatus() {
  const ws = getWorkspacePath();
  if (!ws) return { ok: false, error: "No workspace selected" };

  const modelsDir = path.join(ws, "models");
  const status = {};

  for (const classifier of ["finish", "stamps"]) {
    const dir = path.join(modelsDir, classifier);
    const info = { exists: false };

    if (fs.existsSync(dir)) {
      info.exists = true;

      const labelsPath = path.join(dir, "labels.json");
      if (fs.existsSync(labelsPath)) {
        try {
          const labels = JSON.parse(fs.readFileSync(labelsPath, "utf-8"));
          info.numClasses = Array.isArray(labels) ? labels.length : 0;
          info.labels = labels;
        } catch {}
      }

      const configPath = path.join(dir, "model_config.json");
      if (fs.existsSync(configPath)) {
        try { info.config = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch {}
      }

      const historyPath = path.join(dir, "train_history.json");
      if (fs.existsSync(historyPath)) {
        try { info.history = JSON.parse(fs.readFileSync(historyPath, "utf-8")); } catch {}
      }

      info.hasKeras = fs.existsSync(path.join(dir, "model.keras"));
      info.hasSavedModel = fs.existsSync(path.join(dir, "savedmodel", "saved_model.pb"));
      info.hasTflite = fs.existsSync(path.join(dir, "model_fp16.tflite"));
    }

    status[classifier] = info;
  }

  // Detection model (YOLO — different path structure)
  const detWeightsDir = path.join(modelsDir, "detection", "detection", "weights");
  const detInfo = { exists: false, type: "yolo" };
  if (fs.existsSync(detWeightsDir)) {
    detInfo.exists = fs.existsSync(path.join(detWeightsDir, "best.pt"));
    detInfo.hasOnnx = fs.existsSync(path.join(detWeightsDir, "best.onnx"));
    const labelsPath = path.join(detWeightsDir, "labels.json");
    if (fs.existsSync(labelsPath)) {
      try {
        const labels = JSON.parse(fs.readFileSync(labelsPath, "utf-8"));
        detInfo.labels = labels;
        detInfo.numClasses = Array.isArray(labels) ? labels.length : 0;
      } catch {}
    }
    const configPath = path.join(detWeightsDir, "model_config.json");
    if (fs.existsSync(configPath)) {
      try { detInfo.config = JSON.parse(fs.readFileSync(configPath, "utf-8")); } catch {}
    }
  }
  status.detection = detInfo;

  return { ok: true, status };
}