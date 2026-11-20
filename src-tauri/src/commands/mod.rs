use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::audio;
use crate::history::{self, HistoryEntry};
use crate::installer;
use crate::settings::Settings;
use crate::state::AppState;
use crate::system;
use crate::whisper::{self, Model};

#[tauri::command]
pub fn ping() -> String {
    "pong".to_string()
}

#[tauri::command]
pub fn open_settings_window(app: AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.unminimize().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    tracing::info!("Quit requested via command");
    app.exit(0);
}

#[tauri::command]
pub async fn start_recording(app: AppHandle) -> Result<(), String> {
    crate::recording::start(&app)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle) -> Result<(), String> {
    crate::recording::stop_and_transcribe(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn toggle_recording(app: AppHandle) -> Result<(), String> {
    crate::recording::toggle(&app).await;
    Ok(())
}

#[tauri::command]
pub async fn cancel_recording(app: AppHandle) -> Result<(), String> {
    crate::recording::cancel(&app).await;
    Ok(())
}

#[tauri::command]
pub fn save_overlay_position(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    let state = app.state::<AppState>();
    *state.overlay_position.lock() = Some((x, y));
    crate::state::persist_overlay_position(x, y).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_input_devices() -> Vec<String> {
    audio::list_input_devices()
}

/// Result of the microphone check: how the device was opened, how each
/// channel behaved, and a list of verdict ids the front-end turns into
/// advice ("gain too low", "input 2 ignored", …).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MicReport {
    pub format: audio::CaptureFormat,
    pub channels: Vec<audio::channels::ChannelStats>,
    pub used_channels: Vec<usize>,
    pub duration_ms: u64,
    pub speech_ms: u32,
    pub noise_floor: f32,
    pub threshold: f32,
    /// Loudest 20 ms frame of the mono signal Whisper would get (RMS).
    pub peak: f32,
    /// Speech-to-noise ratio in dB (speech-frame RMS vs noise floor).
    pub snr_db: Option<f32>,
    /// Start request → first audio. Speech before it is lost.
    pub stream_start_ms: Option<f64>,
    /// Stable ids: `ok`, `noSignal`, `noVoice`, `lowGain`, `clipping`,
    /// `channelsIgnored`, `bluetooth`, `slowStart`.
    pub verdicts: Vec<String>,
}

/// One row of "test every microphone".
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceTest {
    pub device: String,
    pub report: Option<MicReport>,
    pub error: Option<String>,
}

/// Run the mic check on every input device, one after another, so the user
/// can compare them side by side while talking continuously. Each device is
/// opened by name, exactly as a dictation would open it.
#[tauri::command]
pub async fn test_all_microphones(app: AppHandle, duration_ms: u64) -> Vec<DeviceTest> {
    let devices = audio::list_input_devices();
    let mut out = Vec::with_capacity(devices.len());
    for device in devices {
        let _ = app.emit("mictest:device", &device);
        let result = run_mic_test(&app, Some(device.clone()), duration_ms).await;
        out.push(match result {
            Ok(report) => DeviceTest { device, report: Some(report), error: None },
            Err(e) => DeviceTest { device, report: None, error: Some(e) },
        });
    }
    out
}

/// Capture audio for `duration_ms` without going through the full recording
/// pipeline (no overlay, no transcription) — used by the onboarding wizard's
/// mic check and the Diagnostics panel. The audio thread keeps emitting
/// `recording:level` events so the UI can draw a live waveform.
#[tauri::command]
pub async fn test_microphone(app: AppHandle, duration_ms: u64) -> Result<MicReport, String> {
    let mic = app.state::<AppState>().settings.get().microphone_name;
    run_mic_test(&app, mic, duration_ms).await
}

async fn run_mic_test(
    app: &AppHandle,
    device: Option<String>,
    duration_ms: u64,
) -> Result<MicReport, String> {
    app.state::<AppState>()
        .recorder
        .start_with_device(app.clone(), device)
        .map_err(|e| e.to_string())?;

    tokio::time::sleep(std::time::Duration::from_millis(duration_ms)).await;

    let app_for_stop = app.clone();
    let capture = tauri::async_runtime::spawn_blocking(move || {
        app_for_stop.state::<AppState>().recorder.stop()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    Ok(mic_report(capture))
}

fn mic_report(capture: audio::Capture) -> MicReport {
    let rate = capture.format.sample_rate.max(1);
    let va = crate::recording::analyze_voice_activity(&capture.mono, rate);

    // Mean RMS of the frames the VAD counted as speech, for an SNR estimate.
    let frame = (rate / 50).max(1) as usize; // 20 ms, same as the VAD
    let loud: Vec<f32> = capture
        .mono
        .chunks(frame)
        .map(|f| (f.iter().map(|s| s * s).sum::<f32>() / f.len().max(1) as f32).sqrt())
        .filter(|&r| va.threshold > 0.0 && r >= va.threshold)
        .collect();
    let snr_db = if loud.is_empty() || va.noise_floor <= 0.0 {
        None
    } else {
        let speech = loud.iter().sum::<f32>() / loud.len() as f32;
        Some(20.0 * (speech / va.noise_floor).log10())
    };

    let max_peak = capture.channel_stats.iter().map(|c| c.peak).fold(0.0, f32::max);
    let clipped = capture
        .channel_stats
        .iter()
        .map(|c| c.clipped_ratio)
        .fold(0.0, f32::max);

    let mut verdicts: Vec<String> = Vec::new();
    if max_peak < 0.001 {
        verdicts.push("noSignal".into());
    } else {
        if va.speech_ms < crate::recording::VAD_MIN_SPEECH_MS {
            verdicts.push("noVoice".into());
        } else if va.peak < 0.03 && snr_db.map_or(true, |s| s < 25.0) {
            // Quiet *and* noisy. A soft voice over a clean background is
            // fine — dictations are normalized — but here turning the gain
            // up would lift the voice out of the noise.
            verdicts.push("lowGain".into());
        }
        if clipped > 0.001 {
            verdicts.push("clipping".into());
        }
    }
    let ignored = capture.used_channels.len() < capture.channel_stats.len();
    if verdicts.is_empty() {
        verdicts.push("ok".into());
    }
    if ignored {
        verdicts.push("channelsIgnored".into());
    }
    // Bluetooth headsets in hands-free mode: 8/16 kHz mono, phone-call
    // quality. Usable, but worth knowing why accuracy is lower.
    let name = capture.format.device.to_lowercase();
    if name.contains("hands-free")
        || name.contains("mains libres")
        || (capture.format.channels == 1 && capture.format.sample_rate <= 16_000)
    {
        verdicts.push("bluetooth".into());
    }
    if capture.stream_start_ms.is_some_and(|ms| ms > 300.0) {
        verdicts.push("slowStart".into());
    }

    MicReport {
        duration_ms: (capture.mono.len() as u64 * 1000) / rate as u64,
        format: capture.format,
        channels: capture.channel_stats,
        used_channels: capture.used_channels,
        speech_ms: va.speech_ms,
        noise_floor: va.noise_floor,
        threshold: va.threshold,
        peak: va.peak,
        snr_db,
        stream_start_ms: capture.stream_start_ms,
        verdicts,
    }
}

#[tauri::command]
pub fn get_metrics(limit: Option<usize>) -> Vec<crate::metrics::DictationMetrics> {
    crate::metrics::read_recent(limit.unwrap_or(500))
}

#[tauri::command]
pub fn clear_metrics() -> Result<(), String> {
    crate::metrics::clear().map_err(|e| e.to_string())
}

/// Static facts about how inference runs on this machine, shown at the top
/// of the Diagnostics panel and included in exports.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub app_version: String,
    pub model: Option<String>,
    pub flash_attn: Option<bool>,
    pub gpu: Option<String>,
    pub gpu_backend: String,
    pub physical_cores: usize,
    pub logical_cores: usize,
    pub whisper_threads: usize,
    pub default_input: Option<String>,
    /// `Some(app)` while game mode has the shortcut suspended.
    pub game_mode_suspended_by: Option<String>,
}

#[tauri::command]
pub async fn get_runtime_info(app: AppHandle) -> RuntimeInfo {
    // detect_gpu shells out on first call; keep it off the async runtime.
    let gpu = tauri::async_runtime::spawn_blocking(system::detect_gpu)
        .await
        .ok()
        .flatten();
    let state = app.state::<AppState>();
    let (model, flash_attn, engine_gpu) = match state.whisper.try_read() {
        Some(guard) => match guard.as_ref() {
            Some(e) => (
                Some(e.model().display_name().to_string()),
                Some(e.flash_attn()),
                e.device().map(str::to_string),
            ),
            None => (None, None, None),
        },
        None => (None, None, None), // a model swap is in progress
    };
    // The device inference really uses beats WMI's first adapter.
    let gpu = engine_gpu.or(gpu);
    let physical = num_cpus::get_physical();
    let game_mode_suspended_by = state.game_mode_app.lock().clone();
    RuntimeInfo {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        model,
        flash_attn,
        gpu,
        gpu_backend: if cfg!(feature = "gpu-vulkan") {
            "vulkan".into()
        } else if cfg!(feature = "gpu-cuda") {
            "cuda".into()
        } else {
            "cpu".into()
        },
        physical_cores: physical,
        logical_cores: num_cpus::get(),
        whisper_threads: physical.clamp(1, 8),
        default_input: audio::default_input_name(),
        game_mode_suspended_by,
    }
}

/// Temporarily unregister every global hotkey — used while the user is
/// rebinding their shortcut so that pressing the candidate combo doesn't
/// also trigger the live recording loop.
#[tauri::command]
pub fn pause_hotkey(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| e.to_string())
}

/// Re-register the hotkey stored in settings — pairs with `pause_hotkey`.
#[tauri::command]
pub fn resume_hotkey(app: AppHandle) -> Result<(), String> {
    let hotkey = app.state::<AppState>().settings.get().hotkey;
    crate::hotkey::register(&app, &hotkey).map_err(|e| e.to_string())
}

/// Persist that the onboarding wizard has been completed. Subsequent app
/// launches start with the main window hidden — the user reaches Settings
/// via the tray icon.
#[tauri::command]
pub fn mark_onboarding_completed(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut s = state.settings.get();
    if s.onboarding_completed {
        return Ok(());
    }
    s.onboarding_completed = true;
    state.settings.update(s).map_err(|e| e.to_string())
}

/// Push localised tray-menu labels down from the front-end. Called once when
/// the UI mounts and again whenever the interface language changes, so the
/// tray follows the rest of the app instead of being stuck in English.
#[tauri::command]
pub fn set_tray_labels(app: AppHandle, labels: crate::tray::TrayLabels) -> Result<(), String> {
    crate::tray::set_labels(&app, labels).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_history() -> Vec<HistoryEntry> {
    history::read_all()
}

#[tauri::command]
pub fn delete_history_entry(id: String) -> Result<(), String> {
    history::delete_entry(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history() -> Result<(), String> {
    history::clear_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Settings {
    app.state::<AppState>().settings.get()
}

#[tauri::command]
pub fn update_settings(app: AppHandle, mut settings: Settings) -> Result<(), String> {
    let state = app.state::<AppState>();
    let previous = state.settings.get();
    // The active model is owned by `load_model`, not by the settings form —
    // keep whatever is persisted so a form that doesn't round-trip the
    // field can't silently reset it.
    settings.model = previous.model;
    let hotkey_changed = previous.hotkey != settings.hotkey;
    let overlay_style_changed = previous.overlay_style != settings.overlay_style;
    let auto_launch_changed = previous.auto_launch != settings.auto_launch;
    let new_hotkey = settings.hotkey.clone();
    let new_overlay_style = settings.overlay_style;
    let new_auto_launch = settings.auto_launch;

    // Register the new hotkey before persisting anything: if the OS rejects
    // the combo (already taken by another app), we restore the old one and
    // leave the saved settings untouched instead of persisting a hotkey
    // that doesn't work.
    if hotkey_changed {
        if let Err(e) = crate::hotkey::re_register(&app, &new_hotkey) {
            if let Err(e2) = crate::hotkey::re_register(&app, &previous.hotkey) {
                tracing::error!("Could not restore previous hotkey: {}", e2);
            }
            return Err(format!("hotkey: {}", e));
        }
    }

    state.settings.update(settings).map_err(|e| e.to_string())?;

    if overlay_style_changed {
        if let Some(overlay) = app.get_webview_window("overlay") {
            let (w, h) = new_overlay_style.window_size();
            let _ = overlay.set_size(tauri::LogicalSize::new(w, h));
        }
    }

    if auto_launch_changed {
        crate::sync_autostart(&app, new_auto_launch);
    }

    let _ = app.emit("settings:changed", ());
    Ok(())
}

#[derive(Serialize)]
pub struct ModelStatus {
    pub model: Model,
    pub filename: String,
    pub display_name: String,
    pub size_mb: u32,
    pub downloaded: bool,
    pub loaded: bool,
}

#[tauri::command]
pub fn list_models(app: AppHandle) -> Result<Vec<ModelStatus>, String> {
    let state = app.state::<AppState>();
    let loaded_model = state.whisper.read().as_ref().map(|e| e.model());

    Ok(Model::ALL
        .iter()
        .map(|m| ModelStatus {
            model: *m,
            filename: m.filename().to_string(),
            display_name: m.display_name().to_string(),
            size_mb: m.size_mb(),
            downloaded: m.is_downloaded(),
            loaded: loaded_model == Some(*m),
        })
        .collect())
}

#[tauri::command]
pub async fn download_model(model: Model, app: AppHandle) -> Result<(), String> {
    let dest = whisper::models::model_path(model).map_err(|e| e.to_string())?;
    if dest.exists() {
        return Ok(());
    }
    whisper::downloader::download_model(app, model, &dest)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_model(model: Model, app: AppHandle) -> Result<(), String> {
    let path = whisper::models::model_path(model).map_err(|e| e.to_string())?;
    if !path.exists() {
        return Err(format!(
            "model file missing: {} — download it first",
            path.display()
        ));
    }

    let app_for_swap = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let engine = whisper::WhisperEngine::load(&path, model)?;
        // Taking the write lock can wait on an in-flight warm-up or
        // dictation for several seconds — do it here, off the async
        // runtime, rather than parking a tokio worker on it.
        let state = app_for_swap.state::<AppState>();
        let previous = state.whisper.write().replace(engine);
        // Free the old model's RAM/VRAM outside the lock.
        drop(previous);
        anyhow::Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // Remember the pick so the next launch loads the same model.
    let state = app.state::<AppState>();
    let mut settings = state.settings.get();
    if settings.model != Some(model) {
        settings.model = Some(model);
        if let Err(e) = state.settings.update(settings) {
            tracing::warn!("Could not persist model choice: {}", e);
        }
    }

    let _ = app.emit("model:loaded", model);
    crate::warm_up_in_background(app.clone());
    Ok(())
}

#[tauri::command]
pub fn is_model_loaded(app: AppHandle) -> bool {
    let state = app.state::<AppState>();
    let loaded = state.whisper.read().is_some();
    loaded
}

/// Snapshot of every "check" surfaced on the General panel. The frontend
/// reads this once on mount and after relevant events to render the
/// status list (✓ / ⚠ / ✗).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStatus {
    pub whisper: StatusItem,
    pub microphone: StatusItem,
    pub hotkey: StatusItem,
    pub acceleration: StatusItem,
    pub privacy: StatusItem,
}

/// A single status row.
///
/// The backend deliberately emits NO prose. It has no idea which language
/// the UI is running in, so it sends a stable `kind` id plus any data that
/// isn't translatable anyway (a device name, a model name, a hotkey combo).
/// The front-end maps `kind` to a string from its own dictionary.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusItem {
    pub level: StatusLevel,
    /// Stable identifier, e.g. "loaded", "missing", "gpu", "cpuWithGpu".
    pub kind: String,
    /// Interpolated into the translated string when present.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link_to: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StatusLevel {
    Ok,
    Warn,
    Error,
}

#[tauri::command]
pub fn get_system_status(app: AppHandle) -> SystemStatus {
    let state = app.state::<AppState>();

    // Whisper model
    let whisper = {
        let guard = state.whisper.read();
        match guard.as_ref() {
            Some(engine) => StatusItem {
                level: StatusLevel::Ok,
                kind: "loaded".into(),
                detail: Some(engine.model().display_name().to_string()),
                link_to: None,
            },
            None => StatusItem {
                level: StatusLevel::Error,
                kind: "missing".into(),
                detail: None,
                link_to: Some("models".into()),
            },
        }
    };

    // Microphone
    let microphone = match audio::default_input_name() {
        Some(name) => StatusItem {
            level: StatusLevel::Ok,
            kind: "ok".into(),
            detail: Some(name),
            link_to: None,
        },
        None => StatusItem {
            level: StatusLevel::Error,
            kind: "missing".into(),
            detail: None,
            link_to: Some("settings".into()),
        },
    };

    let hotkey = {
        let combo = state.settings.get().hotkey;
        StatusItem {
            level: StatusLevel::Ok,
            kind: "ok".into(),
            detail: Some(combo.replace('+', " + ")),
            link_to: None,
        }
    };

    // GPU / acceleration
    let acceleration = {
        // Once a model is loaded, report the device whisper.cpp actually
        // runs on — WMI's first adapter is the iGPU on most laptops.
        let engine_device: Option<Option<String>> = state
            .whisper
            .try_read()
            .and_then(|g| g.as_ref().map(|e| e.device().map(str::to_string)));
        let (gpu, enabled) = match engine_device {
            Some(Some(name)) => (Some(name), true),
            Some(None) => (system::detect_gpu(), false),
            None => (system::detect_gpu(), system::gpu_acceleration_enabled()),
        };
        match (gpu, enabled) {
            (Some(name), true) => StatusItem {
                level: StatusLevel::Ok,
                kind: "gpu".into(),
                detail: Some(name),
                link_to: None,
            },
            (Some(name), false) => StatusItem {
                level: StatusLevel::Warn,
                kind: "cpuWithGpu".into(),
                detail: Some(name),
                link_to: None,
            },
            (None, _) => StatusItem {
                level: StatusLevel::Ok,
                kind: "cpu".into(),
                detail: None,
                link_to: None,
            },
        }
    };

    // Privacy — always OK by design
    let privacy = StatusItem {
        level: StatusLevel::Ok,
        kind: "ok".into(),
        detail: None,
        link_to: None,
    };

    SystemStatus {
        whisper,
        microphone,
        hotkey,
        acceleration,
        privacy,
    }
}

/* ─── Installer commands ─────────────────────────────────────────────── */

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallerStatus {
    /// `true` when the running binary IS the installed copy.
    pub running_installed: bool,
    /// `true` when the binary was launched with `--uninstall` — the frontend
    /// uses this to route to the UninstallerApp instead of the settings UI.
    pub uninstall_mode: bool,
    /// `true` when a previous install is registered on this system.
    pub install_exists: bool,
    /// Default install directory (`%LOCALAPPDATA%\Programs\Hyperwisper`),
    /// pre-filled into the path picker on first install.
    pub default_install_dir: String,
    /// If a previous install is registered, the directory it lives in — used
    /// as the picker's pre-filled value during a reinstall.
    pub existing_install_dir: Option<String>,
    /// Path to the binary currently running.
    pub current_exe: String,
}

#[tauri::command]
pub fn installer_status() -> InstallerStatus {
    let default_dir = installer::default_install_root()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let existing_dir = installer::registered_install_dir()
        .map(|p| p.to_string_lossy().to_string());
    let current = installer::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    InstallerStatus {
        running_installed: installer::is_running_installed(),
        uninstall_mode: crate::is_uninstall_mode(),
        install_exists: installer::install_exists(),
        default_install_dir: default_dir,
        existing_install_dir: existing_dir,
        current_exe: current,
    }
}

/// Copy the running binary to the chosen install directory, create
/// shortcuts, register the uninstaller. Does NOT download the model — the
/// frontend orchestrates that step separately via `download_model` so the
/// progress UI can animate independently.
#[tauri::command]
pub fn installer_install(
    install_dir: String,
    create_desktop_shortcut: bool,
) -> Result<(), String> {
    let dir = std::path::PathBuf::from(&install_dir);
    let installed = installer::copy_exe(&dir).map_err(|e| e.to_string())?;

    installer::create_start_menu_shortcut(&installed).map_err(|e| e.to_string())?;
    if create_desktop_shortcut {
        installer::create_desktop_shortcut(&installed).map_err(|e| e.to_string())?;
    }

    installer::write_uninstall_registry(&installed, &dir).map_err(|e| e.to_string())?;
    Ok(())
}

/// Kill the running (downloaded) instance and start the installed one.
#[tauri::command]
pub fn installer_relaunch(app: AppHandle) -> Result<(), String> {
    installer::relaunch_installed_and_exit(&app).map_err(|e| e.to_string())
}

/// Remove registry entries, shortcuts, user data. Does NOT delete the
/// install directory yet — that happens in `installer_finalize_uninstall`
/// once the UI is ready to dismiss itself.
#[tauri::command]
pub fn installer_uninstall_cleanup() -> Result<(), String> {
    installer::uninstall_cleanup().map_err(|e| e.to_string())
}

/// Schedule the install directory for deletion and exit the app. The
/// scheduled batch waits ~2s so the process can actually release its
/// handle on `Hyperwisper.exe` before the file gets removed.
#[tauri::command]
pub fn installer_finalize_uninstall(app: AppHandle) -> Result<(), String> {
    installer::schedule_install_dir_delete_for_current().map_err(|e| e.to_string())?;
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(150));
        handle.exit(0);
    });
    Ok(())
}

/// Re-spawn the running binary with `--uninstall` and exit the current
/// process. Used by the in-app "Désinstaller" button so the user lands in
/// the custom UninstallerApp instead of seeing the settings UI mid-removal.
#[tauri::command]
pub fn installer_trigger_uninstall_ui(app: AppHandle) -> Result<(), String> {
    use std::process::Command;
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;

    let exe = installer::current_exe().map_err(|e| e.to_string())?;
    let mut cmd = Command::new(&exe);
    cmd.arg("--uninstall");
    #[cfg(windows)]
    cmd.creation_flags(0x0000_0008); // DETACHED_PROCESS
    cmd.spawn().map_err(|e| format!("spawn: {}", e))?;

    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(200));
        handle.exit(0);
    });
    Ok(())
}
