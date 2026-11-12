//! Turning a multi-channel capture into the mono signal Whisper needs.
//!
//! Audio interfaces present every physical input as a channel of one
//! device. A Focusrite Scarlett Solo, for instance, shows up in Windows as a
//! *stereo* input: the XLR mic on channel 1 (left), the instrument jack on
//! channel 2 (right). With nothing plugged into the instrument jack, a plain
//! average of the two halves the voice (-6 dB) and mixes in the empty
//! input's noise. That is exactly the setup other dictation apps fail on.
//!
//! So instead of averaging blindly, we measure every channel and keep only
//! the ones that carry real signal. A true stereo mic (both channels at the
//! same level) is still averaged, as before.

use serde::Serialize;

/// A channel is kept when its RMS is within this ratio of the loudest one.
/// 0.25 ≈ -12 dB: a real second mic or a stereo pair sits well inside it,
/// while an empty instrument input sits 30+ dB below the voice.
const ACTIVE_RATIO: f32 = 0.25;
/// Samples at or above this magnitude count as clipped.
const CLIP_LEVEL: f32 = 0.999;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChannelStats {
    pub rms: f32,
    pub peak: f32,
    /// Fraction of samples at full scale (0.0–1.0).
    pub clipped_ratio: f32,
}

/// Measure each channel of an interleaved buffer.
pub fn channel_stats(interleaved: &[f32], channels: usize) -> Vec<ChannelStats> {
    let channels = channels.max(1);
    let mut sum = vec![0f64; channels];
    let mut sum_sq = vec![0f64; channels];
    let mut peak = vec![0f32; channels];
    let mut clipped = vec![0usize; channels];

    for frame in interleaved.chunks_exact(channels) {
        for (c, &s) in frame.iter().enumerate() {
            let a = s.abs();
            sum[c] += s as f64;
            sum_sq[c] += (s as f64) * (s as f64);
            if a > peak[c] {
                peak[c] = a;
            }
            if a >= CLIP_LEVEL {
                clipped[c] += 1;
            }
        }
    }

    let frames = (interleaved.len() / channels).max(1);
    (0..channels)
        .map(|c| ChannelStats {
            // Standard deviation rather than raw RMS: a cheap mic with a DC
            // offset would otherwise look "loud" while carrying no sound.
            rms: {
                let mean = sum[c] / frames as f64;
                (sum_sq[c] / frames as f64 - mean * mean).max(0.0).sqrt() as f32
            },
            peak: peak[c],
            clipped_ratio: clipped[c] as f32 / frames as f32,
        })
        .collect()
}

/// Indices of the channels worth keeping. Never empty for `channels >= 1`:
/// if everything is silent we keep them all and let the VAD reject it.
pub fn active_channels(stats: &[ChannelStats]) -> Vec<usize> {
    let loudest = stats.iter().map(|s| s.rms).fold(0.0f32, f32::max);
    if loudest <= 0.0 {
        return (0..stats.len()).collect();
    }
    stats
        .iter()
        .enumerate()
        .filter(|(_, s)| s.rms >= loudest * ACTIVE_RATIO)
        .map(|(i, _)| i)
        .collect()
}

/// Average the selected channels into mono.
///
/// Channels that are strongly *anti*-correlated with the first kept one are
/// flipped before averaging. Some stereo USB mics and miswired XLR splitters
/// deliver one side polarity-inverted; a plain average of the two cancels
/// the voice out almost entirely, which reads as "the mic doesn't work".
pub fn downmix(interleaved: &[f32], channels: usize, keep: &[usize]) -> Vec<f32> {
    let channels = channels.max(1);
    if channels == 1 {
        return interleaved.to_vec();
    }
    if keep.is_empty() {
        return Vec::new();
    }
    let signs = polarity(interleaved, channels, keep);
    let scale = 1.0 / keep.len() as f32;
    interleaved
        .chunks_exact(channels)
        .map(|frame| {
            keep.iter()
                .zip(&signs)
                .map(|(&c, &sign)| frame[c] * sign)
                .sum::<f32>()
                * scale
        })
        .collect()
}

/// Correlation below this flips a channel. -0.5 only catches clear
/// inversions; two independent capsules sit near 0 and are left alone.
const INVERTED_CORRELATION: f64 = -0.5;

