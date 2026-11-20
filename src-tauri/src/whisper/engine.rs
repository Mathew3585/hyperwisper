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
/// context across calls means typical latency = inference only.
pub struct WhisperEngine {
    #[allow(dead_code)] // kept alive for `state`; inference goes through `state`
    ctx: WhisperContext,
    /// Reused across dictations. `create_state()` reallocates the KV and
    /// cross-attention buffers every time it's called — on the GPU that's a
    /// VRAM alloc/free cycle per dictation for no benefit, since
    /// `no_context(true)` means nothing is carried between runs anyway.
    state: Mutex<WhisperState>,
    model: Model,
    flash_attn: bool,
    /// GPU the context was created on (`None` = CPU only).
    device: Option<String>,
}

/// The GPU whisper.cpp should run on.
struct GpuChoice {
    /// Value for `WhisperContextParameters::gpu_device`: whisper.cpp counts
    /// discrete *and* integrated GPUs, in ggml registration order.
    whisper_index: i32,
    name: String,
}

/// Pick the discrete GPU when there is one.
///
/// ggml-vulkan registers every discrete and integrated GPU in the order the
/// Vulkan loader returns them, and whisper.cpp then takes the first one
/// (`gpu_device = 0`). On a laptop the iGPU drives the display and usually
/// comes first — so without this, an RTX laptop runs Large v3 Turbo on its
/// integrated graphics, 50–100x slower. Desktops with a single GPU are
/// unaffected.
fn pick_gpu_device() -> Option<GpuChoice> {
    use std::ffi::CStr;
    use whisper_rs::whisper_rs_sys as sys;

    let mut candidates: Vec<(i32, String, bool, usize)> = Vec::new();
    // SAFETY: plain queries on ggml's static device registry; the returned
    // name pointers are owned by ggml and live for the whole process.
    unsafe {
        let mut whisper_index = 0i32;
        for i in 0..sys::ggml_backend_dev_count() {
            let dev = sys::ggml_backend_dev_get(i);
            let kind = sys::ggml_backend_dev_type(dev);
            let desc = sys::ggml_backend_dev_description(dev);
            let name = if desc.is_null() {
                CStr::from_ptr(sys::ggml_backend_dev_name(dev)).to_string_lossy().into_owned()
            } else {
                CStr::from_ptr(desc).to_string_lossy().into_owned()
            };
            let (mut free, mut total) = (0usize, 0usize);
            sys::ggml_backend_dev_memory(dev, &mut free, &mut total);
            tracing::info!(
                "ggml device {i}: {name} (type={kind}, {:.1} GB)",
                total as f64 / 1_073_741_824.0
            );

            let discrete = kind == sys::ggml_backend_dev_type_GGML_BACKEND_DEVICE_TYPE_GPU;
            let integrated = kind == sys::ggml_backend_dev_type_GGML_BACKEND_DEVICE_TYPE_IGPU;
            if discrete || integrated {
                candidates.push((whisper_index, name, discrete, total));
                whisper_index += 1;
            }
        }
    }

    // Discrete first, then the one with the most memory.
    let best = candidates
        .into_iter()
        .max_by_key(|(idx, _, discrete, total)| (*discrete, *total, -*idx))?;
    tracing::info!(
        "Whisper GPU: {} ({}, whisper gpu_device={})",
        best.1,
        if best.2 { "discrete" } else { "integrated" },
        best.0
    );
    Some(GpuChoice { whisper_index: best.0, name: best.1 })
}

#[derive(Debug, Clone, Default)]
pub struct TranscriptionResult {
    pub text: String,
    pub audio_ctx: i32,
    pub n_tokens: u32,
    /// Highest per-segment no-speech probability.
    pub no_speech_prob: f32,
    /// Language code Whisper used (detected when the setting is "auto").
    pub detected_language: Option<String>,
    /// Time spent waiting for the shared state — non-zero when a dictation
    /// queued behind the warm-up or a previous transcription.
    pub lock_wait_ms: f64,
    /// Time inside whisper.cpp's `full()` (encoder + decoder).
    pub full_ms: f64,
    /// Words dropped by `collapse_repetitions`. Non-zero = the decoder
    /// looped and the safety net caught it.
    pub repeated_words: u32,
}

