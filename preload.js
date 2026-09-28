const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  chooseDestination: () => ipcRenderer.invoke('choose-destination'),
  addFolder: () => ipcRenderer.invoke('add-folder'),
  addFile: () => ipcRenderer.invoke('add-file'),
  getExistingDotfiles: () => ipcRenderer.invoke('get-existing-dotfiles'),
  startBackup: (config) => ipcRenderer.invoke('start-backup', config),
  onLog: (callback) => ipcRenderer.on('log', (_event, msg) => callback(msg)),
  onBackupComplete: (callback) => ipcRenderer.on('backup-complete', (_event, result) => callback(result)),
});
