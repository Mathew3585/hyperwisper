use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::audio::resample_mono;
use crate::history::{self, HistoryEntry};
use crate::paste::PasteOutcome;
use crate::state::AppState;

const WHISPER_SAMPLE_RATE: u32 = 16_000;
/// Skip transcription if the recording is shorter than this — avoids whisper
/// hallucinating placeholder sentences on accidental key presses.
const MIN_DURATION_MS: u64 = 250;

/// Per-frame voice-activity detection. We slice the recording into short
/// frames, count how many are loud enough to be speech, and require a
/// minimum total of speech time. This is what lets a user say "phrase A
/// [long pause] phrase B" without the pause dragging the whole-buffer
/// average below the threshold and triggering a false "no voice" — only
/// the loud frames count toward the budget.
const VAD_FRAME_MS: u32 = 20;
/// How far above the recording's own noise floor a frame must sit to count
/// as speech.
///
/// This used to be an absolute RMS threshold (0.025), which tied the gate to
/// the output level of whatever interface was selected. A Focusrite line
/// input and a hot USB mic differ by more than an order of magnitude, so the
/// quiet one had *every* frame rejected — `0 ms of speech` on 20 s of
/// perfectly good audio, silently discarded. Measuring against the noise
/// floor makes the gate care about the shape of the signal instead of its
/// absolute level, which is the thing that actually distinguishes speech.
const VAD_NOISE_MULTIPLIER: f32 = 3.0;
/// Fraction of frames (quietest first) taken to represent the noise floor.
const VAD_NOISE_PERCENTILE: f32 = 0.10;
/// Hard floor, far below any real microphone's speech level. Its only job is
/// to stop a digitally-silent recording — where the noise floor is ~0, so
/// any multiple of it is also ~0 — from counting dither as speech.
const VAD_ABS_MIN_RMS: f32 = 0.002;
/// Minimum total speech budget across the recording. One spoken syllable is
/// roughly 200 ms, so 150 ms is permissive — short transients like a door
/// slam or mouse click (5–40 ms) can't accumulate that much.
const VAD_MIN_SPEECH_MS: u32 = 150;

pub async fn toggle(app: &AppHandle) {
    let state = app.state::<AppState>();
    if state.recorder.is_recording() {
        stop_and_transcribe(app).await;
    } else if let Err(e) = start(app).await {
        tracing::error!("Start error: {}", e);
        let _ = app.emit("recording:state", "idle");
        let _ = app.emit("recording:error", e.to_string());
    }
}

/// Discard the in-flight recording without transcribing. Triggered by the
/// overlay's X button or the Esc key.
pub async fn cancel(app: &AppHandle) {
    crate::hotkey::unregister_cancel_key(app);

    let app_for_blocking = app.clone();
    let _ = tauri::async_runtime::spawn_blocking(move || {
        app_for_blocking.state::<AppState>().recorder.cancel();
    })
    .await;

    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }
    let _ = app.emit("recording:state", "idle");
    tracing::info!("Recording cancelled");
}

pub async fn start(app: &AppHandle) -> anyhow::Result<()> {
    let state = app.state::<AppState>();
    let mic = state.settings.get().microphone_name;
    state.recorder.start_with_device(app.clone(), mic)?;

    if let Some(overlay) = app.get_webview_window("overlay") {
        position_overlay(&overlay, &state);
        let _ = overlay.show();
        // Windows drops the TOPMOST extended style on some show transitions.
        // Re-assert it AFTER `.show()` so the pill actually floats above
        // fullscreen apps / browsers / Discord. The toggle off→on dance
        // forces a SetWindowPos with HWND_TOPMOST in every case.
        let _ = overlay.set_always_on_top(false);
        let _ = overlay.set_always_on_top(true);
    }

    // Esc cancels the in-flight dictation. Registered only while recording so
    // we don't intercept Esc in every other Windows context.
    if let Err(e) = crate::hotkey::register_cancel_key(app) {
        tracing::warn!("Failed to register Esc cancel key: {}", e);
    }

    let _ = app.emit("recording:state", "recording");
    tracing::info!("Recording started");
    Ok(())
}

