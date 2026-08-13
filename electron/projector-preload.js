// Runs in the projector window (the plain local projector.html page, not
// the website). Exposes just enough to receive slide updates pushed from
// the control window via the main process.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("projectorAPI", {
  onSlideUpdate: (callback) => {
    ipcRenderer.on("slide:update", (_event, payload) => callback(payload));
  },
});
