import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Model, HistoryEntry, DictationMetrics } from "./ipc";

export type RecordingState = "idle" | "recording" | "transcribing" | "done";

export interface DownloadProgress {
  model: string;
  bytes: number;
  total: number;
  percent: number;
}

export const events = {
  onRecordingState: (handler: (state: RecordingState) => void): Promise<UnlistenFn> =>
    listen<RecordingState>("recording:state", (e) => handler(e.payload)),

  onRecordingLevel: (handler: (rms: number) => void): Promise<UnlistenFn> =>
    listen<number>("recording:level", (e) => handler(e.payload)),

  onPasteError: (handler: (err: string) => void): Promise<UnlistenFn> =>
    listen<string>("paste:error", (e) => handler(e.payload)),

  onModelProgress: (handler: (p: DownloadProgress) => void): Promise<UnlistenFn> =>
    listen<DownloadProgress>("model:progress", (e) => handler(e.payload)),

  onModelLoaded: (handler: (model: Model) => void): Promise<UnlistenFn> =>
    listen<Model>("model:loaded", (e) => handler(e.payload)),

  onModelMissing: (handler: (model: Model) => void): Promise<UnlistenFn> =>
    listen<Model>("model:missing", (e) => handler(e.payload)),

  onModelLoadError: (handler: (err: string) => void): Promise<UnlistenFn> =>
    listen<string>("model:load-error", (e) => handler(e.payload)),

  onHistoryNew: (handler: (entry: HistoryEntry) => void): Promise<UnlistenFn> =>
    listen<HistoryEntry>("history:new", (e) => handler(e.payload)),

  onHotkeyConflict: (handler: (combo: string) => void): Promise<UnlistenFn> =>
    listen<string>("hotkey:conflict", (e) => handler(e.payload)),

  onDeviceDisconnect: (handler: () => void): Promise<UnlistenFn> =>
    listen<unknown>("device:disconnect", () => handler()),

  onRecordingError: (handler: (msg: string) => void): Promise<UnlistenFn> =>
    listen<string>("recording:error", (e) => handler(e.payload)),

  onRecordingNoVoice: (handler: () => void): Promise<UnlistenFn> =>
    listen<unknown>("recording:no-voice", () => handler()),

  onSettingsChanged: (handler: () => void): Promise<UnlistenFn> =>
    listen<unknown>("settings:changed", () => handler()),

  /** Game mode suspended (true) or restored (false) the shortcut. */
  onGameMode: (handler: (active: boolean) => void): Promise<UnlistenFn> =>
    listen<boolean>("gamemode:active", (e) => handler(e.payload)),

  /** Name of the device the "test every mic" sweep just switched to. */
  onMicTestDevice: (handler: (device: string) => void): Promise<UnlistenFn> =>
    listen<string>("mictest:device", (e) => handler(e.payload)),

  onMetricsNew: (handler: (m: DictationMetrics) => void): Promise<UnlistenFn> =>
    listen<DictationMetrics>("metrics:new", (e) => handler(e.payload)),
};
