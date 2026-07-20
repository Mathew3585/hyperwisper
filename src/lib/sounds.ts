/**
 * Synthesized cues inspired by Superwhisper / modern macOS apps:
 * warm "thunk" tones built from a main sine + soft triangle harmonic,
 * lowpassed for a wood-block quality (not a piezo beep).
 *
 * Every parameter is tuned so the cue is felt rather than heard — it
 * confirms the action without taking attention.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

interface ThunkOptions {
  /** Hz at the start of the tone. */
  startFreq: number;
  /** Hz at the end — slight glide gives it character. */
  endFreq: number;
  /** Total duration in seconds. */
  duration: number;
  /** Multiplier for the triangle harmonic — controls warmth/edge balance. */
  harmonic?: number;
  /** Loudness of the harmonic relative to the fundamental. */
  harmonicGain?: number;
  /** Low-pass cutoff in Hz — lower = warmer, more wooden. */
  lpFreq?: number;
  /** Peak volume — kept low so cues never dominate. */
  volume?: number;
  /** Attack time in seconds — soft attack avoids any "click". */
  attack?: number;
}

function thunk({
  startFreq,
  endFreq,
  duration,
  harmonic = 1.5,
  harmonicGain = 0.28,
  lpFreq = 1900,
  volume = 0.17,
  attack = 0.018,
}: ThunkOptions) {
  const audio = getCtx();
  if (!audio) return;
  const t = audio.currentTime;

  // Fundamental — pure sine for clarity
  const osc1 = audio.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(startFreq, t);
  osc1.frequency.exponentialRampToValueAtTime(endFreq, t + duration * 0.6);

  // Triangle harmonic for woody body
  const osc2 = audio.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(startFreq * harmonic, t);
  osc2.frequency.exponentialRampToValueAtTime(endFreq * harmonic, t + duration * 0.6);

  // Low-pass for warmth — kills any harshness
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(lpFreq, t);
  filter.frequency.exponentialRampToValueAtTime(lpFreq * 0.6, t + duration);
  filter.Q.value = 0.75;

  // Mix the harmonic at reduced gain
  const osc2Mix = audio.createGain();
  osc2Mix.gain.value = harmonicGain;

  // Master envelope — gentle attack, exponential decay
  const master = audio.createGain();
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(volume, t + attack);
  master.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc1.connect(filter);
  osc2.connect(osc2Mix).connect(filter);
  filter.connect(master).connect(audio.destination);

  osc1.start(t);
  osc1.stop(t + duration);
  osc2.start(t);
  osc2.stop(t + duration);
}

export const sounds = {
  /** Start of recording — warm low descending thunk. */
  start: () =>
    thunk({
      startFreq: 260,
      endFreq: 205,
      duration: 0.22,
      harmonic: 1.5,
      lpFreq: 1700,
      volume: 0.18,
    }),

  /** Stop of recording — warm thunk in opposite direction (lower then up). */
  stop: () =>
    thunk({
      startFreq: 215,
      endFreq: 280,
      duration: 0.18,
      harmonic: 1.5,
      lpFreq: 1900,
      volume: 0.16,
    }),

  /** Transcription pasted — soft higher confirmation. */
  done: () =>
    thunk({
      startFreq: 540,
      endFreq: 580,
      duration: 0.11,
      harmonic: 2.0,
      harmonicGain: 0.18,
      lpFreq: 3200,
      volume: 0.13,
      attack: 0.012,
    }),

  /** Soft cancel cue when the user hits Esc. */
  cancel: () =>
    thunk({
      startFreq: 200,
      endFreq: 140,
      duration: 0.14,
      harmonic: 1.3,
      lpFreq: 1400,
      volume: 0.13,
    }),
};
