use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SizedSample};
use parking_lot::Mutex;
use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc,
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

use super::channels::{self, ChannelStats};

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

/// How the device was opened. Filled in by the recording thread once the
/// stream is built, surfaced in diagnostics and the per-dictation metrics.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureFormat {
    pub device: String,
    pub sample_rate: u32,
    pub channels: u16,
    pub sample_format: String,
    /// Every config the device advertises, e.g. "2ch 44100-192000Hz F32".
    pub supported: Vec<String>,
}

/// One finished recording: the mono signal for Whisper plus everything we
/// learned about the input on the way.
pub struct Capture {
    pub mono: Vec<f32>,
    pub format: CaptureFormat,
    pub channel_stats: Vec<ChannelStats>,
    /// Channels averaged into `mono` (0-based).
    pub used_channels: Vec<usize>,
    /// Time from the stop request to the buffer being ready.
    pub stop_ms: f64,
    /// Time from the start request to the first audio callback — audio
    /// spoken before that is lost. ~50-150 ms for wired devices; Bluetooth
    /// headsets switching to their hands-free profile can take far longer.
    pub stream_start_ms: Option<f64>,
}

/// Capture audio from an input device into an in-memory buffer.
///
/// The cpal `Stream` is not `Send`, so it lives on a dedicated thread spawned
/// in `start()` and dropped when `is_recording` flips back to false. We keep
/// the `JoinHandle` so `stop()` can wait for the thread to fully tear down
/// before we drain the buffer — no more sleep races.
///
/// The buffer holds the *interleaved* capture, every channel intact. Which
/// channels end up in the mono mix is decided at stop time, once we can see
/// which of them actually carried the voice (see `audio::channels`).
pub struct AudioRecorder {
    is_recording: Arc<AtomicBool>,
    buffer: Arc<Mutex<Vec<f32>>>,
    format: Arc<Mutex<CaptureFormat>>,
    thread: Mutex<Option<JoinHandle<()>>>,
    /// Microseconds from start request to first callback, +1 (0 = none yet).
    first_audio_us: Arc<AtomicU64>,
    /// Last device opened by name. Enumerating every WASAPI endpoint and
    /// reading its name costs tens of ms per device; reusing the handle
    /// takes that off the hotkey → first-audio path.
    device_cache: DeviceCache,
}

