// FILE: apps/desktop/src/renderer/src/components/InfrastructureSettings.jsx
//
// NEW (2026-03-18)
//
// Drop into your SettingsPage as a new section:
//   import InfrastructureSettings from "../components/InfrastructureSettings";
//   <InfrastructureSettings />

import React, { useEffect, useRef, useState } from "react";
import Card from "./Card";
import Button from "./Button";
import "../assets/infrastructureSettings.css";

const MODES = [
  {
    value: "local",
    label: "Local",
    description: "Everything on this PC. Workspace on a local drive.",
  },
  {
    value: "fenrir",
    label: "Fenrir storage",
    description: "Workspace on Fenrir. Training still runs locally.",
  },
  {
    value: "fenrir+heimdall",
    label: "Fenrir + Heimdall",
    description: "Workspace on Fenrir. Training runs on Heimdall via SSH.",
  },
];

export default function InfrastructureSettings() {
  const [config, setConfig]               = useState(null);
  const [password, setPassword]           = useState("");
  const [dirty, setDirty]                 = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saveMsg, setSaveMsg]             = useState(null);
  const [testing, setTesting]             = useState(false);
  const [testResult, setTestResult]       = useState(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapLog, setBootstrapLog]   = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => {
    window.visionlab.getDeploymentConfig?.().then((c) => { if (c) setConfig(c); });

    const unsubLine = window.visionlab.onRemoteLine?.((p) => {
      if (p.jobId === "bootstrap") {
        setBootstrapLog((prev) => [...prev.slice(-300), p.line]);
      }
    });
    const unsubStatus = window.visionlab.onRemoteStatus?.((p) => {
      if (p.jobId !== "bootstrap") return;
      if (p.status === "done" || p.status === "error") {
        setBootstrapping(false);
        setTestResult({ ok: p.status === "done", message: p.message, needsBootstrap: false });
      }
    });

    return () => { unsubLine?.(); unsubStatus?.(); };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bootstrapLog]);

  const update = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    setSaveMsg(null);
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...config };
    if (password.trim()) payload.heimdallPassword = password;
    const res = await window.visionlab.saveDeploymentConfig?.(payload);
    setSaving(false);
    setDirty(false);
    setSaveMsg(res?.ok ? "Saved." : (res?.error ?? "Save failed."));
    if (res?.ok) setPassword("");
    return res;
  };

  const handleTest = async () => {
    if (dirty || password.trim()) await handleSave();
    setTesting(true);
    setTestResult(null);
    const res = await window.visionlab.testHeimdallConnection?.();
    setTesting(false);
    setTestResult(res);
  };

  const handleBootstrap = async (force = false) => {
    if (dirty || password.trim()) await handleSave();
    setBootstrapping(true);
    setBootstrapLog([]);
    setTestResult(null);
    await window.visionlab.runBootstrap?.({ force });
    // result arrives via onRemoteStatus listener
  };

  if (!config) return <p className="vlMuted">Loading…</p>;

  const isFenrir   = config.deploymentMode !== "local";
  const isHeimdall = config.deploymentMode === "fenrir+heimdall";

  return (
    <div className="infraSettings">

      {/* ── Mode ── */}
      <Card>
        <h3 className="infraSettings__sectionTitle">Deployment mode</h3>
        <div className="infraSettings__modeList">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`infraSettings__modeOption ${config.deploymentMode === m.value ? "infraSettings__modeOption--selected" : ""}`}
            >
              <input
                type="radio"
                name="deploymentMode"
                value={m.value}
                checked={config.deploymentMode === m.value}
                onChange={() => update("deploymentMode", m.value)}
              />
              <div>
                <div className="infraSettings__modeLabel">{m.label}</div>
                <div className="infraSettings__modeDesc">{m.description}</div>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {/* ── Fenrir ── */}
      {isFenrir && (
        <Card>
          <h3 className="infraSettings__sectionTitle">Fenrir (storage)</h3>
          <label className="infraSettings__fieldLabel">
            Workspace path on this PC
            <span className="infraSettings__fieldHint">UNC path to the shared workspace as Windows sees it</span>
          </label>
          <input
            className="vlInput"
            type="text"
            value={config.fenrirWorkspacePath ?? ""}
            onChange={(e) => update("fenrirWorkspacePath", e.target.value)}
            placeholder="\\192.168.0.131\storage\SBF Vision Lab Workspace"
            spellCheck={false}
          />
        </Card>
      )}

      {/* ── Heimdall ── */}
      {isHeimdall && (
        <Card>
          <h3 className="infraSettings__sectionTitle">Heimdall (training node)</h3>

          <p className="infraSettings__groupLabel">SSH connection</p>
          <div className="infraSettings__row">
            <div className="infraSettings__field">
              <label className="infraSettings__fieldLabel">Host</label>
              <input className="vlInput" type="text" value={config.heimdallHost ?? ""} onChange={(e) => update("heimdallHost", e.target.value)} placeholder="192.168.0.x" spellCheck={false} />
            </div>
            <div className="infraSettings__field infraSettings__field--narrow">
              <label className="infraSettings__fieldLabel">Port</label>
              <input className="vlInput" type="number" value={config.heimdallPort ?? 22} onChange={(e) => update("heimdallPort", +e.target.value)} min={1} max={65535} />
            </div>
          </div>

          <div className="infraSettings__row">
            <div className="infraSettings__field">
              <label className="infraSettings__fieldLabel">Username</label>
              <input className="vlInput" type="text" value={config.heimdallUser ?? ""} onChange={(e) => update("heimdallUser", e.target.value)} placeholder="ryan" autoComplete="off" spellCheck={false} />
            </div>
            <div className="infraSettings__field">
              <label className="infraSettings__fieldLabel">
                Password
                {config.heimdallPasswordSet && !password && (
                  <span className="infraSettings__fieldHint infraSettings__fieldHint--inline"> (saved)</span>
                )}
              </label>
              <input className="vlInput" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setDirty(true); }} placeholder={config.heimdallPasswordSet ? "••••••••" : "Enter password"} autoComplete="new-password" />
            </div>
          </div>

          <p className="infraSettings__groupLabel" style={{ marginTop: 16 }}>Workspace</p>
          <label className="infraSettings__fieldLabel">
            Path on Heimdall
            <span className="infraSettings__fieldHint">Where Fenrir is mounted on the training server</span>
          </label>
          <input className="vlInput" type="text" value={config.heimdallWorkspacePath ?? ""} onChange={(e) => update("heimdallWorkspacePath", e.target.value)} placeholder="/mnt/fenrir/SBF Vision Lab Workspace" spellCheck={false} />

          <p className="infraSettings__groupLabel" style={{ marginTop: 16 }}>Pipeline (git)</p>
          <label className="infraSettings__fieldLabel">
            Repository URL
            <span className="infraSettings__fieldHint">Cloned onto Heimdall by "Set up Heimdall"</span>
          </label>
          <input className="vlInput" type="text" value={config.heimdallRepoUrl ?? ""} onChange={(e) => update("heimdallRepoUrl", e.target.value)} placeholder="https://github.com/yourname/sbf-vision-lab.git" spellCheck={false} />

          <div className="infraSettings__row" style={{ marginTop: 12 }}>
            <div className="infraSettings__field">
              <label className="infraSettings__fieldLabel">Clone directory on Heimdall</label>
              <input className="vlInput" type="text" value={config.heimdallRepoDir ?? ""} onChange={(e) => update("heimdallRepoDir", e.target.value)} placeholder="/home/ryan/sbf-vision-lab" spellCheck={false} />
            </div>
            <div className="infraSettings__field infraSettings__field--narrow">
              <label className="infraSettings__fieldLabel">Branch</label>
              <input className="vlInput" type="text" value={config.heimdallRepoBranch ?? "main"} onChange={(e) => update("heimdallRepoBranch", e.target.value)} placeholder="main" spellCheck={false} />
            </div>
          </div>

          {/* Actions */}
          <div className="infraSettings__actions">
            <Button variant="secondary" onClick={handleTest} disabled={testing || bootstrapping}>
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button variant="secondary" onClick={() => handleBootstrap(false)} disabled={bootstrapping || testing}>
              {bootstrapping ? "Setting up…" : "Set up Heimdall"}
            </Button>
            {testResult?.ok && !testResult.needsBootstrap && !bootstrapping && (
              <button className="infraSettings__rebootstrapLink" onClick={() => handleBootstrap(true)} disabled={bootstrapping}>
                Force reinstall
              </button>
            )}
          </div>

          {testResult && (
            <div className={`infraSettings__testResult infraSettings__testResult--${testResult.ok ? "ok" : "fail"}`}>
              {testResult.message}
              {testResult.needsBootstrap && <span> Click "Set up Heimdall" to install the pipeline.</span>}
            </div>
          )}

          {bootstrapLog.length > 0 && (
            <div className="infraSettings__bootstrapLog">
              {bootstrapLog.map((l, i) => <div key={i} className="infraSettings__bootstrapLogLine">{l}</div>)}
              <div ref={logEndRef} />
            </div>
          )}
        </Card>
      )}

      {/* ── Save ── */}
      <div className="infraSettings__saveBar">
        <Button onClick={handleSave} disabled={(!dirty && !password.trim()) || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {saveMsg && <span className="infraSettings__saveMsg">{saveMsg}</span>}
      </div>

    </div>
  );
}