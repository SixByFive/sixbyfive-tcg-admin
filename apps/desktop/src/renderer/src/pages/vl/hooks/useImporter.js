// FILE: apps/desktop/src/renderer/src/hooks/useImporter.js
//
// UPDATED (2026-03-13)
//
// CHANGES:
// - ADDED: Prevent overlapping imports so repeated drops/clicks do not stack.
// - ADDED: Shared handleDroppedEvent() so window-level and dropzone-level drop logic stays consistent.
// - ADDED: Better empty/fully-skipped drop handling with clearer importStatus messages.
// - ADDED: Warning state when extractDroppedFiles() returns skipped files/messages.
// - CHANGED: runImport() now ignores concurrent requests while one import is already running.
// - KEPT: File picker import
// - KEPT: Drag/drop import (window-level preventDefault + blob fallback)

import { useCallback, useEffect, useRef, useState } from "react";
import { extractDroppedFiles } from "../utils/dnd";

/**
 * Import hook
 *
 * Responsibilities:
 * - File picker import
 * - Drag/drop import (window-level preventDefault + blob fallback)
 */
export function useImporter({ enabled }) {
  const [importStatus, setImportStatus] = useState({ kind: "idle" }); // idle|loading|error|ok|warning
  const [lastImport, setLastImport] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const importInFlightRef = useRef(false);

  const runImport = useCallback(async (payload) => {
    if (importInFlightRef.current) {
      return {
        ok: false,
        ignored: true,
        error: "An import is already running.",
      };
    }

    importInFlightRef.current = true;
    setImportStatus({ kind: "loading" });

    try {
      const res = await window.visionlab.importImages(payload);
      if (res?.error) throw new Error(res.error);

      setLastImport(res);
      setImportStatus({ kind: "ok" });
      return res;
    } catch (err) {
      setImportStatus({ kind: "error", message: String(err?.message || err) });
      throw err;
    } finally {
      importInFlightRef.current = false;
    }
  }, []);

  const pickImages = useCallback(async () => {
    if (!enabled) return;
    if (importInFlightRef.current) return null;

    importInFlightRef.current = true;
    setImportStatus({ kind: "loading" });

    try {
      const res = await window.visionlab.pickImages();

      if (res?.canceled) {
        setImportStatus({ kind: "ok" });
        return null;
      }

      if (res?.error) throw new Error(res.error);

      setLastImport(res);
      setImportStatus({ kind: "ok" });
      return res;
    } catch (err) {
      setImportStatus({ kind: "error", message: String(err?.message || err) });
      throw err;
    } finally {
      importInFlightRef.current = false;
    }
  }, [enabled]);

  const handleDroppedEvent = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      if (!enabled) return null;
      if (importInFlightRef.current) return null;

      const extracted = await extractDroppedFiles(e);
      const filePaths = Array.isArray(extracted?.filePaths) ? extracted.filePaths : [];
      const fileBlobs = Array.isArray(extracted?.fileBlobs) ? extracted.fileBlobs : [];
      const skipped = Array.isArray(extracted?.skipped) ? extracted.skipped : [];
      const warningMessage =
        typeof extracted?.warningMessage === "string" ? extracted.warningMessage : "";

      if (!filePaths.length && !fileBlobs.length) {
        if (warningMessage || skipped.length) {
          setImportStatus({
            kind: "warning",
            message:
              warningMessage ||
              "No supported files were imported from the drop.",
            skipped,
          });
        }
        return null;
      }

      if (warningMessage || skipped.length) {
        setImportStatus({
          kind: "warning",
          message:
            warningMessage ||
            `Some dropped files were skipped before import (${skipped.length}).`,
          skipped,
        });
      }

      return await runImport({ filePaths, fileBlobs });
    },
    [enabled, runImport]
  );

  // Window-level drag/drop: required in Electron for reliable file drops
  useEffect(() => {
    function prevent(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    async function onDrop(e) {
      await handleDroppedEvent(e);
    }

    function onDragOver(e) {
      prevent(e);
      if (enabled) setDragOver(true);
    }

    function onDragLeave(e) {
      prevent(e);
      setDragOver(false);
    }

    window.addEventListener("dragenter", prevent);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", prevent);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [enabled, handleDroppedEvent]);

  const dropzoneHandlers = useMemoHandlers({
    enabled,
    setDragOver,
    handleDroppedEvent,
  });

  return {
    importStatus,
    lastImport,
    dragOver,
    pickImages,
    runImport,
    ...dropzoneHandlers,
  };
}

function useMemoHandlers({ enabled, setDragOver, handleDroppedEvent }) {
  const onDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (enabled) setDragOver(true);
    },
    [enabled, setDragOver]
  );

  const onDragEnter = onDragOver;

  const onDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
    },
    [setDragOver]
  );

  const onDrop = useCallback(
    async (e) => {
      await handleDroppedEvent(e);
    },
    [handleDroppedEvent]
  );

  return { onDragOver, onDragEnter, onDragLeave, onDrop };
}
