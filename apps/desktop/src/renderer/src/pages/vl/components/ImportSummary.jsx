// FILE: apps/desktop/src/renderer/src/components/ImportSummary.jsx

import React from "react";
import Card from "./Card";
import StatPill from "./StatPill";

export default function ImportSummary({ importStatus, lastImport }) {
  const right =
    importStatus?.kind === "loading" ? (
      <span className="vlPill">Importing…</span>
    ) : importStatus?.kind === "error" ? (
      <span className="vlPill error">Error</span>
    ) : importStatus?.kind === "ok" && lastImport ? (
      <span className="vlPill ok">Done</span>
    ) : null;

  return (
    <Card title="Last import" subtitle="Hash-based dedupe (SHA-256) + manifest update." right={right}>
      {importStatus?.kind === "error" ? (
        <div className="vlErrorBox">{importStatus.message}</div>
      ) : lastImport?.counts ? (
        <>
          <div className="vlStatsGrid">
            <StatPill label="Imported" value={lastImport.counts.imported} />
            <StatPill label="Duplicates" value={lastImport.counts.duplicates} />
            <StatPill label="Skipped" value={lastImport.counts.skipped} />
            <StatPill label="Errors" value={lastImport.counts.errors} />
          </div>

          {lastImport.imported?.length ? (
            <div className="vlListBlock">
              <div className="vlMutedSmall" style={{ marginBottom: 8 }}>
                Recently imported
              </div>
              <ul className="vlList">
                {lastImport.imported.slice(-10).reverse().map((r) => (
                  <li key={r.id}>
                    <span className="vlMono">{r.id}</span>
                    <span className="vlMutedSmall"> → </span>
                    <span className="vlMono">{r.file}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : lastImport.skipped?.length ? (
            <div className="vlListBlock">
              <div className="vlMutedSmall" style={{ marginBottom: 8 }}>
                Skipped
              </div>
              <ul className="vlList">
                {lastImport.skipped.slice(-10).reverse().map((s, idx) => (
                  <li key={`${s.path || "unknown"}-${idx}`}>
                    <span className="vlMono">{String(s.path || "unknown")}</span>
                    <span className="vlMutedSmall"> — </span>
                    <span className="vlMutedSmall">{String(s.reason || "skipped")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="vlMutedSmall">No new files imported yet.</div>
          )}
        </>
      ) : (
        <div className="vlMutedSmall">Import some images to see results here.</div>
      )}
    </Card>
  );
}