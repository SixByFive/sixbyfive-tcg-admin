// FILE: apps/desktop/src/renderer/src/pages/TestPage.jsx
//
// UPDATED (2026-03-04) — v6 (GraphModel)
//
// CHANGES:
// - Uses tf.loadGraphModel() instead of tf.loadLayersModel()
// - No TFOpLambda registration needed (GraphModel uses raw ops, not Keras layers)
// - GraphModel loads in seconds vs minutes for LayersModel
// - Models load on button click only (page stays responsive)
// - Dynamic import of TFJS (CSP-safe via Vite bundling)
// - WebGL backend with CPU fallback
//
// REQUIRES: Re-export models using updated export_tfjs.py (GraphModel format)
//           Then copy to workspace/tfjs/finish/ and workspace/tfjs/identity/

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "./components/Card";
import Button from "./components/Button";

import "./assets/app.css";
import "./assets/testPage.css";

// =====================================================
// TFJS lazy loading (no custom layer registration needed!)
// =====================================================

let tf = null;
let tfReadyPromise = null;

function ensureTf() {
  if (tf) return Promise.resolve(tf);
  if (tfReadyPromise) return tfReadyPromise;

  tfReadyPromise = (async () => {
    console.log("[TestPage] Loading TFJS…");
    const mod = await import("@tensorflow/tfjs");
    tf = mod;
    console.log("[TestPage] TFJS imported, version:", tf.version?.tfjs);

    // No TFOpLambda registration — GraphModel doesn't need it!

    try {
      await tf.setBackend("webgl");
    } catch {
      console.warn("[TestPage] WebGL unavailable, using CPU");
      await tf.setBackend("cpu");
    }
    await tf.ready();
    console.log("[TestPage] Backend:", tf.getBackend());
    return tf;
  })();

  return tfReadyPromise;
}

// =====================================================
// IPC IOHandler for tf.loadGraphModel()
// =====================================================

/**
 * Returns a TFJS IOHandler that loads model files via Electron IPC.
 *
 * tf.loadGraphModel() expects the IOHandler to return:
 *   { modelTopology, weightSpecs, weightData, ... }
 *
 * Same as LayersModel but the topology is a GraphDef JSON (not Keras config).
 */
function ipcModelLoader(modelName) {
  return {
    load: async () => {
      console.log(`[IOHandler] Loading ${modelName}/model.json…`);
      const mjRes = await window.visionlab.readModelFile({ modelName, fileName: "model.json" });
      if (!mjRes?.ok) throw new Error(`model.json: ${mjRes?.error || "failed"}`);

      const mj = mjRes.data;
      if (!mj.modelTopology) throw new Error("Missing modelTopology");
      if (!mj.weightsManifest?.length) throw new Error("Missing weightsManifest");

      // Weight specs
      const weightSpecs = [];
      for (const g of mj.weightsManifest)
        for (const w of g.weights || [])
          weightSpecs.push({ name: w.name, shape: w.shape, dtype: w.dtype || "float32" });

      // Load binary shards
      const bufs = [];
      let total = 0;
      for (const g of mj.weightsManifest)
        for (const p of g.paths || []) {
          console.log(`[IOHandler] Loading ${modelName}/${p}…`);
          const r = await window.visionlab.readModelFile({ modelName, fileName: p });
          if (!r?.ok) throw new Error(`Shard ${p}: ${r?.error}`);
          bufs.push(r.data);
          total += r.data.byteLength;
        }

      // Concatenate shards
      let weightData;
      if (bufs.length === 1) {
        weightData = bufs[0];
      } else {
        weightData = new ArrayBuffer(total);
        const v = new Uint8Array(weightData);
        let off = 0;
        for (const b of bufs) { v.set(new Uint8Array(b), off); off += b.byteLength; }
      }

      console.log(`[IOHandler] ${modelName}: ${weightSpecs.length} weights, ${(total / 1024 / 1024).toFixed(1)} MB`);

      return {
        modelTopology: mj.modelTopology,
        weightSpecs,
        weightData,
        format: mj.format || "graph-model",
        generatedBy: mj.generatedBy || "unknown",
        // GraphModel also uses the signature for input/output mapping
        ...(mj.signature ? { userDefinedMetadata: { signature: mj.signature } } : {}),
      };
    },
  };
}

