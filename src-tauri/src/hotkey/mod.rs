use std::str::FromStr;

use anyhow::{anyhow, Result};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::recording;
use crate::settings::RecordingMode;
use crate::state::AppState;

/// Parse an accelerator string like `"Ctrl+Space"` or `"Alt+Shift+F8"` into
/// a [`Shortcut`]. Delegates to global-hotkey's `FromStr` impl which already
/// understands the standard accelerator format.
pub fn parse_shortcut(s: &str) -> Result<Shortcut> {
    Shortcut::from_str(s).map_err(|e| anyhow!("invalid shortcut '{}': {:?}", s, e))
}

/// Register a global hotkey with the unified Toggle/PTT handler. The handler
/// reads `settings.mode` at every keystroke, so flipping modes from the UI
/// takes effect immediately — no need to re-register.
pub fn register(app: &AppHandle, hotkey_str: &str) -> Result<()> {
    let shortcut = parse_shortcut(hotkey_str)?;
    let app_handle = app.clone();

    app.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
        let mode = {
            let state = app_handle.state::<AppState>();
            state.settings.get().mode
        };

        let app = app_handle.clone();

        match (mode, event.state()) {
            (RecordingMode::Toggle, ShortcutState::Pressed) => {
                tauri::async_runtime::spawn(async move {
                    recording::toggle(&app).await;
                });
            }
            (RecordingMode::PushToTalk, ShortcutState::Pressed) => {
                tauri::async_runtime::spawn(async move {
                    let state = app.state::<AppState>();
                    if !state.recorder.is_recording() {
                        if let Err(e) = recording::start(&app).await {
                            tracing::error!("PTT start error: {}", e);
                        }
                    }
                });
            }
            (RecordingMode::PushToTalk, ShortcutState::Released) => {
                tauri::async_runtime::spawn(async move {
                    let state = app.state::<AppState>();
                    if state.recorder.is_recording() {
                        recording::stop_and_transcribe(&app).await;
                    }
                });
            }
            _ => {}
        }
    })?;

    tracing::info!("Hotkey registered: {}", hotkey_str);
    Ok(())
}

/// Drop any previously-registered hotkeys before re-registering. Called by
/// `update_settings` when the user picks a new combo from the Shortcuts panel.
pub fn re_register(app: &AppHandle, hotkey_str: &str) -> Result<()> {
    app.global_shortcut().unregister_all()?;
    register(app, hotkey_str)
}

/// First-launch wiring. Reads the hotkey from settings (defaults to
/// `Ctrl+Space`) and registers it.
pub fn setup(app: &AppHandle) -> Result<()> {
    let hotkey = app.state::<AppState>().settings.get().hotkey;
    register(app, &hotkey)
}

/// Register Escape as a recording-only cancel key. We attach it dynamically
/// when a dictation starts (and detach it when it stops) so we don't steal
/// every Esc press in Windows — only the ones during an active recording.
pub fn register_cancel_key(app: &AppHandle) -> Result<()> {
    let shortcut = parse_shortcut("Escape")?;
    let app_handle = app.clone();
    app.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
        if event.state() != ShortcutState::Pressed {
            return;
        }
        let app = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            let state = app.state::<AppState>();
            if state.recorder.is_recording() {
                tracing::info!("Esc pressed → cancelling recording");
                recording::cancel(&app).await;
            }
        });
    })?;
    Ok(())
}

/// Pair with [`register_cancel_key`]. Safe to call even when Esc isn't
/// currently registered — the underlying plugin treats it as a no-op.
pub fn unregister_cancel_key(app: &AppHandle) {
    let shortcut = match parse_shortcut("Escape") {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("Failed to parse Escape for unregister: {}", e);
            return;
        }
    };
    if let Err(e) = app.global_shortcut().unregister(shortcut) {
        // Already-unregistered isn't an error condition we need to flag.
        tracing::debug!("unregister Escape: {}", e);
    }
}
