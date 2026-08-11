// FILE: apps/desktop/src/renderer/src/pages/TrainPage.jsx
//
// UPDATED (2026-03-19)
//
// CHANGES:
//   - ADD: Plays a two-tone chime when training completes (local or remote)
//   - KEEP: all other logic unchanged

import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "./components/Card";
import Button from "./components/Button";
import RemoteJobProgress from "./components/RemoteJobProgress";
import { useWorkspace } from "./hooks/useWorkspace";

import "./assets/app.css";
import "./assets/trainPage.css";

// ─── Completion chime ─────────────────────────────────────────────────────────

function playCompletionChime(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const notes = success
      ? [523.25, 783.99]   // C5 → G5  (bright, resolved)
      : [392.00, 311.13];  // G4 → Eb4 (lower, unresolved)

    let time = ctx.currentTime;
    notes.forEach((freq) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.18, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.6);

      time += 0.18;
    });

    setTimeout(() => ctx.close(), 1500);
  } catch {
    // Audio not available — silently skip
  }
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ kind, children }) {
  const cls =
    kind === "ok" ? "vlPill ok" : kind === "error" ? "vlPill error" : "vlPill";
  return <span className={cls}>{children}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainPage() {
  const { workspacePath, openWorkspace } = useWorkspace();
  const enabled = !!workspacePath;

  const [status, setStatus] = useState({ state: "idle" });
  const [only, setOnly] = useState("all");
  const [noExport, setNoExport] = useState(false);
  const [showStdout, setShowStdout] = useState(true);
  const [showStderr, setShowStderr] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lines, setLines] = useState([]);
  const logRef = useRef(null);

  const [deploymentMode, setDeploymentMode] = useState("local");
  const [remoteJob, setRemoteJob] = useState(null);

  const isRemoteMode   = deploymentMode === "fenrir+heimdall";
  const isRemoteActive = isRemoteMode && remoteJob !== null;

  useEffect(() => {
    window.visionlab.getDeploymentConfig?.().then((cfg) => {
      if (cfg?.deploymentMode) setDeploymentMode(cfg.deploymentMode);
    });

    window.visionlab.getRemoteJob?.().then((job) => {
      if (job?.jobId && (job.status === "running" || job.status === "connecting")) {
        setRemoteJob({ ...job, startedAt: job.startedAt ?? Date.now() });
        setStatus({ state: "running" });
      }
    });

    const unsubStatus = window.visionlab.onRemoteStatus?.((payload) => {
      if (payload.status === "running" || payload.status === "connecting") {
        setRemoteJob((prev) => prev ?? {
          jobId:     payload.jobId,
          logPath:   payload.logPath,
          status:    payload.status,
          startedAt: Date.now(),
        });
        setStatus({ state: "running" });
      }
      if (payload.status === "done" || payload.status === "error" || payload.status === "cancelled") {
        setStatus({ state: payload.status === "done" ? "finished" : "error", code: payload.exitCode });
        setRemoteJob((prev) => prev ? { ...prev, status: payload.status } : prev);
        playCompletionChime(payload.status === "done");
      }
    });

    return () => { unsubStatus?.(); };
  }, []);

  useEffect(() => {
    if (!window.visionlab?.onTrainStdout) return;

    const offOut    = window.visionlab.onTrainStdout((msg) => append("out", msg));
    const offErr    = window.visionlab.onTrainStderr((msg) => append("err", msg));
    const offStatus = window.visionlab.onTrainStatus((payload) => {
      if (payload?.status === "done" || payload?.status === "error") {
        playCompletionChime(payload.status === "done");
      }
      setStatus(payload || { state: "idle" });
    });

    return () => { offOut?.(); offErr?.(); offStatus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  const stateLabel = useMemo(() => {
    if (status.state === "idle")     return ["idle",  "Idle"];
    if (status.state === "starting") return ["warn",  "Starting…"];
    if (status.state === "running")  return ["ok",    "Running"];
    if (status.state === "stopping") return ["warn",  "Stopping…"];
    if (status.state === "finished") return ["ok",    `Finished (code ${status.code ?? 0})`];
    if (status.state === "error")    return ["error", "Error"];
    return ["warn", status.state];
  }, [status]);

  function append(kind, text) {
    const chunks = String(text || "").split(/\r?\n/);
    setLines((prev) => {
      const next = prev.slice(-4000);
      for (const c of chunks) {
        if (c === "") continue;
        next.push({ kind, text: c, t: Date.now() });
      }
      return next;
    });
  }

  const filteredLines = useMemo(() => {
    return lines.filter((l) => {
      if (l.kind === "out" && !showStdout) return false;
      if (l.kind === "err" && !showStderr) return false;
      return true;
    });
  }, [lines, showStdout, showStderr]);

  async function start() {
    if (!enabled) return;
    setLines([]);
    setStatus({ state: "starting" });

    const res = await window.visionlab.startTraining({
      only: only === "all" ? null : only,
      noExport,
    });

    if (!res?.ok) {
      append("err", res?.error || "Failed to start training.");
      setStatus({ state: "error" });
      return;
    }

    if (res.jobId) {
      setRemoteJob((prev) => prev ?? {
        jobId:     res.jobId,
        logPath:   res.logPath,
        status:    "running",
        startedAt: Date.now(),
      });
      setStatus({ state: "running" });
    }
  }

  async function stop() {
    const res = await window.visionlab.stopTraining();
    if (!res?.ok) append("err", res?.error || "Failed to stop training.");
  }

  function clearLogs() { setLines([]); }

  async function copyLogs() {
    try {
      const txt = filteredLines.map((l) => `${l.kind === "err" ? "❌" : "▶"} ${l.text}`).join("\n");
      await navigator.clipboard.writeText(txt);
      append("out", "[ui] copied logs to clipboard");
    } catch (e) {
      append("err", `[ui] failed to copy logs: ${String(e?.message || e)}`);
    }
  }

  const modeLabel = deploymentMode === "fenrir+heimdall"
    ? "Fenrir + Heimdall"
    : deploymentMode === "fenrir"
    ? "Fenrir"
    : null;

  return (
    <div className="vlTrainPage">
      <Card
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Train
            {modeLabel && (
              <span className="vlBadge vlBadge--info" style={{ fontSize: 11, fontWeight: 400 }}>
                {modeLabel}
              </span>
            )}
          </span>
        }
        subtitle={
          isRemoteMode
            ? "Runs on Heimdall via SSH. Models are saved back to Fenrir."
            : "Run the Python pipeline and stream logs."
        }
        right={
          <div className="vlTrainTopRight">
            {stateLabel[0] === "ok" ? (
              <Pill kind="ok">{stateLabel[1]}</Pill>
            ) : stateLabel[0] === "error" ? (
              <Pill kind="error">{stateLabel[1]}</Pill>
            ) : (
              <Pill>{stateLabel[1]}</Pill>
            )}

            <Button
              onClick={start}
              disabled={
                !enabled ||
                status.state === "running" ||
                status.state === "starting" ||
                isRemoteActive
              }
            >
              Start
            </Button>

            <Button
              variant="secondary"
              onClick={stop}
              disabled={status.state !== "running" && status.state !== "starting"}
            >
              Stop
            </Button>

            <Button variant="secondary" onClick={openWorkspace} disabled={!enabled}>
              Open Workspace
            </Button>
          </div>
        }
      >
        {!enabled ? (
          <div className="vlMutedSmall">Select a workspace first.</div>
        ) : (
          <div className="vlTrainSplit">

            <div className="vlTrainLeftCol">
              <Card title="Run options" subtitle="Choose what to train, and whether to skip exports.">
                <div className="vlMutedSmall">Train scope</div>
                <div className="vlRow" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {["all", "identity", "finish"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={only === v ? "vlSegBtn active" : "vlSegBtn"}
                      onClick={() => setOnly(v)}
                    >
                      {v === "all" ? "All" : v === "identity" ? "Identity" : "Finish"}
                    </button>
                  ))}
                  <div style={{ width: 10 }} />
                  <label className="vlMutedSmall" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={noExport} onChange={(e) => setNoExport(e.target.checked)} />
                    Skip exports (--no-export)
                  </label>
                </div>
              </Card>

              {!isRemoteMode && (
                <Card title="Log filters" subtitle="Reduce noise while debugging.">
                  <div className="vlRow" style={{ gap: 16, flexWrap: "wrap" }}>
                    <label className="vlMutedSmall" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="checkbox" checked={showStdout} onChange={(e) => setShowStdout(e.target.checked)} />
                      stdout
                    </label>
                    <label className="vlMutedSmall" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="checkbox" checked={showStderr} onChange={(e) => setShowStderr(e.target.checked)} />
                      stderr
                    </label>
                    <label className="vlMutedSmall" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
                      Auto-scroll
                    </label>
                  </div>
                </Card>
              )}

              <div className="vlHint vlTrainFooterHint">
                Outputs are written into your workspace:
                <code style={{ marginLeft: 8 }}>models/</code>,
                <code style={{ marginLeft: 8 }}>tfjs/</code>,
                <code style={{ marginLeft: 8 }}>reports/</code>.
              </div>
            </div>

            {isRemoteActive ? (
              <div className="vlTrainConsoleCard">
                <RemoteJobProgress
                  job={remoteJob}
                  onDone={(payload) => {
                    setStatus({ state: payload.status === "done" ? "finished" : "error", code: payload.exitCode });
                    setRemoteJob((prev) => ({ ...prev, status: payload.status }));
                    playCompletionChime(payload.status === "done");
                  }}
                />
              </div>
            ) : isRemoteMode ? (
              <Card
                title="Remote console"
                subtitle="Output from Heimdall will appear here when training starts."
                className="vlTrainConsoleCard"
              >
                <div className="vlMutedSmall">
                  Click <span className="vlMono">Start</span> to run the pipeline on Heimdall.
                  Output will appear here.
                </div>
              </Card>
            ) : (
              <Card
                title="Live console"
                subtitle="Training stdout/stderr appears here."
                className="vlTrainConsoleCard"
                right={
                  <div className="vlTrainConsoleActions">
                    <Button variant="secondary" onClick={copyLogs} disabled={!filteredLines.length}>Copy</Button>
                    <Button variant="secondary" onClick={clearLogs} disabled={!lines.length}>Clear</Button>
                  </div>
                }
              >
                <div
                  ref={logRef}
                  className="vlTrainLog"
                  onScroll={() => {
                    const el = logRef.current;
                    if (!el) return;
                    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                    if (autoScroll !== nearBottom) setAutoScroll(nearBottom);
                  }}
                >
                  {filteredLines.length ? (
                    filteredLines.map((l, i) => (
                      <div key={`${l.t}_${i}`} className={`vlTrainLogLine ${l.kind === "err" ? "err" : ""}`}>
                        {l.kind === "err" ? "❌ " : "▶ "}
                        {l.text}
                      </div>
                    ))
                  ) : (
                    <div className="vlMutedSmall">
                      Click <span className="vlMono">Start</span> to run the pipeline. Output will appear here.
                    </div>
                  )}
                </div>
              </Card>
            )}

          </div>
        )}
      </Card>
    </div>
  );
}