// =====================================================
// Preprocessing
// =====================================================

const IMAGE_SIZE = 224;

/** MobileNetV3 preprocess_input: [0,255] → [-1,1] */
function preprocessImage(imgEl) {
  return tf.tidy(() => {
    let t = tf.browser.fromPixels(imgEl);
    t = tf.image.resizeBilinear(t, [IMAGE_SIZE, IMAGE_SIZE]);
    return t.toFloat().div(127.5).sub(1.0).expandDims(0);
  });
}

// =====================================================
// UI components
// =====================================================

function ModelBadge({ name, state, numClasses, totalWeightBytes, error }) {
  const dotCls =
    state === "loaded" ? "dot ready"
    : state === "loading" ? "dot loading"
    : "dot missing";

  const label =
    state === "loaded" ? "Loaded"
    : state === "loading" ? "Loading…"
    : state === "error" ? "Error"
    : state === "available" ? "Ready"
    : "Not found";

  const size = totalWeightBytes ? `${(totalWeightBytes / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div className="vlTestModelBadge" title={error || ""}>
      <span className={dotCls} />
      <span className="modelName">{name}</span>
      <span className="modelMeta">
        {label}{numClasses ? ` · ${numClasses} cls` : ""}{size ? ` · ${size}` : ""}
      </span>
    </div>
  );
}

function PredictionResults({ title, predictions, inferenceMs }) {
  if (!predictions?.length) {
    return (
      <div className="vlTestResultSection">
        <div className="vlTestResultHeader"><div className="vlTestResultTitle">{title}</div></div>
        <div className="vlTestResultBody">
          <div className="vlTestEmpty">
            <div className="vlTestEmptyIcon">📊</div>
            <div className="vlMutedSmall">Drop an image to see predictions</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vlTestResultSection">
      <div className="vlTestResultHeader">
        <div className="vlTestResultTitle">{title}</div>
        {inferenceMs != null && <div className="vlTestResultTime">{inferenceMs.toFixed(0)} ms</div>}
      </div>
      <div className="vlTestResultBody">
        {predictions.map((p, i) => (
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
        ))}
      </div>
    </div>
  );
}

// =====================================================
// Main page
// =====================================================

const TOP_K = 5;

export default function TestPage() {
  const [catalog, setCatalog] = useState(null);
  const [catalogErr, setCatalogErr] = useState(null);

  const modelsRef = useRef({});
  const labelsRef = useRef({});
  const [ms, setMs] = useState({ finish: "init", identity: "init" });
  const [me, setMe] = useState({});

  const [imageUrl, setImageUrl] = useState(null);
  const [fName, setFName] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const imgRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [finishRes, setFinishRes] = useState(null);
  const [identityRes, setIdentityRes] = useState(null);
  const [finishTime, setFinishTime] = useState(null);
  const [identityTime, setIdentityTime] = useState(null);
  const [inferErr, setInferErr] = useState(null);

  // Catalog on mount (lightweight IPC only)
  useEffect(() => {
    (async () => {
      try {
        const r = await window.visionlab.listModels();
        if (!r?.ok) throw new Error(r?.error || "listModels failed");
        setCatalog(r.models);
        const st = {};
        for (const m of r.models) st[m.name] = m.ready ? "available" : "init";
        setMs((p) => ({ ...p, ...st }));
      } catch (e) {
        setCatalogErr(String(e?.message || e));
      }
    })();
  }, []);

  // Load one model (button-triggered)
  const loadOne = useCallback(async (name) => {
    const info = catalog?.find((m) => m.name === name);
    if (!info?.ready) return;

    setMs((p) => ({ ...p, [name]: "loading" }));
    setMe((p) => ({ ...p, [name]: null }));

    try {
      const tfMod = await ensureTf();
      console.log(`[TestPage] Loading "${name}" as GraphModel…`);
      const t0 = performance.now();

      // GraphModel — no Keras layer deserialization, no TFOpLambda
      const model = await tfMod.loadGraphModel(ipcModelLoader(name));

      const sec = ((performance.now() - t0) / 1000).toFixed(1);
      console.log(`[TestPage] "${name}" loaded in ${sec}s`);

      modelsRef.current[name] = model;
      labelsRef.current[name] = info.labels || [];
      setMs((p) => ({ ...p, [name]: "loaded" }));
    } catch (e) {
      console.error(`[TestPage] "${name}" failed:`, e);
      setMs((p) => ({ ...p, [name]: "error" }));
      setMe((p) => ({ ...p, [name]: String(e?.message || e) }));
    }
  }, [catalog]);

  const loadAll = useCallback(async () => {
    if (!catalog) return;
    for (const m of catalog) {
      if (m.ready && ms[m.name] !== "loaded" && ms[m.name] !== "loading") {
        await loadOne(m.name);
      }
    }
  }, [catalog, ms, loadOne]);

  const anyLoaded = ms.finish === "loaded" || ms.identity === "loaded";
  const anyLoading = ms.finish === "loading" || ms.identity === "loading";
  const canLoad = catalog?.some((m) => m.ready && ms[m.name] !== "loaded" && ms[m.name] !== "loading");

  // Inference
  const runInference = useCallback(async () => {
    const img = imgRef.current;
    if (!img?.complete || !img.naturalWidth || !tf || !anyLoaded) return;

    setRunning(true);
    setInferErr(null);

    try {
      const input = preprocessImage(img);

      if (ms.finish === "loaded" && modelsRef.current.finish) {
        const m = modelsRef.current.finish;
        console.log("[TestPage] finish model inputs:", m.inputNodes);
        console.log("[TestPage] finish model outputs:", m.outputNodes);
        const t0 = performance.now();
        // GraphModel: use execute() with explicit output node names
        const results = m.execute(input);
        console.log("[TestPage] finish execute() returned:", results, typeof results, Array.isArray(results));
        const pred = Array.isArray(results) ? results[0] : results;
        const data = await pred.data();
        setFinishTime(performance.now() - t0);
        if (Array.isArray(results)) results.forEach(t => t?.dispose?.());
        else if (results?.dispose) results.dispose();
        setFinishRes(topK(data, labelsRef.current.finish || [], TOP_K));
      }

      if (ms.identity === "loaded" && modelsRef.current.identity) {
        const m = modelsRef.current.identity;
        const t0 = performance.now();
        const results = m.execute(input);
        const pred = Array.isArray(results) ? results[0] : results;
        const data = await pred.data();
        setIdentityTime(performance.now() - t0);
        if (Array.isArray(results)) results.forEach(t => t?.dispose?.());
        else if (results?.dispose) results.dispose();
        setIdentityRes(topK(data, labelsRef.current.identity || [], TOP_K));
      }

      input.dispose();
    } catch (e) {
      console.error("[TestPage] inference:", e);
      setInferErr(String(e?.message || e));
    } finally {
      setRunning(false);
    }
  }, [ms, anyLoaded]);

  // Image helpers
  const loadFile = useCallback((file) => {
    if (!file) return;
    setFName(file.name || "image");
    setFinishRes(null); setIdentityRes(null);
    setFinishTime(null); setIdentityTime(null);
    setInferErr(null);
    const r = new FileReader();
    r.onload = (e) => setImageUrl(e.target.result);
    r.readAsDataURL(file);
  }, []);

  const onImgLoad = useCallback(() => { runInference(); }, [runInference]);
  const clearImg = useCallback(() => {
    setImageUrl(null); setFName(null);
    setFinishRes(null); setIdentityRes(null);
    setFinishTime(null); setIdentityTime(null);
    setInferErr(null);
  }, []);

  const onDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setDragOver(false); }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const f = Array.from(e.dataTransfer?.files || []).find((f) =>
      ["image/jpeg","image/png","image/webp"].includes(f.type));
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

  const finishInfo = useMemo(() => catalog?.find((m) => m.name === "finish"), [catalog]);
  const identityInfo = useMemo(() => catalog?.find((m) => m.name === "identity"), [catalog]);

  return (
    <div className="vlTestPage">
      <div className="vlTestSplit">
        <div className="vlTestLeft">
          <Card
            title="Test Inference"
            subtitle="Drop or paste a card image to classify"
            right={
              <div className="vlRow" style={{ gap: 8 }}>
                {imageUrl && <Button variant="secondary" onClick={clearImg}>Clear</Button>}
                {imageUrl && anyLoaded && <Button onClick={runInference} disabled={running}>Re-run</Button>}
              </div>
            }
          >
            <div className="vlRow" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <ModelBadge name="Finish" state={ms.finish} numClasses={finishInfo?.numClasses}
                totalWeightBytes={finishInfo?.totalWeightBytes} error={me.finish} />
              <ModelBadge name="Identity" state={ms.identity} numClasses={identityInfo?.numClasses}
                totalWeightBytes={identityInfo?.totalWeightBytes} error={me.identity} />
              {canLoad && (
                <Button variant="secondary" onClick={loadAll} disabled={anyLoading}>
                  {anyLoading ? "Loading…" : "Load Models"}
                </Button>
              )}
            </div>

            {catalogErr && <div className="vlErrorBox" style={{ marginTop: 10 }}>{catalogErr}</div>}
            {me.finish && ms.finish === "error" && (
              <div className="vlErrorBox" style={{ marginTop: 10, fontSize: 12 }}>
                <strong>Finish:</strong> {me.finish}
              </div>
            )}
            {me.identity && ms.identity === "error" && (
              <div className="vlErrorBox" style={{ marginTop: 10, fontSize: 12 }}>
                <strong>Identity:</strong> {me.identity}
              </div>
            )}

            <div
              className={["vlTestDropArea", dragOver ? "over" : "", imageUrl ? "hasImage" : ""].filter(Boolean).join(" ")}
              onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              onClick={onClickDrop} style={{ marginTop: 12 }}
            >
              {imageUrl ? (
                <>
                  <img ref={imgRef} src={imageUrl} alt={fName || "image"}
                    className="vlTestPreviewImg" onLoad={onImgLoad} crossOrigin="anonymous" />
                  <button className="vlTestClearBtn" onClick={(e) => { e.stopPropagation(); clearImg(); }}>✕ Clear</button>
                </>
              ) : (
                <>
                  <div className="vlTestDropIcon">🃏</div>
                  <div className="vlTestDropLabel">Drop a card image here</div>
                  <div className="vlTestDropHint">or click to pick · paste with Ctrl+V · .jpg .png .webp</div>
                  {!anyLoaded && <div className="vlTestDropHint" style={{ marginTop: 6, fontWeight: 700 }}>Click "Load Models" first ↑</div>}
                </>
              )}
            </div>

            {fName && <div className="vlMutedSmall" style={{ marginTop: 8 }}><code>{fName}</code></div>}
          </Card>
        </div>

        <div className="vlTestRight">
          {running && <div className="vlTestRunning"><div className="vlTestSpinner" />Running inference…</div>}
          {inferErr && <div className="vlErrorBox">{inferErr}</div>}
          <PredictionResults title="Finish Classifier" predictions={finishRes} inferenceMs={finishTime} />
          <PredictionResults title="Identity Classifier" predictions={identityRes} inferenceMs={identityTime} />
          {!imageUrl && !running && (
            <div style={{ marginTop: 12 }}>
              <div className="vlMutedSmall">Models load from workspace <code>tfjs/</code>. Train and export first if not available.</div>
              <div className="vlMutedSmall" style={{ marginTop: 8 }}>Input: 224×224 RGB · MobileNetV3 preprocessing · Backend: WebGL</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function topK(probs, labels, k = 5) {
  return Array.from(probs)
    .map((p, i) => ({ index: i, confidence: p, label: labels[i] || `class_${i}` }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, k);
}