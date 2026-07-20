use anyhow::{anyhow, Result};
use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

/// Result of a paste attempt — `Ok(true)` means the text was both copied to
/// the clipboard *and* the Ctrl+V simulation succeeded (or was skipped because
/// `auto_paste = false`). `Ok(false)` means the clipboard was set but the
/// keystroke simulation failed — the caller should surface that as a warning
/// so the user knows to press Ctrl+V manually.
pub enum PasteOutcome {
    Pasted,
    ClipboardOnly { reason: String },
}

/// Copy `text` to the system clipboard and (optionally) simulate Ctrl+V so it
/// gets pasted into whatever app currently has focus. If `preserve_previous`
/// is set, the prior clipboard text is captured first and restored after a
/// short delay — but **only if the auto-paste step succeeded**. When the
/// keystroke simulation fails (UAC, secure desktop, restricted app), we keep
/// the transcription in the clipboard so the user can press Ctrl+V manually.
pub fn paste_text(
    text: &str,
    auto_paste: bool,
    preserve_previous: bool,
) -> Result<PasteOutcome> {
    let mut clipboard = Clipboard::new().map_err(|e| anyhow!("clipboard init: {e}"))?;

    let saved = if preserve_previous {
        clipboard.get_text().ok()
    } else {
        None
    };

    clipboard
        .set_text(text.to_owned())
        .map_err(|e| anyhow!("clipboard set_text: {e}"))?;

    if !auto_paste {
        // No keystroke to send — leave the text on the clipboard.
        return Ok(PasteOutcome::Pasted);
    }

    // The target app needs a moment to settle focus after the overlay was
    // hidden. 60ms is the smallest value that works reliably on Discord
    // Electron + Chrome; faster apps don't notice the delay.
    thread::sleep(Duration::from_millis(60));

    match simulate_ctrl_v() {
        Ok(()) => {
            if let Some(previous) = saved {
                // Wait for the target app to consume the Ctrl+V before we
                // swap back so we don't trash the paste mid-flight.
                thread::spawn(move || {
                    thread::sleep(Duration::from_millis(250));
                    if let Ok(mut cb) = Clipboard::new() {
                        let _ = cb.set_text(previous);
                    }
                });
            }
            Ok(PasteOutcome::Pasted)
        }
        Err(e) => {
            // The keystroke failed — typically a secure-desktop / UAC prompt
            // or an app that intercepts global input hooks. Leave the
            // transcription on the clipboard (don't restore the previous
            // value) so the user can still paste it manually.
            Ok(PasteOutcome::ClipboardOnly {
                reason: e.to_string(),
            })
        }
    }
}

fn simulate_ctrl_v() -> Result<()> {
    let mut enigo =
        Enigo::new(&Settings::default()).map_err(|e| anyhow!("enigo init: {e:?}"))?;
    enigo
        .key(Key::Control, Direction::Press)
        .map_err(|e| anyhow!("ctrl down: {e:?}"))?;
    enigo
        .key(Key::Unicode('v'), Direction::Click)
        .map_err(|e| anyhow!("v click: {e:?}"))?;
    enigo
        .key(Key::Control, Direction::Release)
        .map_err(|e| anyhow!("ctrl up: {e:?}"))?;
    Ok(())
}