/// Position the overlay window: prefer the user's saved drag position, fall
/// back to top-center on the monitor currently under the cursor.
fn position_overlay(overlay: &tauri::WebviewWindow, state: &AppState) {
    use tauri::PhysicalPosition;

    if let Some((x, y)) = *state.overlay_position.lock() {
        let _ = overlay.set_position(PhysicalPosition::new(x, y));
        return;
    }

    let monitor = overlay
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| overlay.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        return;
    };

    let monitor_size = monitor.size();
    let monitor_pos = monitor.position();
    let win_size = overlay.outer_size().unwrap_or_default();
    let top_margin_px: i32 = 24;

    let x = monitor_pos.x + ((monitor_size.width as i32 - win_size.width as i32) / 2);
    let y = monitor_pos.y + top_margin_px;
    let _ = overlay.set_position(PhysicalPosition::new(x, y));
}

pub async fn stop_and_transcribe(app: &AppHandle) {
    crate::hotkey::unregister_cancel_key(app);
    let _ = app.emit("recording:state", "transcribing");

    // Joining the audio thread is blocking, so run the stop on the blocking
    // pool to avoid stalling tokio for ~tens of milliseconds.
    let app_for_stop = app.clone();
    let stop_result = tauri::async_runtime::spawn_blocking(move || {
        let state = app_for_stop.state::<AppState>();
        let sample_rate = state.recorder.sample_rate();
        let samples = state.recorder.stop()?;
        Ok::<_, anyhow::Error>((samples, sample_rate))
    })
    .await
    .unwrap_or_else(|e| Err(anyhow::anyhow!("join: {e}")));

    let (samples, sample_rate) = match stop_result {
        Ok(v) => v,
        Err(e) => {
            tracing::error!("Stop error: {}", e);
            let _ = app.emit("recording:error", "Capture audio interrompue".to_string());
            finish_silently(app).await;
            return;
        }
    };

    let duration_ms = (samples.len() as u64 * 1000) / sample_rate.max(1) as u64;
    tracing::info!(
        "Captured {} samples ({} ms @ {} Hz)",
        samples.len(),
        duration_ms,
        sample_rate
    );

    if duration_ms < MIN_DURATION_MS {
        tracing::info!("Skipping transcription (too short: {} ms)", duration_ms);
        finish_silently(app).await;
        return;
    }

    // Voice activity gate: count how many short frames in the recording
    // carry speech-level energy. Silences between phrases contribute zero —
    // they neither help nor hurt the budget — so long pauses don't get
    // mistaken for "no voice".
    let va = analyze_voice_activity(&samples, sample_rate);
    tracing::info!(
        "Voice activity check: {} ms of speech (need ≥{} ms) — \
         noise_floor={:.5} threshold={:.5} peak={:.5}",
        va.speech_ms,
        VAD_MIN_SPEECH_MS,
        va.noise_floor,
        va.threshold,
        va.peak
    );
    let speech_ms = va.speech_ms;
    if speech_ms < VAD_MIN_SPEECH_MS {
        tracing::info!("Skipping transcription (no voice detected)");
        let _ = app.emit("recording:no-voice", ());
        finish_silently(app).await;
        return;
    }

    // Whisper wants 16 kHz mono.
    let app_for_blocking = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let state = app_for_blocking.state::<AppState>();

        let t_resample = std::time::Instant::now();
        let samples_16k = match resample_mono(&samples, sample_rate, WHISPER_SAMPLE_RATE) {
            Ok(s) => s,
            Err(e) => return Err(format!("resample: {e}")),
        };
        let resample_ms = t_resample.elapsed().as_millis();

        let guard = state.whisper.read();
        let engine = match guard.as_ref() {
            Some(e) => e,
            None => {
                return Err(String::from(
                    "Modèle non chargé — télécharge un modèle dans Settings",
                ));
            }
        };

        let model_name = engine.model().display_name().to_string();

        let t_inference = std::time::Instant::now();
        let result = engine.transcribe(&samples_16k);
        let inference_ms = t_inference.elapsed().as_millis();
        tracing::info!(
            "Latency breakdown: resample={}ms, inference={}ms (audio {}ms)",
            resample_ms,
            inference_ms,
            duration_ms
        );

        match result {
            Ok(r) => Ok((r.text, model_name, inference_ms as u64)),
            Err(e) => Err(format!("whisper: {e}")),
        }
    })
    .await
    .unwrap_or_else(|e| Err(format!("join: {e}")));

    match result {
        Ok((text, model_name, _inference_ms)) if !text.is_empty() => {
            // Persist to history before pasting so a paste failure doesn't lose it.
            let entry = HistoryEntry::new(text.clone(), duration_ms, model_name);
            if let Err(e) = history::append(&entry) {
                tracing::error!("history append: {}", e);
            }
            let _ = app.emit("history:new", &entry);
            paste_and_finish(app, text).await;
        }
        Ok(_) => {
            // Whisper returned but produced no usable text (silence, garbage).
            // Skip the "Collé" feedback — nothing actually was.
            finish_silently(app).await;
        }
        Err(err) => {
            tracing::error!("Transcription failed: {}", err);
            let _ = app.emit("recording:error", err);
            finish_silently(app).await;
        }
    }
}

