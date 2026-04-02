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
});
