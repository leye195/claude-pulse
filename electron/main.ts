import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

function getStatsPath(): string {
  const home = app.getPath("home");
  return path.join(home, ".claude", "stats-cache.json");
}

function readStatsFile(): unknown | null {
  const statsPath = getStatsPath();
  try {
    const raw = fs.readFileSync(statsPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 960,
    minHeight: 640,
    maxWidth: 1200,
    maxHeight: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("focus", () => {
    const data = readStatsFile();
    if (data && mainWindow) {
      mainWindow.webContents.send("stats-updated", data);
    }
  });
}

ipcMain.handle("get-stats-data", () => {
  return readStatsFile();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
