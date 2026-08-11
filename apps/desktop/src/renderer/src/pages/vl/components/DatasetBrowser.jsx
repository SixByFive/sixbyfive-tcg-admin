// FILE: apps/desktop/src/renderer/src/components/DatasetBrowser.jsx

import React, { useEffect, useMemo, useState } from "react";
import Card from "./Card";
import Button from "./Button";

/**
 * DatasetBrowser (Phase 1)
 * - Loads datasets/dataset.json via IPC
 * - Shows list + search + simple status filter
 * - Click row → preview image thumbnail
 */

const FILTERS = [
  { id: "all", label: "All" },
  { id: "imported", label: "Imported" },
  { id: "duplicates", label: "Duplicates" },
];

export default function DatasetBrowser({ workspacePath }) {
  const [status, setStatus] = useState({ kind: "idle" }); // idle|loading|error|ok
  const [manifest, setManifest] = useState(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const [selectedId, setSelectedId] = useState(null);
  const [preview, setPreview] = useState({ kind: "idle" }); // idle|loading|error|ok

  async function load() {
    setStatus({ kind: "loading" });
    try {
      const res = await window.visionlab.getDataset();
      if (!res?.ok) throw new Error(res?.error || "Failed to load dataset.");
      setManifest(res.manifest);
      setStatus({ kind: "ok" });
    } catch (err) {
      setStatus({ kind: "error", message: String(err?.message || err) });
    }
  }

  useEffect(() => {
    if (!workspacePath) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath]);

  const items = manifest?.items || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((it) => {
      // Expecting items like: { id, file, status, sha256, ... }
      // Your import pipeline already returns { id, file } at minimum.
      const file = String(it.file || "");
      const id = String(it.id || "");
      const st = String(it.status || "imported");

      if (filter === "imported" && st !== "imported") return false;
      if (filter === "duplicates" && st !== "duplicate") return false;

      if (!q) return true;
      return id.toLowerCase().includes(q) || file.toLowerCase().includes(q);
    });
  }, [items, query, filter]);

  const selected = useMemo(
    () => filtered.find((x) => x.id === selectedId) || null,
    [filtered, selectedId]
  );

  useEffect(() => {
    let alive = true;

    async function loadPreview() {
      if (!selected?.file) {
        setPreview({ kind: "idle" });
        return;
      }

      setPreview({ kind: "loading" });

      try {
        // Manifest file entries look like: "raw/img_000001.jpg"
        // But we store under datasets/raw/. So build relative path from workspace root.
        const rel = selected.file.startsWith("datasets/")
          ? selected.file
          : `datasets/${selected.file}`;

        const res = await window.visionlab.getRawImageDataUrl(rel);
        if (!alive) return;

        if (!res?.ok) throw new Error(res?.error || "Preview failed.");
        setPreview({ kind: "ok", dataUrl: res.dataUrl });
      } catch (err) {
        if (!alive) return;
        setPreview({ kind: "error", message: String(err?.message || err) });
      }
    }

    loadPreview();
    return () => {
      alive = false;
    };
  }, [selected?.file]);

  return (
    <div className="vlGrid">
      <div className="vlCol">
        <Card
          title="Dataset"
          subtitle="Browse imported images from datasets/dataset.json"
          right={
            <div className="vlRow">
              <Button variant="secondary" onClick={load} disabled={!workspacePath || status.kind === "loading"}>
                Refresh
              </Button>
            </div>
          }
        >
          {!workspacePath ? (
            <div className="vlMutedSmall">Select a workspace to load the dataset.</div>
          ) : status.kind === "loading" ? (
            <div className="vlMutedSmall">Loading…</div>
          ) : status.kind === "error" ? (
            <div className="vlErrorBox">{status.message}</div>
          ) : (
            <>
              <div className="vlRow" style={{ marginBottom: 10 }}>
                <input
                  className="vlInput"
                  placeholder="Search by id or filename…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />

                <div className="vlSeg">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={filter === f.id ? "vlSegBtn active" : "vlSegBtn"}
                      onClick={() => setFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="vlTable">
                <div className="vlTableHead">
                  <div>ID</div>
                  <div>File</div>
                  <div>Status</div>
                </div>

                <div className="vlTableBody">
                  {filtered.length === 0 ? (
                    <div className="vlMutedSmall">No rows match your filter.</div>
                  ) : (
                    filtered.slice(0, 200).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        className={it.id === selectedId ? "vlRowBtn active" : "vlRowBtn"}
                        onClick={() => setSelectedId(it.id)}
                        title={it.file}
                      >
                        <div className="vlMono">{it.id}</div>
                        <div className="vlMono">{it.file}</div>
                        <div className="vlMutedSmall">{String(it.status || "imported")}</div>
                      </button>
                    ))
                  )}
                </div>

                {filtered.length > 200 && (
                  <div className="vlMutedSmall" style={{ marginTop: 10 }}>
                    Showing first 200 results (we’ll add pagination/virtualization later).
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="vlCol">
        <Card title="Preview" subtitle={selected ? selected.id : "Select an item"}>
          {!selected ? (
            <div className="vlMutedSmall">Click a row to preview.</div>
          ) : preview.kind === "loading" ? (
            <div className="vlMutedSmall">Loading preview…</div>
          ) : preview.kind === "error" ? (
            <div className="vlErrorBox">{preview.message}</div>
          ) : preview.kind === "ok" ? (
            <div>
              <img
                src={preview.dataUrl}
                alt={selected.id}
                style={{
                  width: "100%",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,.08)",
                  background: "rgba(0,0,0,.2)",
                }}
              />
              <div style={{ marginTop: 10 }} className="vlMutedSmall">
                <div>
                  <span className="vlMutedSmall">File:</span>{" "}
                  <span className="vlMono">{selected.file}</span>
                </div>
                {selected.sha256 ? (
                  <div style={{ marginTop: 6 }}>
                    <span className="vlMutedSmall">SHA:</span>{" "}
                    <span className="vlMono">{selected.sha256}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="vlMutedSmall">No preview.</div>
          )}
        </Card>
      </div>
    </div>
  );
}