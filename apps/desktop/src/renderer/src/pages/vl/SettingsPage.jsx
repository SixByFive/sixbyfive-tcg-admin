// FILE: apps/desktop/src/renderer/src/pages/SettingsPage.jsx
//
// NEW (2026-03-18)

import React, { useEffect, useState } from "react";
import Card from "./components/Card";
import Button from "./components/Button";
import InfrastructureSettings from "./components/InfrastructureSettings";
import { useWorkspace } from "./hooks/useWorkspace";

import "./assets/app.css";
import "./assets/settingsPage.css";

export default function SettingsPage() {
  const { workspacePath, openWorkspace } = useWorkspace();

  return (
    <div className="vlSettingsPage">

      {/* ── Workspace ── */}
      <Card title="Workspace" subtitle="Where datasets, models, and reports are stored.">
        <div className="vlSettingsRow">
          <div className="vlSettingsWorkspacePath">
            {workspacePath
              ? <code className="vlMono">{workspacePath}</code>
              : <span className="vlMuted">No workspace selected.</span>
            }
          </div>
          <div className="vlSettingsWorkspaceActions">
            <Button
              variant="secondary"
              onClick={() => window.visionlab.selectWorkspace?.().then(() => window.location.reload())}
            >
              Change…
            </Button>
            <Button
              variant="secondary"
              onClick={openWorkspace}
              disabled={!workspacePath}
            >
              Open folder
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Infrastructure ── */}
      <InfrastructureSettings />

    </div>
  );
}