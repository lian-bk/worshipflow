// Runs in the control window (the one showing the website) before the page
// loads. Exposes a small, explicit API on window.electronAPI — the Show
// page's client-side code checks for this to know it's running inside the
// desktop app (vs. a plain browser tab) and turns on the projector
// controls. No filesystem/shell access is exposed, only display listing
// and passing slide content through to the projector window.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  listDisplays: () => ipcRenderer.invoke("displays:list"),
  openProjector: (displayId) => ipcRenderer.invoke("projector:open", displayId),
  closeProjector: () => ipcRenderer.invoke("projector:close"),
  sendToProjector: (payload) => ipcRenderer.send("projector:send", payload),
});
