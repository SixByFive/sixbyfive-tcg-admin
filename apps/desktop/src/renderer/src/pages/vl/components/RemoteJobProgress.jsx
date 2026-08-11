// FILE: apps/desktop/src/renderer/src/components/RemoteJobProgress.jsx
//
// UPDATED (2026-03-18)
//
// CHANGES:
//   - FIX: Auto-scroll respects manual scroll position
//   - IMPROVE: Much more aggressive noise filtering
//   - IMPROVE: Keras epoch summary lines reformatted to be readable

import React, { useCallback, useEffect, useRef, useState } from "react";
import "../assets/remoteJobProgress.css";

// ─── Line cleaning ─────────────────────────────────────────────────────────────

const ANSI_RE  = /\x1b\[[0-9;]*[a-zA-Z]/g;
const ANSI_RE2 = /\x1b\][^\x07]*\x07/g;

function stripAnsi(s) {
  return s.replace(ANSI_RE, "").replace(ANSI_RE2, "");
}

function resolveCarriageReturns(raw) {
  const parts = raw.split("\r");
  for (let i = parts.length - 1; i >= 0; i--) {
    const s = stripAnsi(parts[i]).trim();
    if (s) return s;
  }
  return "";
}

const NOISE_PATTERNS = [
  /^\s*$/,
  /^[=\->._ ]{3,}$/,
  /\[\d+m/,
  /W0000 00:00/,
  /cpu_allocator_impl/,
  /Allocation of \d+ exceeds/,
  /^\d+\/\d+\s+[\u2501\u2508=>.]+/,
  /^[\u2501\u2508\u25A0\u25CF ]+$/,
  /^[\[]+[\u2501\u2508=>.]+/,
  /ETA:/,
  /^[0-9]+s [0-9]+ms\/step/,
  /^\s*\d+\s+\[/,
  /Corrupt JPEG/,
  /^Using .* device/,
  /^Metal device/,
  /^Created TensorFlow/,
  /tensorflow\/core/,
  /^I\d{4}/,
  /^2\d{3}-\d{2}-\d{2}/,
  /^\d+ms\/step/,
  /step - accuracy/,
];

function isNoise(line) {
  return NOISE_PATTERNS.some((re) => re.test(line));
}

function reformatLine(line) {
  // Keras epoch end summary — reformat to readable
  const epochSummary = line.match(
    /accuracy[:\s]+([\d.]+).*?loss[:\s]+([\d.]+)(?:.*?top3[:\s]+([\d.]+))?/i
  );
  if (epochSummary && !line.includes("val_")) {
    const acc  = (parseFloat(epochSummary[1]) * 100).toFixed(1);
    const loss = parseFloat(epochSummary[2]).toFixed(4);
    const top3 = epochSummary[3]
      ? `  ·  top3 ${(parseFloat(epochSummary[3]) * 100).toFixed(1)}%`
      : "";
    return `train  accuracy ${acc}%  ·  loss ${loss}${top3}`;
  }

  // val_ summary
  const valSummary = line.match(
    /val_accuracy[:\s]+([\d.]+)(?:.*?val_top3[:\s]+([\d.]+))?/i
  );
  if (valSummary) {
    const acc  = (parseFloat(valSummary[1]) * 100).toFixed(1);
    const top3 = valSummary[2]
      ? `  ·  top3 ${(parseFloat(valSummary[2]) * 100).toFixed(1)}%`
      : "";
    return `val    accuracy ${acc}%${top3}`;
  }

  return line;
}

function processRawLine(raw) {
  if (!raw) return null;
  const resolved = resolveCarriageReturns(raw);
  const clean = stripAnsi(resolved)
    .replace(/[\u2500-\u25FF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean || isNoise(clean)) return null;
  return reformatLine(clean);
}

// ─── Progress parsing ─────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  "preprocess",
  "train_identity",
  "train_finish",
  "eval_identity",
  "eval_finish",
  "export",
];

const STEP_LABELS = {
  preprocess:     "Preprocessing data",
  train_identity: "Training identity classifier",
  train_finish:   "Training finish classifier",
  eval_identity:  "Evaluating identity model",
  eval_finish:    "Evaluating finish model",
  export:         "Exporting models",
};

function parseMeta(line) {
  const epochMatch = line.match(/Epoch\s+(\d+)\/(\d+)/i);
  if (epochMatch) return { type: "epoch", epoch: +epochMatch[1], total: +epochMatch[2] };

  const stepMatch = line.match(
    /\b(train_identity|train_finish|eval_identity|eval_finish|export|preprocess)\b/i
  );
  if (stepMatch) return { type: "step", step: stepMatch[1].toLowerCase() };

  const accMatch = line.match(/val_accuracy[:\s]+([\d.]+)/i);
  if (accMatch) return { type: "acc", value: +accMatch[1] };

  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RemoteJobProgress({ job, onDone }) {
  const [lines, setLines]           = useState([]);
  const [currentStep, setStep]      = useState(null);
  const [epoch, setEpoch]           = useState(null);
  const [totalEpochs, setTotEpochs] = useState(null);
  const [lastAcc, setLastAcc]       = useState(null);
  const [elapsed, setElapsed]       = useState(0);
  const [finalStatus, setFinal]     = useState(job?.status ?? "running");

  const logRef      = useRef(null);
  const pollRef     = useRef(null);
  const atBottomRef = useRef(true);

  const scrollIfAtBottom = useCallback(() => {
    if (atBottomRef.current && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, []);

  const applyMeta = useCallback((line) => {
    const p = parseMeta(line);
    if (!p) return;
    if (p.type === "epoch") { setEpoch(p.epoch); setTotEpochs(p.total); }
    if (p.type === "step")  { setStep(p.step); setEpoch(null); setTotEpochs(null); }
    if (p.type === "acc")   { setLastAcc(p.value); }
  }, []);

  const addRawLine = useCallback((raw) => {
    const line = processRawLine(raw);
    if (!line) return;
    setLines((prev) => {
      const next = [...prev, line];
      return next.length > 600 ? next.slice(-600) : next;
    });
    applyMeta(line);
  }, [applyMeta]);

  // Elapsed timer
  useEffect(() => {
    if (!job?.startedAt) return;
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - job.startedAt) / 1000)),
      1000
    );
    return () => clearInterval(t);
  }, [job?.startedAt]);

  // Live events
  useEffect(() => {
    const unsubLine = window.visionlab.onRemoteLine?.((p) => {
      if (p.jobId === job?.jobId) addRawLine(p.line);
    });
    const unsubStatus = window.visionlab.onRemoteStatus?.((p) => {
      if (p.jobId !== job?.jobId) return;
      setFinal(p.status);
      if (p.status === "done" || p.status === "error" || p.status === "cancelled") {
        clearInterval(pollRef.current);
        onDone?.(p);
      }
    });
    return () => { unsubLine?.(); unsubStatus?.(); };
  }, [job?.jobId, addRawLine, onDone]);

  // Log file polling
  useEffect(() => {
    if (!job?.logPath) return;
    const poll = async () => {
      const res = await window.visionlab.readJobLog?.(job.logPath, 500);
      if (!res?.ok || !res.lines?.length) return;
      const cleaned = res.lines.map(processRawLine).filter(Boolean);
      if (!cleaned.length) return;
      setLines((prev) => cleaned.length >= prev.length ? cleaned : prev);
      cleaned.forEach(applyMeta);
    };
    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => clearInterval(pollRef.current);
  }, [job?.logPath, applyMeta]);

  // Auto-scroll — only if at bottom
  useEffect(() => { scrollIfAtBottom(); }, [lines, scrollIfAtBottom]);

  const isDone      = finalStatus === "done";
  const isError     = finalStatus === "error";
  const isCancelled = finalStatus === "cancelled";
  const isRunning   = finalStatus === "running" || finalStatus === "connecting";

  const stepIndex = currentStep ? PIPELINE_STEPS.indexOf(currentStep) : -1;
  const epochPct  = epoch && totalEpochs ? Math.round((epoch / totalEpochs) * 100) : null;
  const elapsed_m = Math.floor(elapsed / 60);
  const elapsed_s = String(elapsed % 60).padStart(2, "0");

  return (
    <div className="remoteJob">

      <div className="remoteJob__header">
        <div className="remoteJob__title">
          <span className={`remoteJob__dot remoteJob__dot--${finalStatus}`} />
          {isDone      && "Training complete"}
          {isError     && "Training failed"}
          {isCancelled && "Job cancelled"}
          {isRunning   && "Training on Heimdall…"}
        </div>
        <div className="remoteJob__meta">
          <span>{elapsed_m}m {elapsed_s}s</span>
          {isRunning && (
            <>
              <span>·</span>
              <button className="remoteJob__cancelBtn" onClick={() => window.visionlab.cancelJob?.()}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="remoteJob__steps">
        {PIPELINE_STEPS.map((s, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
          return (
            <div key={s} className={`remoteJob__step remoteJob__step--${state}`}>
              <span className="remoteJob__stepDot" />
              <span>{STEP_LABELS[s]}</span>
            </div>
          );
        })}
      </div>

      {epochPct !== null && (
        <div className="remoteJob__epochBar">
          <div className="remoteJob__epochBarLabel">
            <span>Epoch {epoch} / {totalEpochs}</span>
            {lastAcc !== null && <span>val_acc {(lastAcc * 100).toFixed(1)}%</span>}
          </div>
          <div className="remoteJob__epochTrack">
            <div className="remoteJob__epochFill" style={{ width: `${epochPct}%` }} />
          </div>
        </div>
      )}

      <div
        ref={logRef}
        className="remoteJob__log"
        onScroll={() => {
          const el = logRef.current;
          if (!el) return;
          atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {lines.length ? (
          lines.map((l, i) => {
            const isErr  = /error|failed|traceback/i.test(l) && !/val_accuracy|accuracy \d/i.test(l);
            const isWarn = /warn/i.test(l);
            const isMeta = /^(train|val)\s+accuracy/.test(l);
            return (
              <div
                key={i}
                className={["remoteJob__logLine", isErr ? "err" : "", isWarn ? "warn" : "", isMeta ? "meta" : ""].filter(Boolean).join(" ")}
              >
                <span className="remoteJob__logPrefix">{isErr ? "❌" : "▶"}</span>
                <span>{l}</span>
              </div>
            );
          })
        ) : (
          <div className="remoteJob__logEmpty">Waiting for output…</div>
        )}
      </div>

      {isDone && (
        <div className="remoteJob__done">
          Models saved to Fenrir. Check the Results page to review accuracy.
        </div>
      )}
      {isError && (
        <div className="remoteJob__error">
          <p>The pipeline exited with an error. Check the log above for details.</p>
          <p className="remoteJob__logPath">{job?.logPath}</p>
        </div>
      )}

    </div>
  );
}