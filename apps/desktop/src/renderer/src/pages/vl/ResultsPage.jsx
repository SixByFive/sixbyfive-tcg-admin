// FILE: apps/desktop/src/renderer/src/pages/ResultsPage.jsx
//
// NEW (2026-03-05)
//
// Displays training results and model status:
// - Current model overview (classes, accuracy, config)
// - Accuracy bars (top-1, top-3, top-5)
// - Training run history (list of past runs with metrics)
//
// Data comes from workspace/reports/ and workspace/models/ via IPC.
//
// IPC channels needed (register in registerIpcHandlers.js):
//   visionlab:listTrainingRuns  → results.handlers.listTrainingRuns
//   visionlab:getModelStatus    → results.handlers.getModelStatus

import React, { useCallback, useEffect, useState } from "react";
import Card from "./components/Card";
import Button from "./components/Button";

import "./assets/app.css";
import "./assets/resultsPage.css";

// =====================================================
// Accuracy bar component
// =====================================================

function AccuracyBar({ label, value }) {
  if (value == null) return null;
  const pct = (value * 100).toFixed(1);
  const cls = value >= 0.8 ? "good" : value >= 0.5 ? "mid" : "low";

  return (
    <div className="vlAccRow">
      <div className="vlAccLabel">{label}</div>
      <div className="vlAccBar">
        <div className="vlAccBarFill" style={{ width: `${Math.max(1, value * 100)}%` }} />
      </div>
      <div className={`vlAccValue vlMetricHighlight ${cls}`}>{pct}%</div>
    </div>
  );
}

// =====================================================
// Model overview card
// =====================================================

function ModelOverview({ name, info }) {
  if (!info?.exists) {
    return (
      <Card title={name} subtitle="Not trained yet">
        <div className="vlMutedSmall">
          No model found. Run training to create the {name} classifier.
        </div>
      </Card>
    );
  }

  const cfg = info.config || {};
  const history = info.history?.history || {};
  const lastStage = history.stage2 || history.stage1 || {};

  // Get final metrics from training history
  const finalValAcc = lastVal(lastStage.val_accuracy);
  const finalValTop3 = lastVal(lastStage.val_top3);
  const finalValTop5 = lastVal(lastStage.val_top5);
  const finalTrainAcc = lastVal(lastStage.accuracy);

  return (
    <Card title={name} subtitle={`${info.numClasses || "?"} classes`}>
      <div className="vlModelOverview">
        {/* Accuracy bars */}
        {(finalValAcc != null || finalValTop3 != null || finalValTop5 != null) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <AccuracyBar label="Top-1" value={finalValAcc} />
            <AccuracyBar label="Top-3" value={finalValTop3} />
            <AccuracyBar label="Top-5" value={finalValTop5} />
          </div>
        ) : (
          <div className="vlMutedSmall">No validation metrics available.</div>
        )}

        {/* Config summary */}
        <div className="vlConfigGrid" style={{ marginTop: 8 }}>
          {cfg.epochs && <ConfigItem k="epochs" v={cfg.epochs} />}
          {cfg.learning_rate && <ConfigItem k="lr" v={cfg.learning_rate} />}
          {cfg.fine_tune_at_epoch && <ConfigItem k="fine-tune" v={`epoch ${cfg.fine_tune_at_epoch}`} />}
          {cfg.dropout != null && <ConfigItem k="dropout" v={cfg.dropout} />}
          {cfg.image_size && <ConfigItem k="input" v={`${cfg.image_size}×${cfg.image_size}`} />}
          {cfg.backbone && <ConfigItem k="backbone" v={cfg.backbone.replace("MobileNetV3", "MNv3")} />}
        </div>

        {/* File status */}
        <div className="vlMutedSmall" style={{ marginTop: 8, display: "flex", gap: 12 }}>
          {info.hasKeras && <span>✓ .keras</span>}
          {info.hasSavedModel && <span>✓ SavedModel</span>}
          {info.hasTflite && <span>✓ TFLite</span>}
        </div>
      </div>
    </Card>
  );
}

