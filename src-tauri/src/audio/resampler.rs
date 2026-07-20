use anyhow::Result;
use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction};

/// Resample mono audio from `from_rate` Hz to `to_rate` Hz.
/// Whisper expects 16 000 Hz mono input; cpal typically gives us 44 100 or
/// 48 000 Hz. Speech sits below 4 kHz so we don't need audiophile-grade
/// interpolation here — lighter settings shave hundreds of ms off the
/// pipeline without any audible quality loss.
pub fn resample_mono(samples: &[f32], from_rate: u32, to_rate: u32) -> Result<Vec<f32>> {
    if from_rate == to_rate {
        return Ok(samples.to_vec());
    }

    let params = SincInterpolationParameters {
        sinc_len: 64,
        f_cutoff: 0.92,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 32,
        window: WindowFunction::Hann,
    };

    let chunk_size = 1024;
    let mut resampler = SincFixedIn::<f32>::new(
        to_rate as f64 / from_rate as f64,
        2.0,
        params,
        chunk_size,
        1, // mono
    )?;

    let mut output: Vec<f32> = Vec::with_capacity(
        (samples.len() as f64 * to_rate as f64 / from_rate as f64) as usize + chunk_size,
    );

    let mut pos = 0;
    while pos + chunk_size <= samples.len() {
        let frame = vec![samples[pos..pos + chunk_size].to_vec()];
        let resampled = resampler.process(&frame, None)?;
        output.extend_from_slice(&resampled[0]);
        pos += chunk_size;
    }

    // Pad the leftover with zeros so the resampler has a full chunk.
    if pos < samples.len() {
        let mut last = samples[pos..].to_vec();
        last.resize(chunk_size, 0.0);
        let resampled = resampler.process(&vec![last], None)?;
        // Only keep the proportional number of output samples for the real tail.
        let real_tail = samples.len() - pos;
        let real_out = (real_tail as f64 * to_rate as f64 / from_rate as f64) as usize;
        output.extend(resampled[0].iter().copied().take(real_out));
    }

    Ok(output)
}