/// +1/-1 per kept channel, relative to the first kept channel.
pub fn polarity(interleaved: &[f32], channels: usize, keep: &[usize]) -> Vec<f32> {
    let Some(&reference) = keep.first() else {
        return Vec::new();
    };
    keep.iter()
        .map(|&c| {
            if c == reference {
                return 1.0;
            }
            let (mut dot, mut e_ref, mut e_c) = (0f64, 0f64, 0f64);
            for frame in interleaved.chunks_exact(channels) {
                let (a, b) = (frame[reference] as f64, frame[c] as f64);
                dot += a * b;
                e_ref += a * a;
                e_c += b * b;
            }
            let denom = (e_ref * e_c).sqrt();
            if denom > 0.0 && dot / denom < INVERTED_CORRELATION {
                -1.0
            } else {
                1.0
            }
        })
        .collect()
}

/// Strip DC offset and sub-audio rumble (desk thumps, HVAC) with a one-pole
/// high-pass around 40 Hz — well below the lowest voice fundamental.
pub fn high_pass(samples: &mut [f32], sample_rate: u32) {
    if samples.is_empty() || sample_rate == 0 {
        return;
    }
    let r = (-2.0 * std::f32::consts::PI * 40.0 / sample_rate as f32).exp();
    // Start from the first sample so a big DC offset doesn't produce a step.
    let mut x_prev = samples[0];
    let mut y_prev = 0.0f32;
    for s in samples.iter_mut() {
        let x = *s;
        let y = x - x_prev + r * y_prev;
        x_prev = x;
        y_prev = y;
        *s = y;
    }
}

/// Peak the signal is raised towards: -6 dBFS, comfortable headroom.
const NORMALIZE_TARGET: f32 = 0.5;
/// Never amplify more than +20 dB — beyond that it's mostly noise being
/// boosted, and the VAD has already judged the clip to contain speech.
const NORMALIZE_MAX_GAIN: f32 = 10.0;

/// Raise quiet recordings to a standard level before Whisper. Its log-mel
/// front end isn't level-invariant, and it was trained on normalized audio:
/// a headset or interface at low gain lands outside what it's used to.
/// Never attenuates. Returns the gain applied, in dB.
pub fn normalize(samples: &mut [f32]) -> f32 {
    let peak = samples.iter().fold(0.0f32, |m, s| m.max(s.abs()));
    if peak <= 0.0 {
        return 0.0;
    }
    let gain = (NORMALIZE_TARGET / peak).clamp(1.0, NORMALIZE_MAX_GAIN);
    if gain > 1.0 {
        for s in samples.iter_mut() {
            *s *= gain;
        }
    }
    20.0 * gain.log10()
}

