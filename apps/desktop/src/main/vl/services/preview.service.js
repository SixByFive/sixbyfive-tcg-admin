// FILE: apps/desktop/src/main/services/preview.service.js
//
// MOVED helper from main/index.js (2026-02-28)

export async function shellOpenFolder(folderPath) {
  const { shell } = await import("electron");
  const errMsg = await shell.openPath(folderPath);
  if (errMsg) throw new Error(errMsg);
}