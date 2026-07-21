use std::path::Path;
use std::time::Instant;

use anyhow::{anyhow, Result};
use parking_lot::Mutex;
use whisper_rs::{
    FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperState,
};

use super::Model;

/// Whisper encodes a padded 30 s window, addressed by 1500 audio-context
/// positions. A 5 s dictation therefore pays the same encoder cost as a 30 s
/// one unless we shrink the context to match the real audio.
const AUDIO_CTX_FULL: i32 = 1500;
/// Floor for the shrunk context. Going lower saves little and starts costing
/// accuracy, so short clips clamp here rather than scaling all the way down.
const AUDIO_CTX_MIN: i32 = 256;
/// Headroom on the scaled context so we never clip the tail of the audio.
const AUDIO_CTX_MARGIN: f32 = 1.2;

const WHISPER_SAMPLE_RATE: f32 = 16_000.0;
/// Length of the dummy clip used to warm the pipeline up at load time.
const WARMUP_SAMPLES: usize = 16_000;

/// Wraps a loaded `WhisperContext` (and its state) so we can transcribe
/// without paying the model-load cost on every dictation. Holding the
/// context across calls means typical latency = inference only (~1-3s for
/// `small-q5_0` on a modern CPU).
pub struct WhisperEngine {
    #[allow(dead_code)] // kept alive for `state`; inference goes through `state`
    ctx: WhisperContext,
    /// Reused across dictations. `create_state()` reallocates the KV and
    /// cross-attention buffers every time it's called — on the GPU that's a
    /// VRAM alloc/free cycle per dictation for no benefit, since
    /// `no_context(true)` means nothing is carried between runs anyway.
    state: Mutex<WhisperState>,
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

        // Flash attention is a straight win on the GPU backends when the
        // device supports it, but support isn't universal. Try it, and fall
        // back to a plain context if creation rejects it rather than leaving
        // the user with no model at all.
        let mut params = WhisperContextParameters::default();
        params.flash_attn(true);
        let (ctx, flash_attn) = match WhisperContext::new_with_params(path, params) {
            Ok(ctx) => (ctx, true),
            Err(e) => {
                tracing::warn!("Context creation with flash_attn failed ({e}); retrying without");
                let ctx = WhisperContext::new_with_params(path, WhisperContextParameters::default())
                    .map_err(|e| anyhow!("WhisperContext::new failed: {e}"))?;
                (ctx, false)
            }
        };

        let state = ctx
            .create_state()
            .map_err(|e| anyhow!("create_state failed: {e}"))?;

        tracing::info!(
            "Whisper model loaded ({}, flash_attn={}) in {:.2}s",
            model.display_name(),
            flash_attn,
            started.elapsed().as_secs_f32()
        );

        Ok(Self {
            ctx,
            state: Mutex::new(state),
            model,
            language: Mutex::new(language.to_string()),
        })
    }

    /// Run one throwaway inference so the first *real* dictation doesn't have
    /// to. `WhisperContext::new` only mmaps the weights — the page-in from
    /// disk, the upload to VRAM, the compilation of every ggml-vulkan compute
    /// pipeline and the allocation of the encoder/decoder graphs all happen
    /// lazily on first use. Measured on this machine that came to ~14.5s,
    /// which is what made the first dictation of a session ~5.7x slower per
    /// second of audio than every subsequent one.
    ///
    /// Call this *after* publishing the engine, never before: it takes long
    /// enough that gating availability on it would just move the wait to a
    /// "model not loaded" error. A dictation that lands mid-warm-up blocks on
    /// the state mutex instead, which is no worse than the old cold start.
    pub fn warm_up(&self) {
        let started = Instant::now();

        // Near-silence rather than exact zeros: a pure-zero buffer is the kind
        // of input a fast path might short-circuit, and a warm-up that gets
        // skipped is worse than useless. Deterministic, so no rng dependency.
        let samples: Vec<f32> = (0..WARMUP_SAMPLES)
            .map(|i| ((i % 97) as f32 - 48.0) * 1e-5)
            .collect();

        // Full audio context on purpose: this is the widest graph a real
        // dictation can ask for, so warming it covers every shorter one.
        match self.run(&samples, AUDIO_CTX_FULL) {
            Ok(_) => tracing::info!("Whisper warm-up completed in {:.2}s", started.elapsed().as_secs_f32()),
            Err(e) => tracing::warn!("Whisper warm-up failed ({e}); first dictation will be slow"),
        }
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

        let audio_ctx = audio_ctx_for(samples_16k_mono.len());
        let text = self.run(samples_16k_mono, audio_ctx)?;
        let elapsed = started.elapsed();

        tracing::info!(
            "Transcribed {} samples in {:.2}s (audio_ctx={}) → '{}'",
            samples_16k_mono.len(),
            elapsed.as_secs_f32(),
            audio_ctx,
            truncate(&text, 60)
        );

        Ok(TranscriptionResult {
            text,
            language: self.language.lock().clone(),
            duration_ms: elapsed.as_millis() as u64,
        })
    }

    /// Single inference against the shared state. Returns the concatenated
    /// segment text.
    fn run(&self, samples_16k_mono: &[f32], audio_ctx: i32) -> Result<String> {
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
        params.set_audio_ctx(audio_ctx);

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

        let mut state = self.state.lock();
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

        Ok(text.trim().to_string())
    }
}

