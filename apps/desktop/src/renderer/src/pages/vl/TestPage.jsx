// FILE: apps/desktop/src/renderer/src/pages/vl/TestPage.jsx

import React, { useCallback, useEffect, useRef, useState } from "react";
import Card from "./components/Card";
import Button from "./components/Button";
import { adminApi } from "../../lib/api";

import "./assets/app.css";
import "./assets/testPage.css";

// ── UI components ─────────────────────────────────────────────────────────────

function ClassifierResults({ title, predictions, inferenceMs }) {
  return (
    <div className="vlTestResultSection">
      <div className="vlTestResultHeader">
        <div className="vlTestResultTitle">{title}</div>
        {inferenceMs != null && <div className="vlTestResultTime">{inferenceMs.toFixed(0)} ms</div>}
      </div>
      <div className="vlTestResultBody">
        {predictions?.length ? (
          predictions.map((p, i) => (
            <div key={p.label} className={`vlTestPredRow${i === 0 ? " top" : ""}`}>
              <div className="vlTestPredRank">{i + 1}</div>
              <div className="vlTestPredInfo">
                <div className="vlTestPredLabel">{p.label}</div>
                <div className="vlTestPredBar">
                  <div className="vlTestPredBarFill" style={{ width: `${Math.max(1, p.confidence * 100)}%` }} />
                </div>
              </div>
              <div className="vlTestPredConf">{(p.confidence * 100).toFixed(1)}%</div>
            </div>
          ))
        ) : (
          <div className="vlMutedSmall" style={{ padding: "8px 0" }}>
            {predictions === null ? "Drop an image to see predictions" : "No predictions (model not trained yet)"}
          </div>
        )}
      </div>
    </div>
  );
}

