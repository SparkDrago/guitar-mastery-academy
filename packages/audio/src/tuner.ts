/**
 * Chromatic tuner logic, independent of the Web Audio API.
 * Feed it raw frames (Float32Array) and it returns stable readings:
 * detected note (all 12 semitones), octave, Hz, cents, and the closest string
 * of the selected tuning, with noise gating, outlier rejection and smoothing.
 */
import { yin, highPass, toDb, type PitchEstimate } from './yin';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface TunerOptions {
  a4?: number;
  /** Frames quieter than this (dBFS) are ignored. */
  noiseGateDb?: number;
  /** Minimum YIN probability for a frame to count. */
  minProbability?: number;
  /** Within ± this many cents counts as in tune. */
  inTuneCents?: number;
  /** Consecutive in-range frames needed before declaring "in tune". */
  inTuneFrames?: number;
  minFreq?: number;
  maxFreq?: number;
}

export interface StringTarget {
  index: number;
  midi: number;
}

export interface TunerReading {
  freq: number;
  /** Fractional MIDI number of the smoothed pitch. */
  midiFloat: number;
  /** Nearest equal-tempered note. */
  midi: number;
  note: string;
  octave: number;
  /** Cents from the nearest chromatic note (−50..+50). */
  cents: number;
  confidence: number;
  levelDb: number;
  /** Closest (or manually selected) string of the active tuning. */
  target?: {
    index: number;
    midi: number;
    note: string;
    octave: number;
    freq: number;
    /** Cents from the string's target pitch (can exceed ±50 when far off). */
    cents: number;
    /** Octave error hint when a manually selected string hears the wrong octave. */
    octaveHint?: 'up' | 'down';
  };
  status: 'flat' | 'sharp' | 'in-tune';
  /** True once the reading has been in range for `inTuneFrames` frames. */
  locked: boolean;
}

