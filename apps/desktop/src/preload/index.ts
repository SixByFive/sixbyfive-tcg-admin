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
  identify:      (payload) => ipcRenderer.invoke('visionlab:identify', payload),

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

const statusAPI = {
  getTargets:   ()         => ipcRenderer.invoke('status:getTargets'),
  checkAll:     ()         => ipcRenderer.invoke('status:checkAll'),
  saveTarget:   (target)   => ipcRenderer.invoke('status:saveTarget', target),
  deleteTarget: (id)       => ipcRenderer.invoke('status:deleteTarget', { id }),
}

const snippetsAPI = {
  list:   ()        => ipcRenderer.invoke('snippets:list'),
  save:   (snippet) => ipcRenderer.invoke('snippets:save', snippet),
  delete: (id)      => ipcRenderer.invoke('snippets:delete', { id }),
}

const permissionsAPI = {
  getConfig:  ()        => ipcRenderer.invoke('permissions:getConfig'),
  saveConfig: (config)  => ipcRenderer.invoke('permissions:saveConfig', config),
  forEmail:   (email)   => ipcRenderer.invoke('permissions:forEmail', { email }),
  listRoles:  ()        => ipcRenderer.invoke('permissions:listRoles'),
}

const sshAPI = {
  listConnections:  ()           => ipcRenderer.invoke('ssh:listConnections'),
  saveConnection:   (conn)       => ipcRenderer.invoke('ssh:saveConnection', conn),
  deleteConnection: (args)       => ipcRenderer.invoke('ssh:deleteConnection', args),
  connect:          (args)       => ipcRenderer.invoke('ssh:connect', args),
  disconnect:       (args)       => ipcRenderer.invoke('ssh:disconnect', args),
  input:            (args)       => ipcRenderer.invoke('ssh:input', args),
  resize:           (args)       => ipcRenderer.invoke('ssh:resize', args),
  getConnectedTabs: ()           => ipcRenderer.invoke('ssh:getConnectedTabs'),
  onData: (cb) => {
    const h = (_, p) => cb(p)
    ipcRenderer.on('ssh:data', h)
    return () => ipcRenderer.removeListener('ssh:data', h)
  },
  onStatus: (cb) => {
    const h = (_, p) => cb(p)
    ipcRenderer.on('ssh:status', h)
    return () => ipcRenderer.removeListener('ssh:status', h)
  },
}

const releaseAPI = {
  listProjects:    ()                    => ipcRenderer.invoke('release:listProjects'),
  saveProject:     (p)                   => ipcRenderer.invoke('release:saveProject', p),
  deleteProject:   (id)                  => ipcRenderer.invoke('release:deleteProject', { id }),
  listReleases:    (projectId)           => ipcRenderer.invoke('release:listReleases', { projectId }),
  saveRelease:     (r)                   => ipcRenderer.invoke('release:saveRelease', r),
  deleteRelease:   (id)                  => ipcRenderer.invoke('release:deleteRelease', { id }),
  listTags:        (projectId)           => ipcRenderer.invoke('release:listTags', { projectId }),
  listRuns:        (projectId)           => ipcRenderer.invoke('release:listRuns', { projectId }),
  triggerWorkflow: (projectId, ref)      => ipcRenderer.invoke('release:triggerWorkflow', { projectId, ref }),
}

const marketingAPI = {
  listModels:          ()        => ipcRenderer.invoke('marketing:ollama:listModels'),
  generateCampaign:    (payload) => ipcRenderer.invoke('marketing:ollama:generateCampaign', payload),
  getActiveCampaign:   ()        => ipcRenderer.invoke('marketing:campaign:getActive'),
  listCampaigns:       ()        => ipcRenderer.invoke('marketing:campaign:list'),
  saveCampaign:        (payload) => ipcRenderer.invoke('marketing:campaign:save', payload),
  deleteCampaign:      (id)      => ipcRenderer.invoke('marketing:campaign:delete', id),
  getBufferConnection: ()        => ipcRenderer.invoke('marketing:buffer:getConnection'),
  connectBuffer:       (apiKey)  => ipcRenderer.invoke('marketing:buffer:connect', { apiKey }),
  publishBuffer:       (payload) => ipcRenderer.invoke('marketing:buffer:publish', payload),
  syncBufferMetrics:   ()        => ipcRenderer.invoke('marketing:buffer:syncMetrics'),
  videoStatus:         ()        => ipcRenderer.invoke('marketing:video:status'),
  setupVideoNode:      ()        => ipcRenderer.invoke('marketing:video:setup'),
  startComfyUi:        ()        => ipcRenderer.invoke('marketing:video:startComfy'),
  renderMotionVideo:   (payload) => ipcRenderer.invoke('marketing:video:renderMotion', payload),
  revealVideo:         (path)    => ipcRenderer.invoke('marketing:video:revealOutput', path),
  onVideoStatus: (cb) => {
    const h = (_, payload) => cb(payload)
    ipcRenderer.on('marketing:video:status', h)
    return () => ipcRenderer.removeListener('marketing:video:status', h)
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('visionlab', visionlabAPI)
    contextBridge.exposeInMainWorld('vault', vaultAPI)
    contextBridge.exposeInMainWorld('statusBoard', statusAPI)
    contextBridge.exposeInMainWorld('snippets', snippetsAPI)
    contextBridge.exposeInMainWorld('permissions', permissionsAPI)
    contextBridge.exposeInMainWorld('ssh', sshAPI)
    contextBridge.exposeInMainWorld('releaseManager', releaseAPI)
    contextBridge.exposeInMainWorld('marketing', marketingAPI)
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
  // @ts-ignore
  window.statusBoard = statusAPI
  // @ts-ignore
  window.snippets = snippetsAPI
  // @ts-ignore
  window.permissions = permissionsAPI
  // @ts-ignore
  window.ssh = sshAPI
  // @ts-ignore
  window.releaseManager = releaseAPI
  // @ts-ignore
  window.marketing = marketingAPI
}
