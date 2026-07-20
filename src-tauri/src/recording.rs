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
/// RMS a 20 ms frame must reach to count as speech. Background hiss is
/// typically <0.005; ambient fan/keyboard <0.02; even soft speech ≥ 0.03.
const VAD_FRAME_RMS_THRESHOLD: f32 = 0.025;
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
    let speech_ms = speech_budget_ms(&samples, sample_rate);
    tracing::info!(
        "Voice activity check: {} ms of speech detected (threshold ≥{} ms)",
        speech_ms,
        VAD_MIN_SPEECH_MS
    );
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

/// Sum, in milliseconds, the duration of frames whose RMS exceeds the
/// speech threshold. Silent frames contribute zero — which is exactly what
/// we want when the user pauses between phrases.
fn speech_budget_ms(samples: &[f32], sample_rate: u32) -> u32 {
    if samples.is_empty() || sample_rate == 0 {
        return 0;
    }
    let frame_samples = ((sample_rate as u64 * VAD_FRAME_MS as u64) / 1000) as usize;
    if frame_samples == 0 {
        return 0;
    }

    let mut speech_frames: u32 = 0;
    let thresh_sq = (VAD_FRAME_RMS_THRESHOLD * VAD_FRAME_RMS_THRESHOLD) as f64;

    for frame in samples.chunks(frame_samples) {
        if frame.is_empty() {
            continue;
        }
        let sum_sq: f64 = frame.iter().map(|&s| (s as f64) * (s as f64)).sum();
        let mean_sq = sum_sq / frame.len() as f64;
        if mean_sq >= thresh_sq {
            speech_frames += 1;
        }
    }

    speech_frames * VAD_FRAME_MS
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
