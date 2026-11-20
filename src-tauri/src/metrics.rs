//! Per-dictation diagnostics, kept locally in
//! `%APPDATA%\Hyperwisper\metrics.jsonl` — one JSON object per line.
//!
//! Every dictation that reaches the stop step writes a record, whatever its
//! outcome (pasted, too short, no voice, error…), so a run of failures is as
//! visible as a run of successes. Nothing here ever leaves the machine; the
//! Diagnostics panel reads the file and can copy it to the clipboard when
//! the user decides to share it.

use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use serde::{Deserialize, Serialize};

/// Rewrite the file down to `KEEP_LINES` once it grows past `MAX_LINES`.
/// Bounded so a year of daily use can't turn into a multi-MB read.
const MAX_LINES: usize = 2_000;
const KEEP_LINES: usize = 1_000;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DictationMetrics {
    /// Unix milliseconds at the stop request.
    pub timestamp: u64,
    /// `pasted` | `clipboard` | `tooShort` | `noVoice` | `empty` | `error`.
    pub outcome: String,
    pub error: Option<String>,

    // ── Input device ────────────────────────────────────────────────────
    pub device: String,
    pub sample_rate: u32,
    pub channels: u16,
    pub sample_format: String,
    pub channel_rms: Vec<f32>,
    pub channel_peak: Vec<f32>,
    /// Worst per-channel fraction of clipped samples, in percent.
    pub clipped_pct: f32,
    pub used_channels: Vec<usize>,
    /// Start request → first audio callback. Speech before it is lost.
    pub stream_start_ms: Option<f64>,
    /// Gain applied by level normalization before Whisper.
    pub gain_db: f32,

    // ── Voice activity ──────────────────────────────────────────────────
    pub recorded_ms: u64,
    pub speech_ms: u32,
    /// Length actually sent to Whisper after silence trimming.
    pub trimmed_ms: u64,
    pub noise_floor: f32,
    pub vad_threshold: f32,

    // ── Timings (ms) ────────────────────────────────────────────────────
    /// Stop request → capture buffer ready (stream teardown).
    pub stop_ms: f64,
    pub vad_ms: f64,
    pub resample_ms: f64,
    pub inference_ms: f64,
    /// Wait for the Whisper state before inference could start — non-zero
    /// when the dictation queued behind the warm-up or a model swap.
    pub lock_wait_ms: f64,
    pub paste_ms: f64,
    /// Stop request → text pasted: the latency the user feels.
    pub total_ms: f64,
    /// whisper.cpp time / audio time sent. Below 1 = faster than real time.
    pub rtf: f64,

    // ── Model ───────────────────────────────────────────────────────────
    pub model: String,
    pub language: String,
    /// Language Whisper settled on (differs from `language` only on auto).
    pub detected_language: Option<String>,
    pub audio_ctx: i32,
    pub n_tokens: u32,
    /// Highest no-speech probability across segments. High values on a
    /// pasted result are the signature of a hallucination.
    pub no_speech_prob: f32,
    /// Words removed by the repetition-loop safety net (0 = clean decode).
    pub repeated_words: u32,
    /// Filler words ("du coup", "euh"…) stripped before pasting.
    pub fillers_removed: u32,
    pub chars: u32,
    pub words: u32,
}

impl DictationMetrics {
    pub fn now() -> Self {
        Self {
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            ..Default::default()
        }
    }
}

fn metrics_path() -> Option<PathBuf> {
    Some(dirs::data_dir()?.join("Hyperwisper").join("metrics.jsonl"))
}

pub fn append(m: &DictationMetrics) -> Result<()> {
    let path = metrics_path().ok_or_else(|| anyhow::anyhow!("could not resolve data dir"))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)?;
    file.write_all((serde_json::to_string(m)? + "\n").as_bytes())?;
    drop(file);

    // Cheap size proxy before paying for a line count: records are ~600 B.
    if std::fs::metadata(&path).map(|md| md.len()).unwrap_or(0) > (MAX_LINES as u64) * 600 {
        let content = std::fs::read_to_string(&path)?;
        let lines: Vec<&str> = content.lines().collect();
        if lines.len() > MAX_LINES {
            let kept = lines[lines.len() - KEEP_LINES..].join("\n") + "\n";
            std::fs::write(&path, kept)?;
        }
    }
    Ok(())
}

/// The most recent `limit` records, newest first.
pub fn read_recent(limit: usize) -> Vec<DictationMetrics> {
    let Some(path) = metrics_path() else { return vec![] };
    let Ok(content) = std::fs::read_to_string(path) else { return vec![] };
    content
        .lines()
        .rev()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .take(limit)
        .collect()
}

pub fn clear() -> Result<()> {
    if let Some(path) = metrics_path() {
        if path.exists() {
            std::fs::write(path, "")?;
        }
    }
    Ok(())
}
