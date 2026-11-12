use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// Catalog of supported Whisper models. URLs and SHA256s point to the
/// official ggerganov/whisper.cpp HuggingFace repo.
///
/// The default is `large-v3-turbo` (Q5_0): OpenAI's 2024 distillation of
/// large-v3 down to 4 decoder layers. It keeps large-v3-level accuracy —
/// markedly better than `small` on French — while decoding ~8x faster than
/// large-v3, and with Vulkan compiled in by default it lands in the same
/// latency class `small` used to on CPU.
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
    #[serde(rename = "large-v3-turbo-q5_0")]
    LargeV3TurboQ5_0,
    #[serde(rename = "large-v3-turbo-q8_0")]
    LargeV3TurboQ8_0,
    #[serde(rename = "large-v3-q5_0")]
    LargeV3Q5_0,
}

impl Default for Model {
    fn default() -> Self {
        Self::LargeV3TurboQ5_0
    }
}

impl Model {
    /// Every model, in the order the UI lists them (smallest first).
    pub const ALL: [Model; 8] = [
        Model::TinyQ5_1,
        Model::BaseQ5_1,
        Model::SmallQ5_1,
        Model::Small,
        Model::MediumQ5_0,
        Model::LargeV3TurboQ5_0,
        Model::LargeV3TurboQ8_0,
        Model::LargeV3Q5_0,
    ];

    /// Fallback order when the preferred model isn't on disk: best
    /// dictation model first. Plain large-v3 sits below turbo because it's
    /// far slower for a barely-measurable accuracy gain.
    pub const PREFERENCE: [Model; 8] = [
        Model::LargeV3TurboQ5_0,
        Model::LargeV3TurboQ8_0,
        Model::LargeV3Q5_0,
        Model::MediumQ5_0,
        Model::Small,
        Model::SmallQ5_1,
        Model::BaseQ5_1,
        Model::TinyQ5_1,
    ];

    pub fn filename(&self) -> &'static str {
        match self {
            Self::TinyQ5_1 => "ggml-tiny-q5_1.bin",
            Self::BaseQ5_1 => "ggml-base-q5_1.bin",
            Self::SmallQ5_1 => "ggml-small-q5_1.bin",
            Self::Small => "ggml-small.bin",
            Self::MediumQ5_0 => "ggml-medium-q5_0.bin",
            Self::LargeV3TurboQ5_0 => "ggml-large-v3-turbo-q5_0.bin",
            Self::LargeV3TurboQ8_0 => "ggml-large-v3-turbo-q8_0.bin",
            Self::LargeV3Q5_0 => "ggml-large-v3-q5_0.bin",
        }
    }

    pub fn url(&self) -> String {
        format!(
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}",
            self.filename()
        )
    }

    /// SHA-256 of the file as published on HuggingFace (the LFS object id).
    /// Checked after every download so a truncated or corrupted file is
    /// rejected instead of crashing whisper.cpp at load time.
    pub fn sha256(&self) -> &'static str {
        match self {
            Self::TinyQ5_1 => "818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7",
            Self::BaseQ5_1 => "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
            Self::SmallQ5_1 => "ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb",
            Self::Small => "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
            Self::MediumQ5_0 => "19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f",
            Self::LargeV3TurboQ5_0 => "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2",
            Self::LargeV3TurboQ8_0 => "317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1",
            Self::LargeV3Q5_0 => "d75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1",
        }
    }

    /// Approximate on-disk size in MB (informational, used in UI).
    pub fn size_mb(&self) -> u32 {
        match self {
            Self::TinyQ5_1 => 32,
            Self::BaseQ5_1 => 60,
            Self::SmallQ5_1 => 190,
            Self::Small => 488,
            Self::MediumQ5_0 => 539,
            Self::LargeV3TurboQ5_0 => 574,
            Self::LargeV3TurboQ8_0 => 874,
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
            Self::LargeV3TurboQ5_0 => "Large v3 Turbo (Q5_0)",
            Self::LargeV3TurboQ8_0 => "Large v3 Turbo (Q8_0)",
            Self::LargeV3Q5_0 => "Large v3 (Q5_0)",
        }
    }

    /// Whether the encoder window may be shrunk to the clip length.
    ///
    /// The large-v3 family (Turbo included) falls into repetition loops when
    /// its audio context is cut down — measured on a real 10 s French
    /// dictation: audio_ctx=582 produced 220 tokens of "l'aplique,
    /// l'aplique, …" where ~60 were spoken. Those models always get the full
    /// 30 s window; the smaller ones tolerate the shrink and keep the speedup.
    pub fn allows_audio_ctx_shrink(&self) -> bool {
        !matches!(
            self,
            Self::LargeV3TurboQ5_0 | Self::LargeV3TurboQ8_0 | Self::LargeV3Q5_0
        )
    }

    pub fn is_downloaded(&self) -> bool {
        model_path(*self).map_or(false, |p| p.exists())
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

/// The model to load at startup: the user's last pick if it's still on
/// disk, otherwise the best model that is. Existing installs that only
/// have the old `small-q5_1` default keep working without a re-download.
pub fn resolve_startup_model(preferred: Option<Model>) -> Option<Model> {
    preferred
        .filter(Model::is_downloaded)
        .or_else(|| Model::PREFERENCE.into_iter().find(Model::is_downloaded))
}