type DeviceCache = Arc<Mutex<Option<(String, cpal::Device)>>>;

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            buffer: Arc::new(Mutex::new(Vec::new())),
            format: Arc::new(Mutex::new(CaptureFormat::default())),
            thread: Mutex::new(None),
            first_audio_us: Arc::new(AtomicU64::new(0)),
            device_cache: Arc::new(Mutex::new(None)),
        }
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    /// Start recording on a specific input device by name. Falls back to the
    /// Windows system default if `device_name` is `None` or doesn't match
    /// anything currently available (e.g. user unplugged the mic).
    pub fn start_with_device(&self, app: AppHandle, device_name: Option<String>) -> Result<()> {
        if self.is_recording.swap(true, Ordering::SeqCst) {
            return Err(anyhow!("already recording"));
        }
        self.buffer.lock().clear();
        self.first_audio_us.store(0, Ordering::SeqCst);

        let is_recording = self.is_recording.clone();
        let buffer = self.buffer.clone();
        let format = self.format.clone();
        let cache = self.device_cache.clone();
        let first_audio = FirstAudio {
            requested_at: Instant::now(),
            us: self.first_audio_us.clone(),
        };

        let handle = thread::spawn(move || {
            if let Err(e) = run_recording_thread(
                app.clone(),
                is_recording.clone(),
                buffer,
                format,
                device_name,
                first_audio,
                cache,
            ) {
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

    /// Stop recording and hand back the capture. Blocks on the recording
    /// thread's `JoinHandle` so the cpal stream is fully torn down by the
    /// time we read the buffer — callers must invoke this from a blocking
    /// context (e.g. `tauri::async_runtime::spawn_blocking`).
    pub fn stop(&self) -> Result<Capture> {
        let started = Instant::now();
        if !self.is_recording.swap(false, Ordering::SeqCst) {
            return Err(anyhow!("not recording"));
        }
        join_now(self.thread.lock().take());

        let interleaved = std::mem::take(&mut *self.buffer.lock());
        let format = self.format.lock().clone();
        let ch = format.channels.max(1) as usize;

        let channel_stats = channels::channel_stats(&interleaved, ch);
        let used_channels = channels::active_channels(&channel_stats);
        let mut mono = channels::downmix(&interleaved, ch, &used_channels);
        channels::high_pass(&mut mono, format.sample_rate);

        if ch > 1 {
            let signs = channels::polarity(&interleaved, ch, &used_channels);
            tracing::info!(
                "Channels: {} — rms {:?} → using {:?}{}",
                ch,
                channel_stats.iter().map(|s| s.rms).collect::<Vec<_>>(),
                used_channels,
                if signs.contains(&-1.0) { " (polarity-inverted channel flipped)" } else { "" }
            );
        }

        let first = self.first_audio_us.load(Ordering::SeqCst);
        Ok(Capture {
            mono,
            format,
            channel_stats,
            used_channels,
            stop_ms: started.elapsed().as_secs_f64() * 1000.0,
            stream_start_ms: (first > 0).then(|| (first - 1) as f64 / 1000.0),
        })
    }

    /// Discard the in-flight recording. Same blocking contract as `stop`.
    pub fn cancel(&self) {
        self.is_recording.store(false, Ordering::SeqCst);
        join_now(self.thread.lock().take());
        self.buffer.lock().clear();
    }
}

/// Wake the recording thread out of its park and wait for it to exit. The
/// unpark is what makes stopping instant — without it `stop()` would sit
/// out the rest of the thread's park timeout before transcription starts.
fn join_now(handle: Option<JoinHandle<()>>) {
    if let Some(handle) = handle {
        handle.thread().unpark();
        let _ = handle.join();
    }
}

fn describe_supported(device: &cpal::Device) -> Vec<String> {
    match device.supported_input_configs() {
        Ok(configs) => configs
            .map(|c| {
                format!(
                    "{}ch {}-{}Hz {:?}",
                    c.channels(),
                    c.min_sample_rate().0,
                    c.max_sample_rate().0,
                    c.sample_format()
                )
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

fn run_recording_thread(
    app: AppHandle,
    is_recording: Arc<AtomicBool>,
    buffer: Arc<Mutex<Vec<f32>>>,
    format_state: Arc<Mutex<CaptureFormat>>,
    device_name: Option<String>,
    first_audio: FirstAudio,
    cache: DeviceCache,
) -> Result<()> {
    let t0 = Instant::now();
    let host = cpal::default_host();

    // A cached handle is only trusted for a named device (the Windows
    // default can change under us) and only if it still answers.
    let cached = device_name.as_deref().and_then(|name| {
        let guard = cache.lock();
        match guard.as_ref() {
            Some((n, d)) if n == name => Some(d.clone()),
            _ => None,
        }
    });
    let (device, supported) = match cached.and_then(|d| d.default_input_config().ok().map(|c| (d, c))) {
        Some(hit) => hit,
        None => {
            let device = resolve_device(&host, device_name.as_deref())
                .ok_or_else(|| anyhow!("no input device available"))?;
            let config = device.default_input_config()?;
            if let Some(name) = &device_name {
                *cache.lock() = Some((name.clone(), device.clone()));
            }
            (device, config)
        }
    };
    let resolve_ms = t0.elapsed().as_secs_f64() * 1000.0;

    let sample_format = supported.sample_format();
    let sample_rate = supported.sample_rate().0;
    let channels = supported.channels();
    let name = device.name().unwrap_or_else(|_| "<unknown>".into());

    tracing::info!(
        "Recording from '{}' — format={:?}, rate={}Hz, channels={}",
        name,
        sample_format,
        sample_rate,
        channels
    );

    // The supported-config list is diagnostics only: keep it if the device
    // didn't change, otherwise fill it in after the stream is running.
    let need_supported = {
        let mut f = format_state.lock();
        let supported_list = if f.device == name && !f.supported.is_empty() {
            std::mem::take(&mut f.supported)
        } else {
            Vec::new()
        };
        let need = supported_list.is_empty();
        *f = CaptureFormat {
            device: name,
            sample_rate,
            channels,
            sample_format: format!("{sample_format:?}"),
            supported: supported_list,
        };
        need
    };

    let config: cpal::StreamConfig = supported.into();

    // Pre-size for a typical dictation (30 s) so the buffer doesn't go
    // through a dozen grow-and-copy cycles inside the audio callback.
    buffer
        .lock()
        .reserve(sample_rate as usize * channels as usize * 30);

    // Any mid-recording cpal stream error means the device is gone — there's
    // no useful recovery beyond stopping and telling the UI.
    let err_fn = {
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

    let sink = Sink {
        buffer,
        channels,
        last_emit: Instant::now(),
        app: app.clone(),
        scratch: Vec::with_capacity(8192),
        first_audio: Some(first_audio),
    };

    use cpal::SampleFormat as F;
    let stream = match sample_format {
        F::F32 => build::<f32>(&device, &config, sink, err_fn)?,
        F::F64 => build::<f64>(&device, &config, sink, err_fn)?,
        F::I8 => build::<i8>(&device, &config, sink, err_fn)?,
        F::I16 => build::<i16>(&device, &config, sink, err_fn)?,
        F::I32 => build::<i32>(&device, &config, sink, err_fn)?,
        F::I64 => build::<i64>(&device, &config, sink, err_fn)?,
        F::U8 => build::<u8>(&device, &config, sink, err_fn)?,
        F::U16 => build::<u16>(&device, &config, sink, err_fn)?,
        F::U32 => build::<u32>(&device, &config, sink, err_fn)?,
        F::U64 => build::<u64>(&device, &config, sink, err_fn)?,
        other => return Err(anyhow!("unsupported sample format: {:?}", other)),
    };

    let build_ms = t0.elapsed().as_secs_f64() * 1000.0 - resolve_ms;
    stream.play()?;
    tracing::info!(
        "Mic open: resolve {:.0} ms, build {:.0} ms, play {:.0} ms",
        resolve_ms,
        build_ms,
        t0.elapsed().as_secs_f64() * 1000.0 - resolve_ms - build_ms
    );

    if need_supported {
        let list = describe_supported(&device);
        format_state.lock().supported = list;
    }

    // `stop()`/`cancel()` unpark us immediately. The timeout only covers
    // the stream-error path, which clears the flag from cpal's own thread
    // without a handle to unpark this one.
    while is_recording.load(Ordering::SeqCst) {
        thread::park_timeout(Duration::from_millis(100));
    }

    drop(stream);
    tracing::info!("Recording thread exited cleanly");
    Ok(())
}

/// Stamps the first callback's arrival, relative to the start request.
struct FirstAudio {
    requested_at: Instant,
    us: Arc<AtomicU64>,
}

/// Everything the audio callback owns. Moved into the callback closure, so
/// the throttle clock and scratch buffer need no locking.
struct Sink {
    buffer: Arc<Mutex<Vec<f32>>>,
    channels: u16,
    last_emit: Instant,
    app: AppHandle,
    /// Reused conversion buffer — avoids a Vec<f32> allocation per audio
    /// callback (~65 callbacks/sec at typical WASAPI latencies).
    scratch: Vec<f32>,
    /// Taken on the first callback.
    first_audio: Option<FirstAudio>,
}

impl Sink {
    fn push(&mut self, data: &[f32]) {
        if let Some(f) = self.first_audio.take() {
            let us = f.requested_at.elapsed().as_micros() as u64;
            f.us.store(us + 1, Ordering::SeqCst);
        }
        self.buffer.lock().extend_from_slice(data);

        // Throttle level emission to ~30 Hz so the UI doesn't drown in events.
        let now = Instant::now();
        if now.duration_since(self.last_emit) >= Duration::from_millis(33) && !data.is_empty() {
            self.last_emit = now;
            let level = channels::live_level(data, self.channels as usize);
            let _ = self.app.emit("recording:level", level);
        }
    }
}

/// Build an input stream for any sample type, converting to f32 on the fly.
fn build<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    mut sink: Sink,
    err_fn: impl FnMut(cpal::StreamError) + Send + 'static,
) -> Result<cpal::Stream>
where
    T: SizedSample,
    f32: FromSample<T>,
{
    let stream = device.build_input_stream(
        config,
        move |data: &[T], _: &cpal::InputCallbackInfo| {
            let mut scratch = std::mem::take(&mut sink.scratch);
            scratch.clear();
            scratch.extend(data.iter().map(|&s| f32::from_sample(s)));
            sink.push(&scratch);
            sink.scratch = scratch;
        },
        err_fn,
        None,
    )?;
    Ok(stream)
}
