// FILE: apps/desktop/src/renderer/src/utils/tfjsModelLoader.js
//
// NEW (2026-03-04)
//
// Purpose:
//   Load TFJS LayersModel files via IPC (no custom protocol, no CSP changes).
//
// How it works:
//   TFJS supports custom IOHandlers. Instead of fetching model.json + shards
//   from HTTP URLs, we read them via IPC from the main process (which reads
//   from workspace/tfjs/<modelName>/).
//
// Usage:
//   import * as tf from "@tensorflow/tfjs";
//   import { ipcModelLoader } from "../utils/tfjsModelLoader";
//
//   const model = await tf.loadLayersModel(ipcModelLoader("finish"));
//   const preds = model.predict(tensor);

/**
 * Creates a TFJS IOHandler that loads model files via the visionlab IPC bridge.
 *
 * @param {string} modelName - "finish" or "identity"
 * @returns {Object} TFJS IOHandler with a `load()` method
 */
export function ipcModelLoader(modelName) {
  return {
    /**
     * Called by tf.loadLayersModel(). Must return a ModelArtifacts object:
     * {
     *   modelTopology: object,
     *   weightSpecs: [{name, shape, dtype}, ...],
     *   weightData: ArrayBuffer,
     *   format: string,
     *   generatedBy: string,
     * }
     */
    load: async () => {
      // 1. Read model.json
      const modelJsonRes = await window.visionlab.readModelFile({
        modelName,
        fileName: "model.json",
      });

      if (!modelJsonRes?.ok) {
        throw new Error(
          `Failed to load model.json for ${modelName}: ${modelJsonRes?.error || "unknown"}`
        );
      }

      const modelJson = modelJsonRes.data;

      // 2. Extract topology + weights manifest
      const modelTopology = modelJson.modelTopology;
      const weightsManifest = modelJson.weightsManifest;

      if (!modelTopology) {
        throw new Error(`model.json for ${modelName} is missing modelTopology`);
      }
      if (!weightsManifest || !weightsManifest.length) {
        throw new Error(`model.json for ${modelName} is missing weightsManifest`);
      }

      // 3. Build flat weight specs array
      const weightSpecs = [];
      for (const group of weightsManifest) {
        for (const w of group.weights || []) {
          weightSpecs.push({
            name: w.name,
            shape: w.shape,
            dtype: w.dtype || "float32",
          });
        }
      }

      // 4. Read all shard .bin files and concatenate into one ArrayBuffer
      const shardBuffers = [];
      let totalBytes = 0;

      for (const group of weightsManifest) {
        for (const shardPath of group.paths || []) {
          const shardRes = await window.visionlab.readModelFile({
            modelName,
            fileName: shardPath,
          });

          if (!shardRes?.ok) {
            throw new Error(
              `Failed to load shard ${shardPath} for ${modelName}: ${shardRes?.error || "unknown"}`
            );
          }

          // IPC transfers ArrayBuffer via structured clone
          const ab = shardRes.data;
          shardBuffers.push(ab);
          totalBytes += ab.byteLength;
        }
      }

      // Concatenate all shards into a single ArrayBuffer
      let weightData;
      if (shardBuffers.length === 1) {
        weightData = shardBuffers[0];
      } else {
        weightData = new ArrayBuffer(totalBytes);
        const view = new Uint8Array(weightData);
        let offset = 0;
        for (const buf of shardBuffers) {
          view.set(new Uint8Array(buf), offset);
          offset += buf.byteLength;
        }
      }

      // 5. Return ModelArtifacts
      return {
        modelTopology,
        weightSpecs,
        weightData,
        format: modelJson.format || "layers-model",
        generatedBy: modelJson.generatedBy || "unknown",
      };
    },
  };
}