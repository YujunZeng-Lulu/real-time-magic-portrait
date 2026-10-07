const { contextBridge, ipcRenderer } = require('electron')

// The only bridge between the page and the main process.
contextBridge.exposeInMainWorld('widget', {
  config: () => ipcRenderer.invoke('widget:config'),
  session: () => ipcRenderer.invoke('widget:session'),
  hide: () => ipcRenderer.send('widget:hide'),
  quit: () => ipcRenderer.send('widget:quit'),
})
