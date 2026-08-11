// FILE: apps/desktop/src/renderer/src/pages/DatasetBrowserPage.jsx

import React, { useCallback, useEffect, useState } from "react";
import Card from "./components/Card";
import Button from "./components/Button";
import "./assets/app.css";
import "./assets/browser.css"

// ─── Finish badge ─────────────────────────────────────────────────────────────

const FINISH_LABELS = {
  normal: "Normal",
  holo: "Holo",
  reverse_holo: "Reverse Holo",
  full_art: "Full Art",
  special: "Special",
  unknown: "Unknown",
};

function FinishBadge({ finish }) {
  return (
    <span className="vlBrowserBadge" data-finish={finish}>
      {FINISH_LABELS[finish] || finish}
    </span>
  );
}

// ─── Image tile ───────────────────────────────────────────────────────────────

function ImageTile({ cardId, filename, finish, onDelete }) {
  const [thumb, setThumb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.visionlab
      .getDatasetImageThumb({ cardId, filename })
      .then((res) => {
        if (!cancelled) {
          setThumb(res?.dataUrl || null);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cardId, filename]);

  async function handleDelete() {
    if (!confirm) { setConfirm(true); return; }
    setDeleting(true);
    try {
      const res = await window.visionlab.deleteDatasetImage({ cardId, filename });
      if (res?.ok) onDelete(filename);
      else { setDeleting(false); setConfirm(false); }
    } catch { setDeleting(false); setConfirm(false); }
  }

  return (
    <div className={`vlBrowserTile${confirm ? " vlBrowserTile--confirm" : ""}`}>
      {/* Thumb */}
      <div className="vlBrowserTileThumb">
        {loading && <div className="vlProcThumbSkeleton" style={{ width: "100%", height: "100%" }} />}
        {!loading && thumb && <img src={thumb} alt={filename} />}
        {!loading && !thumb && <span className="vlMutedSmall">?</span>}
      </div>

      {/* Footer */}
      <div className="vlBrowserTileFooter">
        <FinishBadge finish={finish} />
        {confirm ? (
          <div className="vlBrowserTileConfirmRow">
            <button
              className="vlBtn vlBrowserTileDeleteConfirm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "…" : "Delete"}
            </button>
            <button
              className="vlBtn vlBrowserTileCancel"
              onClick={() => setConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="vlBrowserTileDeleteBtn"
            onClick={handleDelete}
            title="Delete image"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Finish group ─────────────────────────────────────────────────────────────

function FinishGroup({ cardId, finish, filenames, onDelete }) {
  const [files, setFiles] = useState(filenames);
  if (files.length === 0) return null;

  function handleDelete(filename) {
    const next = files.filter((f) => f !== filename);
    setFiles(next);
    onDelete(finish, filename, next.length);
  }

  return (
    <div className="vlBrowserFinishGroup">
      <div className="vlBrowserFinishGroupHeader">
        <FinishBadge finish={finish} />
        <span className="vlMutedSmall">{files.length} image{files.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="vlBrowserTileGrid">
        {files.map((f) => (
          <ImageTile key={f} cardId={cardId} filename={f} finish={finish} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}

// ─── Card row ─────────────────────────────────────────────────────────────────

function CardRow({ card }) {
  const [expanded, setExpanded] = useState(false);
  const [finishes, setFinishes] = useState(card.finishes);
  const [totalImages, setTotalImages] = useState(card.totalImages);

  function handleDelete(finish, _filename, remainingInFinish) {
    setTotalImages((n) => n - 1);
    if (remainingInFinish === 0) {
      setFinishes((prev) => {
        const next = { ...prev };
        delete next[finish];
        return next;
      });
    }
  }

  return (
    <div className="vlBrowserCardRow">
      <button className="vlBrowserCardBtn" onClick={() => setExpanded((v) => !v)}>
        <span className="vlBrowserCardId">{card.cardId}</span>
        <span className="vlBrowserCardCount vlMutedSmall">
          {totalImages} image{totalImages !== 1 ? "s" : ""}
        </span>
        <span className="vlBrowserChevron vlMutedSmall">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="vlBrowserCardBody">
          {Object.keys(finishes).length === 0 ? (
            <div className="vlMutedSmall">No images remaining.</div>
          ) : (
            Object.entries(finishes)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([finish, files]) => (
                <FinishGroup
                  key={finish}
                  cardId={card.cardId}
                  finish={finish}
                  filenames={files}
                  onDelete={handleDelete}
                />
              ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Set section ──────────────────────────────────────────────────────────────

function SetSection({ set }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalImages = set.cards.reduce((n, c) => n + c.totalImages, 0);

  return (
    <div className="vlBrowserSetSection">
      <button className="vlBrowserSetBtn" onClick={() => setCollapsed((v) => !v)}>
        <span className="vlBrowserSetCode">{set.setCode.toUpperCase()}</span>
        <span className="vlMutedSmall">
          {set.cards.length} card{set.cards.length !== 1 ? "s" : ""}
          {" · "}
          {totalImages} image{totalImages !== 1 ? "s" : ""}
        </span>
        <span className="vlBrowserChevron vlMutedSmall">{collapsed ? "▶" : "▼"}</span>
      </button>

      {!collapsed && (
        <div className="vlBrowserSetBody">
          {set.cards.map((card) => (
            <CardRow key={card.cardId} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DatasetBrowserPage() {
  const [state, setState] = useState({ kind: "idle" });
  const [search, setSearch] = useState("");

  async function load() {
    setState({ kind: "loading" });
    try {
      const res = await window.visionlab.listDatasetCards();
      if (!res?.ok) throw new Error(res?.error || "Failed to load dataset.");
      setState({ kind: "ok", sets: res.sets, totalCards: res.totalCards, totalImages: res.totalImages });
    } catch (err) {
      setState({ kind: "error", message: String(err?.message || err) });
    }
  }

  useEffect(() => { load(); }, []);

  const filteredSets = (() => {
    if (state.kind !== "ok") return [];
    const q = search.trim().toLowerCase();
    if (!q) return state.sets;
    return state.sets
      .map((set) => {
        if (set.setCode.toLowerCase().includes(q)) return set;
        const cards = set.cards.filter((c) => c.cardId.toLowerCase().includes(q));
        return cards.length > 0 ? { ...set, cards } : null;
      })
      .filter(Boolean);
  })();

  return (
    <div className="vlBrowserShell">
      <Card
        title="Dataset Browser"
        subtitle="Browse and manage card images in identity_raw, grouped by set."
        right={
          <Button variant="secondary" onClick={load} disabled={state.kind === "loading"}>
            Refresh
          </Button>
        }
      >
        {/* Summary */}
        {state.kind === "ok" && (
          <div className="vlBrowserSummary">
            <span className="vlPill">{state.totalCards} cards</span>
            <span className="vlPill">{state.totalImages} images</span>
          </div>
        )}

        {/* Search */}
        <input
          className="vlInput vlBrowserSearch"
          type="text"
          placeholder="Filter by card ID or set code (e.g. ssp, b2-036)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: "100%", marginTop: 12, marginBottom: 4 }}
        />

        {/* States */}
        {state.kind === "loading" && (
          <div className="vlMutedSmall" style={{ marginTop: 16 }}>Loading…</div>
        )}
        {state.kind === "error" && (
          <div className="vlErrorBox" style={{ marginTop: 12 }}>{state.message}</div>
        )}
        {state.kind === "idle" && (
          <div className="vlMutedSmall" style={{ marginTop: 16 }}>Select a workspace to browse.</div>
        )}
        {state.kind === "ok" && filteredSets.length === 0 && (
          <div className="vlMutedSmall" style={{ marginTop: 16 }}>
            {search ? "No cards match that filter." : "No cards found in identity_raw."}
          </div>
        )}

        {/* Sets */}
        {state.kind === "ok" && (
          <div className="vlBrowserSetList">
            {filteredSets.map((set) => (
              <SetSection key={set.setCode} set={set} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}