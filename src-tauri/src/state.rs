use std::sync::Arc;

use parking_lot::{Mutex, RwLock};

use crate::audio::AudioRecorder;
use crate::settings::SettingsStore;
use crate::whisper::{Model, WhisperEngine};

/// Global state held inside Tauri via `app.manage()`. Only one instance lives
/// for the whole app lifetime.
pub struct AppState {
    pub recorder: AudioRecorder,
    /// Loaded Whisper engine, or `None` if the model isn't downloaded yet or
    /// failed to load. The `RwLock` lets us hot-swap models from settings.
    pub whisper: Arc<RwLock<Option<WhisperEngine>>>,
    #[allow(dead_code)] // used in Phase 6 for settings UI
    pub default_model: Model,
    /// User-defined screen position for the overlay (px, physical pixels).
    /// `None` means "use the default top-center placement".
    pub overlay_position: Mutex<Option<(i32, i32)>>,
    /// Persisted user settings (mic, mode, hotkey, etc.).
    pub settings: SettingsStore,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            recorder: AudioRecorder::new(),
            whisper: Arc::new(RwLock::new(None)),
            default_model: Model::default(),
            overlay_position: Mutex::new(load_overlay_position()),
            settings: SettingsStore::new(),
        }
    }
}

fn overlay_pos_path() -> Option<std::path::PathBuf> {
    let base = dirs::data_dir()?;
    Some(base.join("Hyperwisper").join("overlay-position.json"))
}

fn load_overlay_position() -> Option<(i32, i32)> {
    let path = overlay_pos_path()?;
    let content = std::fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    let x = json.get("x")?.as_i64()? as i32;
    let y = json.get("y")?.as_i64()? as i32;
    Some((x, y))
}

pub fn persist_overlay_position(x: i32, y: i32) -> anyhow::Result<()> {
    let path = overlay_pos_path()
        .ok_or_else(|| anyhow::anyhow!("could not resolve data dir"))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::json!({ "x": x, "y": y });
    std::fs::write(&path, json.to_string())?;
    Ok(())
}