/// What one `full()` pass produced, before trailing-filler cleanup.
struct RunOutput {
    text: String,
    n_tokens: u32,
    no_speech_prob: f32,
    detected_language: Option<String>,
    lock_wait_ms: f64,
    full_ms: f64,
}

impl WhisperEngine {
    pub fn load(model_path: &Path, model: Model) -> Result<Self> {
        let path = model_path
            .to_str()
            .ok_or_else(|| anyhow!("non-UTF8 model path"))?;

        let started = Instant::now();

        // Flash attention is a straight win on the GPU backends when the
        // device supports it, but support isn't universal. Try it, and fall
        // back to a plain context if creation rejects it rather than leaving
        // the user with no model at all.
        let gpu = pick_gpu_device();
        let base_params = || {
            let mut p = WhisperContextParameters::default();
            if let Some(gpu) = &gpu {
                p.gpu_device(gpu.whisper_index);
            }
            p
        };

        let mut params = base_params();
        params.flash_attn(true);
        let (ctx, flash_attn) = match WhisperContext::new_with_params(path, params) {
            Ok(ctx) => (ctx, true),
            Err(e) => {
                tracing::warn!("Context creation with flash_attn failed ({e}); retrying without");
                let ctx = WhisperContext::new_with_params(path, base_params())
                    .map_err(|e| anyhow!("WhisperContext::new failed: {e}"))?;
                (ctx, false)
            }
        };

        let state = ctx
            .create_state()
            .map_err(|e| anyhow!("create_state failed: {e}"))?;

        let device = gpu.map(|g| g.name);
        tracing::info!(
            "Whisper model loaded ({}, flash_attn={}, device={}) in {:.2}s",
            model.display_name(),
            flash_attn,
            device.as_deref().unwrap_or("CPU"),
            started.elapsed().as_secs_f32()
        );

        Ok(Self {
            ctx,
            state: Mutex::new(state),
            model,
            flash_attn,
            device,
        })
    }

    /// Name of the GPU inference runs on, `None` when it runs on the CPU.
    pub fn device(&self) -> Option<&str> {
        self.device.as_deref()
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
        match self.run(&samples, AUDIO_CTX_FULL, "en") {
            Ok(_) => tracing::info!("Whisper warm-up completed in {:.2}s", started.elapsed().as_secs_f32()),
            Err(e) => tracing::warn!("Whisper warm-up failed ({e}); first dictation will be slow"),
        }
    }

    pub fn model(&self) -> Model {
        self.model
    }

    pub fn flash_attn(&self) -> bool {
        self.flash_attn
    }