function ConfigItem({ k, v }) {
  return (
    <div className="vlConfigItem">
      <div className="vlConfigKey">{k}</div>
      <div className="vlConfigVal">{String(v)}</div>
    </div>
  );
}

// =====================================================
// Run history table
// =====================================================

function RunsTable({ runs }) {
  if (!runs?.length) {
    return (
      <div className="vlResultsEmpty">
        <div className="vlResultsEmptyIcon">📊</div>
        <div className="vlMutedSmall">No training runs found.</div>
        <div className="vlMutedSmall">Go to the Train tab and run the pipeline.</div>
      </div>
    );
  }

  return (
    <table className="vlRunsTable">
      <thead>
        <tr>
          <th>Run</th>
          <th>Status</th>
          <th>Identity</th>
          <th>Finish</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <RunRow key={run.runId} run={run} />
        ))}
      </tbody>
    </table>
  );
}

function RunRow({ run }) {
  const id = run.steps?.identity;
  const fin = run.steps?.finish;

  return (
    <tr>
      <td className="mono">{run.runId}</td>
      <td>
        <span className={`vlRunStatusDot ${run.ok ? "ok" : "fail"}`} />
        {run.ok ? "Success" : "Failed"}
      </td>
      <td>
        {id?.evalTop1 != null ? (
          <MetricCell value={id.evalTop1} label="top-1" />
        ) : id?.valAccuracy != null ? (
          <MetricCell value={id.valAccuracy} label="val" />
        ) : id?.ok === false ? (
          <span className="vlMutedSmall">—</span>
        ) : (
          <span className="vlMutedSmall">—</span>
        )}
      </td>
      <td>
        {fin?.evalTop1 != null ? (
          <MetricCell value={fin.evalTop1} label="top-1" />
        ) : fin?.valAccuracy != null ? (
          <MetricCell value={fin.valAccuracy} label="val" />
        ) : (
          <span className="vlMutedSmall">—</span>
        )}
      </td>
      <td className="mono">
        {run.startedAt ? formatDate(run.startedAt) : "—"}
      </td>
    </tr>
  );
}

function MetricCell({ value, label }) {
  const pct = (value * 100).toFixed(1);
  const cls = value >= 0.8 ? "good" : value >= 0.5 ? "mid" : "low";
  return (
    <span className={`vlMetricHighlight ${cls}`}>
      {pct}%
      <span style={{ opacity: 0.4, fontSize: 11, marginLeft: 3 }}>{label}</span>
    </span>
  );
}

// =====================================================
// Main page
// =====================================================

export default function ResultsPage() {
  const [runs, setRuns] = useState(null);
  const [modelStatus, setModelStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [runsRes, statusRes] = await Promise.all([
        window.visionlab.listTrainingRuns(),
        window.visionlab.getModelStatus(),
      ]);

      if (runsRes?.ok) setRuns(runsRes.runs);
      else setError(runsRes?.error || "Failed to load runs");

      if (statusRes?.ok) setModelStatus(statusRes.status);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const identity = modelStatus?.identity;
  const finish = modelStatus?.finish;

  return (
    <div className="vlResultsPage">
      {/* Model overview */}
      <div className="vlModelCards">
        <ModelOverview name="Identity" info={identity} />
        <ModelOverview name="Finish" info={finish} />
      </div>

      {/* Run history */}
      <Card
        title="Training History"
        subtitle="Past training runs and their metrics"
        right={
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        }
      >
        {error && <div className="vlErrorBox" style={{ marginBottom: 10 }}>{error}</div>}
        <RunsTable runs={runs} />
      </Card>
    </div>
  );
}

// =====================================================
// Helpers
// =====================================================

function lastVal(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[arr.length - 1];
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}