/// Loudest per-channel RMS of one callback's worth of audio — what the
/// overlay meter shows, so an empty second input can't make it look dead.
pub fn live_level(interleaved: &[f32], channels: usize) -> f32 {
    let channels = channels.max(1);
    let mut sum_sq = [0f32; 8];
    let n = channels.min(8);
    let mut frames = 0usize;
    for frame in interleaved.chunks_exact(channels) {
        for c in 0..n {
            sum_sq[c] += frame[c] * frame[c];
        }
        frames += 1;
    }
    if frames == 0 {
        return 0.0;
    }
    sum_sq[..n]
        .iter()
        .map(|s| (s / frames as f32).sqrt())
        .fold(0.0, f32::max)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Interleave per-channel signals into one buffer.
    fn interleave(chans: &[Vec<f32>]) -> Vec<f32> {
        let n = chans[0].len();
        (0..n).flat_map(|i| chans.iter().map(move |c| c[i])).collect()
    }

    fn tone(amp: f32, n: usize) -> Vec<f32> {
        (0..n).map(|i| if i % 2 == 0 { amp } else { -amp }).collect()
    }

    /// The Scarlett Solo case: voice on input 1, an empty instrument input
    /// on 2. Only channel 0 may be used, at full level.
    #[test]
    fn empty_second_input_is_dropped() {
        let buf = interleave(&[tone(0.2, 1000), tone(0.0005, 1000)]);
        let stats = channel_stats(&buf, 2);
        let keep = active_channels(&stats);
        assert_eq!(keep, vec![0]);
        let mono = downmix(&buf, 2, &keep);
        assert_eq!(mono.len(), 1000);
        assert!((mono[0] - 0.2).abs() < 1e-6, "voice was attenuated: {}", mono[0]);
    }

    /// Same thing with the mic plugged into input 2 instead.
    #[test]
    fn voice_on_the_second_input_is_found() {
        let buf = interleave(&[tone(0.0005, 1000), tone(0.1, 1000)]);
        assert_eq!(active_channels(&channel_stats(&buf, 2)), vec![1]);
    }

    /// A genuine stereo mic must still be averaged.
    #[test]
    fn balanced_stereo_keeps_both_channels() {
        let buf = interleave(&[tone(0.2, 1000), tone(0.15, 1000)]);
        let keep = active_channels(&channel_stats(&buf, 2));
        assert_eq!(keep, vec![0, 1]);
        let mono = downmix(&buf, 2, &keep);
        assert!((mono[0] - 0.175).abs() < 1e-6);
    }

    #[test]
    fn silence_keeps_everything_and_mono_passes_through() {
        let buf = vec![0.0; 200];
        assert_eq!(active_channels(&channel_stats(&buf, 2)), vec![0, 1]);
        let mono = vec![0.1, -0.2, 0.3];
        assert_eq!(downmix(&mono, 1, &[0]), mono);
    }

    #[test]
    fn clipping_is_measured_per_channel() {
        let mut ch0 = tone(0.3, 1000);
        for s in ch0.iter_mut().take(10) {
            *s = 1.0;
        }
        let stats = channel_stats(&interleave(&[ch0, tone(0.3, 1000)]), 2);
        assert!((stats[0].clipped_ratio - 0.01).abs() < 1e-6);
        assert_eq!(stats[1].clipped_ratio, 0.0);
        assert_eq!(stats[0].peak, 1.0);
    }

    /// A polarity-inverted second capsule must not cancel the voice out.
    #[test]
    fn inverted_channel_is_flipped_not_cancelled() {
        let ch0 = tone(0.2, 1000);
        let ch1: Vec<f32> = ch0.iter().map(|s| -s).collect();
        let buf = interleave(&[ch0, ch1]);
        let keep = active_channels(&channel_stats(&buf, 2));
        assert_eq!(keep, vec![0, 1]);
        let mono = downmix(&buf, 2, &keep);
        assert!((mono[0] - 0.2).abs() < 1e-6, "voice cancelled: {}", mono[0]);
    }

    /// A channel that only carries DC offset is not "active".
    #[test]
    fn dc_offset_is_not_mistaken_for_signal() {
        let buf = interleave(&[tone(0.05, 1000), vec![0.3; 1000]]);
        let stats = channel_stats(&buf, 2);
        assert!(stats[1].rms < 1e-6, "DC counted as signal: {}", stats[1].rms);
        assert_eq!(active_channels(&stats), vec![0]);
    }

    #[test]
    fn high_pass_removes_dc_and_keeps_voice() {
        let rate = 16_000;
        let mut x: Vec<f32> = (0..rate)
            .map(|i| 0.3 + 0.2 * (2.0 * std::f32::consts::PI * 300.0 * i as f32 / rate as f32).sin())
            .collect();
        high_pass(&mut x, rate as u32);
        let tail = &x[rate / 2..];
        let mean = tail.iter().sum::<f32>() / tail.len() as f32;
        let peak = tail.iter().fold(0.0f32, |m, s| m.max(s.abs()));
        assert!(mean.abs() < 0.005, "DC left: {mean}");
        assert!((0.18..=0.21).contains(&peak), "voice band altered: {peak}");
    }

    #[test]
    fn normalize_boosts_quiet_audio_only() {
        let mut quiet = tone(0.05, 100);
        let db = normalize(&mut quiet);
        assert!((quiet[0] - 0.5).abs() < 1e-6);
        assert!((db - 20.0).abs() < 0.01);

        let mut very_quiet = tone(0.001, 100);
        normalize(&mut very_quiet);
        assert!((very_quiet[0] - 0.01).abs() < 1e-6, "gain must cap at +20 dB");

        let mut loud = tone(0.8, 100);
        assert_eq!(normalize(&mut loud), 0.0);
        assert_eq!(loud[0], 0.8);

        assert_eq!(normalize(&mut []), 0.0);
    }

    #[test]
    fn live_level_follows_the_loudest_channel() {
        let buf = interleave(&[tone(0.0, 100), tone(0.4, 100)]);
        assert!((live_level(&buf, 2) - 0.4).abs() < 1e-6);
        assert_eq!(live_level(&[], 2), 0.0);
    }
}
