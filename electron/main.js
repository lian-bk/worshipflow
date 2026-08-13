// WorshipFlow desktop app — the "Operator App" from the build guide.
// Wraps the same website you already use in a browser (worshipflow-topaz
// .vercel.app) in a real desktop window, and adds the one thing a browser
// tab can't do: opening a second, undecorated, full-screen window on a
// projector/external monitor and pushing whatever slide is live to it —
// the actual "click a song, congregation sees the lyrics" flow.
//
// This app still needs the internet (it loads the live website, same as
// the browser); fully offline use is separate, later work. Nothing here
// talks to Supabase directly — all of that stays in the website's own
// code, exactly as it runs in a normal browser. This file only manages
// two OS-level windows and passes slide data between them.

const { app, BrowserWindow, screen, ipcMain, Menu } = require("electron");
const path = require("path");

// Point this at your deployed site. Overridable via env var for local
// testing against `next dev` (WORSHIPFLOW_URL=http://localhost:3000).
const APP_URL = process.env.WORSHIPFLOW_URL || "https://worshipflow-topaz.vercel.app";

let controlWindow = null;
let projectorWindow = null;

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "WorshipFlow",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  controlWindow.loadURL(APP_URL);
  controlWindow.on("closed", () => {
    controlWindow = null;
    if (projectorWindow) {
      projectorWindow.close();
      projectorWindow = null;
    }
  });
}

function createProjectorWindow(displayId) {
  const displays = screen.getAllDisplays();
  const target = displays.find((d) => d.id === displayId) || screen.getPrimaryDisplay();

  if (projectorWindow) projectorWindow.close();

  projectorWindow = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "projector-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  projectorWindow.loadFile(path.join(__dirname, "projector.html"));
  projectorWindow.on("closed", () => {
    projectorWindow = null;
  });
}

// --- IPC: the control window (running the website) calls these through
// the contextBridge exposed in preload.js. Kept to a minimal, safe surface
// — display management and passing along slide content only, nothing that
// touches the filesystem or shell.

ipcMain.handle("displays:list", () => {
  return screen.getAllDisplays().map((d) => ({
    id: d.id,
    label: d.label || `Display ${d.id}`,
    isPrimary: d.id === screen.getPrimaryDisplay().id,
    width: d.bounds.width,
    height: d.bounds.height,
  }));
});

ipcMain.handle("projector:open", (_event, displayId) => {
  createProjectorWindow(displayId);
});

ipcMain.handle("projector:close", () => {
  if (projectorWindow) {
    projectorWindow.close();
    projectorWindow = null;
  }
});

ipcMain.on("projector:send", (_event, payload) => {
  if (projectorWindow) projectorWindow.webContents.send("slide:update", payload);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createControlWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
