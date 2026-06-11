const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vibeDesktop', {
  platform: process.platform,
  isElectron: true,
  selectWorldFolder: () => ipcRenderer.invoke('vibe:select-world-folder'),
  showAssetInFolder: (assetPath) => ipcRenderer.invoke('vibe:show-asset-in-folder', assetPath),
});
