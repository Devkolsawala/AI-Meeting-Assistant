import electron from "electron";
import type { InferContextLine } from "@meetcopilot/shared";
import { APP_NAME, parseSttProvider } from "@meetcopilot/shared";
import { type AuthStatus, IpcChannel, type MeetCopilotApi, type StatusEntry } from "./ipc.js";

const { contextBridge, ipcRenderer } = electron;

const api: MeetCopilotApi = {
  appName: APP_NAME,
  sttProvider: parseSttProvider(process.env.STT_PROVIDER),
  onLog: (handler) => {
    ipcRenderer.on(IpcChannel.Log, (_event, entry: StatusEntry) => handler(entry));
  },
  close: () => ipcRenderer.send(IpcChannel.Close),
  auth: {
    login: () => ipcRenderer.invoke(IpcChannel.AuthLogin),
    logout: () => ipcRenderer.invoke(IpcChannel.AuthLogout),
    getStatus: () => ipcRenderer.invoke(IpcChannel.AuthGetStatus),
    onChanged: (handler) => {
      ipcRenderer.on(IpcChannel.AuthChanged, (_event, status: AuthStatus) => handler(status));
    },
  },
  session: {
    start: () => ipcRenderer.invoke(IpcChannel.SessionStart),
    end: () => ipcRenderer.invoke(IpcChannel.SessionEnd),
  },
  stt: {
    deepgramToken: () => ipcRenderer.invoke(IpcChannel.SttToken),
  },
  openUpgrade: () => ipcRenderer.send(IpcChannel.OpenUpgrade),
  reportError: (message: string) => ipcRenderer.send(IpcChannel.TelemetryError, message),
  onboarding: {
    getState: () => ipcRenderer.invoke(IpcChannel.OnboardingGetState),
    complete: () => ipcRenderer.invoke(IpcChannel.OnboardingComplete),
  },
  openTroubleshooting: () => ipcRenderer.send(IpcChannel.OpenTroubleshooting),
  infer: {
    run: (context: InferContextLine[]) => ipcRenderer.invoke(IpcChannel.InferRun, context),
    onDelta: (handler) => {
      ipcRenderer.on(IpcChannel.InferDelta, (_event, text: string) => handler(text));
    },
    onDone: (handler) => {
      ipcRenderer.on(IpcChannel.InferDone, () => handler());
    },
    onError: (handler) => {
      ipcRenderer.on(IpcChannel.InferError, (_event, error: string) => handler(error));
    },
    onHotkey: (handler) => {
      ipcRenderer.on(IpcChannel.InferHotkey, () => handler());
    },
  },
};

contextBridge.exposeInMainWorld("meetcopilot", api);
