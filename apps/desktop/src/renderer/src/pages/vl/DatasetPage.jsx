// FILE: apps/desktop/src/renderer/src/pages/DatasetPage.jsx
import "./assets/app.css";
import React, { useEffect, useMemo, useState } from "react";
import Card from "./components/Card";
import Button from "./components/Button";
import WorkspaceCard from "./components/WorkspaceCard";
import Dropzone from "./components/Dropzone";
import ImportSummary from "./components/ImportSummary";
import { useWorkspace } from "./hooks/useWorkspace";
import { useImporter } from "./hooks/useImporter";

/**
 * Dataset page = "Homepage" dashboard.
 *
 * CHANGES:
 * - CHANGED: Stats terminology for R2
 *   - R2 indexed / cached / not cached (R2 is source-of-truth)
 * - KEPT: Workspace + Import UX
 */

function StatGrid({ stats }) {
  const s = stats || {
    total: 0,

    localImported: 0,

    r2Indexed: 0,
    r2Cached: 0,
    r2NotCached: 0,

    processed: 0,
    unprocessed: 0,

    labeled: 0,
    unlabeled: 0,
  };

  return (
    <div className="vlStatsGrid">
      <div className="vlStat">
        <div className="vlStatValue">{s.total}</div>
        <div className="vlStatLabel">Total images</div>
      </div>

      <div className="vlStat">
        <div className="vlStatValue">{s.localImported}</div>
        <div className="vlStatLabel">Local imported</div>
      </div>

      <div className="vlStat">
        <div className="vlStatValue">{s.r2Indexed}</div>
        <div className="vlStatLabel">R2 indexed</div>
      </div>

      <div className="vlStat">
        <div className="vlStatValue">{s.r2Cached}</div>
        <div className="vlStatLabel">R2 cached locally</div>
      </div>

      <div className="vlStat">
        <div className="vlStatValue">{s.r2NotCached}</div>
        <div className="vlStatLabel">R2 not cached</div>
      </div>

      <div className="vlStat">
        <div className="vlStatValue">{s.unprocessed}</div>
        <div className="vlStatLabel">Unprocessed</div>
      </div>

      <div className="vlStat">
        <div className="vlStatValue">{s.processed}</div>
        <div className="vlStatLabel">Processed</div>
      </div>

      <div className="vlStat">
        <div className="vlStatValue">{s.unlabeled}</div>
        <div className="vlStatLabel">Unlabeled</div>
      </div>

      <div className="vlStat">
        <div className="vlStatValue">{s.labeled}</div>
        <div className="vlStatLabel">Labeled</div>
      </div>
    </div>
  );
}

export default function DatasetPage() {
  const { workspacePath, status, selectWorkspace, openWorkspace } = useWorkspace();
  const enabled = !!workspacePath;

  const {
    importStatus,
    lastImport,
    dragOver,
    pickImages,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
  } = useImporter({ enabled });

  const [statsState, setStatsState] = useState({ kind: "idle" }); // idle|loading|ok|error
  const stats = useMemo(() => statsState.stats || null, [statsState]);

  async function refreshStats() {
    if (!enabled) {
      setStatsState({ kind: "idle" });
      return;
    }

    setStatsState((prev) => ({ ...prev, kind: "loading" }));
    try {
      if (!window.visionlab?.getDatasetStats) {
        throw new Error("Bridge missing: visionlab.getDatasetStats");
      }

      const res = await window.visionlab.getDatasetStats();
      if (!res?.ok) throw new Error(res?.error || "Failed to load dataset stats.");

      setStatsState({ kind: "ok", stats: res.stats });
    } catch (err) {
      setStatsState({ kind: "error", message: String(err?.message || err) });
    }
  }

  // Initial load + when workspace changes
  useEffect(() => {
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, workspacePath]);

  // Refresh after imports complete
  useEffect(() => {
    if (lastImport?.counts && importStatus.kind === "ok") {
      refreshStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastImport?.counts, importStatus.kind]);

  return (
    <div className="vlGrid">
      <div className="vlCol">
        <WorkspaceCard
          workspacePath={workspacePath}
          status={status}
          onChangeWorkspace={selectWorkspace}
          onOpenWorkspace={openWorkspace}
        />

        <Card
          title="Import"
          subtitle="Add images to datasets/raw. Dedupe uses SHA-256."
          right={
            <Button onClick={pickImages} disabled={!enabled || importStatus.kind === "loading"}>
              Import Images
            </Button>
          }
        >
          <Dropzone
            enabled={enabled}
            isOver={dragOver}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          />

          <div className="vlMutedSmall" style={{ marginTop: 10 }}>
            Tip: dropping works from Explorer and also from sources that don’t expose file paths (blob fallback).
          </div>
        </Card>

        <Card
          title="Dataset Stats"
          subtitle="High-level health checks for your workspace."
          right={
            <Button variant="secondary" onClick={refreshStats} disabled={!enabled || statsState.kind === "loading"}>
              Refresh
            </Button>
          }
        >
          {!enabled ? (
            <div className="vlMutedSmall">Select a workspace to see dataset stats.</div>
          ) : statsState.kind === "error" ? (
            <div className="vlErrorBox">{statsState.message}</div>
          ) : statsState.kind === "loading" && !stats ? (
            <div className="vlMutedSmall">Loading…</div>
          ) : (
            <StatGrid stats={stats} />
          )}

          <div className="vlHint">
            R2 counts are based on manifest records with <code>source="r2"</code>. We’ll add R2 indexing/downloading later.
          </div>
        </Card>
      </div>

      <div className="vlCol">
        <ImportSummary importStatus={importStatus} lastImport={lastImport} />
      </div>
    </div>
  );
}