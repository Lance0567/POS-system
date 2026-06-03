import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron'
import { join } from 'path'
import { initDatabase } from './services/database'
import { registerOrderHandlers } from './ipc/orders.ipc'
import { registerProductHandlers } from './ipc/products.ipc'
import { registerPaymentHandlers } from './ipc/payments.ipc'
import { registerUserHandlers } from './ipc/users.ipc'
import { registerReportHandlers } from './ipc/reports.ipc'
import { registerTableHandlers } from './ipc/tables.ipc'
import { startSyncEngine } from './services/sync.service'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null
let kdsWindow: BrowserWindow | null = null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    icon: join(__dirname, '../public/icon.png'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Remove default menu
  Menu.setApplicationMenu(null)
}

function createKdsWindow() {
  kdsWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    title: 'Kitchen Display System',
  })

  const kdsUrl = isDev
    ? 'http://localhost:5173/#/kds'
    : `file://${join(__dirname, '../dist/index.html')}#/kds`

  kdsWindow.loadURL(kdsUrl)

  kdsWindow.once('ready-to-show', () => {
    kdsWindow?.show()
  })

  kdsWindow.on('closed', () => {
    kdsWindow = null
  })
}

app.whenReady().then(async () => {
  // Initialize SQLite database
  await initDatabase()

  // Register all IPC handlers
  registerOrderHandlers()
  registerProductHandlers()
  registerPaymentHandlers()
  registerUserHandlers()
  registerReportHandlers()
  registerTableHandlers()

  // Start offline sync engine
  startSyncEngine()

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Window control IPC
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())
ipcMain.on('window:open-kds', () => {
  if (!kdsWindow) createKdsWindow()
  else kdsWindow.focus()
})

// Open external links in browser
ipcMain.on('shell:open-external', (_, url: string) => {
  shell.openExternal(url)
})
