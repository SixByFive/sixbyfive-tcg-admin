// FILE: apps/desktop/src/renderer/src/pages/ProcessPage.jsx
//
// UPDATED (2026-03-14) — REMOVE DRAFT STATE
//
// CHANGES:
// - REMOVE: draft state, latestDraftRef, draftSignature, shouldApplySavedImage,
//           lastSavedSigRef, inFlightSaveRef, updateDraft, autoSaveDebounced,
//           autoSaveOnBlur, autoSaveTimer, flushPendingAutosaveAndWaitStable.
// - CHANGE: activeImage is derived directly from images+activeId (no copy).
// - CHANGE: Number and Name fields are fully uncontrolled — they read their
//           initial value from activeImage on mount/item-change only, and
//           commit to images[] on blur or Enter via updateActiveField().
// - CHANGE: Set autocomplete commits via updateActiveField() on blur/select.
// - CHANGE: Finish and Stamp changes call updateActiveField() immediately
//           (single field, no typing involved).
// - CHANGE: save() reads directly from images[] via activeId.
// - CHANGE: saveNext(), renameNext() etc. work the same — save then navigate.
// - KEEP: All filter/search/scroll/shortcut/preview/thumbnail logic unchanged.

import "./assets/app.css";
import "./assets/process.css";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";

const BBOX_CLASSES = [
  { key: "card",         label: "Card",   color: "#3b82f6" },
  { key: "nameRegion",   label: "Name",   color: "#22c55e" },
  { key: "numberRegion", label: "Number", color: "#f97316" },
];
import { createPortal } from "react-dom";

import Card from "./components/Card";
import Button from "./components/Button";
import { SUGGESTED_STAMPS } from "./constants/stamps";
import { FINISHES, finishLabel } from "./constants/finishes";
import SETS_RAW from "./constants/sets.json";

/* =====================================================
   Helpers
   ===================================================== */

const MAX_THUMB_CACHE_ITEMS = 300;
const VISIBLE_BATCH_SIZE = 100;
const VISIBLE_LOAD_MORE = 60;

function safeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]+/g, "")
    .replace(/^[_-]+|[_-]+$/g, "");
}

function normalizeStampClient(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-+]/g, "")
    .replace(/^[_-]+|[_-]+$/g, "");
}

function normalizeFinishClient(f) {
  const v = String(f || "").trim().toLowerCase();
  if (!v) return null;
  return v.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_");
}

