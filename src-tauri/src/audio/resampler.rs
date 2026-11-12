use anyhow::Result;
use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};

const CHUNK_SIZE: usize = 1024;

/// Resample mono audio from `from_rate` Hz to `to_rate` Hz.
/// Whisper expects 16 000 Hz mono input; cpal typically gives us 44 100 or
/// 48 000 Hz. Speech sits below 4 kHz so we don't need audiophile-grade
/// interpolation here — lighter settings shave hundreds of ms off the
/// pipeline without any audible quality loss.
///
/// Runs through one pair of reused buffers (no per-chunk allocation) and
/// flushes the filter at the end, so the last few milliseconds of speech
/// aren't dropped.
pub fn resample_mono(samples: &[f32], from_rate: u32, to_rate: u32) -> Result<Vec<f32>> {
    if from_rate == to_rate || samples.is_empty() {
        return Ok(samples.to_vec());
    }

    let params = SincInterpolationParameters {
        sinc_len: 64,
        f_cutoff: 0.92,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 32,
        window: WindowFunction::Hann,
    };

    let ratio = to_rate as f64 / from_rate as f64;
    let mut resampler = SincFixedIn::<f32>::new(ratio, 1.0, params, CHUNK_SIZE, 1)?;

    let expected = (samples.len() as f64 * ratio).round() as usize;

    let mut output: Vec<f32> = Vec::with_capacity(expected + resampler.output_frames_max());
    let mut out_buf = resampler.output_buffer_allocate(true);

    let mut chunks = samples.chunks_exact(CHUNK_SIZE);
    for chunk in &mut chunks {
        let (_, written) = resampler.process_into_buffer(&[chunk], &mut out_buf, None)?;
        output.extend_from_slice(&out_buf[0][..written]);
    }

    // The leftover partial chunk, then empty flushes until the filter has
    // emitted everything that belongs to the real input.
    let tail = chunks.remainder();
    if !tail.is_empty() {
        let (_, written) =
            resampler.process_partial_into_buffer(Some(&[tail]), &mut out_buf, None)?;
        output.extend_from_slice(&out_buf[0][..written]);
    }
    while output.len() < expected {
        let (_, written) =
            resampler.process_partial_into_buffer(None::<&[&[f32]]>, &mut out_buf, None)?;
        if written == 0 {
            break;
        }
        output.extend_from_slice(&out_buf[0][..written]);
    }

    // Flushing pads with zeros past the real end; drop that.
    output.truncate(expected);
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sine(freq: f32, rate: u32, n: usize) -> Vec<f32> {
        (0..n)
            .map(|i| (2.0 * std::f32::consts::PI * freq * i as f32 / rate as f32).sin() * 0.5)
            .collect()
    }

    #[test]
    fn output_length_matches_ratio() {
        for &n in &[1usize, 500, 1024, 4800, 48_000 + 37] {
            let out = resample_mono(&vec![0.1; n], 48_000, 16_000).unwrap();
            let expected = (n as f64 / 3.0).round() as usize;
            assert_eq!(out.len(), expected, "n={n}");
        }
        let out = resample_mono(&vec![0.1; 44_100], 44_100, 16_000).unwrap();
        assert_eq!(out.len(), 16_000);
    }

    /// An impulse must come out where it went in (scaled by the ratio):
    /// no lead or lag introduced by the filter or the chunking.
    #[test]
    fn impulse_stays_in_place() {
        let mut x = vec![0.0f32; 48_000];
        x[24_000] = 1.0;
        let out = resample_mono(&x, 48_000, 16_000).unwrap();
        let peak = (0..out.len())
            .max_by(|&a, &b| out[a].abs().total_cmp(&out[b].abs()))
            .unwrap();
        assert!((7_998..=8_002).contains(&peak), "peak at {peak}, want ~8000");
    }

    /// A speech-band tone must survive with its amplitude intact — the
    /// lighter sinc settings are only acceptable if they don't eat the voice.
    #[test]
    fn speech_band_tone_keeps_its_amplitude() {
        let out = resample_mono(&sine(1_000.0, 48_000, 48_000), 48_000, 16_000).unwrap();
        let peak = out[1_000..15_000].iter().fold(0.0f32, |m, v| m.max(v.abs()));
        assert!((0.48..=0.52).contains(&peak), "peak {peak}, want ~0.5");
    }

    #[test]
    fn same_rate_and_empty_are_passthrough() {
        assert_eq!(resample_mono(&[0.1, 0.2], 16_000, 16_000).unwrap(), vec![0.1, 0.2]);
        assert!(resample_mono(&[], 48_000, 16_000).unwrap().is_empty());
    }
}
