import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const visionlabAPI = {
  getWorkspace:    () => ipcRenderer.invoke('visionlab:getWorkspace'),
  selectWorkspace: () => ipcRenderer.invoke('visionlab:selectWorkspace'),
  openWorkspace:   () => ipcRenderer.invoke('visionlab:openWorkspace'),

  getDatasetStats: () => ipcRenderer.invoke('visionlab:getDatasetStats'),

  listDatasetCards:     ()        => ipcRenderer.invoke('visionlab:listDatasetCards'),
  deleteDatasetImage:   (payload) => ipcRenderer.invoke('visionlab:deleteDatasetImage', payload),
  getDatasetImageThumb: (payload) => ipcRenderer.invoke('visionlab:getDatasetImageThumb', payload),

  pickImages:   ()        => ipcRenderer.invoke('visionlab:pickImages'),
  importImages: (payload) => ipcRenderer.invoke('visionlab:importImages', payload),

  getProcessItems: ()        => ipcRenderer.invoke('visionlab:getProcessItems'),
  updateImageMeta: (payload) => ipcRenderer.invoke('visionlab:updateImageMeta', payload),
  renameRawFiles:  (payload) => ipcRenderer.invoke('visionlab:renameRawFiles', payload),

  getImageDataUrl: (payload) => ipcRenderer.invoke('visionlab:getImageDataUrl', payload),

  exportTrainingDatasets: (payload) => ipcRenderer.invoke('visionlab:exportTrainingDatasets', payload),
  splitTrainingDatasets:  (payload) => ipcRenderer.invoke('visionlab:splitTrainingDatasets', payload),

  startTraining: (payload) => ipcRenderer.invoke('visionlab:startTraining', payload),
  stopTraining:  ()        => ipcRenderer.invoke('visionlab:stopTraining'),

  onTrainStdout: (cb) => {
    const h = (_, txt) => cb(txt)
    ipcRenderer.on('visionlab:train:stdout', h)
    return () => ipcRenderer.removeListener('visionlab:train:stdout', h)
  },
  onTrainStderr: (cb) => {
    const h = (_, txt) => cb(txt)
    ipcRenderer.on('visionlab:train:stderr', h)
    return () => ipcRenderer.removeListener('visionlab:train:stderr', h)
  },
  onTrainStatus: (cb) => {
    const h = (_, payload) => cb(payload)
    ipcRenderer.on('visionlab:train:status', h)
    return () => ipcRenderer.removeListener('visionlab:train:status', h)
  },

  getRemoteJob: ()                   => ipcRenderer.invoke('visionlab:getRemoteJob'),
  cancelJob:    ()                   => ipcRenderer.invoke('visionlab:cancelJob'),
  readJobLog:   (logPath, lines)     => ipcRenderer.invoke('visionlab:readJobLog', { logPath, lines }),

  onRemoteStatus: (cb) => {
    const h = (_, p) => cb(p)
    ipcRenderer.on('training:remote-status', h)
    return () => ipcRenderer.removeListener('training:remote-status', h)
  },
  onRemoteLine: (cb) => {
    const h = (_, p) => cb(p)
    ipcRenderer.on('training:remote-line', h)
    return () => ipcRenderer.removeListener('training:remote-line', h)
  },

  listModels:    ()        => ipcRenderer.invoke('visionlab:listModels'),
  readModelFile: (payload) => ipcRenderer.invoke('visionlab:readModelFile', payload),

  listTrainingRuns:     ()      => ipcRenderer.invoke('visionlab:listTrainingRuns'),
  getTrainingRunDetail: (runId) => ipcRenderer.invoke('visionlab:getTrainingRunDetail', runId),
  getModelStatus:       ()      => ipcRenderer.invoke('visionlab:getModelStatus'),

  getDeploymentConfig:    ()       => ipcRenderer.invoke('visionlab:getDeploymentConfig'),
  saveDeploymentConfig:   (config) => ipcRenderer.invoke('visionlab:saveDeploymentConfig', config),
  testHeimdallConnection: ()       => ipcRenderer.invoke('visionlab:testHeimdallConnection'),
  runBootstrap:           (args)   => ipcRenderer.invoke('visionlab:runBootstrap', args ?? {}),
}

const vaultAPI = {
  list:             ()       => ipcRenderer.invoke('vault:list'),
  getPassword:      (id)     => ipcRenderer.invoke('vault:getPassword', { id }),
  save:             (entry)  => ipcRenderer.invoke('vault:save', entry),
  delete:           (id)     => ipcRenderer.invoke('vault:delete', { id }),
  encryptionStatus: ()       => ipcRenderer.invoke('vault:encryptionStatus'),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('visionlab', visionlabAPI)
    contextBridge.exposeInMainWorld('vault', vaultAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.visionlab = visionlabAPI
  // @ts-ignore
  window.vault = vaultAPI
}
