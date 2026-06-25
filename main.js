const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')

const USER_DIR = () => app.getPath('userData')
const ACCOUNTS_FILE = () => path.join(USER_DIR(), 'accounts.json')
const dataFileFor = (id) => path.join(USER_DIR(), `player-data-${id}.json`)
const APP_META_FILE = () => path.join(USER_DIR(), 'app-meta.json')

const generatedIcon = (name) => path.join(__dirname, 'assets', 'generated', name)
const APP_ICON = () => {
  const ico = generatedIcon('icon.ico')
  const png = generatedIcon('icon.png')
  if (process.platform === 'win32' && fs.existsSync(ico)) return ico
  if (fs.existsSync(png)) return png
  return path.join(__dirname, 'assets', 'icon.png')
}
const NOTIFY_ICON = () => {
  const png = generatedIcon('notify.png')
  return fs.existsSync(png) ? png : APP_ICON()
}

// --- Session ---------------------------------------------------------------
let session = { userId: null }
let mainWindow = null
let isQuitting = false

// --- JSON helpers ----------------------------------------------------------
function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonAtomic(file, obj) {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2))
  fs.renameSync(tmp, file)
}

function readAccounts() {
  return readJson(ACCOUNTS_FILE(), { accounts: [] })
}

function writeAccounts(data) {
  writeJsonAtomic(ACCOUNTS_FILE(), data)
}

// --- Auto-launch on system startup ----------------------------------------
// On the first run of an installed build, register the app to open at login.
// We record a marker so we only force it on once - after that the user (or a
// future settings toggle) stays in control of the preference.
function configureAutoLaunchOnFirstRun() {
  if (!app.isPackaged) return // don't register the dev/electron binary
  if (process.platform !== 'win32' && process.platform !== 'darwin') return

  const meta = readJson(APP_META_FILE(), {})
  if (meta.autoLaunchInitialized) return

  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: [],
    })
  } catch (e) {
    // Non-fatal: a failure here shouldn't block startup.
  }

  meta.autoLaunchInitialized = true
  writeJsonAtomic(APP_META_FILE(), meta)
}

// --- Password hashing (scrypt) --------------------------------------------
function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey.toString('hex'))
    })
  })
}

function safeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// --- Window ----------------------------------------------------------------
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 560,
    icon: APP_ICON(),
    backgroundColor: '#0b0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadFile('htmlFiles/index.html')

  // On close, give a logged-in player the chance to plan tomorrow's goals.
  mainWindow.on('close', (e) => {
    if (isQuitting || !session.userId) return
    e.preventDefault()
    mainWindow.webContents.send('app:prompt-tomorrow')
  })
}

// Renderer calls this after the "plan tomorrow" prompt is handled.
ipcMain.handle('app:close-now', () => {
  isQuitting = true
  if (mainWindow) mainWindow.close()
  return { ok: true }
})

// --- Auth IPC --------------------------------------------------------------
ipcMain.handle('auth:list', () => {
  return readAccounts().accounts.map((a) => ({ id: a.id, username: a.username }))
})

ipcMain.handle('auth:signup', async (_e, { username, password }) => {
  username = String(username || '').trim()
  if (!username || !password) return { ok: false, error: 'Username and password are required.' }
  const data = readAccounts()
  if (data.accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: 'That username already exists.' }
  }
  const id = crypto.randomUUID()
  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = await hashPassword(password, salt)
  data.accounts.push({ id, username, salt, passwordHash, createdAt: Date.now() })
  writeAccounts(data)
  // New accounts start with no data file; renderer seeds defaults on first save.
  session.userId = id
  return { ok: true, user: { id, username } }
})

ipcMain.handle('auth:login', async (_e, { username, password }) => {
  const data = readAccounts()
  const acct = data.accounts.find(
    (a) => a.username.toLowerCase() === String(username || '').trim().toLowerCase()
  )
  if (!acct) return { ok: false, error: 'No such account.' }
  const hash = await hashPassword(password, acct.salt)
  if (!safeEqualHex(hash, acct.passwordHash)) {
    return { ok: false, error: 'Incorrect password.' }
  }
  session.userId = acct.id
  return { ok: true, user: { id: acct.id, username: acct.username } }
})

ipcMain.handle('auth:logout', () => {
  session.userId = null
  clearReminders()
  return { ok: true }
})

// --- State IPC (per-user) --------------------------------------------------
ipcMain.handle('state:load', () => {
  if (!session.userId) return null
  return readJson(dataFileFor(session.userId), null)
})

ipcMain.handle('state:save', (_e, state) => {
  if (!session.userId) return { ok: false, error: 'Not logged in.' }
  writeJsonAtomic(dataFileFor(session.userId), state)
  return { ok: true }
})

ipcMain.handle('state:reset', () => {
  if (!session.userId) return { ok: false }
  const file = dataFileFor(session.userId)
  if (fs.existsSync(file)) fs.rmSync(file)
  return { ok: true }
})

// --- Data export / import --------------------------------------------------
ipcMain.handle('data:export', async (_e, state) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Player Data',
    defaultPath: `player-dashboard-backup-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { ok: false }
  writeJsonAtomic(filePath, state)
  return { ok: true, filePath }
})

ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Player Data',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (canceled || !filePaths || !filePaths[0]) return { ok: false }
  const imported = readJson(filePaths[0], null)
  if (!imported || typeof imported !== 'object') {
    return { ok: false, error: 'Invalid backup file.' }
  }
  return { ok: true, state: imported }
})

// --- Notifications ---------------------------------------------------------
ipcMain.handle('notify', (_e, { title, body }) => {
  if (!Notification.isSupported()) return { ok: false }
  new Notification({ title: title || 'Player Dashboard', body: body || '', icon: NOTIFY_ICON() }).show()
  return { ok: true }
})

// --- Reminder scheduler ----------------------------------------------------
let reminderTimers = []

function clearReminders() {
  reminderTimers.forEach((t) => clearTimeout(t))
  reminderTimers = []
}

function scheduleReminder(reminder) {
  if (!reminder || reminder.enabled === false || !reminder.time) return
  const [h, m] = String(reminder.time).split(':').map((n) => parseInt(n, 10))
  if (Number.isNaN(h) || Number.isNaN(m)) return

  const now = new Date()
  const next = new Date()
  next.setHours(h, m, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)

  // If days-of-week restricted, advance to the next allowed day.
  if (Array.isArray(reminder.days) && reminder.days.length > 0) {
    let guard = 0
    while (!reminder.days.includes(next.getDay()) && guard < 8) {
      next.setDate(next.getDate() + 1)
      guard++
    }
  }

  const delay = next.getTime() - now.getTime()
  const timer = setTimeout(() => {
    if (Notification.isSupported()) {
      new Notification({
        title: reminder.label || 'Reminder',
        body: reminder.body || "It's time!",
        icon: NOTIFY_ICON(),
      }).show()
    }
    // Reschedule for the next occurrence.
    scheduleReminder(reminder)
  }, Math.max(1000, delay))

  reminderTimers.push(timer)
}

ipcMain.handle('reminders:set', (_e, reminders) => {
  clearReminders()
  if (Array.isArray(reminders)) reminders.forEach(scheduleReminder)
  return { ok: true }
})

// --- App lifecycle ---------------------------------------------------------
app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.kiansmith.playerdashboard')

  configureAutoLaunchOnFirstRun()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
