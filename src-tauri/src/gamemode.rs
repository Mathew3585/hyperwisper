//! Game mode — suspend the global hotkey while a game is on screen.
//!
//! `Ctrl+Space` is a perfectly ordinary key combination inside a game. Left
//! registered, it steals the keystroke, pops an always-on-top overlay and
//! yanks focus mid-match. So we hand the shortcut back to the foreground
//! application whenever Windows says the user is in a do-not-interrupt state,
//! and take it again when they leave.
//!
//! Detection uses `SHQueryUserNotificationState`, the API Windows itself
//! exposes for "is it acceptable to interrupt right now". That is exactly the
//! question being asked, and it beats the usual heuristic of comparing the
//! foreground window's rectangle against the monitor's: no window
//! enumeration, no class-name denylist, and it already accounts for
//! borderless-windowed games, which the rectangle trick handles badly.

use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use crate::state::AppState;

/// How often we ask Windows about the current notification state. Two seconds
/// is imperceptible when alt-tabbing and costs nothing measurable — the call
/// is a single cheap syscall.
const POLL_INTERVAL: Duration = Duration::from_secs(2);

#[cfg(windows)]
#[link(name = "shell32")]
extern "system" {
    /// <https://learn.microsoft.com/windows/win32/api/shellapi/nf-shellapi-shqueryusernotificationstate>
    fn SHQueryUserNotificationState(pquns: *mut i32) -> i32;
}

/// Values of `QUERY_USER_NOTIFICATION_STATE` (shellapi.h).
#[cfg(windows)]
mod quns {
    /// A full-screen application is running, or Presentation Settings are on.
    /// This is what borderless-windowed games report.
    pub const BUSY: i32 = 2;
    /// A full-screen exclusive-mode Direct3D application is running.
    pub const RUNNING_D3D_FULL_SCREEN: i32 = 3;
    /// The user has explicitly asked not to be disturbed.
    pub const PRESENTATION_MODE: i32 = 4;
}

/// Whether the user is currently in a state where interrupting them would be
/// wrong: a game, a fullscreen app, or presentation mode.
pub fn user_is_busy() -> bool {
    #[cfg(windows)]
    {
        let mut state: i32 = 0;
        // SAFETY: `state` is a valid, aligned, writable i32 for the duration
        // of the call, which is the only requirement on the out-parameter.
        let hr = unsafe { SHQueryUserNotificationState(&mut state) };
        if hr != 0 {
            // S_OK is 0. Anything else means we couldn't determine the state —
            // treat that as "not busy" so a failed query can never silently
            // leave the user's hotkey disabled.
            tracing::debug!("SHQueryUserNotificationState failed: 0x{:08X}", hr);
            return false;
        }
        matches!(
            state,
            quns::BUSY | quns::RUNNING_D3D_FULL_SCREEN | quns::PRESENTATION_MODE
        )
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Background watcher that suspends and restores the hotkey as games come and
/// go. Started once at boot; it reads the setting on every tick so toggling
/// Game mode in the UI takes effect without a restart.
pub fn spawn_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut suspended = false;

        loop {
            tokio::time::sleep(POLL_INTERVAL).await;

            let state = app.state::<AppState>();
            let enabled = state.settings.get().game_mode;

            // Turning the feature off while a game is running must give the
            // hotkey straight back rather than wait for the game to close.
            if !enabled {
                if suspended {
                    restore(&app);
                    suspended = false;
                }
                continue;
            }

            // Never pull the hotkey out from under an in-flight dictation:
            // push-to-talk would never see its key release and the recording
            // would hang until the user found another way to stop it.
            if state.recorder.is_recording() {
                continue;
            }

            let busy = user_is_busy();

            if busy && !suspended {
                match app.global_shortcut().unregister_all() {
                    Ok(()) => {
                        suspended = true;
                        tracing::info!("Game mode: fullscreen app detected, hotkey suspended");
                        let _ = app.emit("gamemode:active", true);
                    }
                    Err(e) => tracing::warn!("Game mode: could not unregister hotkey: {}", e),
                }
            } else if !busy && suspended {
                restore(&app);
                suspended = false;
            }
        }
    });
}

fn restore(app: &AppHandle) {
    let hotkey = app.state::<AppState>().settings.get().hotkey;
    match crate::hotkey::register(app, &hotkey) {
        Ok(()) => {
            tracing::info!("Game mode: hotkey restored ({})", hotkey);
            let _ = app.emit("gamemode:active", false);
        }
        Err(e) => tracing::error!("Game mode: failed to restore hotkey: {}", e),
    }
}
