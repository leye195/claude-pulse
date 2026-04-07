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
});
