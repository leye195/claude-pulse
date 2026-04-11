import { app, BrowserWindow, Tray, ipcMain, nativeImage, screen } from "electron";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

interface AppState {
  isQuitting: boolean;
}
const state: AppState = { isQuitting: false };

function getStatsPath(): string {
  return path.join(app.getPath("home"), ".claude", "stats-cache.json");
}

function getHistoryPath(): string {
  return path.join(app.getPath("home"), ".claude", "history.jsonl");
}

function getSessionsDir(): string {
  return path.join(app.getPath("home"), ".claude", "sessions");
}

function readStatsFile(): unknown | null {
  try {
    const raw = fs.readFileSync(getStatsPath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readHistoryFile(): unknown[] | null {
  try {
    const raw = fs.readFileSync(getHistoryPath(), "utf-8");
    const entries: unknown[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch {
        // skip
      }
    }
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}

interface RawSessionFile {
  pid?: number;
  sessionId?: string;
  cwd?: string;
  startedAt?: number;
  name?: string;
}

interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  projectName: string;
  startedAt: number;
  name?: string;
  cpuPercent: number;
  isActive: boolean;
}

function getCpuPercent(pid: number): number {
  try {
    const out = execSync(`ps -p ${pid} -o %cpu=`, {
      encoding: "utf-8",
      timeout: 2000,
    });
    const v = parseFloat(out.trim());
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function readSessions(): ActiveSession[] {
  const dir = getSessionsDir();
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const sessions: ActiveSession[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const data = JSON.parse(raw) as RawSessionFile;
      if (!data.pid || !data.sessionId || !data.cwd) continue;
      const cpuPercent = getCpuPercent(data.pid);
      sessions.push({
        pid: data.pid,
        sessionId: data.sessionId,
        cwd: data.cwd,
        projectName: path.basename(data.cwd),
        startedAt: data.startedAt ?? Date.now(),
        name: data.name,
        cpuPercent,
        isActive: cpuPercent > 1,
      });
    } catch {
      // skip
    }
  }
  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

let mainWindow: BrowserWindow | null = null;
let popoverWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let sessionsWatcher: fs.FSWatcher | null = null;
let sessionsInterval: NodeJS.Timeout | null = null;

function createMainWindow(): void {
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
    const history = readHistoryFile();
    if (history && mainWindow) {
      mainWindow.webContents.send("history-updated", history);
    }
  });

  mainWindow.on("close", (event) => {
    if (!state.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createPopoverWindow(): void {
  popoverWindow = new BrowserWindow({
    width: 360,
    height: 600,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    popoverWindow.loadURL("http://localhost:5173/?popover=1");
  } else {
    popoverWindow.loadFile(path.join(__dirname, "../../dist/index.html"), {
      query: { popover: "1" },
    });
  }

  popoverWindow.on("blur", () => {
    if (popoverWindow?.isVisible() && !popoverWindow.webContents.isDevToolsOpened()) {
      popoverWindow.hide();
    }
  });

  popoverWindow.on("closed", () => {
    popoverWindow = null;
  });
}

function positionPopover(): void {
  if (!popoverWindow || !tray) return;
  const trayBounds = tray.getBounds();
  const windowBounds = popoverWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);

  const minX = display.workArea.x + 4;
  const maxX = display.workArea.x + display.workArea.width - windowBounds.width - 4;
  if (x < minX) x = minX;
  if (x > maxX) x = maxX;

  popoverWindow.setPosition(x, y, false);
}

function togglePopover(): void {
  if (!popoverWindow) {
    createPopoverWindow();
  }
  if (popoverWindow!.isVisible()) {
    popoverWindow!.hide();
    return;
  }
  positionPopover();
  popoverWindow!.show();
  popoverWindow!.focus();
  // push fresh data on open
  const stats = readStatsFile();
  if (stats) popoverWindow!.webContents.send("stats-updated", stats);
  const sessions = readSessions();
  popoverWindow!.webContents.send("sessions-updated", sessions);
}

function createTray(): void {
  const iconPath = isDev
    ? path.join(__dirname, "../../build/iconTemplate.png")
    : path.join(process.resourcesPath, "build/iconTemplate.png");

  let image: Electron.NativeImage;
  try {
    image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      image.setTemplateImage(true);
    }
  } catch {
    image = nativeImage.createEmpty();
  }

  tray = new Tray(image);
  tray.setToolTip("Claude Analysis");
  tray.on("click", () => togglePopover());
  tray.on("right-click", () => togglePopover());
}

function broadcastSessions(): void {
  const sessions = readSessions();
  if (popoverWindow && !popoverWindow.isDestroyed()) {
    popoverWindow.webContents.send("sessions-updated", sessions);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("sessions-updated", sessions);
  }
}

function startSessionsMonitor(): void {
  const dir = getSessionsDir();
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    sessionsWatcher = fs.watch(dir, () => broadcastSessions());
  } catch {
    sessionsWatcher = null;
  }
  sessionsInterval = setInterval(broadcastSessions, 5000);
}

ipcMain.handle("get-stats-data", () => readStatsFile());
ipcMain.handle("get-history-data", () => readHistoryFile());
ipcMain.handle("get-sessions", () => readSessions());

ipcMain.on("show-main-window", () => {
  if (!mainWindow) {
    createMainWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
  if (popoverWindow?.isVisible()) popoverWindow.hide();
});

ipcMain.on("theme-changed", (_event, theme: "light" | "dark") => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("theme-changed", theme);
  }
});

app.whenReady().then(() => {
  createMainWindow();
  createTray();
  startSessionsMonitor();
});

app.on("window-all-closed", () => {
  // Keep app alive in tray
});

app.on("activate", () => {
  if (!mainWindow) {
    createMainWindow();
  } else {
    mainWindow.show();
  }
});

app.on("before-quit", () => {
  state.isQuitting = true;
  if (sessionsWatcher) sessionsWatcher.close();
  if (sessionsInterval) clearInterval(sessionsInterval);
});
