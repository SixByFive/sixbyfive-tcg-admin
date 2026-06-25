import { app, shell, BrowserWindow, ipcMain, Notification, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'

// electron-builder only bakes resources/icon.ico into packaged builds —
// BrowserWindow needs it set explicitly so the taskbar/title bar icon
// shows up in dev too.
const appIcon = join(__dirname, '../../resources/icon.png')

function createWindow(): void {
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
      webSecurity: !is.dev,
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

  createWindow()
  initAutoUpdater()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