async fn paste_and_finish(app: &AppHandle, text: String) {
    let settings = app.state::<AppState>().settings.get();
    let auto_paste = settings.auto_paste;
    let preserve = settings.preserve_clipboard;

    let text_for_paste = text.clone();
    let app_for_paste = app.clone();
    let _ = tauri::async_runtime::spawn_blocking(move || {
        match crate::paste::paste_text(&text_for_paste, auto_paste, preserve) {
            Ok(PasteOutcome::Pasted) => {}
            Ok(PasteOutcome::ClipboardOnly { reason }) => {
                tracing::warn!("Paste fell back to clipboard-only: {}", reason);
                let _ = app_for_paste.emit("paste:error", reason);
            }
            Err(e) => {
                tracing::error!("Paste error: {}", e);
                let _ = app_for_paste.emit("paste:error", e.to_string());
            }
        }
    })
    .await;

    finish(app).await;
}

/// What the voice-activity pass concluded about a recording. The extra
/// fields beyond `speech_ms` exist so the log line can explain *why* a
/// recording was rejected — diagnosing the Focusrite case from `0 ms of
/// speech` alone cost far more time than carrying three floats around.
struct VoiceActivity {
    speech_ms: u32,
    noise_floor: f32,
    threshold: f32,
    peak: f32,
}

/// Sum, in milliseconds, the duration of frames loud enough to be speech
/// relative to this recording's own noise floor. Silent frames contribute
/// zero — which is exactly what we want when the user pauses between
/// phrases.
fn analyze_voice_activity(samples: &[f32], sample_rate: u32) -> VoiceActivity {
    let empty = VoiceActivity {
        speech_ms: 0,
        noise_floor: 0.0,
        threshold: 0.0,
        peak: 0.0,
    };

    if samples.is_empty() || sample_rate == 0 {
        return empty;
    }
    let frame_samples = ((sample_rate as u64 * VAD_FRAME_MS as u64) / 1000) as usize;
    if frame_samples == 0 {
        return empty;
    }

    let mut frame_rms: Vec<f32> = samples
        .chunks(frame_samples)
        .filter(|f| !f.is_empty())
        .map(|frame| {
            let sum_sq: f64 = frame.iter().map(|&s| (s as f64) * (s as f64)).sum();
            (sum_sq / frame.len() as f64).sqrt() as f32
        })
        .collect();

    if frame_rms.is_empty() {
        return empty;
    }

    let peak = frame_rms.iter().copied().fold(0.0f32, f32::max);

    // Noise floor = the quietest decile. Sorting a copy is fine: even a
    // 5-minute dictation is only ~15k frames.
    let mut sorted = frame_rms.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let idx = ((sorted.len() as f32 * VAD_NOISE_PERCENTILE) as usize).min(sorted.len() - 1);
    let noise_floor = sorted[idx];

    // No upper clamp on the threshold, deliberately. In a recording that is
    // pure room tone the noise floor sits right at the peak, so 3x it lands
    // above every frame and we correctly report no speech. Capping the
    // threshold to some fraction of the peak would break exactly that case.
    let threshold = (noise_floor * VAD_NOISE_MULTIPLIER).max(VAD_ABS_MIN_RMS);

    frame_rms.retain(|&rms| rms >= threshold);
    let speech_frames = frame_rms.len() as u32;

    VoiceActivity {
        speech_ms: speech_frames * VAD_FRAME_MS,
        noise_floor,
        threshold,
        peak,
    }
}

