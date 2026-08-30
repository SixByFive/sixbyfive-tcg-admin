// FILE: apps/desktop/src/main/ipc/registerIpcHandlers.js
//
// UPDATED (2026-03-18)
//
// CHANGES:
//   - ADD: deployment handlers (getDeploymentConfig, saveDeploymentConfig,
//          testHeimdallConnection, runBootstrap)
//   - ADD: remote job handlers (getRemoteJob, cancelJob, readJobLog)
//   - KEEP: all existing registrations unchanged

import { ipcMain } from "electron";

import {
  getWorkspace,
  selectWorkspace,
  openWorkspace,
} from "./handlers/workspace.handlers.js";

import { getDatasetStats } from "./handlers/stats.handlers.js";
import { pickImages, importImages } from "./handlers/import.handlers.js";

import {
  getProcessItems,
  updateImageMeta,
  renameRawFiles,
} from "./handlers/process.handlers.js";

import { getImageDataUrl } from "./handlers/preview.handlers.js";
import { exportTrainingDatasetsHandler } from "./handlers/export.handlers.js";
import { splitTrainingDatasetsHandler } from "./handlers/split.handlers.js";

import {
  listDatasetCardsHandler,
  deleteDatasetImageHandler,
  getDatasetImageThumbHandler,
} from "./handlers/datasetBrowser.handlers.js";

import {
  startTraining,
  stopTraining,
  getRemoteJob,
  cancelJob,
  readJobLog,
} from "./handlers/train.handlers.js";

import { listModels, readModelFile } from "./handlers/model.handlers.js";
import { identifyCard } from "./handlers/inference.handlers.js";

import {
  listTrainingRuns,
  getTrainingRunDetail,
  getModelStatus,
} from "./handlers/results.handlers.js";

import {
  getDeploymentConfig,
  saveDeploymentConfig,
  testHeimdallConnection,
  runBootstrap,
} from "./handlers/deployment.handlers.js";

export function registerIpcHandlers() {
  // ── Workspace ──────────────────────────────────────────────────────────────
  ipcMain.handle("visionlab:getWorkspace",    getWorkspace);
  ipcMain.handle("visionlab:selectWorkspace", selectWorkspace);
  ipcMain.handle("visionlab:openWorkspace",   openWorkspace);

  // ── Dataset stats ──────────────────────────────────────────────────────────
  ipcMain.handle("visionlab:getDatasetStats", getDatasetStats);

  // ── Dataset Browser ────────────────────────────────────────────────────────
  ipcMain.handle("visionlab:listDatasetCards",       listDatasetCardsHandler);
  ipcMain.handle("visionlab:deleteDatasetImage",     deleteDatasetImageHandler);
  ipcMain.handle("visionlab:getDatasetImageThumb",   getDatasetImageThumbHandler);

  // ── Import ─────────────────────────────────────────────────────────────────
  ipcMain.handle("visionlab:pickImages",   pickImages);
  ipcMain.handle("visionlab:importImages", importImages);

  // ── Process ────────────────────────────────────────────────────────────────
  ipcMain.handle("visionlab:getProcessItems",  getProcessItems);
  ipcMain.handle("visionlab:updateImageMeta",  updateImageMeta);
  ipcMain.handle("visionlab:renameRawFiles",   renameRawFiles);

  // ── Preview ────────────────────────────────────────────────────────────────
  ipcMain.handle("visionlab:getImageDataUrl", getImageDataUrl);

  // ── Export / split datasets ────────────────────────────────────────────────
  ipcMain.handle("visionlab:exportTrainingDatasets", exportTrainingDatasetsHandler);
  ipcMain.handle("visionlab:splitTrainingDatasets",  splitTrainingDatasetsHandler);

  // ── Training ───────────────────────────────────────────────────────────────
  // startTraining routes to local bundled exe OR remote SSH based on deploymentMode
  ipcMain.handle("visionlab:startTraining", startTraining);
  ipcMain.handle("visionlab:stopTraining",  stopTraining);

  // Remote job helpers (used by Train page progress view)
  ipcMain.handle("visionlab:getRemoteJob", getRemoteJob);
  ipcMain.handle("visionlab:cancelJob",    cancelJob);
  ipcMain.handle("visionlab:readJobLog",   readJobLog);

  // ── TFJS inference (Test page) ─────────────────────────────────────────────
  ipcMain.handle("visionlab:listModels",    listModels);
  ipcMain.handle("visionlab:readModelFile", readModelFile);

  // ── Python YOLO+OCR inference ──────────────────────────────────────────────
  ipcMain.handle("visionlab:identify", identifyCard);

  // ── Results ────────────────────────────────────────────────────────────────
  ipcMain.handle("visionlab:listTrainingRuns",    listTrainingRuns);
  ipcMain.handle("visionlab:getTrainingRunDetail", getTrainingRunDetail);
  ipcMain.handle("visionlab:getModelStatus",       getModelStatus);

  // ── Deployment / infrastructure ────────────────────────────────────────────
  ipcMain.handle("visionlab:getDeploymentConfig",    getDeploymentConfig);
  ipcMain.handle("visionlab:saveDeploymentConfig",   saveDeploymentConfig);
  ipcMain.handle("visionlab:testHeimdallConnection", testHeimdallConnection);
  ipcMain.handle("visionlab:runBootstrap",           runBootstrap);

  // ── Push events (main → renderer, no handle needed) ───────────────────────
  // Existing local training:
  //   "visionlab:train:stdout"   → string
  //   "visionlab:train:stderr"   → string
  //   "visionlab:train:status"   → { status, exitCode?, error? }
  //
  // Remote training:
  //   "training:remote-status"   → { jobId, status, message, logPath?, exitCode? }
  //   "training:remote-line"     → { jobId, line }
}