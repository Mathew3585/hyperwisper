mod audio;
mod commands;
mod history;
mod hotkey;
mod installer;
mod paste;
mod recording;
mod settings;
mod state;
mod system;
mod tray;
mod whisper;

use std::sync::OnceLock;

use tauri::path::BaseDirectory;
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;

use state::AppState;
use whisper::{models::model_path, Model, WhisperEngine};

/// Set when the binary was started with `--uninstall` and we want the UI to
/// drive the removal flow. Read by `installer_status` so the frontend can
/// route to UninstallerApp instead of the normal settings.
static UNINSTALL_MODE: OnceLock<bool> = OnceLock::new();

pub fn is_uninstall_mode() -> bool {
    *UNINSTALL_MODE.get().unwrap_or(&false)
}

/// Reconcile the OS-level "launch at startup" registration with the user's
/// preference. Called at boot (to fix drift if the user toggled the entry
/// via Task Manager) and from `update_settings` whenever the toggle changes.
pub(crate) fn sync_autostart(app: &tauri::AppHandle, enabled: bool) {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    if let Err(e) = result {
        tracing::warn!("Failed to {} autostart: {}", if enabled { "enable" } else { "disable" }, e);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // The worker guard must outlive the app — dropping it flushes the
    // non-blocking file appender. Store it on the stack of `run()` so it
    // lives as long as the Tauri runtime.
    let _log_guard = setup_logging();

    tracing::info!("Starting Hyperwisper {}", env!("CARGO_PKG_VERSION"));
    if cfg!(feature = "gpu-vulkan") {
        tracing::info!("Acceleration: Vulkan GPU (compiled in)");
    } else if cfg!(feature = "gpu-cuda") {
        tracing::info!("Acceleration: CUDA (compiled in)");
    } else {
        tracing::info!("Acceleration: CPU only (no GPU feature compiled)");
    }

    // Two uninstall modes:
    // - `--uninstall --silent`: tear down without UI (for automations).
    // - `--uninstall` alone:    show the custom UninstallerApp window so the
    //                           user can confirm before we remove anything.
    let args: Vec<String> = std::env::args().skip(1).collect();
    let uninstall_flag = args.iter().any(|a| a == "--uninstall");
    let silent_flag = args.iter().any(|a| a == "--silent");

    if uninstall_flag && silent_flag {
        match installer::uninstall_cleanup() {
            Ok(()) => tracing::info!("Silent uninstall cleanup completed"),
            Err(e) => tracing::error!("Silent uninstall cleanup failed: {}", e),
        }
        if let Err(e) = installer::schedule_install_dir_delete_for_current() {
            tracing::error!("Could not schedule install dir delete: {}", e);
        }
        return;
    }

    let _ = UNINSTALL_MODE.set(uninstall_flag);
    let running_installed = installer::is_running_installed();
    tracing::info!(
        "Run mode: {}",
        if running_installed {
            "installed binary"
        } else {
            "portable (showing installer UI)"
        }
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AppState::new())
        .setup(move |app| {
            use tauri::{Emitter, Manager};

            // Uninstall mode: show only the main window (UninstallerApp).
            // No tray, no hotkey, no model preload — we're tearing down.
            if is_uninstall_mode() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                return Ok(());
            }

            // Portable mode: only show the installer window, skip every
            // runtime feature (tray, hotkey, model preload). The frontend
            // calls `installer_status` on mount and renders InstallerApp.
            if !running_installed {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                return Ok(());
            }

            tray::setup_tray(app.handle())?;

            // Main window is `visible: false` in tauri.conf.json — we show it
            // here only if the user hasn't finished the first-run wizard. On
            // subsequent launches the app lives in the tray; the user opens
            // Settings explicitly by clicking the tray icon.
            {
                let settings = app.handle().state::<AppState>().settings.get();
                if !settings.onboarding_completed {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                // Apply the user's overlay-style preference up front so the
                // window is already the right size on the first dictation.
                if let Some(overlay) = app.get_webview_window("overlay") {
                    let (w, h) = settings.overlay_style.window_size();
                    let _ = overlay.set_size(tauri::LogicalSize::new(w, h));
                }
                // Reconcile OS autostart with the saved preference — covers
                // the case where the user toggled the Run-key entry via Task
                // Manager between sessions.
                sync_autostart(app.handle(), settings.auto_launch);
            }

            if let Err(e) = hotkey::setup(app.handle()) {
                tracing::error!("Failed to register global hotkey: {}", e);
                // The frontend listener isn't attached yet at boot — defer the
                // emit so the toast actually reaches the user instead of being
                // dropped on the floor.
                let handle = app.handle().clone();
                let combo = app
                    .handle()
                    .state::<AppState>()
                    .settings
                    .get()
                    .hotkey;
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                    let _ = handle.emit("hotkey:conflict", combo);
                    tracing::warn!("Emitted hotkey:conflict after delay: {}", e);
                });
            }

            // Copy the bundled model into the user data dir on first run.
            // Must happen BEFORE `preload_default_model` so the file is at
            // its canonical path by the time we try to load it.
            bootstrap_bundled_model(app.handle());

            // Try to auto-load the default model in the background so dictation
            // is ready by the time the user hits Ctrl+Space. If the file isn't
            // there yet, the Settings UI exposes a download button.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                preload_default_model(handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::open_settings_window,
            commands::quit_app,
            commands::start_recording,
            commands::stop_recording,
            commands::toggle_recording,
            commands::cancel_recording,
            commands::list_models,
            commands::download_model,
            commands::load_model,
            commands::is_model_loaded,
            commands::get_system_status,
            commands::save_overlay_position,
            commands::list_input_devices,
            commands::test_microphone,
            commands::pause_hotkey,
            commands::resume_hotkey,
            commands::mark_onboarding_completed,
            commands::get_history,
            commands::delete_history_entry,
            commands::clear_history,
            commands::get_settings,
            commands::update_settings,
            commands::installer_status,
            commands::installer_install,
            commands::installer_relaunch,
            commands::installer_uninstall_cleanup,
            commands::installer_finalize_uninstall,
            commands::installer_trigger_uninstall_ui,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Wire `tracing` to both stderr (dev console) and a daily-rotating file at
/// `%APPDATA%\Hyperwisper\logs\hyperwisper.log.YYYY-MM-DD`. The returned
/// guard must be kept alive for the lifetime of the app — when it drops,
/// pending log lines are flushed.
fn setup_logging() -> Option<tracing_appender::non_blocking::WorkerGuard> {
    use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new("hyperwisper=info,hyperwisper_lib=info")
    });

    let stderr_layer = tracing_subscriber::fmt::layer()
        .with_writer(std::io::stderr)
        .with_ansi(true);

    let (file_layer, guard) = match dirs::data_dir() {
        Some(base) => {
            let logs_dir = base.join("Hyperwisper").join("logs");
            if std::fs::create_dir_all(&logs_dir).is_ok() {
                let appender = tracing_appender::rolling::daily(&logs_dir, "hyperwisper.log");
                let (non_blocking, guard) = tracing_appender::non_blocking(appender);
                let layer = tracing_subscriber::fmt::layer()
                    .with_writer(non_blocking)
                    .with_ansi(false);
                (Some(layer), Some(guard))
            } else {
                (None, None)
            }
        }
        None => (None, None),
    };

    tracing_subscriber::registry()
        .with(env_filter)
        .with(stderr_layer)
        .with(file_layer)
        .init();

    guard
}

