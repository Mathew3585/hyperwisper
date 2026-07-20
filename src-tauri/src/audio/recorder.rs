use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::Mutex;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// Returns the name of the currently-active default input device, for display
/// in the Settings UI. None if no input device is available.
pub fn default_input_name() -> Option<String> {
    let host = cpal::default_host();
    let device = host.default_input_device()?;
    device.name().ok()
}

/// Enumerate every input device WASAPI exposes. Used by the Audio panel.
pub fn list_input_devices() -> Vec<String> {
    let host = cpal::default_host();
    match host.input_devices() {
        Ok(devices) => devices.filter_map(|d| d.name().ok()).collect(),
        Err(_) => Vec::new(),
    }
}

/// Find the named device, or fall back to the system default. We match by
/// exact name; if the user unplugged the persisted mic we silently use the
/// default rather than failing — this is what every well-behaved app does.
fn resolve_device(host: &cpal::Host, name: Option<&str>) -> Option<cpal::Device> {
    if let Some(name) = name {
        if let Ok(devices) = host.input_devices() {
            for device in devices {
                if device.name().ok().as_deref() == Some(name) {
                    tracing::info!("Using user-selected mic: {}", name);
                    return Some(device);
                }
            }
            tracing::warn!(
                "Persisted mic '{}' not found; falling back to system default",
                name
            );
        }
    }
    host.default_input_device()
}

/// Capture audio from the default input device into an in-memory buffer.
///
/// The cpal `Stream` is not `Send`, so it lives on a dedicated thread spawned
/// in `start()` and dropped when `is_recording` flips back to false. We keep
/// the `JoinHandle` so `stop()` can wait for the thread to fully tear down
/// before we drain the buffer — no more sleep races.
pub struct AudioRecorder {
    is_recording: Arc<AtomicBool>,
    buffer: Arc<Mutex<Vec<f32>>>,
    sample_rate: Arc<Mutex<u32>>,
    thread: Mutex<Option<JoinHandle<()>>>,
}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            buffer: Arc::new(Mutex::new(Vec::new())),
            sample_rate: Arc::new(Mutex::new(48_000)),
            thread: Mutex::new(None),
        }
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn sample_rate(&self) -> u32 {
        *self.sample_rate.lock()
    }

    /// Start recording on a specific input device by name. Falls back to the
    /// Windows system default if `device_name` is `None` or doesn't match
    /// anything currently available (e.g. user unplugged the mic).
    pub fn start_with_device(&self, app: AppHandle, device_name: Option<String>) -> Result<()> {
        if self.is_recording.swap(true, Ordering::SeqCst) {
            return Err(anyhow!("already recording"));
        }
        self.buffer.lock().clear();

        let is_recording = self.is_recording.clone();
        let buffer = self.buffer.clone();
        let sample_rate = self.sample_rate.clone();

        let handle = thread::spawn(move || {
            if let Err(e) =
                run_recording_thread(app.clone(), is_recording.clone(), buffer, sample_rate, device_name)
            {
                tracing::error!("Recording thread error: {}", e);
                is_recording.store(false, Ordering::SeqCst);
                // Tell the UI the recording didn't actually happen so it can
                // hide the overlay and surface the failure.
                let _ = app.emit("recording:error", e.to_string());
                let _ = app.emit("recording:state", "idle");
                if let Some(overlay) = app.get_webview_window("overlay") {
                    let _ = overlay.hide();
                }
                crate::hotkey::unregister_cancel_key(&app);
            }
        });

        *self.thread.lock() = Some(handle);
        Ok(())
    }

    /// Stop recording and drain the captured samples (mono f32). Blocks on
    /// the recording thread's `JoinHandle` so the cpal stream is fully torn
    /// down by the time we read the buffer — callers must invoke this from a
    /// blocking context (e.g. `tauri::async_runtime::spawn_blocking`).
    pub fn stop(&self) -> Result<Vec<f32>> {
        if !self.is_recording.swap(false, Ordering::SeqCst) {
            return Err(anyhow!("not recording"));
        }
        if let Some(handle) = self.thread.lock().take() {
            let _ = handle.join();
        }
        let samples = std::mem::take(&mut *self.buffer.lock());
        Ok(samples)
    }

    /// Discard the in-flight recording. Same blocking contract as `stop`.
    pub fn cancel(&self) {
        self.is_recording.store(false, Ordering::SeqCst);
        if let Some(handle) = self.thread.lock().take() {
            let _ = handle.join();
        }
        self.buffer.lock().clear();
    }
}