    /// Transcribe a buffer of 16 kHz mono f32 samples. `language` is a
    /// Whisper language code (`"fr"`, `"en"`…) or `"auto"` to detect it.
    pub fn transcribe(&self, samples_16k_mono: &[f32], language: &str) -> Result<TranscriptionResult> {
        let started = Instant::now();

        let audio_ctx = if self.model.allows_audio_ctx_shrink() {
            audio_ctx_for(samples_16k_mono.len())
        } else {
            AUDIO_CTX_FULL
        };
        let out = self.run(samples_16k_mono, audio_ctx, language)?;

        // Safety net for decoder loops that slip past the temperature
        // fallback: collapse runs of the same phrase down to one.
        let (deduped, repeated_words) = collapse_repetitions(&out.text);
        if repeated_words > 0 {
            tracing::warn!(
                "Collapsed a repetition loop ({} words removed, {} tokens decoded)",
                repeated_words,
                out.n_tokens
            );
        }

        let text = strip_trailing_artifacts(&deduped);
        if text != deduped {
            tracing::info!("Stripped trailing artifact: {:?} → {:?}", deduped, text);
        }
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
            audio_ctx,
            n_tokens: out.n_tokens,
            no_speech_prob: out.no_speech_prob,
            detected_language: out.detected_language,
            lock_wait_ms: out.lock_wait_ms,
            full_ms: out.full_ms,
            repeated_words,
        })
    }

    /// Single inference against the shared state.
    fn run(&self, samples_16k_mono: &[f32], audio_ctx: i32, language: &str) -> Result<RunOutput> {
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        // Physical cores: SIMD/mat-mul workloads in whisper.cpp don't benefit
        // from SMT (hyperthreads) and often regress when both siblings of a
        // core contend on the same FP units. Capped at 8: past that the
        // ggml thread barrier costs more than the extra cores bring, and
        // with a GPU backend the CPU side is mostly orchestration anyway.
        params.set_n_threads(num_cpus::get_physical().clamp(1, 8) as i32);
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
        // Suppress non-speech tokens: the bracketed sound annotations
        // ("[Musique]", "(rires)") and standalone punctuation that Whisper
        // learned from subtitle tracks and likes to emit over quiet audio.
        params.set_suppress_nst(true);
        // Greedy at T=0 first. When a segment comes out degenerate — the
        // decoder's token entropy collapses (a loop) or its average
        // log-prob is poor — whisper.cpp re-decodes it at T+0.2, up to 1.0.
        // This used to be disabled for speed, which left loops like
        // "l'aplique, l'aplique, …" with no way out. It costs nothing on a
        // clean decode; only failing segments pay for a retry.
        params.set_temperature(0.0);
        params.set_temperature_inc(0.2);
        params.set_entropy_thold(2.4);
        params.set_logprob_thold(-1.0);
        params.set_token_timestamps(false);
        // Timestamp tokens stay on (no `set_no_timestamps`): they're how the
        // decoder segments and seeks, and turning them off made loops more
        // likely for a negligible saving.
        params.set_audio_ctx(audio_ctx);

        params.set_language(match language {
            "" | "auto" => None,
            code => Some(code),
        });

        let t_lock = Instant::now();
        let mut state = self.state.lock();
        let lock_wait_ms = t_lock.elapsed().as_secs_f64() * 1000.0;

        let t_full = Instant::now();
        state
            .full(params, samples_16k_mono)
            .map_err(|e| anyhow!("whisper full() failed: {e}"))?;
        let full_ms = t_full.elapsed().as_secs_f64() * 1000.0;

        let n = state.full_n_segments();
        let mut text = String::new();
        let mut n_tokens = 0u32;
        let mut no_speech_prob = 0f32;
        for i in 0..n {
            if let Some(segment) = state.get_segment(i) {
                n_tokens += segment.n_tokens().max(0) as u32;
                no_speech_prob = no_speech_prob.max(segment.no_speech_probability());
                match segment.to_str() {
                    Ok(s) => text.push_str(s),
                    Err(e) => tracing::warn!("segment {} decode error: {}", i, e),
                }
            }
        }
        let detected_language =
            whisper_rs::get_lang_str(state.full_lang_id_from_state()).map(str::to_string);

        Ok(RunOutput {
            text: text.trim().to_string(),
            n_tokens,
            no_speech_prob,
            detected_language,
            lock_wait_ms,
            full_ms,
        })
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

/// A phrase repeated this many times in a row is a decoder loop, not speech.
/// Four keeps natural emphasis ("non non non", "très très très") intact.
const LOOP_MIN_REPEATS: usize = 4;
/// Longest repeated unit we look for, in words.
const LOOP_MAX_UNIT: usize = 8;

/// Collapse decoder loops: any run of the same 1–8 word phrase repeated
/// `LOOP_MIN_REPEATS`+ times in a row is kept once. A truncated copy of the
/// phrase at the very end ("…, l'aplique, l'a") is dropped with it.
/// Returns the cleaned text and how many words were removed.
fn collapse_repetitions(text: &str) -> (String, u32) {
    let words: Vec<&str> = text.split_whitespace().collect();
    // Compare loosely: case and trailing punctuation differ between copies.
    let norm: Vec<String> = words
        .iter()
        .map(|w| {
            w.trim_matches(|c: char| c.is_ascii_punctuation() || c == '…')
                .to_lowercase()
        })
        .collect();

    let mut out: Vec<&str> = Vec::with_capacity(words.len());
    let mut removed = 0u32;
    let mut i = 0;
    'scan: while i < words.len() {
        for n in 1..=LOOP_MAX_UNIT {
            if i + n * LOOP_MIN_REPEATS > words.len() {
                break;
            }
            let unit = &norm[i..i + n];
            let mut reps = 1;
            while i + (reps + 1) * n <= words.len() && norm[i + reps * n..i + (reps + 1) * n] == *unit {
                reps += 1;
            }
            if reps >= LOOP_MIN_REPEATS {
                out.extend_from_slice(&words[i..i + n]);
                let mut next = i + reps * n;
                removed += ((reps - 1) * n) as u32;

                // A cut-off copy of the unit trailing at the very end.
                let tail = &norm[next..];
                if !tail.is_empty()
                    && tail.len() <= n
                    && tail
                        .iter()
                        .zip(unit)
                        .all(|(t, u)| u.starts_with(t.as_str()))
                {
                    removed += tail.len() as u32;
                    next = words.len();
                }
                i = next;
                continue 'scan;
            }
        }
        out.push(words[i]);
        i += 1;
    }

    if removed == 0 {
        return (text.to_string(), 0);
    }
    // The kept copy usually ends in the loop's separator (a comma).
    let joined = out.join(" ");
    let cleaned = joined.trim_end_matches([',', ';', ' ']).to_string();
    (cleaned, removed)
}