async fn finish(app: &AppHandle) {
    let _ = app.emit("recording:state", "done");
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(900)).await;
        if let Some(overlay) = app.get_webview_window("overlay") {
            let _ = overlay.hide();
        }
        let _ = app.emit("recording:state", "idle");
    });
}

/// Tear down the overlay without showing the "Collé" success badge. Used when
/// nothing actually got pasted (too short, no voice, whisper returned empty
/// text, transcription error). Showing a green check in those cases would be
/// a lie.
async fn finish_silently(app: &AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.hide();
    }
    let _ = app.emit("recording:state", "idle");
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: u32 = 48_000;

    /// Build a recording from (duration_ms, rms_amplitude) segments. Uses an
    /// alternating +/- signal so each frame's RMS equals the amplitude exactly.
    fn signal(segments: &[(u32, f32)]) -> Vec<f32> {
        let mut out = Vec::new();
        for &(ms, amp) in segments {
            let n = (SR as u64 * ms as u64 / 1000) as usize;
            for i in 0..n {
                out.push(if i % 2 == 0 { amp } else { -amp });
            }
        }
        out
    }

    /// The Focusrite regression: real speech at a low absolute level, which
    /// the old fixed 0.025 threshold rejected wholesale.
    #[test]
    fn quiet_interface_speech_is_detected() {
        let samples = signal(&[(500, 0.0004), (1000, 0.012), (500, 0.0004)]);
        let va = analyze_voice_activity(&samples, SR);
        assert!(
            va.speech_ms >= VAD_MIN_SPEECH_MS,
            "quiet-but-real speech rejected: {} ms (threshold {:.5})",
            va.speech_ms,
            va.threshold
        );
    }

    /// The same shape at a hot USB-mic level must still work — the fix must
    /// not trade one interface for another.
    #[test]
    fn loud_mic_speech_is_detected() {
        let samples = signal(&[(500, 0.004), (1000, 0.15), (500, 0.004)]);
        let va = analyze_voice_activity(&samples, SR);
        assert!(va.speech_ms >= VAD_MIN_SPEECH_MS, "{} ms", va.speech_ms);
    }

    /// A dead input must stay rejected: this is the case the absolute floor
    /// exists for, since 3x a noise floor of zero is still zero.
    #[test]
    fn digital_silence_is_rejected() {
        let samples = vec![0.0f32; SR as usize * 2];
        assert_eq!(analyze_voice_activity(&samples, SR).speech_ms, 0);
    }

    /// Steady room tone with no speech: flat signal means the noise floor
    /// sits at the peak, so the multiplier lands above every frame.
    #[test]
    fn steady_room_tone_is_rejected() {
        let samples = signal(&[(3000, 0.006)]);
        let va = analyze_voice_activity(&samples, SR);
        assert_eq!(
            va.speech_ms, 0,
            "room tone counted as speech (threshold {:.5}, peak {:.5})",
            va.threshold, va.peak
        );
    }

    /// Speech over a noisy room: the floor rises, and the gate must rise
    /// with it rather than counting the noise.
    #[test]
    fn speech_over_noisy_room_counts_only_the_speech() {
        let samples = signal(&[(1000, 0.005), (400, 0.08), (1000, 0.005)]);
        let va = analyze_voice_activity(&samples, SR);
        assert!(va.speech_ms >= VAD_MIN_SPEECH_MS, "{} ms", va.speech_ms);
        // Only the loud stretch should count, not the 2 s of room tone.
        assert!(
            va.speech_ms <= 500,
            "noise counted as speech: {} ms",
            va.speech_ms
        );
    }

    /// Long pauses between phrases must not drag the whole thing below the
    /// bar — the original reason this is per-frame rather than whole-buffer.
    #[test]
    fn pauses_between_phrases_do_not_suppress_detection() {
        let samples = signal(&[(300, 0.001), (2000, 0.001), (300, 0.02), (2000, 0.001)]);
        let va = analyze_voice_activity(&samples, SR);
        assert!(va.speech_ms >= VAD_MIN_SPEECH_MS, "{} ms", va.speech_ms);
    }

    #[test]
    fn degenerate_inputs_do_not_panic() {
        assert_eq!(analyze_voice_activity(&[], SR).speech_ms, 0);
        assert_eq!(analyze_voice_activity(&[0.1, -0.1], 0).speech_ms, 0);
    }
}
