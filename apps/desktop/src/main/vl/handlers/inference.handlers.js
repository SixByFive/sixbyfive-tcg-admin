// FILE: apps/desktop/src/main/vl/handlers/inference.handlers.js

import { readSettings } from "../services/settings.service.js";
import { identify } from "../services/inference.service.js";

export async function identifyCard(_, { imageDataUrl } = {}) {
  if (!imageDataUrl) return { ok: false, error: "No image data provided." };

  const settings = readSettings();
  const workspacePath = settings.workspacePath;
  if (!workspacePath) return { ok: false, error: "No workspace selected." };

  try {
    const result = await identify(workspacePath, imageDataUrl);
    return result;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
