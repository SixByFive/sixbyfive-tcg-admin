// FILE: apps/desktop/src/renderer/src/hooks/useWorkspace.js

import { useCallback, useEffect, useState } from "react";

/**
 * Workspace hook
 *
 * Responsibilities:
 * - Load workspace on app start
 * - Change workspace (select folder)
 * - Open workspace in explorer
 */

export function useWorkspace() {
  const [workspacePath, setWorkspacePath] = useState(null);
  const [status, setStatus] = useState({ kind: "idle" }); // idle|loading|error|ok

  const load = useCallback(async () => {
    setStatus({ kind: "loading" });

    try {
      if (!window.visionlab?.getWorkspace) {
        throw new Error("Preload bridge not found. Check preload + BrowserWindow config.");
      }

      const res = await window.visionlab.getWorkspace();
      setWorkspacePath(res.workspacePath || null);
      setStatus({ kind: "ok" });
    } catch (err) {
      setStatus({ kind: "error", message: String(err?.message || err) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectWorkspace = useCallback(async () => {
    setStatus({ kind: "loading" });

    try {
      const res = await window.visionlab.selectWorkspace();

      if (res?.canceled) {
        setStatus({ kind: "ok" });
        return;
      }

      if (!res?.ok) {
        throw new Error(res?.error || "Failed to select workspace.");
      }

      setWorkspacePath(res.workspacePath);
      setStatus({ kind: "ok" });
    } catch (err) {
      setStatus({ kind: "error", message: String(err?.message || err) });
    }
  }, []);

  const openWorkspace = useCallback(async () => {
    try {
      const res = await window.visionlab.openWorkspace();
      if (!res?.ok) throw new Error(res?.error || "Failed to open workspace.");
    } catch (err) {
      setStatus({ kind: "error", message: String(err?.message || err) });
    }
  }, []);

  return {
    workspacePath,
    status,
    reload: load,
    selectWorkspace,
    openWorkspace,
  };
}