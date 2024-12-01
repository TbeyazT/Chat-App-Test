const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: ipcRenderer.invoke,
  fs: {
    readdir: (dir, callback) => fs.readdir(dir, callback),
    join: (...args) => path.join(...args)
  }
});
