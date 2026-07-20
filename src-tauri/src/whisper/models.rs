use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// Catalog of supported Whisper models. URLs and SHA256s point to the
/// official ggerganov/whisper.cpp HuggingFace repo. We default to
/// `SmallQ5_1` — best quality/speed tradeoff for French dictation on CPU.
///
/// Each variant is explicitly renamed so the JSON string matches the TS
/// literal type 1:1, regardless of how `heck` chooses to handle the mix of
/// uppercase letters, digits and underscores in our enum names.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Model {
    #[serde(rename = "tiny-q5_1")]
    TinyQ5_1,
    #[serde(rename = "base-q5_1")]
    BaseQ5_1,
    #[serde(rename = "small-q5_1")]
    SmallQ5_1,
    #[serde(rename = "small")]
    Small,
    #[serde(rename = "medium-q5_0")]
    MediumQ5_0,
    #[serde(rename = "large-v3-q5_0")]
    LargeV3Q5_0,
}

impl Default for Model {
    fn default() -> Self {
        Self::SmallQ5_1
    }
}

impl Model {
    pub fn filename(&self) -> &'static str {
        match self {
            Self::TinyQ5_1 => "ggml-tiny-q5_1.bin",
            Self::BaseQ5_1 => "ggml-base-q5_1.bin",
            Self::SmallQ5_1 => "ggml-small-q5_1.bin",
            Self::Small => "ggml-small.bin",
            Self::MediumQ5_0 => "ggml-medium-q5_0.bin",
            Self::LargeV3Q5_0 => "ggml-large-v3-q5_0.bin",
        }
    }

    pub fn url(&self) -> String {
        format!(
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}",
            self.filename()
        )
    }

    /// Approximate on-disk size in MB (informational, used in UI).
    pub fn size_mb(&self) -> u32 {
        match self {
            Self::TinyQ5_1 => 32,
            Self::BaseQ5_1 => 60,
            Self::SmallQ5_1 => 190,
            Self::Small => 488,
            Self::MediumQ5_0 => 539,
            Self::LargeV3Q5_0 => 1080,
        }
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            Self::TinyQ5_1 => "Tiny (Q5_1)",
            Self::BaseQ5_1 => "Base (Q5_1)",
            Self::SmallQ5_1 => "Small (Q5_1)",
            Self::Small => "Small (full)",
            Self::MediumQ5_0 => "Medium (Q5_0)",
            Self::LargeV3Q5_0 => "Large v3 (Q5_0)",
        }
    }
}

/// Absolute path where a model file should live on disk.
/// Resolves to `%APPDATA%\Hyperwisper\models\<filename>` on Windows.
pub fn model_path(model: Model) -> anyhow::Result<PathBuf> {
    let dir = models_dir()?;
    Ok(dir.join(model.filename()))
}

pub fn models_dir() -> anyhow::Result<PathBuf> {
    let base = dirs::data_dir()
        .ok_or_else(|| anyhow::anyhow!("could not resolve user data dir"))?;
    let dir = base.join("Hyperwisper").join("models");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}