function IdentityResult({ result, setMatches, setLoading, inferenceMs }) {
  if (!result) return (
    <div className="vlTestResultSection">
      <div className="vlTestResultHeader"><div className="vlTestResultTitle">Identity (YOLO + OCR)</div></div>
      <div className="vlTestResultBody">
        <div className="vlMutedSmall" style={{ padding: "8px 0" }}>Drop an image to identify</div>
      </div>
    </div>
  );

  if (!result.ok) return (
    <div className="vlTestResultSection">
      <div className="vlTestResultHeader"><div className="vlTestResultTitle">Identity (YOLO + OCR)</div></div>
      <div className="vlTestResultBody">
        <div className="vlErrorBox" style={{ fontSize: 12 }}>{result.error}</div>
      </div>
    </div>
  );

  const detected   = result.detectedClasses || [];
  const classNames = { 0: "card", 1: "name", 2: "number" };

  return (
    <div className="vlTestResultSection">
      <div className="vlTestResultHeader">
        <div className="vlTestResultTitle">Identity (YOLO + OCR)</div>
        {inferenceMs != null && <div className="vlTestResultTime">{inferenceMs.toFixed(0)} ms</div>}
      </div>
      <div className="vlTestResultBody">
        <div className="vlTestIdentityGrid">
          <div className="vlTestIdentityRow">
            <span className="vlTestIdentityLabel">Name</span>
            <span className="vlTestIdentityValue">{result.name ?? <em className="vlMutedSmall">not read</em>}</span>
          </div>
          <div className="vlTestIdentityRow">
            <span className="vlTestIdentityLabel">Number</span>
            <span className="vlTestIdentityValue">
              {result.number
                ? <>{result.number}{result.total ? <span className="vlMutedSmall"> / {result.total}</span> : null}</>
                : <em className="vlMutedSmall">not read</em>}
            </span>
          </div>
          <div className="vlTestIdentityRow">
            <span className="vlTestIdentityLabel">Detected</span>
            <span className="vlTestIdentityValue" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[0, 1, 2].map((c) => (
                <span key={c} className={`vlBadge${detected.includes(c) ? " ok" : ""}`} style={{ fontSize: 11 }}>
                  {classNames[c]}
                </span>
              ))}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 10, borderTop: "1px solid var(--vl-border)", paddingTop: 10 }}>
          <div className="vlMutedSmall" style={{ marginBottom: 6 }}>Set lookup</div>
          {setLoading ? (
            <div className="vlMutedSmall">Looking up sets…</div>
          ) : setMatches === null ? (
            <div className="vlMutedSmall">—</div>
          ) : setMatches.length === 0 ? (
            <div className="vlMutedSmall">No set found with {result.total} cards</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {setMatches.map((s) => (
                <div key={s.code} className="vlTestSetMatch">
                  <span className="vlMono" style={{ fontSize: 12 }}>{s.code}</span>
                  <span style={{ marginLeft: 8, fontSize: 13 }}>{s.name}</span>
                  {s.official_count != null && (
                    <span className="vlMutedSmall" style={{ marginLeft: 6 }}>({s.official_count} cards)</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TestPage() {
  const [imageUrl, setImageUrl]     = useState(null);
  const [fName, setFName]           = useState(null);
  const [dragOver, setDragOver]     = useState(false);
  const imgRef = useRef(null);

  const [running, setRunning]       = useState(false);
  const [inferErr, setInferErr]     = useState(null);
  const [inferenceMs, setInferenceMs] = useState(null);

  const [identityRes, setIdentityRes] = useState(null);
  const [setMatches, setSetMatches]   = useState(null);
  const [setLoading, setSetLoading]   = useState(false);

  const lookupSet = useCallback(async (total) => {
    if (!total) { setSetMatches(null); return; }
    setSetLoading(true);
    setSetMatches(null);
    try {
      const resp = await adminApi.getCatalogSets({ pageSize: 500 });
      const sets = Array.isArray(resp) ? resp : (resp?.sets ?? resp?.data ?? []);
      const n    = parseInt(total, 10);
      setSetMatches(sets.filter((s) => {
        const count = s.official_count ?? s.total_cards ?? s.ingested_cards;
        return count === n;
      }));
    } catch (e) {
      console.error("[TestPage] set lookup:", e);
      setSetMatches([]);
    } finally {
      setSetLoading(false);
    }
  }, []);

  const runInference = useCallback(async (dataUrl) => {
    setRunning(true);
    setInferErr(null);
    setIdentityRes(null);
    setSetMatches(null);

    try {
      const t0     = performance.now();
      const result = await window.visionlab.identify({ imageDataUrl: dataUrl });
      setInferenceMs(performance.now() - t0);
      setIdentityRes(result);
      if (result?.ok && result.total) lookupSet(result.total);
    } catch (e) {
      setInferErr(String(e?.message || e));
    } finally {
      setRunning(false);
    }
  }, [lookupSet]);

  // Image helpers
  const loadFile = useCallback((file) => {
    if (!file) return;
    setFName(file.name || "image");
    setIdentityRes(null); setSetMatches(null); setInferErr(null); setInferenceMs(null);
    const r = new FileReader();
    r.onload = (e) => setImageUrl(e.target.result);
    r.readAsDataURL(file);
  }, []);

  const onImgLoad = useCallback(() => {
    if (imageUrl) runInference(imageUrl);
  }, [imageUrl, runInference]);

  const clearImg = useCallback(() => {
    setImageUrl(null); setFName(null);
    setIdentityRes(null); setSetMatches(null); setInferErr(null); setInferenceMs(null);
  }, []);

  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setDragOver(false); }, []);
  const onDrop      = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const f = Array.from(e.dataTransfer?.files || []).find((f) =>
      ["image/jpeg", "image/png", "image/webp"].includes(f.type));
    if (f) loadFile(f);
  }, [loadFile]);
  const onClickDrop = useCallback(() => {
    if (imageUrl) return;
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp";
    inp.onchange = (e) => { const f = e.target?.files?.[0]; if (f) loadFile(f); };
    inp.click();
  }, [imageUrl, loadFile]);

  useEffect(() => {
    const h = (e) => {
      const it = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
      if (it) { const f = it.getAsFile(); if (f) loadFile(f); }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [loadFile]);

  const finishPreds = identityRes?.ok ? (identityRes.finish ?? []) : null;
  const stampsPreds = identityRes?.ok ? (identityRes.stamps ?? []) : null;

  return (
    <div className="vlTestPage">
      <div className="vlTestSplit">

        {/* ── Left: drop zone ─────────────────────────────────────────── */}
        <div className="vlTestLeft">
          <Card
            title="Test Inference"
            subtitle="YOLO detection + OCR identity + finish and stamps classifiers"
            right={
              <div className="vlRow" style={{ gap: 8 }}>
                {imageUrl && <Button variant="secondary" onClick={clearImg}>Clear</Button>}
                {imageUrl && <Button onClick={() => runInference(imageUrl)} disabled={running}>Re-run</Button>}
              </div>
            }
          >
            <div
              className={["vlTestDropArea", dragOver ? "over" : "", imageUrl ? "hasImage" : ""].filter(Boolean).join(" ")}
              onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              onClick={onClickDrop}
            >
              {imageUrl ? (
                <>
                  <img ref={imgRef} src={imageUrl} alt={fName || "image"}
                    className="vlTestPreviewImg" onLoad={onImgLoad} crossOrigin="anonymous" />
                  <button className="vlTestClearBtn" onClick={(e) => { e.stopPropagation(); clearImg(); }}>✕</button>
                </>
              ) : (
                <>
                  <div className="vlTestDropIcon">🃏</div>
                  <div className="vlTestDropLabel">Drop a card image here</div>
                  <div className="vlTestDropHint">or click to pick · paste Ctrl+V · .jpg .png .webp</div>
                </>
              )}
            </div>

            {fName && <div className="vlMutedSmall" style={{ marginTop: 8 }}><code>{fName}</code></div>}

            {!imageUrl && (
              <div className="vlMutedSmall" style={{ marginTop: 12 }}>
                Runs YOLO + EasyOCR for identity, TFLite classifiers for finish and stamps.
                Train and export models first if not available.
              </div>
            )}
          </Card>
        </div>

        {/* ── Right: results ──────────────────────────────────────────── */}
        <div className="vlTestRight">
          {running && (
            <div className="vlTestRunning"><div className="vlTestSpinner" />Running inference…</div>
          )}
          {inferErr && <div className="vlErrorBox" style={{ marginBottom: 8 }}>{inferErr}</div>}

          <IdentityResult
            result={identityRes}
            setMatches={setMatches}
            setLoading={setLoading}
            inferenceMs={inferenceMs}
          />
          <ClassifierResults title="Finish Classifier" predictions={finishPreds} />
          <ClassifierResults title="Stamps Classifier" predictions={stampsPreds} />
        </div>

      </div>
    </div>
  );
}