function normalizeDatasetRelClient(f) {
  return String(f || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^datasets\//, "");
}

function isRawFile(img) {
  return normalizeDatasetRelClient(img?.file || "").startsWith("raw/");
}

function isProcessed(img) {
  return !!img?.processedFile;
}

function isRowReady(img) {
  return (
    !!String(img?.card?.setCode || "").trim() &&
    !!String(img?.card?.number || "").trim() &&
    !!String(img?.card?.name || "").trim() &&
    !!String(img?.finish || "").trim()
  );
}

function formatCardNumber3(value) {
  if (value == null) return "";
  const digits = String(value).replace(/\D+/g, "");
  if (!digits) return "";
  return digits.slice(0, 3).padStart(3, "0");
}

function normalizeQuery(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeSetCode(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeSetsList(raw) {
  const sets = Array.isArray(raw?.sets) ? raw.sets : [];
  const out = [];

  for (const item of sets) {
    if (!item || typeof item !== "object") continue;
    const code = String(item.code || "").trim();
    const label = String(item.label || "").trim();
    let name = "";
    if (label) {
      const parts = label.split("—").map((x) => x.trim());
      name = parts.length >= 2 ? parts.slice(1).join(" — ").trim() : label;
    }
    const codeLower = normalizeSetCode(code);
    const nameLower = normalizeQuery(name);
    if (codeLower) out.push({ code, codeLower, name, nameLower, label });
  }

  const by = new Map();
  for (const s of out) { if (!by.has(s.codeLower)) by.set(s.codeLower, s); }
  return Array.from(by.values()).sort((a, b) => a.codeLower.localeCompare(b.codeLower));
}

const SET_ALIASES = {
  sv01: "svi", sv02: "pal", sv03: "obf", sv04: "par",
  sv05: "tef", sv06: "twm", sv07: "scr", sv08: "ssp",
};

function resolveSetAbbrev(input, setsIndex) {
  const raw = String(input || "");
  const q = normalizeQuery(raw);
  const qNoSpace = normalizeSetCode(raw);
  if (!q && !qNoSpace) return "";
  if (SET_ALIASES[qNoSpace]) return SET_ALIASES[qNoSpace];
  if (setsIndex.byCode.has(qNoSpace)) return qNoSpace;
  if (setsIndex.byNameExact.has(q)) return setsIndex.byNameExact.get(q);

  let best = null;
  for (const s of setsIndex.list) {
    const name = s.nameLower || "";
    if (!name) continue;
    if (name === q) { best = s; break; }
    const starts = name.startsWith(q);
    const contains = !starts && name.includes(q);
    if (!starts && !contains) continue;
    const score = (starts ? 3 : 0) + (contains ? 2 : 0) + (s.codeLower ? 1 : 0);
    const penalty = Math.min(20, Math.abs(name.length - q.length));
    const final = score * 100 - penalty;
    if (!best || final > best._final) best = { ...s, _final: final };
  }
  return best?.codeLower || "";
}

function buildPreviewFilename(img) {
  const setCode = safeSlug(img?.card?.setCode);
  const number = safeSlug(formatCardNumber3(img?.card?.number));
  const name = safeSlug(img?.card?.name);
  const finish = safeSlug(img?.finish);
  const stamps = Array.isArray(img?.stamps) ? img.stamps : [];
  const stampPart = stamps.length ? stamps.map(safeSlug).filter(Boolean).join("+") : "nostamp";
  if (!setCode || !number || !name || !finish) return "";
  return `${setCode}-${number}__${name}__${finish}__${stampPart}__${safeSlug(img?.id || "img")}.jpg`;
}

function Pill({ children, kind }) {
  const cls = kind === "ok" ? "vlPill ok" : kind === "error" ? "vlPill error" : "vlPill";
  return <span className={cls}>{children}</span>;
}

function ProgressBar({ value, max }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div className="vlProg">
      <div className="vlProgFill" style={{ width: `${pct}%` }} />
      <div className="vlProgTxt">{pct}%</div>
    </div>
  );
}

/* =====================================================
   Thumb cache (uses getThumbnailDataUrl)
   ===================================================== */

function useThumbCache() {
  const [map, setMap] = useState(() => new Map());
  const mapRef = useRef(map);
  useEffect(() => { mapRef.current = map; }, [map]);
  const inflight = useRef(new Set());

  const ensure = useCallback(async (id) => {
    if (!id) return null;
    if (mapRef.current.get(id)) return mapRef.current.get(id);
    if (inflight.current.has(id)) return null;
    inflight.current.add(id);
    try {
      const res = await window.visionlab.getThumbnailDataUrl({ id });
      if (res?.ok && res.dataUrl) {
        setMap((prev) => {
          if (prev.get(id) === res.dataUrl) return prev;
          const next = new Map(prev);
          next.set(id, res.dataUrl);
          while (next.size > MAX_THUMB_CACHE_ITEMS) next.delete(next.keys().next().value);
          return next;
        });
        return res.dataUrl;
      }
      return null;
    } finally {
      inflight.current.delete(id);
    }
  }, []);

  return { map, ensure };
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="vlSeg">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={value === opt.value ? "vlSegBtn active" : "vlSegBtn"}
          onClick={() => onChange(opt.value)}
          title={opt.label}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* =====================================================
   Set Autocomplete
   ===================================================== */

function SetCodeAutocomplete({ value, setsIndex, onCommit, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || "");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const portalRef = useRef(null);

  useEffect(() => { setQ(value || ""); setActiveIndex(0); setOpen(false); }, [value]);

  const options = useMemo(() => {
    const query = normalizeQuery(q);
    const queryNoSpace = normalizeSetCode(q);
    const out = [];

    if (queryNoSpace) {
      for (const [alias, abbr] of Object.entries(SET_ALIASES)) {
        if (alias.includes(queryNoSpace)) {
          const set = setsIndex.byCode.get(abbr) || null;
          out.push({ key: `alias:${alias}`, abbr, left: alias.toUpperCase(), right: set?.name || "Set alias", hint: `→ ${abbr.toUpperCase()}`, score: alias.startsWith(queryNoSpace) ? 300 : 220 });
        }
      }
    }

    for (const s of setsIndex.list) {
      const codeHit = queryNoSpace && s.codeLower.includes(queryNoSpace) ? (s.codeLower.startsWith(queryNoSpace) ? 280 : 240) : 0;
      const nameHit = query && s.nameLower.includes(query) ? (s.nameLower.startsWith(query) ? 200 : 160) : 0;
      if (!codeHit && !nameHit && query) continue;
      out.push({ key: s.codeLower, abbr: s.codeLower, left: s.code, right: s.name, hint: "", score: !query && !queryNoSpace ? 0 : codeHit + nameHit });
    }

    out.sort((a, b) => (b.score - a.score) || a.abbr.localeCompare(b.abbr));
    const seen = new Set();
    const dedup = [];
    for (const x of out) {
      if (seen.has(x.abbr)) continue;
      seen.add(x.abbr);
      dedup.push(x);
      if (dedup.length >= 18) break;
    }
    return dedup;
  }, [q, setsIndex]);

  const [pos, setPos] = useState(null);
  const updatePos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: Math.round(r.left), top: Math.round(r.bottom + 6), width: Math.round(r.width) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => { window.removeEventListener("scroll", updatePos, true); window.removeEventListener("resize", updatePos); };
  }, [open, updatePos]);

  const commitAbbr = useCallback((abbrLower) => {
    const next = normalizeSetCode(abbrLower);
    if (!next) return;
    setQ(next);
    setOpen(false);
    onCommit(next);
  }, [onCommit]);

  const commitBestMatch = useCallback(() => {
    const resolved = resolveSetAbbrev(q, setsIndex);
    if (resolved) commitAbbr(resolved);
    else { setQ(normalizeSetCode(q)); setOpen(false); }
  }, [q, setsIndex, commitAbbr]);

  const maybeImmediateCommit = (raw) => {
    const qNoSpace = normalizeSetCode(raw);
    if (!qNoSpace) return false;
    if (SET_ALIASES[qNoSpace]) { commitAbbr(SET_ALIASES[qNoSpace]); return true; }
    if (setsIndex.byCode.has(qNoSpace)) { commitAbbr(qNoSpace); return true; }
    return false;
  };

  useEffect(() => {
    const onDocDown = (e) => {
      if (inputRef.current?.contains(e.target)) return;
      if (portalRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  return (
    <>
      <input
        ref={inputRef}
        className="vlInput"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActiveIndex(0); maybeImmediateCommit(e.target.value); }}
        onFocus={() => { setOpen(true); setActiveIndex(0); }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
          if (!open) { if (e.key === "Enter") commitBestMatch(); return; }
          if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
          if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, options.length - 1)); return; }
          if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); return; }
          if (e.key === "Enter") { e.preventDefault(); if (options[activeIndex]?.abbr) commitAbbr(options[activeIndex].abbr); }
        }}
        onBlur={commitBestMatch}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {open && !!options.length && pos
        ? createPortal(
            <div
              ref={portalRef}
              style={{ position: "fixed", zIndex: 9999, left: pos.left, top: pos.top, width: pos.width, maxHeight: 280, overflow: "auto", border: "1px solid rgba(255,255,255,.10)", background: "rgba(10,16,30,.96)", borderRadius: 12, padding: 6, boxShadow: "0 18px 60px rgba(0,0,0,.45)", backdropFilter: "blur(10px)" }}
            >
              {options.map((opt, idx) => (
                <button
                  key={opt.key}
                  type="button"
                  onMouseDown={(ev) => { ev.preventDefault(); commitAbbr(opt.abbr); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 10px", borderRadius: 10, border: "1px solid transparent", background: idx === activeIndex ? "rgba(41,99,255,.16)" : "transparent", color: "rgba(234,240,255,.95)", cursor: "pointer", display: "flex", gap: 10, alignItems: "baseline" }}
                  title={opt.right ? `${opt.left} — ${opt.right}` : opt.left}
                >
                  <span style={{ fontWeight: 900, letterSpacing: 0.2 }}>{String(opt.abbr || "").toUpperCase()}</span>
                  <span style={{ color: "rgba(159,176,208,.95)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{opt.right || ""}</span>
                  {opt.hint ? <span style={{ color: "rgba(159,176,208,.7)", fontSize: 12, whiteSpace: "nowrap" }}>{opt.hint}</span> : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/* =====================================================
   Smart parse
   ===================================================== */

function SmartParse({ onApply, setsIndex }) {
  const [text, setText] = useState("");

  function parse() {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const tokens = raw.split(/\s+/).filter(Boolean);
    let setCode = "", number = "", total = "", finish = "";
    const stamps = [], nameParts = [];
    for (const t of tokens) {
      const lower = t.toLowerCase();
      if (!setCode) { const r = resolveSetAbbrev(lower, setsIndex); if (r) { setCode = r; continue; } }
      // "52/193" or "1/102" — parse number and set total together
      if (!number && /^\d{1,4}\/\d{1,4}$/.test(lower)) {
        const [n, tot] = lower.split("/");
        number = formatCardNumber3(n);
        total = tot;
        continue;
      }
      if (!number && /^\d{1,4}$/i.test(lower)) { number = formatCardNumber3(lower); continue; }
      if (!finish && FINISHES.includes(lower)) { finish = lower; continue; }
      if (lower.startsWith("stamp:")) { const s = normalizeStampClient(lower.replace(/^stamp:/, "")); if (s) stamps.push(s); continue; }
      if (SUGGESTED_STAMPS.includes(lower)) { stamps.push(lower); continue; }
      nameParts.push(t);
    }
    return {
      card: { setCode: setCode || undefined, number: number || undefined, total: total || undefined, name: nameParts.join(" ").trim() || undefined },
      finish: finish || undefined,
      stamps: stamps.length ? Array.from(new Set(stamps)).sort() : undefined,
    };
  }

  function apply() { const out = parse(); if (!out) return; onApply(out); setText(""); }

  return (
    <div className="vlSmart">
      <div className="vlMutedSmall">Smart parse (paste tokens)</div>
      <div className="vlRow" style={{ gap: 8 }}>
        <input className="vlInput" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. sv08 052 Pikachu reverse_holo stamp:prerelease" />
        <Button variant="secondary" onClick={apply} disabled={!text.trim()}>Apply</Button>
      </div>
    </div>
  );
}

/* =====================================================
   Stamps
   ===================================================== */

function StampPicker({ value, onChange }) {
  const stamps = Array.isArray(value) ? value : [];
  const set = new Set(stamps);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const RECENT_KEY = "visionlab:recent_stamps";
  const [recent, setRecent] = useState(() => {
    try { const arr = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(arr) ? arr : []; }
    catch { return []; }
  });

  function pushRecent(stamp) {
    try {
      const next = [stamp, ...recent.filter((x) => x !== stamp)].slice(0, 12);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      setRecent(next);
    } catch {}
  }

  const suggestions = useMemo(() => {
    const all = Array.from(new Set([...recent, ...SUGGESTED_STAMPS])).filter(Boolean);
    const q = query.trim().toLowerCase();
    return q ? all.filter((s) => s.includes(q)) : all;
  }, [recent, query]);

  function toggleStamp(s) {
    const k = normalizeStampClient(s);
    if (!k) return;
    const next = new Set(set);
    next.has(k) ? next.delete(k) : next.add(k);
    pushRecent(k);
    onChange(Array.from(next).sort());
  }

  function addCustom() {
    const k = normalizeStampClient(custom);
    if (!k) return;
    const next = new Set(set);
    next.add(k);
    pushRecent(k);
    onChange(Array.from(next).sort());
    setCustom("");
  }

  return (
    <div className="vlStampBlock">
      <div className="vlRow" style={{ justifyContent: "space-between" }}>
        <div className="vlMutedSmall">Stamps (optional)</div>
        <Button variant="secondary" onClick={() => onChange([])} disabled={!stamps.length}>Clear</Button>
      </div>
      <input className="vlInput" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stamps…" style={{ marginTop: 8 }} />
      <div className="vlProcChips" style={{ marginTop: 10 }}>
        {suggestions.map((s) => (
          <button key={s} type="button" className={set.has(s) ? "vlChip active" : "vlChip"} onClick={() => toggleStamp(s)} title={s}>{s}</button>
        ))}
      </div>
      <div className="vlRow" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <input className="vlInput" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add custom stamp…" />
        <Button variant="secondary" onClick={addCustom} disabled={!custom.trim()}>Add</Button>
      </div>
      {!!stamps.length && (
        <div className="vlMutedSmall" style={{ marginTop: 8 }}>Selected: <span className="vlMono">{stamps.join(", ")}</span></div>
      )}
    </div>
  );
}

/* =====================================================
   Uncontrolled text field
   Syncs its DOM value from props only when activeId changes.
   Zero re-renders while the user is typing.
   ===================================================== */

function TextField({ activeId, value, onCommit, placeholder, inputMode, pattern, style }) {
  const ref = useRef(null);
  const prevIdRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (prevIdRef.current !== activeId) {
      ref.current.value = value || "";
      prevIdRef.current = activeId;
    }
  }, [activeId, value]);

  return (
    <input
      ref={ref}
      className="vlInput"
      style={style}
      defaultValue={value || ""}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") onCommit(e.target.value); }}
      placeholder={placeholder}
      inputMode={inputMode}
      pattern={pattern}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

/* =====================================================
   List item (memoized)
   ===================================================== */

const ListItem = memo(function ListItem({ img, active, thumb, onClick, onVisible, rootEl }) {
  const rowRef = useRef(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || thumb) return;
    if (typeof IntersectionObserver !== "function") { onVisible?.(img.id); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) onVisible?.(img.id); },
      { root: rootEl || null, rootMargin: "200px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [img.id, onVisible, rootEl, thumb]);

  useEffect(() => { if (active && !thumb) onVisible?.(img.id); }, [active, thumb, img.id, onVisible]);

  return (
    <button
      ref={rowRef}
      type="button"
      className={active ? "vlProcItem active" : "vlProcItem"}
      onClick={onClick}
      title={img.file || img.id}
    >
      <div className="vlProcThumbWrap">
        {thumb ? <img className="vlProcThumb" src={thumb} alt={img.id} /> : <div className="vlProcThumbSkeleton" />}
      </div>
      <div className="vlProcItemMeta">
        <div className="vlProcItemTopRow">
          <div className="vlProcItemTitle">{img.id}</div>
          <div className="vlRow" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {isRawFile(img) ? <span className="vlBadge">Raw</span> : <span className="vlBadge">Other</span>}
            {isProcessed(img) ? <span className="vlBadge ok">Processed</span> : <span className="vlBadge">Unprocessed</span>}
            {isRowReady(img) ? <span className="vlBadge ok">Ready</span> : <span className="vlBadge">Missing</span>}
            {img.bbox?.card && img.bbox?.nameRegion && img.bbox?.numberRegion
              ? <span className="vlBadge ok">Bbox</span>
              : null}
          </div>
        </div>
        <div className="vlMutedSmall vlProcItemSub">
          {(img.card?.setCode || "—") + " · " + (img.card?.number || "—")}
          {img.finish ? ` · ${img.finish}` : ""}
        </div>
        <div className="vlProcItemFile">{img.file || "—"}</div>
      </div>
    </button>
  );
});

/* =====================================================
   BboxEditor — canvas-based region annotator
   ===================================================== */

function BboxEditor({ activeId, activeImage, previewUrl, onBboxSaved }) {
  const [activeTool, setActiveTool]   = useState("card");
  const [bboxes, setBboxes]           = useState({ card: null, nameRegion: null, numberRegion: null });
  const [saving, setSaving]           = useState(false);
  const [bboxToast, setBboxToast]     = useState(null);

  const imgRef     = useRef(null);
  const canvasRef  = useRef(null);
  const bboxesRef  = useRef(bboxes);
  bboxesRef.current = bboxes;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const liveDrawRef = useRef(null);

  // Sync committed boxes from manifest when image changes
  useEffect(() => {
    const b = activeImage?.bbox;
    setBboxes({
      card:         b?.card         ?? null,
      nameRegion:   b?.nameRegion   ?? null,
      numberRegion: b?.numberRegion ?? null,
    });
    liveDrawRef.current = null;
    setBboxToast(null);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw the canvas (called imperatively — no React re-render per frame)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || !img.naturalWidth || !img.clientWidth) return;

    // Sync canvas pixel buffer to displayed image size
    canvas.width  = img.clientWidth;
    canvas.height = img.clientHeight;

    const ctx    = canvas.getContext("2d");
    const scaleX = img.clientWidth  / img.naturalWidth;
    const scaleY = img.clientHeight / img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Committed boxes
    for (const cls of BBOX_CLASSES) {
      const box = bboxesRef.current[cls.key];
      if (!box) continue;
      const [ox, oy, ow, oh] = box;
      const dx = ox * scaleX, dy = oy * scaleY, dw = ow * scaleX, dh = oh * scaleY;
      ctx.save();
      ctx.strokeStyle = cls.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(dx, dy, dw, dh);
      ctx.font = "bold 11px system-ui, sans-serif";
      const tw = ctx.measureText(cls.label).width + 8;
      ctx.fillStyle = cls.color + "cc";
      ctx.fillRect(dx, dy, tw, 18);
      ctx.fillStyle = "#fff";
      ctx.fillText(cls.label, dx + 4, dy + 13);
      ctx.restore();
    }

    // Live drag preview
    const live = liveDrawRef.current;
    if (live) {
      const cls = BBOX_CLASSES.find((c) => c.key === activeToolRef.current);
      const x = Math.min(live.startX, live.currentX);
      const y = Math.min(live.startY, live.currentY);
      const w = Math.abs(live.currentX - live.startX);
      const h = Math.abs(live.currentY - live.startY);
      ctx.save();
      ctx.strokeStyle = cls?.color || "#fff";
      ctx.lineWidth   = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }, []);

  // Redraw after committed state changes or image swap
  useEffect(() => { drawCanvas(); }, [bboxes, previewUrl, drawCanvas]);

  // Redraw on container resize (e.g. panel resize)
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const ro = new ResizeObserver(drawCanvas);
    ro.observe(img);
    return () => ro.disconnect();
  }, [drawCanvas]);

  function canvasCoords(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const { x, y } = canvasCoords(e);
    liveDrawRef.current = { startX: x, startY: y, currentX: x, currentY: y };
  }

  function onMouseMove(e) {
    if (!liveDrawRef.current) return;
    const { x, y } = canvasCoords(e);
    liveDrawRef.current = { ...liveDrawRef.current, currentX: x, currentY: y };
    drawCanvas();
  }

  function onMouseUp(e) {
    const live = liveDrawRef.current;
    if (!live) return;
    const { x, y } = canvasCoords(e);

    const rawX = Math.min(live.startX, x);
    const rawY = Math.min(live.startY, y);
    const rawW = Math.abs(x - live.startX);
    const rawH = Math.abs(y - live.startY);
    liveDrawRef.current = null;

    if (rawW < 5 || rawH < 5) { drawCanvas(); return; }

    const img = imgRef.current;
    if (!img || !img.clientWidth) return;
    const sx = img.naturalWidth  / img.clientWidth;
    const sy = img.naturalHeight / img.clientHeight;
    const box = [
      Math.round(rawX * sx), Math.round(rawY * sy),
      Math.round(rawW * sx), Math.round(rawH * sy),
    ];

    const tool = activeToolRef.current;
    setBboxes((prev) => ({ ...prev, [tool]: box }));

    // Auto-advance tool after drawing
    const idx = BBOX_CLASSES.findIndex((c) => c.key === tool);
    setActiveTool(BBOX_CLASSES[(idx + 1) % BBOX_CLASSES.length].key);
  }

  async function saveBbox() {
    if (!activeId) return;
    setSaving(true);
    setBboxToast(null);
    try {
      const res = await window.visionlab.updateImageMeta({ id: activeId, patch: { bbox: bboxes } });
      if (!res?.ok) throw new Error(res?.error || "Save failed");
      onBboxSaved?.(res.image);
      setBboxToast({ kind: "ok", message: "Saved." });
    } catch (err) {
      setBboxToast({ kind: "error", message: String(err?.message || err) });
    } finally {
      setSaving(false);
    }
  }

  const allSet = !!(bboxes.card && bboxes.nameRegion && bboxes.numberRegion);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>

      {/* Tool selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
        {BBOX_CLASSES.map((cls) => (
          <button
            key={cls.key}
            type="button"
            onClick={() => setActiveTool(cls.key)}
            className={activeTool === cls.key ? "vlSegBtn active" : "vlSegBtn"}
            style={activeTool === cls.key
              ? { borderColor: cls.color, color: cls.color }
              : bboxes[cls.key] ? { color: cls.color } : {}}
          >
            {bboxes[cls.key] ? "✓ " : ""}{cls.label}
          </button>
        ))}
        <button
          type="button"
          className="vlSegBtn"
          onClick={() => {
            setBboxes({ card: null, nameRegion: null, numberRegion: null });
            liveDrawRef.current = null;
            drawCanvas();
          }}
        >
          Clear
        </button>
      </div>

      {/* Image + canvas overlay */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {previewUrl ? (
          <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", maxHeight: "100%" }}>
            <img
              ref={imgRef}
              src={previewUrl}
              alt=""
              draggable={false}
              style={{ display: "block", maxWidth: "100%", maxHeight: "100%", userSelect: "none" }}
              onLoad={drawCanvas}
            />
            <canvas
              ref={canvasRef}
              style={{ position: "absolute", top: 0, left: 0, cursor: "crosshair" }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={() => { liveDrawRef.current = null; drawCanvas(); }}
            />
          </div>
        ) : (
          <div className="vlProcBigSkeleton">Loading preview…</div>
        )}
      </div>

      {/* Save row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <Button onClick={saveBbox} disabled={saving || !allSet}>
          {saving ? "Saving…" : "Save Bbox"}
        </Button>
        {bboxToast
          ? <span style={{ fontSize: 11, color: bboxToast.kind === "ok" ? "#22c55e" : "#ef4444" }}>{bboxToast.message}</span>
          : !allSet
          ? <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Draw Card → Name → Number</span>
          : <span style={{ fontSize: 11, color: "#22c55e" }}>✓ All regions set</span>
        }
      </div>

    </div>
  );
}

/* =====================================================
   Page
   ===================================================== */

export default function ProcessPage() {
  const [loadState, setLoadState] = useState({ kind: "idle" });
  const [images, setImages] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const [filterScope, setFilterScope] = useState("raw");
  const [filterStatus, setFilterStatus] = useState("unprocessed");
  const [filterReady, setFilterReady] = useState("missing");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH_SIZE);

  const { map: thumbs, ensure: ensureThumb } = useThumbCache();
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewTimerRef = useRef(null);
  const previewTokenRef = useRef(0);
  const listRef = useRef(null);

  const setsIndex = useMemo(() => {
    const list = normalizeSetsList(SETS_RAW);
    const byCode = new Map();
    const byNameExact = new Map();
    for (const s of list) {
      byCode.set(s.codeLower, s);
      if (s.nameLower) byNameExact.set(s.nameLower, s.codeLower);
    }
    return { list, byCode, byNameExact };
  }, []);

  // Active image derived directly from images — no draft copy
  const activeImage = useMemo(
    () => images.find((x) => x.id === activeId) ?? null,
    [images, activeId]
  );

  const stats = useMemo(() => {
    const total = images.length;
    const raw = images.filter(isRawFile).length;
    const processed = images.filter(isProcessed).length;
    const ready = images.filter(isRowReady).length;
    return { total, raw, processed, unprocessed: total - processed, ready, missing: total - ready };
  }, [images]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return images.filter((img) => {
      if (filterScope === "raw" && !isRawFile(img)) return false;
      if (filterStatus === "processed" && !isProcessed(img)) return false;
      if (filterStatus === "unprocessed" && isProcessed(img)) return false;
      if (filterReady === "ready" && !isRowReady(img)) return false;
      if (filterReady === "missing" && isRowReady(img)) return false;
      if (!q) return true;
      return [img.id, img.file, img.card?.setCode, img.card?.number, img.card?.name, img.finish, ...(img.stamps || [])]
        .filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [images, filterScope, filterStatus, filterReady, search]);

  useEffect(() => { setVisibleCount(VISIBLE_BATCH_SIZE); }, [filterScope, filterStatus, filterReady, search, images.length]);

  const visibleItems = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const activeIndex = useMemo(() => filtered.findIndex((x) => x.id === activeId), [filtered, activeId]);
  const canRename = !!activeImage && isRowReady(activeImage) && isRawFile(activeImage);
  const filenamePreview = useMemo(() => buildPreviewFilename(activeImage), [activeImage]);

  /* ─── Update a single field on the active image in-place ─── */
  const updateActiveField = useCallback((fieldUpdater) => {
    setImages((prev) =>
      prev.map((img) => img.id === activeId ? fieldUpdater(img) : img)
    );
  }, [activeId]);

  /* ─── Preview ─── */
  const queuePreviewLoad = useCallback((id) => {
    clearTimeout(previewTimerRef.current);
    previewTokenRef.current += 1;
    const token = previewTokenRef.current;
    setPreviewUrl(null);
    previewTimerRef.current = setTimeout(async () => {
      try {
        const res = await window.visionlab.getImageDataUrl({ id });
        if (!res?.ok || !res.dataUrl) return;
        if (previewTokenRef.current !== token) return;
        setPreviewUrl(res.dataUrl);
      } catch {}
    }, 120);
  }, []);

  useEffect(() => () => clearTimeout(previewTimerRef.current), []);

  /* ─── Pick ─── */
  const pick = useCallback((id) => {
    setActiveId(id);
    setToast(null);
    queuePreviewLoad(id);
    ensureThumb(id);
  }, [queuePreviewLoad, ensureThumb]);

  /* ─── Load ─── */
  const load = useCallback(async () => {
    setLoadState({ kind: "loading" });
    setToast(null);
    try {
      const res = await window.visionlab.getProcessItems();
      if (!res?.ok) throw new Error(res?.error || "Failed to load process items.");
      const list = Array.isArray(res.images) ? res.images : [];
      setImages(list);
      setLoadState({ kind: "ok" });
      setActiveId((prev) => {
        if (prev && list.find((x) => x.id === prev)) return prev;
        return (
          list.find((x) => isRawFile(x) && !isProcessed(x) && !isRowReady(x))?.id ||
          list.find((x) => isRawFile(x) && !isProcessed(x))?.id ||
          list.find((x) => isRawFile(x))?.id ||
          list[0]?.id ||
          null
        );
      });
    } catch (err) {
      setLoadState({ kind: "error", message: String(err?.message || err) });
    }
  }, []);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger preview when activeId resolves after load
  useEffect(() => {
    if (activeId) { queuePreviewLoad(activeId); ensureThumb(activeId); }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Save ─── */
  const save = useCallback(async () => {
    if (!activeId) return;
    const img = images.find((x) => x.id === activeId);
    if (!img) return;
    setBusy(true);
    setToast(null);
    try {
      const resolvedSet = resolveSetAbbrev(img.card?.setCode ?? "", setsIndex);
      const patch = {
        card: {
          setCode: resolvedSet || normalizeSetCode(img.card?.setCode ?? ""),
          number: formatCardNumber3(img.card?.number ?? ""),
          name: String(img.card?.name ?? ""),
          total: String(img.card?.total ?? "").replace(/\D/g, ""),
        },
        finish: img.finish == null ? null : normalizeFinishClient(img.finish),
        stamps: Array.isArray(img.stamps) ? img.stamps.map(normalizeStampClient).filter(Boolean) : [],
      };
      const res = await window.visionlab.updateImageMeta({ id: activeId, patch });
      if (!res?.ok) throw new Error(res?.error || "Save failed.");
      setImages((prev) => prev.map((x) => x.id === activeId ? res.image : x));
      setToast({ kind: "ok", message: "Saved." });
    } catch (err) {
      setToast({ kind: "error", message: String(err?.message || err) });
    } finally {
      setBusy(false);
    }
  }, [activeId, images, setsIndex]);

  /* ─── Navigation ─── */
  const goNext = useCallback(() => {
    const nxt = filtered[activeIndex + 1];
    if (nxt) pick(nxt.id);
  }, [filtered, activeIndex, pick]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) pick(filtered[activeIndex - 1].id);
  }, [filtered, activeIndex, pick]);

  const goNextNeedingWork = useCallback(() => {
    const start = Math.max(0, activeIndex);
    const find = (arr) => arr.find((x) => isRawFile(x) && !isProcessed(x) && !isRowReady(x));
    const nxt = find(filtered.slice(start + 1)) || find(filtered.slice(0, start));
    if (nxt) pick(nxt.id);
  }, [filtered, activeIndex, pick]);

  const saveNext = useCallback(async () => { await save(); goNext(); }, [save, goNext]);

  /* ─── Rename ─── */
  const renameCurrent = useCallback(async () => {
    if (!activeId) return;
    const img = images.find((x) => x.id === activeId);
    if (!img || !isRowReady(img) || !isRawFile(img)) {
      setToast({ kind: "error", message: "Fill set/number/name/finish first (and must be raw/)." });
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      // Save first so the main process manifest has current field values before
      // renameRawFiles calls isLabeled() against it. updateActiveField only
      // updates React state; the manifest cache is only updated by updateImageMeta.
      const saveRes = await window.visionlab.updateImageMeta({
        id: activeId,
        patch: {
          card: {
            setCode: img.card?.setCode ?? "",
            number: img.card?.number ?? "",
            name: img.card?.name ?? "",
            total: String(img.card?.total ?? "").replace(/\D/g, ""),
          },
          finish: img.finish ?? null,
          stamps: Array.isArray(img.stamps) ? img.stamps : [],
        },
      });
      if (!saveRes?.ok) throw new Error(saveRes?.error || "Save before rename failed.");

      // Optimistic update: mark the item as processed in the UI immediately
      // so the user can move on without waiting for the network file move.
      // The actual rename runs in the background and corrects the file path on completion.
      setImages((prev) =>
        prev.map((x) => x.id !== activeId ? x : {
          ...x,
          file: x.file,         // path stays as-is until rename completes
          processedFile: x.file, // mark as processed immediately so it leaves the unprocessed filter
          rawFile: x.rawFile || x.file,
        })
      );
      setBusy(false);

      // Fire-and-forget the actual network file move - don't await it
      window.visionlab.renameRawFiles({ ids: [activeId] }).then((res) => {
        if (!res?.ok) {
          // Revert optimistic update on failure
          setImages((prev) =>
            prev.map((x) => x.id !== activeId ? x : { ...x, processedFile: null })
          );
          setToast({ kind: "error", message: res?.error || "Rename failed." });
          return;
        }
        // Patch with real paths from server once move completes
        const renamedMap = new Map((res.renamed || []).map((x) => [x.id, x.file]));
        const movedMap = new Map((res.moved || []).map((x) => [x.id, x.processedFile]));
        setImages((prev) =>
          prev.map((x) => {
            if (!renamedMap.has(x.id) && !movedMap.has(x.id)) return x;
            return {
              ...x,
              ...(renamedMap.has(x.id) ? { file: renamedMap.get(x.id) } : {}),
              ...(movedMap.has(x.id) ? { processedFile: movedMap.get(x.id) } : {}),
            };
          })
        );
      }).catch(() => {
        setImages((prev) =>
          prev.map((x) => x.id !== activeId ? x : { ...x, processedFile: null })
        );
        setToast({ kind: "error", message: "Rename failed." });
      });

      setToast({ kind: "ok", message: "Saving..." });
    } catch (err) {
      setToast({ kind: "error", message: String(err?.message || err) });
    } finally {
      setBusy(false);
    }
  }, [activeId, images]);

  const renameNext = useCallback(async () => { await renameCurrent(); goNextNeedingWork(); }, [renameCurrent, goNextNeedingWork]);

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const onKey = (e) => {
      const tag = String(e.target?.tagName || "").toLowerCase();
      const inField = tag === "input" || tag === "select" || tag === "textarea";
      if (!inField && e.key === "ArrowLeft") return void goPrev();
      if (!inField && e.key === "ArrowRight") return void goNext();
      if (inField) return;
      if (e.key === "Enter") return void saveNext();
      if (e.key.toLowerCase() === "r") return void renameNext();
      if (e.key.toLowerCase() === "u") return void goNextNeedingWork();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, saveNext, renameNext, goNextNeedingWork]);

  /* ─── Prefetch thumbnails ─── */
  useEffect(() => {
    visibleItems.slice(0, 20).forEach((img) => {
      if (img?.id && !thumbs.has(img.id)) ensureThumb(img.id);
    });
  }, [visibleItems, ensureThumb, thumbs]);

  /* ─── Progressive scroll ─── */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 300) {
        setVisibleCount((prev) => Math.min(filtered.length, prev + VISIBLE_LOAD_MORE));
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [filtered.length]);

  if (loadState.kind === "error") {
    return (
      <div className="vlProcShell">
        <div className="vlProcCenter">
          <Card title="Process" subtitle="Failed to load">
            <div className="vlErrorBox">{loadState.message}</div>
            <div className="vlRow" style={{ marginTop: 10 }}><Button onClick={load}>Retry</Button></div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="vlProcShell">

      {/* ── Left: queue ── */}
      <div className="vlProcLeft">
        <div className="vlProcLeftTop">
          <div className="vlRow" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="vlProcLeftTitle">Processing Queue</div>
              <div className="vlMutedSmall">
                Raw {stats.raw} · Unprocessed {stats.unprocessed} · Ready {stats.ready}/{stats.total}
              </div>
            </div>
            <Button variant="secondary" onClick={load} disabled={loadState.kind === "loading"}>Refresh</Button>
          </div>

          <div style={{ marginTop: 10 }}>
            <ProgressBar value={stats.ready} max={stats.total || 1} />
          </div>

          <div className="vlRow" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <Segmented value={filterScope} options={[{ value: "raw", label: "Raw only" }, { value: "all", label: "All" }]} onChange={setFilterScope} />
            <Segmented value={filterStatus} options={[{ value: "unprocessed", label: "Unprocessed" }, { value: "processed", label: "Processed" }, { value: "any", label: "Any" }]} onChange={setFilterStatus} />
          </div>
          <div className="vlRow" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <Segmented value={filterReady} options={[{ value: "missing", label: "Missing" }, { value: "ready", label: "Ready" }, { value: "any", label: "Any" }]} onChange={setFilterReady} />
          </div>

          <input className="vlInput" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search id / file / set / number / name…" style={{ marginTop: 10 }} />

          <div className="vlMutedSmall" style={{ marginTop: 10 }}>
            Shortcuts: <span className="vlKbd">Enter</span> Save&amp;Next ·{" "}
            <span className="vlKbd">R</span> Rename&amp;Next ·{" "}
            <span className="vlKbd">U</span> Next Needing Work ·{" "}
            <span className="vlKbd">←</span>/<span className="vlKbd">→</span>
          </div>
          <div className="vlMutedSmall" style={{ marginTop: 6 }}>
            Showing {Math.min(visibleItems.length, filtered.length)} of {filtered.length}
          </div>
        </div>

        <div className="vlProcList" ref={listRef}>
          {visibleItems.map((img) => (
            <ListItem
              key={img.id}
              img={img}
              active={img.id === activeId}
              thumb={thumbs.get(img.id) || null}
              onClick={() => pick(img.id)}
              onVisible={ensureThumb}
              rootEl={listRef.current}
            />
          ))}
          {!filtered.length && (
            <div className="vlMutedSmall" style={{ padding: 12 }}>No items match your filters.</div>
          )}
        </div>
      </div>

      {/* ── Centre: editor ── */}
      <div className="vlProcCenter">
        <Card
          title="Label"
          subtitle="Smart parse → set/number/name → finish → stamps → Save/Rename & Next"
          right={toast?.kind === "error" ? <Pill kind="error">Error</Pill> : toast ? <Pill kind="ok">OK</Pill> : null}
        >
          {!activeImage ? (
            <div className="vlMutedSmall">Pick an item to start.</div>
          ) : (
            <div className="vlProcEditorScroll">

              <SmartParse
                setsIndex={setsIndex}
                onApply={(parsed) => {
                  updateActiveField((img) => {
                    const nextSet = parsed?.card?.setCode ?? img.card?.setCode ?? "";
                    const nextResolved = resolveSetAbbrev(nextSet, setsIndex) || nextSet;
                    return {
                      ...img,
                      card: {
                        ...(img.card || {}),
                        ...(parsed.card || {}),
                        setCode: normalizeSetCode(nextResolved),
                        number: formatCardNumber3(parsed?.card?.number ?? img.card?.number ?? ""),
                        total: parsed?.card?.total ?? img.card?.total ?? "",
                      },
                      finish: parsed.finish ?? img.finish,
                      stamps: parsed.stamps ?? img.stamps,
                    };
                  });
                }}
              />

              <div className="vlProcFormGrid" style={{ marginTop: 12 }}>
                <div>
                  <label className="vlLabel">Set</label>
                  <SetCodeAutocomplete
                    value={activeImage.card?.setCode || ""}
                    setsIndex={setsIndex}
                    onCommit={(abbr) =>
                      updateActiveField((img) => ({
                        ...img,
                        card: { ...(img.card || {}), setCode: normalizeSetCode(abbr) },
                      }))
                    }
                    placeholder="Type set code or name (e.g. sv08 / ssp / Surging Sparks)"
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 2 }}>
                    <label className="vlLabel">Number</label>
                    <TextField
                      activeId={activeId}
                      value={activeImage.card?.number || ""}
                      onCommit={(raw) =>
                        updateActiveField((img) => ({
                          ...img,
                          card: { ...(img.card || {}), number: formatCardNumber3(raw) },
                        }))
                      }
                      placeholder="052"
                      inputMode="numeric"
                      pattern="\d*"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="vlLabel">Total</label>
                    <TextField
                      activeId={activeId}
                      value={activeImage.card?.total || ""}
                      onCommit={(raw) =>
                        updateActiveField((img) => ({
                          ...img,
                          card: { ...(img.card || {}), total: String(raw).replace(/\D/g, "") },
                        }))
                      }
                      placeholder="193"
                      inputMode="numeric"
                      pattern="\d*"
                    />
                  </div>
                </div>

                <div className="vlProcSpan2">
                  <label className="vlLabel">Name</label>
                  <TextField
                    activeId={activeId}
                    value={activeImage.card?.name || ""}
                    onCommit={(raw) =>
                      updateActiveField((img) => ({
                        ...img,
                        card: { ...(img.card || {}), name: raw },
                      }))
                    }
                    placeholder="Pikachu"
                  />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div className="vlMutedSmall">Finish</div>
                <div className="vlSeg" style={{ marginTop: 8, flexWrap: "wrap" }}>
                  {FINISHES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={(activeImage.finish || "") === f ? "vlSegBtn active" : "vlSegBtn"}
                      onClick={() => updateActiveField((img) => ({ ...img, finish: f }))}
                      title={f}
                    >
                      {finishLabel(f)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="vlProcStamps">
                <StampPicker
                  value={activeImage.stamps || []}
                  onChange={(next) => updateActiveField((img) => ({ ...img, stamps: next }))}
                />
              </div>

              <div className="vlProcPreviewRow">
                <div className="vlMutedSmall">Filename preview</div>
                <div className="vlMono">{filenamePreview || "(fill set/number/name/finish)"}</div>
              </div>

              <div className="vlProcActions">
                <div className="vlRow" style={{ gap: 10, flexWrap: "wrap" }}>
                  <Button onClick={save} disabled={busy}>Save</Button>
                  <Button onClick={saveNext} disabled={busy}>Save & Next</Button>
                  <Button onClick={renameNext} disabled={busy || !canRename}>Rename & Next</Button>
                  <Button variant="secondary" onClick={goNextNeedingWork} disabled={busy}>Next Needing Work (U)</Button>
                  <div style={{ marginLeft: "auto" }} />
                  {isRowReady(activeImage) ? <Pill kind="ok">Ready</Pill> : <Pill kind="error">Missing fields</Pill>}
                  {isProcessed(activeImage) ? <Pill kind="ok">Processed</Pill> : <Pill>Unprocessed</Pill>}
                </div>
                {toast?.message && (
                  <div className="vlProcToast">
                    {toast.kind === "error" ? <Pill kind="error">Error</Pill> : <Pill kind="ok">OK</Pill>}
                    <div className="vlMutedSmall">{toast.message}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Right: bbox annotator ── */}
      <div className="vlProcRight">
        <Card title={activeImage?.id || "Preview"} subtitle={activeImage?.file || ""}>
          <div className="vlProcRightScroll" style={{ overflow: "hidden" }}>
            <BboxEditor
              activeId={activeId}
              activeImage={activeImage}
              previewUrl={previewUrl}
              onBboxSaved={(updatedImg) =>
                setImages((prev) => prev.map((x) => x.id === activeId ? updatedImg : x))
              }
            />
          </div>
        </Card>
      </div>

    </div>
  );
}