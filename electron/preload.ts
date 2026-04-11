import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getStatsData: () => ipcRenderer.invoke("get-stats-data"),
  onStatsUpdated: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("stats-updated", handler);
    return () => {
      ipcRenderer.removeListener("stats-updated", handler);
    };
  },
  getHistoryData: () => ipcRenderer.invoke("get-history-data"),
  onHistoryUpdated: (callback: (data: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown[]) => callback(data);
    ipcRenderer.on("history-updated", handler);
    return () => {
      ipcRenderer.removeListener("history-updated", handler);
    };
  },
  getSessions: () => ipcRenderer.invoke("get-sessions"),
  onSessionsUpdated: (callback: (data: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown[]) => callback(data);
    ipcRenderer.on("sessions-updated", handler);
    return () => {
      ipcRenderer.removeListener("sessions-updated", handler);
    };
  },
  showMainWindow: () => ipcRenderer.send("show-main-window"),
  notifyThemeChanged: (theme: "light" | "dark") =>
    ipcRenderer.send("theme-changed", theme),
  onThemeChanged: (callback: (theme: "light" | "dark") => void) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: "light" | "dark") =>
      callback(theme);
    ipcRenderer.on("theme-changed", handler);
    return () => {
      ipcRenderer.removeListener("theme-changed", handler);
    };
  },
});
