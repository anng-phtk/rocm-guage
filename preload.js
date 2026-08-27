const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getGpuStats: () => ipcRenderer.invoke('get-gpu-stats')
});
