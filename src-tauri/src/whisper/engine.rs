use std::path::Path;
use std::time::Instant;

use anyhow::{anyhow, Result};
use parking_lot::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use super::Model;

/// Wraps a loaded `WhisperContext` (and its state) so we can transcribe
/// without paying the model-load cost on every dictation. Holding the
/// context across calls means typical latency = inference only (~1-3s for
/// `small-q5_0` on a modern CPU).
pub struct WhisperEngine {
    ctx: WhisperContext,
    model: Model,
    language: Mutex<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)] // language + duration surfaced to UI in Phase 6
pub struct TranscriptionResult {
    pub text: String,
    pub language: String,
    pub duration_ms: u64,
}

impl WhisperEngine {
    pub fn load(model_path: &Path, model: Model, language: &str) -> Result<Self> {
        let path = model_path
            .to_str()
            .ok_or_else(|| anyhow!("non-UTF8 model path"))?;

        let started = Instant::now();
        let params = WhisperContextParameters::default();
        let ctx = WhisperContext::new_with_params(path, params)
            .map_err(|e| anyhow!("WhisperContext::new failed: {e}"))?;
        tracing::info!(
            "Whisper model loaded ({}) in {:.2}s",
            model.display_name(),
            started.elapsed().as_secs_f32()
        );

        Ok(Self {
            ctx,
            model,
            language: Mutex::new(language.to_string()),
        })
    }

    #[allow(dead_code)] // wired to settings UI in Phase 6
    pub fn set_language(&self, lang: &str) {
        *self.language.lock() = lang.to_string();
    }

    pub fn model(&self) -> Model {
        self.model
    }

    /// Transcribe a buffer of 16 kHz mono f32 samples.
    pub fn transcribe(&self, samples_16k_mono: &[f32]) -> Result<TranscriptionResult> {
        let started = Instant::now();

        let mut state = self
            .ctx
            .create_state()
            .map_err(|e| anyhow!("create_state failed: {e}"))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        // Physical cores: SIMD/mat-mul workloads in whisper.cpp don't benefit
        // from SMT (hyperthreads) and often regress when both siblings of a
        // core contend on the same FP units.
        params.set_n_threads(num_cpus::get_physical().max(1) as i32);
        params.set_translate(false);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_no_context(true);
        // Allow multi-segment output so dictations longer than ~30s aren't
        // truncated; the perf cost on short clips is negligible.
        params.set_single_segment(false);
        params.set_suppress_blank(true);
        // Disable temperature fallback (greedy already + skip retry-on-uncertainty).
        params.set_temperature(0.0);
        params.set_temperature_inc(0.0);
        params.set_token_timestamps(false);

        let lang_string;
        let lang = {
            let l = self.language.lock();
            if l.as_str() == "auto" {
                None
            } else {
                lang_string = l.clone();
                Some(lang_string.as_str())
            }
        };
        params.set_language(lang);

        state
            .full(params, samples_16k_mono)
            .map_err(|e| anyhow!("whisper full() failed: {e}"))?;

        let n = state.full_n_segments();
        let mut text = String::new();
        for i in 0..n {
            if let Some(segment) = state.get_segment(i) {
                match segment.to_str() {
                    Ok(s) => text.push_str(s),
                    Err(e) => tracing::warn!("segment {} decode error: {}", i, e),
                }
            }
        }

        let text = text.trim().to_string();
        let elapsed = started.elapsed();

        tracing::info!(
            "Transcribed {} samples in {:.2}s → '{}'",
            samples_16k_mono.len(),
            elapsed.as_secs_f32(),
            truncate(&text, 60)
        );

        Ok(TranscriptionResult {
            text,
            language: self.language.lock().clone(),
            duration_ms: elapsed.as_millis() as u64,
        })
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max).collect::<String>() + "…"
    }
}