/// Subtitle-corpus filler Whisper emits over silence. Matched case-insensitively
/// against the very end of the transcript, never anywhere else.
///
/// Deliberately narrow. A bare "Merci beaucoup" is *not* in this list even
/// though it shows up as a hallucination, because people genuinely end
/// dictations that way — deleting a sentence the user actually spoke is a
/// worse failure than leaving a stray one. Trimming the trailing silence
/// before inference is what's meant to stop those; this list only catches
/// the outros that carry no plausible dictated meaning.
const TRAILING_ARTIFACTS: &[&str] = &[
    "sous-titres réalisés par la communauté d'amara.org",
    "sous-titres réalisés par l'amara.org",
    "sous-titrage société radio-canada",
    "sous-titrage st' 501",
    "merci d'avoir regardé cette vidéo",
    "merci d'avoir regardé cette vidéo !",
    "n'hésitez pas à vous abonner",
    "abonnez-vous !",
    "thanks for watching!",
    "thank you for watching!",
];

/// Strip trailing filler from a transcript: the ellipsis Whisper tacks on
/// when a sentence trails into silence, and the subtitle outros above.
/// Repeats until stable, since the two often arrive stacked ("… - Merci").
fn strip_trailing_artifacts(text: &str) -> String {
    let mut s = text.trim_end();

    loop {
        let before = s.len();

        // A run of 2+ dots, or a real ellipsis character. A single '.' is
        // ordinary punctuation and stays.
        if s.ends_with('…') {
            s = s[..s.len() - '…'.len_utf8()].trim_end();
        } else if s.ends_with("..") {
            s = s.trim_end_matches('.').trim_end();
        }

        // Separator left dangling by an artifact we removed on a prior pass.
        s = s.trim_end_matches(['-', '–', ',', ';']).trim_end();

        for artifact in TRAILING_ARTIFACTS {
            if let Some(cut) = s.len().checked_sub(artifact.len()) {
                if s.is_char_boundary(cut) && s[cut..].to_lowercase() == *artifact {
                    s = s[..cut].trim_end();
                    break;
                }
            }
        }

        if s.len() == before {
            break;
        }
    }

    s.to_string()
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

    /// Verbatim (shortened) from the first Large v3 Turbo dictation on the
    /// user's Scarlett — the loop that motivated `collapse_repetitions`.
    #[test]
    fn collapses_the_loop_seen_in_the_wild() {
        let looped = format!(
            "Ok, alors, du coup, je te faire, message, {}l'a",
            "l'aplique, ".repeat(40)
        );
        let (out, removed) = collapse_repetitions(&looped);
        assert_eq!(out, "Ok, alors, du coup, je te faire, message, l'aplique");
        assert_eq!(removed, 40);
    }

    #[test]
    fn collapses_multi_word_loops() {
        let looped = format!("Bonjour. {}", "Merci d'avoir regardé. ".repeat(6));
        let (out, removed) = collapse_repetitions(looped.trim());
        assert_eq!(out, "Bonjour. Merci d'avoir regardé.");
        assert_eq!(removed, 15);
    }

    /// Emphasis a person actually says must survive.
    #[test]
    fn keeps_natural_repetition() {
        for s in [
            "non non non, pas comme ça",
            "c'est très très très bien",
            "on teste, on teste, on teste encore",
        ] {
            assert_eq!(collapse_repetitions(s), (s.to_string(), 0), "{s}");
        }
    }

    #[test]
    fn repetition_check_handles_degenerate_text() {
        assert_eq!(collapse_repetitions(""), (String::new(), 0));
        assert_eq!(collapse_repetitions("a"), ("a".to_string(), 0));
    }

    #[test]
    fn large_models_keep_the_full_window() {
        assert!(!Model::LargeV3TurboQ5_0.allows_audio_ctx_shrink());
        assert!(!Model::LargeV3Q5_0.allows_audio_ctx_shrink());
        assert!(Model::SmallQ5_1.allows_audio_ctx_shrink());
    }

    /// Verbatim from the user's history.jsonl.
    #[test]
    fn strips_the_trailing_ellipsis_seen_in_the_wild() {
        assert_eq!(
            strip_trailing_artifacts(
                "je te laisse sur les changements et on teste tout ça directement après. ..."
            ),
            "je te laisse sur les changements et on teste tout ça directement après."
        );
        assert_eq!(strip_trailing_artifacts("on est goo..."), "on est goo");
    }

    #[test]
    fn keeps_ordinary_sentence_punctuation() {
        assert_eq!(
            strip_trailing_artifacts("Donc au final on passe bien sur le network object."),
            "Donc au final on passe bien sur le network object."
        );
        assert_eq!(
            strip_trailing_artifacts("Comment ça va ?"),
            "Comment ça va ?"
        );
    }

    /// An ellipsis mid-sentence is the speaker's own pause and must survive —
    /// only the trailing one is filler.
    #[test]
    fn leaves_internal_ellipsis_alone() {
        assert_eq!(
            strip_trailing_artifacts("alors... je réfléchis encore"),
            "alors... je réfléchis encore"
        );
    }

    #[test]
    fn strips_subtitle_outros_case_insensitively() {
        assert_eq!(
            strip_trailing_artifacts(
                "voilà pour aujourd'hui. Sous-titres réalisés par la communauté d'Amara.org"
            ),
            "voilà pour aujourd'hui."
        );
    }

    /// Stacked filler: ellipsis, dangling dash, then an outro.
    #[test]
    fn strips_stacked_filler_in_one_pass() {
        assert_eq!(
            strip_trailing_artifacts("le vrai texte - Thanks for watching! ..."),
            "le vrai texte"
        );
    }

    /// The judgement call in `TRAILING_ARTIFACTS`: "merci beaucoup" is left
    /// alone because it's something a person actually says.
    #[test]
    fn does_not_delete_words_the_user_may_have_spoken() {
        assert_eq!(
            strip_trailing_artifacts("c'est bon pour moi, merci beaucoup"),
            "c'est bon pour moi, merci beaucoup"
        );
    }

    #[test]
    fn handles_degenerate_text() {
        assert_eq!(strip_trailing_artifacts(""), "");
        assert_eq!(strip_trailing_artifacts("..."), "");
        assert_eq!(strip_trailing_artifacts("   "), "");
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
        let path = crate::whisper::models::model_path(Model::default()).unwrap();
        if !path.exists() {
            panic!("model not found at {} — download it first", path.display());
        }

        let t_load = Instant::now();
        let engine = WhisperEngine::load(&path, Model::default()).unwrap();
        let load_ms = t_load.elapsed().as_millis();

        // Mirrors what the app does: publish, then warm up off-thread.
        let t_warm = Instant::now();
        engine.warm_up();
        let warm_ms = t_warm.elapsed().as_millis();

        let clip: Vec<f32> = (0..samples_for(10.0))
            .map(|i| ((i % 97) as f32 - 48.0) * 1e-4)
            .collect();

        let t1 = Instant::now();
        engine.transcribe(&clip, "fr").unwrap();
        let first_ms = t1.elapsed().as_millis();

        let t2 = Instant::now();
        engine.transcribe(&clip, "fr").unwrap();
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
