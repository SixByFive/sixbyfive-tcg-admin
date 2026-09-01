import { app, shell, BrowserWindow, ipcMain, Notification, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { registerIpcHandlers as registerVlIpcHandlers } from './vl/registerIpcHandlers.js'
import { registerMarketingIpcHandlers } from './marketing/ollama.handlers.js'
import { registerMarketingVideoIpcHandlers } from './marketing/video.handlers.js'
import {
  vaultList,
  vaultGetPassword,
  vaultSave,
  vaultDelete,
  vaultEncryptionStatus,
} from './vault/vault.handlers.js'
import {
  statusGetTargets,
  statusCheckAll,
  statusSaveTarget,
  statusDeleteTarget,
} from './status/status.handlers.js'
import {
  snippetsList,
  snippetsSave,
  snippetsDelete,
} from './snippets/snippets.handlers.js'
import {
  permissionsGetConfig,
  permissionsSaveConfig,
  permissionsForEmail,
  permissionsListRoles,
} from './permissions/permissions.handlers.js'
import {
  sshListConnections,
  sshSaveConnection,
  sshDeleteConnection,
  sshConnect,
  sshDisconnect,
  sshInput,
  sshResize,
  sshGetConnectedTabs,
} from './ssh/ssh.handlers.js'
import {
  releaseListProjects,
  releaseSaveProject,
  releaseDeleteProject,
  releaseListReleases,
  releaseSaveRelease,
  releaseDeleteRelease,
  releaseListTags,
  releaseListRuns,
  releaseTriggerWorkflow,
} from './release/release.handlers.js'
import { ensureWorkspaceOnStartup, getWorkspacePath } from './vl/services/workspace.service.js'
import { startWorkspaceWatcher } from './vl/services/workspaceWatcher.service.js'
import { flushManifest } from './vl/services/manifest.service.js'
import { stopInferenceServer } from './vl/services/inference.service.js'

// electron-builder only bakes resources/icon.ico into packaged builds —
// BrowserWindow needs it set explicitly so the taskbar/title bar icon
// shows up in dev too.
const appIcon = join(__dirname, '../../resources/icon.png')

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'TCG Admin',
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
    },
  })

  mainWindow.on('ready-to-show', () => { mainWindow.show() })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// Auto-update — checks the self-hosted feed (apps/desktop/package.json
// "build.publish"), since the repo is private and we don't ship a GitHub
// token in the app. Only meaningful in packaged builds; electron-updater
// has no app-update.yml to read from in dev.
function initAutoUpdater(): void {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `TCG Admin ${info.version} has been downloaded.`,
      detail: 'Restart now to install it, or it will install automatically next time you quit.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater]', err)
  })

  autoUpdater.checkForUpdates().catch((err) => console.error('[auto-updater] check failed', err))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.sixbyfive.tcgadmin')
  app.on('browser-window-created', (_, window) => { optimizer.watchWindowShortcuts(window) })

  // Native desktop notifications sent from the renderer via AlertsContext
  ipcMain.on('show-notification', (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show()
    }
  })

  registerVlIpcHandlers()
  registerMarketingIpcHandlers()
  registerMarketingVideoIpcHandlers()

  ipcMain.handle('vault:list',             vaultList)
  ipcMain.handle('vault:getPassword',      vaultGetPassword)
  ipcMain.handle('vault:save',             vaultSave)
  ipcMain.handle('vault:delete',           vaultDelete)
  ipcMain.handle('vault:encryptionStatus', vaultEncryptionStatus)

  ipcMain.handle('status:getTargets',   statusGetTargets)
  ipcMain.handle('status:checkAll',     statusCheckAll)
  ipcMain.handle('status:saveTarget',   statusSaveTarget)
  ipcMain.handle('status:deleteTarget', statusDeleteTarget)

  ipcMain.handle('permissions:getConfig',  permissionsGetConfig)
  ipcMain.handle('permissions:saveConfig', permissionsSaveConfig)
  ipcMain.handle('permissions:forEmail',   permissionsForEmail)
  ipcMain.handle('permissions:listRoles',  permissionsListRoles)

  ipcMain.handle('ssh:listConnections',  sshListConnections)
  ipcMain.handle('ssh:saveConnection',   sshSaveConnection)
  ipcMain.handle('ssh:deleteConnection', sshDeleteConnection)
  ipcMain.handle('ssh:connect',          sshConnect)
  ipcMain.handle('ssh:disconnect',       sshDisconnect)
  ipcMain.handle('ssh:input',            sshInput)
  ipcMain.handle('ssh:resize',           sshResize)
  ipcMain.handle('ssh:getConnectedTabs', sshGetConnectedTabs)

  ipcMain.handle('snippets:list',   snippetsList)
  ipcMain.handle('snippets:save',   snippetsSave)
  ipcMain.handle('snippets:delete', snippetsDelete)

  ipcMain.handle('release:listProjects',    releaseListProjects)
  ipcMain.handle('release:saveProject',     releaseSaveProject)
  ipcMain.handle('release:deleteProject',   releaseDeleteProject)
  ipcMain.handle('release:listReleases',    releaseListReleases)
  ipcMain.handle('release:saveRelease',     releaseSaveRelease)
  ipcMain.handle('release:deleteRelease',   releaseDeleteRelease)
  ipcMain.handle('release:listTags',        releaseListTags)
  ipcMain.handle('release:listRuns',        releaseListRuns)
  ipcMain.handle('release:triggerWorkflow', releaseTriggerWorkflow)

  const mainWindow = createWindow()

  // Vision Lab: initialise workspace and watch for file changes
  try {
    const workspacePath = ensureWorkspaceOnStartup()
    if (workspacePath) startWorkspaceWatcher(mainWindow.webContents, workspacePath)
  } catch (err) {
    console.warn('[VisionLab] workspace init failed:', err)
  }

  initAutoUpdater()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

// Vision Lab: flush in-memory manifest to disk before exit
app.on('before-quit', (e) => {
  e.preventDefault()
  ;(async () => {
    try {
      stopInferenceServer()
      const wp = getWorkspacePath()
      await flushManifest(wp)
    } catch {
      // workspace may never have been initialised — that's fine
    } finally {
      app.exit(0)
    }
  })()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