export function midiToFreqA4(midi: number, a4: number): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidiA4(freq: number, a4: number): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export function noteNameOf(midi: number): { note: string; octave: number } {
  return { note: NOTE_NAMES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1 };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Pick the string of a tuning that a detected pitch most likely belongs to.
 * Uses distance in cents; if `manual` is given, that string is used and an
 * octave hint is returned when the pitch is roughly an octave off.
 */
export function matchString(midiFloat: number, strings: number[], manual?: number): { index: number; cents: number; octaveHint?: 'up' | 'down' } {
  if (manual !== undefined && manual >= 0 && manual < strings.length) {
    const cents = (midiFloat - strings[manual]) * 100;
    let octaveHint: 'up' | 'down' | undefined;
    if (Math.abs(cents - 1200) < 150) octaveHint = 'down';
    else if (Math.abs(cents + 1200) < 150) octaveHint = 'up';
    return { index: manual, cents, octaveHint };
  }
  let best = 0;
  let bestDist = Infinity;
  strings.forEach((m, i) => {
    const d = Math.abs(midiFloat - m);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return { index: best, cents: (midiFloat - strings[best]) * 100 };
}

export class TunerEngine {
  private opts: Required<TunerOptions>;
  private history: number[] = [];
  private smoothed: number | null = null;
  private inRangeCount = 0;
  private pendingJump: number[] = [];
  private scratch: Float32Array | null = null;

  constructor(options: TunerOptions = {}) {
    this.opts = {
      a4: options.a4 ?? 440,
      noiseGateDb: options.noiseGateDb ?? -50,
      minProbability: options.minProbability ?? 0.82,
      inTuneCents: options.inTuneCents ?? 3,
      inTuneFrames: options.inTuneFrames ?? 4,
      minFreq: options.minFreq ?? 30,
      maxFreq: options.maxFreq ?? 1500,
    };
  }

  setA4(a4: number): void {
    this.opts.a4 = a4;
    this.reset();
  }

  /** Lowest frequency to search; set from the tuning so low strings (8-string F♯1, D1) are found. */
  setMinFreq(freq: number): void {
    this.opts.minFreq = Math.max(20, freq);
  }

  get a4(): number {
    return this.opts.a4;
  }

  reset(): void {
    this.history = [];
    this.smoothed = null;
    this.inRangeCount = 0;
    this.pendingJump = [];
  }

  /** Analyse one frame. Returns null when no reliable pitch is present. */
  analyse(frame: Float32Array, sampleRate: number): PitchEstimate | null {
    if (!this.scratch || this.scratch.length !== frame.length) this.scratch = new Float32Array(frame.length);
    this.scratch.set(frame);
    highPass(this.scratch, sampleRate, 25);
    const est = yin(this.scratch, sampleRate, { threshold: 0.15, minFreq: this.opts.minFreq, maxFreq: this.opts.maxFreq });
    if (!est) return null;
    if (toDb(est.rms) < this.opts.noiseGateDb) return null;
    if (est.probability < this.opts.minProbability) return null;
    return est;
  }

  /**
   * Process a frame and update the smoothed reading.
   * @param strings MIDI notes of the active tuning (lowest first)
   * @param manualString index of a manually selected string, if any
   */
  process(frame: Float32Array, sampleRate: number, strings: number[] = [], manualString?: number): TunerReading | null {
    const est = this.analyse(frame, sampleRate);
    if (!est) {
      // Let the needle rest after a short silence, but keep history briefly for sustain gaps.
      this.inRangeCount = 0;
      if (this.history.length) this.history.shift();
      if (!this.history.length) this.smoothed = null;
      return null;
    }
    const m = freqToMidiA4(est.freq, this.opts.a4);

    // Outlier / new-note handling: a jump of more than 70 cents is accepted only
    // after it repeats for 2 frames (rejects octave glitches and pick noise).
    if (this.smoothed !== null && Math.abs(m - this.smoothed) > 0.7) {
      this.pendingJump.push(m);
      const n = this.pendingJump.length;
      const confirmed = n >= 2 && Math.abs(this.pendingJump[n - 1] - this.pendingJump[n - 2]) <= 0.5;
      if (!confirmed) {
        if (n > 3) this.pendingJump = this.pendingJump.slice(-1);
        return this.reading(est, strings, manualString);
      }
      this.history = this.pendingJump.slice(-2);
      this.smoothed = median(this.history);
      this.pendingJump = [];
      this.inRangeCount = 0;
    } else {
      this.pendingJump = [];
      this.history.push(m);
      if (this.history.length > 5) this.history.shift();
      const med = median(this.history);
      this.smoothed = this.smoothed === null ? med : this.smoothed + 0.35 * (med - this.smoothed);
    }
    return this.reading(est, strings, manualString);
  }

  private reading(est: PitchEstimate, strings: number[], manualString?: number): TunerReading | null {
    if (this.smoothed === null) return null;
    const midiFloat = this.smoothed;
    const midi = Math.round(midiFloat);
    const { note, octave } = noteNameOf(midi);
    const cents = (midiFloat - midi) * 100;
    let target: TunerReading['target'];
    let refCents = cents;
    if (strings.length) {
      const s = matchString(midiFloat, strings, manualString);
      const tn = noteNameOf(strings[s.index]);
      target = { index: s.index, midi: strings[s.index], note: tn.note, octave: tn.octave, freq: midiToFreqA4(strings[s.index], this.opts.a4), cents: s.cents, octaveHint: s.octaveHint };
      refCents = s.octaveHint ? cents : s.cents;
    }
    const inRange = Math.abs(refCents) <= this.opts.inTuneCents;
    this.inRangeCount = inRange ? this.inRangeCount + 1 : 0;
    const locked = this.inRangeCount >= this.opts.inTuneFrames;
    return {
      freq: midiToFreqA4(midiFloat, this.opts.a4),
      midiFloat,
      midi,
      note,
      octave,
      cents,
      confidence: est.probability,
      levelDb: toDb(est.rms),
      target,
      status: inRange ? 'in-tune' : refCents < 0 ? 'flat' : 'sharp',
      locked,
    };
  }
}
