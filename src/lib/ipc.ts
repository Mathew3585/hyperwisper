import { invoke } from "@tauri-apps/api/core";

export type Model =
  | "tiny-q5_1"
  | "base-q5_1"
  | "small-q5_1"
  | "small"
  | "medium-q5_0"
  | "large-v3-turbo-q5_0"
  | "large-v3-turbo-q8_0"
  | "large-v3-q5_0";

/**
 * Model the app recommends and installs on first run. Mirrors
 * `Model::default()` in `whisper/models.rs` — large-v3-turbo: large-v3
 * accuracy at a fraction of its decode cost.
 */
export const RECOMMENDED_MODEL: Model = "large-v3-turbo-q5_0";
/**
 * Matched by filename (hardcoded on the Rust side, so it never drifts) when
 * filtering `model:progress` events, which carry the filename.
 */
export const RECOMMENDED_FILENAME = "ggml-large-v3-turbo-q5_0.bin";

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
  /**
   * Release the global hotkey while a game or other fullscreen app has the
   * screen, so the keystroke reaches that app instead of starting a dictation.
   */
  gameMode: boolean;
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

export interface CaptureFormat {
  device: string;
  sampleRate: number;
  channels: number;
  sampleFormat: string;
  /** Every config the device advertises, e.g. "2ch 44100-192000Hz F32". */
  supported: string[];
}

export interface ChannelStats {
  rms: number;
  peak: number;
  /** 0–1 fraction of samples at full scale. */
  clippedRatio: number;
}

export type MicVerdict =
  | "ok"
  | "noSignal"
  | "noVoice"
  | "lowGain"
  | "clipping"
  | "channelsIgnored"
  | "bluetooth"
  | "slowStart";

export interface MicReport {
  format: CaptureFormat;
  channels: ChannelStats[];
  usedChannels: number[];
  durationMs: number;
  speechMs: number;
  noiseFloor: number;
  threshold: number;
  peak: number;
  snrDb: number | null;
  /** Start request → first audio (ms). Speech before it is lost. */
  streamStartMs: number | null;
  verdicts: MicVerdict[];
}

export interface DeviceTest {
  device: string;
  report: MicReport | null;
  error: string | null;
}

export type DictationOutcome =
  | "pasted"
  | "clipboard"
  | "tooShort"
  | "noVoice"
  | "empty"
  | "error";

/** One line of `metrics.jsonl` — see `metrics.rs`. */
export interface DictationMetrics {
  timestamp: number;
  outcome: DictationOutcome;
  error: string | null;
  device: string;
  sampleRate: number;
  channels: number;
  sampleFormat: string;
  channelRms: number[];
  channelPeak: number[];
  clippedPct: number;
  usedChannels: number[];
  streamStartMs: number | null;
  gainDb: number;
  recordedMs: number;
  speechMs: number;
  trimmedMs: number;
  noiseFloor: number;
  vadThreshold: number;
  stopMs: number;
  vadMs: number;
  resampleMs: number;
  inferenceMs: number;
  lockWaitMs: number;
  pasteMs: number;
  totalMs: number;
  rtf: number;
  model: string;
  language: string;
  detectedLanguage: string | null;
  audioCtx: number;
  nTokens: number;
  noSpeechProb: number;
  /** Words removed by the repetition-loop safety net (0 = clean decode). */
  repeatedWords: number;
  chars: number;
  words: number;
}

export interface RuntimeInfo {
  appVersion: string;
  model: string | null;
  flashAttn: boolean | null;
  gpu: string | null;
  gpuBackend: string;
  physicalCores: number;
  logicalCores: number;
  whisperThreads: number;
  defaultInput: string | null;
  /** Set while game mode has the shortcut suspended: the foreground app. */
  gameModeSuspendedBy: string | null;
}

/** Localised text for the Windows tray menu, pushed down from the front-end. */
export interface TrayLabels {
  open: string;
  status: string;
  quit: string;
  tooltip: string;
}

export const api = {
  ping: () => invoke<string>("ping"),
  openSettingsWindow: () => invoke<void>("open_settings_window"),
  quitApp: () => invoke<void>("quit_app"),

  /**
   * The tray menu is built by Rust but worded by us — the backend holds no
   * dictionary, so we send it the strings already translated.
   */
  setTrayLabels: (labels: TrayLabels) =>
    invoke<void>("set_tray_labels", { labels }),

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
    invoke<MicReport>("test_microphone", { durationMs }),
  testAllMicrophones: (durationMs: number) =>
    invoke<DeviceTest[]>("test_all_microphones", { durationMs }),
  getMetrics: (limit?: number) => invoke<DictationMetrics[]>("get_metrics", { limit }),
  clearMetrics: () => invoke<void>("clear_metrics"),
  getRuntimeInfo: () => invoke<RuntimeInfo>("get_runtime_info"),
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
