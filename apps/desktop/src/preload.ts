import electron from "electron";
import { APP_NAME } from "@meetcopilot/shared";
import { IpcChannel, type MeetCopilotApi, type StatusEntry } from "./ipc.js";

const { contextBridge, ipcRenderer } = electron;

const api: MeetCopilotApi = {
  appName: APP_NAME,
  onLog: (handler) => {
    ipcRenderer.on(IpcChannel.Log, (_event, entry: StatusEntry) => handler(entry));
  },
  close: () => ipcRenderer.send(IpcChannel.Close),
};

contextBridge.exposeInMainWorld("meetcopilot", api);
