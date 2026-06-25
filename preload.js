const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Auth
  listAccounts: () => ipcRenderer.invoke('auth:list'),
  signup: (username, password) => ipcRenderer.invoke('auth:signup', { username, password }),
  login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  logout: () => ipcRenderer.invoke('auth:logout'),

  // State (per-user)
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  resetState: () => ipcRenderer.invoke('state:reset'),

  // Data backup
  exportData: (state) => ipcRenderer.invoke('data:export', state),
  importData: () => ipcRenderer.invoke('data:import'),

  // Notifications + reminders
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  setReminders: (reminders) => ipcRenderer.invoke('reminders:set', reminders),
})
