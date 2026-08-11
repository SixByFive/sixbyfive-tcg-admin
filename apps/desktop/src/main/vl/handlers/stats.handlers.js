// FILE: apps/desktop/src/main/ipc/handlers/stats.handlers.js
//
// NEW (2026-02-28)
// - Extracted and kept the CRITICAL response shape: { stats: {...} }

import { ensureWorkspaceOnStartup } from "../services/workspace.service.js";
import { readManifest, isLabeled } from "../services/manifest.service.js";

export async function getDatasetStats() {
  try {
    const workspacePath = ensureWorkspaceOnStartup();
    const manifest = readManifest(workspacePath);
    const images = Array.isArray(manifest.images) ? manifest.images : [];

    const total = images.length;

    const localImported = images.filter(
      (x) => (x?.source || "local") === "local"
    ).length;

    const r2Indexed = images.filter((x) => x?.source === "r2").length;
    const r2Cached = images.filter((x) => x?.source === "r2" && !!x?.cachedAt)
      .length;
    const r2NotCached = images.filter((x) => x?.source === "r2" && !x?.cachedAt)
      .length;

    // FIX KEPT: derived from processedFile marker
    const processed = images.filter((x) => !!x?.processedFile).length;
    const unprocessed = images.filter((x) => !x?.processedFile).length;

    const labeled = images.filter(isLabeled).length;
    const unlabeled = total - labeled;

    return {
      ok: true,
      workspacePath,
      stats: {
        total,
        localImported,
        r2Indexed,
        r2Cached,
        r2NotCached,
        processed,
        unprocessed,
        labeled,
        unlabeled,
      },
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}