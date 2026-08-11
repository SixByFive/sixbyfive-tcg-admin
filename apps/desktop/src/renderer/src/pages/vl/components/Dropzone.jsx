// FILE: apps/desktop/src/renderer/src/components/Dropzone.jsx

import React from "react";

export default function Dropzone({
  enabled,
  isOver,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
}) {
  const cls = [
    "vlDropzone",
    enabled ? "" : "disabled",
    isOver ? "over" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cls}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="vlDropTitle">Drag & drop images</div>
      <div className="vlMutedSmall">
        Supported: <code>.jpg</code>, <code>.png</code>, <code>.webp</code>
      </div>
      {!enabled && <div className="vlHint">Select a workspace first.</div>}
    </div>
  );
}