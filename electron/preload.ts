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
  getHarnessConfigs: (paths: string[]) => ipcRenderer.invoke("get-harness-configs", paths),
  onSessionsUpdated: (callback: (data: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown[]) => callback(data);
    ipcRenderer.on("sessions-updated", handler);
    return () => {
      ipcRenderer.removeListener("sessions-updated", handler);
    };
  },
  getSettings: () => ipcRenderer.invoke("get-settings"),
  updateSettings: (partial: unknown) => ipcRenderer.invoke("update-settings", partial),
  onSettingsUpdated: (callback: (data: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("settings-updated", handler);
    return () => {
      ipcRenderer.removeListener("settings-updated", handler);
    };
  },
  showMainWindow: () => ipcRenderer.send("show-main-window"),
  showMainWindowTab: (tab: string) => ipcRenderer.send("show-main-window-tab", tab),
  onSetActiveTab: (callback: (tab: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, tab: string) => callback(tab);
    ipcRenderer.on("set-active-tab", handler);
    return () => {
      ipcRenderer.removeListener("set-active-tab", handler);
    };
  },
  notifyThemeChanged: (theme: "light" | "dark") => ipcRenderer.send("theme-changed", theme),
  onThemeChanged: (callback: (theme: "light" | "dark") => void) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: "light" | "dark") => callback(theme);
    ipcRenderer.on("theme-changed", handler);
    return () => {
      ipcRenderer.removeListener("theme-changed", handler);
    };
  },
});