fn run_recording_thread(
    app: AppHandle,
    is_recording: Arc<AtomicBool>,
    buffer: Arc<Mutex<Vec<f32>>>,
    sample_rate_state: Arc<Mutex<u32>>,
    device_name: Option<String>,
) -> Result<()> {
    let host = cpal::default_host();
    let device = resolve_device(&host, device_name.as_deref())
        .ok_or_else(|| anyhow!("no input device available"))?;

    let supported = device.default_input_config()?;
    let sample_format = supported.sample_format();
    let sample_rate = supported.sample_rate().0;
    let channels = supported.channels();
    *sample_rate_state.lock() = sample_rate;

    tracing::info!(
        "Recording from '{}' — format={:?}, rate={}Hz, channels={}",
        device.name().unwrap_or_else(|_| "<unknown>".into()),
        sample_format,
        sample_rate,
        channels
    );

    let config: cpal::StreamConfig = supported.into();
    let last_emit = Arc::new(Mutex::new(Instant::now()));

    // Build a fresh err closure per stream that flips state back to idle and
    // surfaces a `device:disconnect` event so the frontend can toast it. Any
    // mid-recording cpal stream error means the device is gone — there's no
    // useful recovery beyond stopping.
    let make_err_fn = || {
        let is_recording = is_recording.clone();
        let app = app.clone();
        move |err: cpal::StreamError| {
            tracing::error!("cpal stream error: {}", err);
            if is_recording.swap(false, Ordering::SeqCst) {
                let _ = app.emit("device:disconnect", ());
                let _ = app.emit("recording:state", "idle");
                if let Some(overlay) = app.get_webview_window("overlay") {
                    let _ = overlay.hide();
                }
                crate::hotkey::unregister_cancel_key(&app);
            }
        }
    };

    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            let buffer = buffer.clone();
            let last_emit = last_emit.clone();
            let app = app.clone();
            device.build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    process_samples(data, channels, &buffer, &last_emit, &app);
                },
                make_err_fn(),
                None,
            )?
        }
        cpal::SampleFormat::I16 => {
            let buffer = buffer.clone();
            let last_emit = last_emit.clone();
            let app = app.clone();
            // Reused scratch buffer — avoids a Vec<f32> allocation per audio
            // callback (~65 callbacks/sec at typical WASAPI latencies).
            let mut scratch: Vec<f32> = Vec::with_capacity(4096);
            device.build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    scratch.clear();
                    scratch.extend(data.iter().map(|&s| s as f32 / i16::MAX as f32));
                    process_samples(&scratch, channels, &buffer, &last_emit, &app);
                },
                make_err_fn(),
                None,
            )?
        }
        cpal::SampleFormat::U16 => {
            let buffer = buffer.clone();
            let last_emit = last_emit.clone();
            let app = app.clone();
            let mut scratch: Vec<f32> = Vec::with_capacity(4096);
            device.build_input_stream(
                &config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    scratch.clear();
                    scratch
                        .extend(data.iter().map(|&s| (s as f32 - 32_768.0) / 32_768.0));
                    process_samples(&scratch, channels, &buffer, &last_emit, &app);
                },
                make_err_fn(),
                None,
            )?
        }
        other => return Err(anyhow!("unsupported sample format: {:?}", other)),
    };

    stream.play()?;

    while is_recording.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_millis(40));
    }

    drop(stream);
    tracing::info!("Recording thread exited cleanly");
    Ok(())
}

fn process_samples(
    data: &[f32],
    channels: u16,
    buffer: &Arc<Mutex<Vec<f32>>>,
    last_emit: &Arc<Mutex<Instant>>,
    app: &AppHandle,
) {
    // Downmix to mono on the fly so the buffer is already in the format whisper expects.
    {
        let mut buf = buffer.lock();
        if channels <= 1 {
            buf.extend_from_slice(data);
        } else {
            let ch = channels as usize;
            for frame in data.chunks_exact(ch) {
                let sum: f32 = frame.iter().sum();
                buf.push(sum / ch as f32);
            }
        }
    }

    // Throttle RMS emission to ~30 Hz so the UI doesn't drown in events.
    let now = Instant::now();
    let should_emit = {
        let mut last = last_emit.lock();
        if now.duration_since(*last).as_millis() >= 33 {
            *last = now;
            true
        } else {
            false
        }
    };

    if should_emit && !data.is_empty() {
        let mean_sq: f32 = data.iter().map(|&x| x * x).sum::<f32>() / data.len() as f32;
        let rms = mean_sq.sqrt();
        let _ = app.emit("recording:level", rms);
    }
}