/// If the installer shipped a model alongside the binary, copy it to the
/// user's data dir on first launch so the rest of the app finds it at the
/// usual location. Subsequent launches see the file already in place and
/// skip the copy.
fn bootstrap_bundled_model(app: &tauri::AppHandle) {
    let model = Model::default();
    let bundled = match app.path().resolve(
        format!("resources/{}", model.filename()),
        BaseDirectory::Resource,
    ) {
        Ok(p) => p,
        Err(_) => return, // no resource bundled (dev mode)
    };

    if !bundled.exists() {
        return;
    }

    let user_path = match whisper::models::model_path(model) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("Could not resolve user model path: {}", e);
            return;
        }
    };

    if user_path.exists() {
        return; // already there, nothing to do
    }

    if let Some(parent) = user_path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            tracing::error!("Failed to create models dir: {}", e);
            return;
        }
    }

    match std::fs::copy(&bundled, &user_path) {
        Ok(bytes) => tracing::info!(
            "Bootstrapped bundled model ({:.1} MB) to {}",
            bytes as f64 / 1_048_576.0,
            user_path.display()
        ),
        Err(e) => tracing::error!("Failed to copy bundled model: {}", e),
    }
}

async fn preload_default_model(app: tauri::AppHandle) {
    use tauri::Emitter;

    let model = Model::default();
    let path = match model_path(model) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("model_path: {}", e);
            return;
        }
    };

    if !path.exists() {
        tracing::info!("Default model not present at {}", path.display());
        let _ = app.emit("model:missing", model);
        return;
    }

    let load_path = path.clone();
    let engine_result =
        tauri::async_runtime::spawn_blocking(move || WhisperEngine::load(&load_path, model, "fr"))
            .await;

    match engine_result {
        Ok(Ok(engine)) => {
            let state = app.state::<AppState>();
            *state.whisper.write() = Some(engine);
            let _ = app.emit("model:loaded", model);
            tracing::info!("Default model preloaded successfully");
        }
        Ok(Err(e)) => {
            tracing::error!("Failed to load default model: {}", e);
            let _ = app.emit("model:load-error", e.to_string());
        }
        Err(e) => tracing::error!("Join error preloading model: {}", e),
    }
}