/// Scale the audio context to the actual clip length so short dictations
/// don't pay for a full 30 s encoder window. Clips longer than 30 s clamp
/// back to the full context — whisper splits those into 30 s chunks
/// internally, and every one of those chunks needs the whole window.
fn audio_ctx_for(n_samples: usize) -> i32 {
    let seconds = n_samples as f32 / WHISPER_SAMPLE_RATE;
    let scaled = (seconds / 30.0 * AUDIO_CTX_FULL as f32 * AUDIO_CTX_MARGIN).ceil();
    (scaled as i32).clamp(AUDIO_CTX_MIN, AUDIO_CTX_FULL)
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars().take(max).collect::<String>() + "…"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn samples_for(seconds: f32) -> usize {
        (seconds * WHISPER_SAMPLE_RATE) as usize
    }

    #[test]
    fn short_clips_scale_down_but_respect_the_floor() {
        // 5 s → 5/30 * 1500 * 1.2 = 300, comfortably above the floor.
        assert_eq!(audio_ctx_for(samples_for(5.0)), 300);
        // 0.5 s would scale to 30; the floor takes over.
        assert_eq!(audio_ctx_for(samples_for(0.5)), AUDIO_CTX_MIN);
    }

    #[test]
    fn clips_at_or_over_the_window_use_the_full_context() {
        assert_eq!(audio_ctx_for(samples_for(30.0)), AUDIO_CTX_FULL);
        // Multi-chunk audio must keep the full window: whisper slices it into
        // 30 s pieces internally and each one needs all 1500 positions.
        assert_eq!(audio_ctx_for(samples_for(90.0)), AUDIO_CTX_FULL);
    }

    #[test]
    fn margin_keeps_the_context_above_the_bare_ratio() {
        // A 20 s clip needs 1000 positions bare; the margin must leave slack.
        assert!(audio_ctx_for(samples_for(20.0)) > 1000);
    }

    #[test]
    fn empty_input_does_not_underflow() {
        assert_eq!(audio_ctx_for(0), AUDIO_CTX_MIN);
    }

    /// Measures the thing this whole change is about: after `load()` has run
    /// its warm-up, the first real dictation should cost roughly the same as
    /// the second. Before the warm-up existed, the first was ~5.7x slower per
    /// second of audio.
    ///
    /// Needs the real model on disk, so it's `#[ignore]`d by default. Run with:
    ///   cargo test --release -- --ignored --nocapture warm_up_flattens
    #[test]
    #[ignore = "requires the downloaded model; run manually"]
    fn warm_up_flattens_first_run_latency() {
        let path = crate::whisper::models::model_path(Model::SmallQ5_1).unwrap();
        if !path.exists() {
            panic!("model not found at {} — download it first", path.display());
        }

        let t_load = Instant::now();
        let engine = WhisperEngine::load(&path, Model::SmallQ5_1, "fr").unwrap();
        let load_ms = t_load.elapsed().as_millis();

        // Mirrors what the app does: publish, then warm up off-thread.
        let t_warm = Instant::now();
        engine.warm_up();
        let warm_ms = t_warm.elapsed().as_millis();

        let clip: Vec<f32> = (0..samples_for(10.0))
            .map(|i| ((i % 97) as f32 - 48.0) * 1e-4)
            .collect();

        let t1 = Instant::now();
        engine.transcribe(&clip).unwrap();
        let first_ms = t1.elapsed().as_millis();

        let t2 = Instant::now();
        engine.transcribe(&clip).unwrap();
        let second_ms = t2.elapsed().as_millis();

        println!(
            "load={load_ms}ms  warmup={warm_ms}ms  \
             first_transcribe={first_ms}ms  second_transcribe={second_ms}ms"
        );

        // The point of the warm-up: no cold-start cliff left on the first
        // real call. Generous bound — we're catching a 5x regression, not
        // policing normal jitter.
        assert!(
            first_ms < second_ms * 2 + 500,
            "first call ({first_ms}ms) still far slower than second ({second_ms}ms) — \
             warm-up is not covering the cold start"
        );
    }
}
