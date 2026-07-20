import { invoke } from "@tauri-apps/api/core";

export type Model =
  | "tiny-q5_1"
  | "base-q5_1"
  | "small-q5_1"
  | "small"
  | "medium-q5_0"
  | "large-v3-q5_0";

export interface ModelStatus {
  model: Model;
  filename: string;
  displayName: string;
  sizeMb: number;
  downloaded: boolean;
  loaded: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  text: string;
  durationMs: number;
  wordCount: number;
  model: string;
}

export type RecordingMode = "toggle" | "pushtotalk";
export type OverlayStyle = "fat" | "thin";

export interface AppSettings {
  microphoneName: string | null;
  mode: RecordingMode;
  hotkey: string;
  autoPaste: boolean;
  preserveClipboard: boolean;
  language: string;
  overlayStyle: OverlayStyle;
  onboardingCompleted: boolean;
  autoLaunch: boolean;
}

interface ModelStatusRust {
  model: Model;
  filename: string;
  display_name: string;
  size_mb: number;
  downloaded: boolean;
  loaded: boolean;
}

function normalizeStatus(s: ModelStatusRust): ModelStatus {
  return {
    model: s.model,
    filename: s.filename,
    displayName: s.display_name,
    sizeMb: s.size_mb,
    downloaded: s.downloaded,
    loaded: s.loaded,
  };
}

export interface InstallerStatus {
  runningInstalled: boolean;
  uninstallMode: boolean;
  installExists: boolean;
  defaultInstallDir: string;
  existingInstallDir: string | null;
  currentExe: string;
}

export const api = {
  ping: () => invoke<string>("ping"),
  openSettingsWindow: () => invoke<void>("open_settings_window"),
  quitApp: () => invoke<void>("quit_app"),

  installerStatus: () => invoke<InstallerStatus>("installer_status"),
  installerInstall: (installDir: string, createDesktopShortcut: boolean) =>
    invoke<void>("installer_install", { installDir, createDesktopShortcut }),
  installerRelaunch: () => invoke<void>("installer_relaunch"),
  installerUninstallCleanup: () => invoke<void>("installer_uninstall_cleanup"),
  installerFinalizeUninstall: () => invoke<void>("installer_finalize_uninstall"),
  installerTriggerUninstallUi: () => invoke<void>("installer_trigger_uninstall_ui"),

  startRecording: () => invoke<void>("start_recording"),
  stopRecording: () => invoke<void>("stop_recording"),
  toggleRecording: () => invoke<void>("toggle_recording"),
  cancelRecording: () => invoke<void>("cancel_recording"),

  saveOverlayPosition: (x: number, y: number) =>
    invoke<void>("save_overlay_position", { x, y }),

  listInputDevices: () => invoke<string[]>("list_input_devices"),
  testMicrophone: (durationMs: number) =>
    invoke<void>("test_microphone", { durationMs }),
  pauseHotkey: () => invoke<void>("pause_hotkey"),
  resumeHotkey: () => invoke<void>("resume_hotkey"),

  markOnboardingCompleted: () => invoke<void>("mark_onboarding_completed"),

  getSettings: () => invoke<AppSettings>("get_settings"),
  updateSettings: (settings: AppSettings) =>
    invoke<void>("update_settings", { settings }),

  getHistory: () => invoke<HistoryEntry[]>("get_history"),
  deleteHistoryEntry: (id: string) =>
    invoke<void>("delete_history_entry", { id }),
  clearHistory: () => invoke<void>("clear_history"),

  listModels: async (): Promise<ModelStatus[]> => {
    const raw = await invoke<ModelStatusRust[]>("list_models");
    return raw.map(normalizeStatus);
  },
  downloadModel: (model: Model) => invoke<void>("download_model", { model }),
  loadModel: (model: Model) => invoke<void>("load_model", { model }),
  isModelLoaded: () => invoke<boolean>("is_model_loaded"),
};
