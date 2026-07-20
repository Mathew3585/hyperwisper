use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

/// User-facing settings. Persisted as JSON in `%APPDATA%\Hyperwisper\settings.json`.
/// All fields have sane defaults so the app works out-of-the-box on first launch
/// without writing anything to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    /// Name of the cpal input device to use. `None` = Windows system default
    /// — whichever mic the user picked in Windows Sound settings.
    pub microphone_name: Option<String>,

    pub mode: RecordingMode,

    /// Human-readable hotkey string, e.g. `"Ctrl+Space"`.
    pub hotkey: String,

    pub auto_paste: bool,

    /// If true, restore the previous clipboard content ~200ms after the
    /// transcription was pasted, so dictation doesn't trash whatever the
    /// user had copied.
    pub preserve_clipboard: bool,

    /// Whisper transcription language. `"auto"` lets Whisper detect.
    pub language: String,

    /// Visual style of the recording overlay. `Fat` is the rich pill with
    /// timer and full waveform; `Thin` is a minimal sliver for users who
    /// don't want a big thing on screen.
    pub overlay_style: OverlayStyle,

    /// Set to `true` once the user has completed the first-run wizard. While
    /// `false`, the main window opens to the wizard on startup; after that,
    /// the app launches into the tray with no visible window.
    pub onboarding_completed: bool,

    /// Launch Hyperwisper automatically when Windows starts so the user
    /// doesn't have to remember to open the app before pressing the hotkey.
    /// The OS-level autostart registration is kept in sync with this value
    /// at startup and whenever settings are saved.
    pub auto_launch: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordingMode {
    Toggle,
    PushToTalk,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OverlayStyle {
    Fat,
    Thin,
}

impl OverlayStyle {
    /// Window dimensions (logical px). Tuned so the pill has comfortable
    /// breathing room around its content.
    pub fn window_size(self) -> (u32, u32) {
        match self {
            OverlayStyle::Fat => (520, 140),
            OverlayStyle::Thin => (220, 48),
        }
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            microphone_name: None,
            mode: RecordingMode::Toggle,
            hotkey: "Ctrl+Space".to_string(),
            auto_paste: true,
            preserve_clipboard: false,
            language: "fr".to_string(),
            overlay_style: OverlayStyle::Fat,
            onboarding_completed: false,
            auto_launch: true,
        }
    }
}

/// Thread-safe settings holder. Read-mostly: we clone on `get` instead of
/// handing out a lock guard so callers don't accidentally hold the lock
/// across IPC boundaries.
pub struct SettingsStore {
    inner: Arc<RwLock<Settings>>,
}

impl SettingsStore {
    pub fn new() -> Self {
        let initial = load_from_disk().unwrap_or_default();
        Self {
            inner: Arc::new(RwLock::new(initial)),
        }
    }

    pub fn get(&self) -> Settings {
        self.inner.read().clone()
    }

    pub fn update(&self, new: Settings) -> Result<()> {
        persist_to_disk(&new)?;
        *self.inner.write() = new;
        Ok(())
    }
}

fn settings_path() -> Result<PathBuf> {
    let base = dirs::data_dir()
        .ok_or_else(|| anyhow::anyhow!("could not resolve user data dir"))?;
    Ok(base.join("Hyperwisper").join("settings.json"))
}

fn load_from_disk() -> Result<Settings> {
    let path = settings_path()?;
    let content = std::fs::read_to_string(&path)?;
    let settings: Settings = serde_json::from_str(&content)?;
    Ok(settings)
}

fn persist_to_disk(s: &Settings) -> Result<()> {
    let path = settings_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(s)?;
    std::fs::write(&path, content)?;
    Ok(())
}
