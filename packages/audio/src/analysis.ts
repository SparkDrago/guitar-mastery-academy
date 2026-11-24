/**
 * Offline performance analysis for the Playing Analyzer:
 *  - radix-2 FFT
 *  - spectral-flux onset detection
 *  - timing analysis against a metronome grid
 *  - per-note pitch checking with YIN
 *
 * Everything reports only what it measured, with a confidence value, so the UI
 * never shows invented scores.
 */
import { yin } from './yin';

/** In-place iterative radix-2 FFT. `re` and `im` lengths must be a power of two. */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k];
        const ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export interface OnsetOptions {
  frameSize?: number;
  hopSize?: number;
  /** Multiplier over the local median of the flux curve. */
  sensitivity?: number;
  /** Minimum time between onsets, seconds. */
  minInterval?: number;
  /** Absolute floor for the flux (relative to its maximum). */
  floor?: number;
}

export interface Onset {
  time: number;
  strength: number;
}

/** Spectral-flux onset detection on a mono signal. */
export function detectOnsets(signal: Float32Array, sampleRate: number, opts: OnsetOptions = {}): Onset[] {
  const N = opts.frameSize ?? 1024;
  const H = opts.hopSize ?? 256;
  const sensitivity = opts.sensitivity ?? 1.5;
  const minInterval = opts.minInterval ?? 0.06;
  const floorRel = opts.floor ?? 0.08;
  const frames = Math.max(0, Math.floor((signal.length - N) / H) + 1);
  if (frames < 3) return [];
  const window = new Float32Array(N);
  for (let i = 0; i < N; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  let prev = new Float32Array(N / 2);
  const flux = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const off = f * H;
    for (let i = 0; i < N; i++) {
      re[i] = signal[off + i] * window[i];
      im[i] = 0;
    }
    fft(re, im);
    const mag = new Float32Array(N / 2);
    let sum = 0;
    for (let k = 1; k < N / 2; k++) {
      mag[k] = Math.log1p(10 * Math.hypot(re[k], im[k]));
      const d = mag[k] - prev[k];
      if (d > 0) sum += d;
    }
    flux[f] = sum;
    prev = mag;
  }
  let max = 0;
  for (const v of flux) max = Math.max(max, v);
  if (max <= 0) return [];
  const half = 8;
  const onsets: Onset[] = [];
  let lastTime = -Infinity;
  for (let f = 1; f < frames - 1; f++) {
    const lo = Math.max(0, f - half);
    const hi = Math.min(frames, f + half + 1);
    const local = Array.from(flux.slice(lo, hi)).sort((a, b) => a - b);
    const med = local[Math.floor(local.length / 2)];
    const thresh = Math.max(med * sensitivity, floorRel * max);
    if (flux[f] > thresh && flux[f] >= flux[f - 1] && flux[f] >= flux[f + 1]) {
      const time = (f * H + N / 4) / sampleRate;
      if (time - lastTime >= minInterval) {
        onsets.push({ time, strength: flux[f] / max });
        lastTime = time;
      } else if (onsets.length && flux[f] / max > onsets[onsets.length - 1].strength) {
        onsets[onsets.length - 1] = { time, strength: flux[f] / max };
        lastTime = time;
      }
    }
  }
  return onsets;
}

export interface TimingResult {
  /** Number of onsets analysed. */
  onsetCount: number;
  expectedCount: number;
  matched: number;
  missed: number;
  extra: number;
  /** Signed timing errors of matched notes, ms (negative = early). */
  errorsMs: number[];
  meanAbsErrorMs: number;
  meanErrorMs: number;
  stdDevMs: number;
  /** Share of matched notes within ±tightMs. */
  tightRatio: number;
  /** Tempo implied by the played note spacing. */
  playedBpm: number | null;
  /** ms of drift per bar (slope of errors over time). */
  driftMsPerBar: number;
  /** Mean absolute error in the first and last third of the take. */
  earlyVsLate: { firstThirdMs: number; lastThirdMs: number } | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Compare onsets with a metronome grid of `bpm` and `notesPerBeat` notes per beat,
 * starting at `startTime` (seconds), for `expectedCount` notes.
 */
export function analyseTiming(onsets: Onset[], bpm: number, notesPerBeat: number, startTime: number, expectedCount: number, opts: { tightMs?: number; beatsPerBar?: number } = {}): TimingResult {
  const step = 60 / bpm / notesPerBeat;
  const grid = Array.from({ length: expectedCount }, (_, i) => startTime + i * step);
  return analyseTimingGrid(onsets, grid, bpm, { ...opts, notesPerBeat });
}

export interface GridMatch {
  /** Index into the expected grid. */
  index: number;
  /** Time of the matched onset, seconds. */
  onsetTime: number;
  errorMs: number;
}

/**
 * Compare onsets with an arbitrary list of expected note times (seconds, ascending).
 * Used for exercises with rests or mixed rhythms. Each expected note is matched to the
 * nearest unused onset within a tolerance derived from the local note spacing.
 */
export function analyseTimingGrid(onsets: Onset[], grid: number[], bpm: number, opts: { tightMs?: number; beatsPerBar?: number; notesPerBeat?: number } = {}): TimingResult & { matches: GridMatch[] } {
  const tightMs = opts.tightMs ?? 25;
  const beatsPerBar = opts.beatsPerBar ?? 4;
  const expectedCount = grid.length;
  const gaps = grid.slice(1).map((g, i) => g - grid[i]).filter((d) => d > 1e-6);
  const minGap = gaps.length ? Math.min(...gaps) : 60 / bpm;
  const step = opts.notesPerBeat ? 60 / bpm / opts.notesPerBeat : minGap;
  const used = new Set<number>();
  const matches: GridMatch[] = [];
  for (let g = 0; g < grid.length; g++) {
    const prevGap = g > 0 ? grid[g] - grid[g - 1] : Infinity;
    const nextGap = g < grid.length - 1 ? grid[g + 1] - grid[g] : Infinity;
    const local = Math.min(prevGap, nextGap, isFinite(Math.min(prevGap, nextGap)) ? Infinity : 60 / bpm);
    const tolerance = Math.min(local * 0.45, 0.15);
    let best = -1;
    let bestD = Infinity;
    onsets.forEach((o, i) => {
      if (used.has(i)) return;
      const d = Math.abs(o.time - grid[g]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0 && bestD <= tolerance) {
      used.add(best);
      matches.push({ index: g, onsetTime: onsets[best].time, errorMs: (onsets[best].time - grid[g]) * 1000 });
    }
  }
  const errs = matches.map((e) => e.errorMs);
  const mean = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
  const meanAbs = errs.length ? errs.reduce((a, b) => a + Math.abs(b), 0) / errs.length : 0;
  const sd = errs.length > 1 ? Math.sqrt(errs.reduce((a, b) => a + (b - mean) ** 2, 0) / (errs.length - 1)) : 0;
  const edgeTol = Math.min(minGap * 0.45, 0.15);
  const inWindow = grid.length ? onsets.filter((o) => o.time >= grid[0] - edgeTol && o.time <= grid[grid.length - 1] + edgeTol) : [];
  const iois = inWindow.slice(1).map((o, i) => o.time - inWindow[i].time).filter((d) => d > step * 0.5 && d < step * 1.5);
  const medIoi = iois.length ? [...iois].sort((a, b) => a - b)[Math.floor(iois.length / 2)] : 0;
  let drift = 0;
  if (matches.length > 3) {
    const xs = matches.map((e) => grid[e.index] - grid[0]);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const num = xs.reduce((a, x, i) => a + (x - mx) * (errs[i] - mean), 0);
    const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const slopePerSecond = den > 0 ? num / den : 0;
    drift = slopePerSecond * (60 / bpm) * beatsPerBar;
  }
  const third = Math.floor(matches.length / 3);
  const avgAbs = (a: GridMatch[]) => (a.length ? a.reduce((s, e) => s + Math.abs(e.errorMs), 0) / a.length : 0);
  const matched = matches.length;
  const confidence = matched >= 12 ? 'high' : matched >= 6 ? 'medium' : 'low';
  // Uniform grids report the tempo implied by the student's note spacing.
  const uniform = gaps.length > 0 && gaps.every((d) => Math.abs(d - gaps[0]) < 1e-3);
  return {
    onsetCount: inWindow.length,
    expectedCount,
    matched,
    missed: expectedCount - matched,
    extra: Math.max(0, inWindow.length - matched),
    errorsMs: errs,
    meanAbsErrorMs: meanAbs,
    meanErrorMs: mean,
    stdDevMs: sd,
    tightRatio: matched ? errs.filter((e) => Math.abs(e) <= tightMs).length / matched : 0,
    playedBpm: uniform && medIoi > 0 ? (60 / medIoi) * (gaps[0] / (60 / bpm)) : null,
    driftMsPerBar: drift,
    earlyVsLate: third >= 2 ? { firstThirdMs: avgAbs(matches.slice(0, third)), lastThirdMs: avgAbs(matches.slice(-third)) } : null,
    confidence,
    matches,
  };
}

export interface NotePitchCheck {
  time: number;
  expectedMidi: number;
  detectedMidi: number | null;
  centsOff: number | null;
  correct: boolean;
}

/** Check the pitch of each note that starts at the given onset times. */
export function checkPitches(signal: Float32Array, sampleRate: number, onsetTimes: number[], expectedMidi: number[], a4 = 440): NotePitchCheck[] {
  const frame = 2048;
  return onsetTimes.map((t, i) => {
    const start = Math.floor((t + 0.04) * sampleRate);
    const expected = expectedMidi[i % expectedMidi.length];
    if (start + frame > signal.length) return { time: t, expectedMidi: expected, detectedMidi: null, centsOff: null, correct: false };
    const est = yin(signal.subarray(start, start + frame), sampleRate, { minFreq: 40, maxFreq: 1500 });
    if (!est || est.probability < 0.7) return { time: t, expectedMidi: expected, detectedMidi: null, centsOff: null, correct: false };
    const mf = 69 + 12 * Math.log2(est.freq / a4);
    const centsOff = (mf - expected) * 100;
    return { time: t, expectedMidi: expected, detectedMidi: Math.round(mf), centsOff, correct: Math.abs(centsOff) <= 50 };
  });
}

export interface Feedback {
  kind: 'timing' | 'tempo' | 'consistency' | 'pitch' | 'completion';
  severity: 'good' | 'info' | 'warn';
  message: string;
  /** The measurement this statement is based on. */
  evidence: string;
}

/** Turn measurements into plain-language feedback. Only measured facts produce statements. */
export function timingFeedback(r: TimingResult, bpm: number, pitch?: NotePitchCheck[]): Feedback[] {
  const out: Feedback[] = [];
  if (r.matched < 4) {
    out.push({ kind: 'completion', severity: 'info', message: 'Not enough clear note attacks were detected to judge timing. Play closer to the microphone, mute open strings, or use a cleaner tone.', evidence: `${r.matched} of ${r.expectedCount} expected notes matched` });
    return out;
  }
  const completion = r.matched / r.expectedCount;
  if (completion < 0.85)
    out.push({ kind: 'completion', severity: 'warn', message: 'Several expected notes were missing or landed too far from the beat to be matched.', evidence: `${r.missed} of ${r.expectedCount} notes unmatched` });
  if (r.meanAbsErrorMs <= 15)
    out.push({ kind: 'timing', severity: 'good', message: 'Your note attacks are tightly aligned with the click.', evidence: `average error ${r.meanAbsErrorMs.toFixed(0)} ms` });
  else if (r.meanAbsErrorMs <= 30)
    out.push({ kind: 'timing', severity: 'info', message: 'Your timing is close to the click, with some looseness.', evidence: `average error ${r.meanAbsErrorMs.toFixed(0)} ms` });
  else
    out.push({ kind: 'timing', severity: 'warn', message: 'Your note attacks are not consistently aligned with the beat. Slow down by 10–15% and lock in before speeding up.', evidence: `average error ${r.meanAbsErrorMs.toFixed(0)} ms` });
  if (Math.abs(r.meanErrorMs) > 12)
    out.push({ kind: 'timing', severity: 'info', message: r.meanErrorMs < 0 ? 'You tend to play ahead of the beat (rushing).' : 'You tend to play behind the beat (dragging).', evidence: `mean offset ${r.meanErrorMs > 0 ? '+' : ''}${r.meanErrorMs.toFixed(0)} ms` });
  if (r.stdDevMs > 20)
    out.push({ kind: 'consistency', severity: 'warn', message: 'The spacing between your notes is uneven.', evidence: `timing spread (std. dev.) ${r.stdDevMs.toFixed(0)} ms` });
  if (Math.abs(r.driftMsPerBar) > 8)
    out.push({ kind: 'tempo', severity: 'warn', message: r.driftMsPerBar < 0 ? 'Your tempo speeds up over the take.' : 'Your tempo slows down over the take.', evidence: `drift ${r.driftMsPerBar.toFixed(1)} ms per bar` });
  if (r.earlyVsLate && r.earlyVsLate.lastThirdMs > r.earlyVsLate.firstThirdMs * 1.5 && r.earlyVsLate.lastThirdMs > 20)
    out.push({ kind: 'consistency', severity: 'warn', message: 'Your accuracy drops toward the end, a sign of fatigue or tension. Shorten the take or relax your picking hand.', evidence: `first third ${r.earlyVsLate.firstThirdMs.toFixed(0)} ms → last third ${r.earlyVsLate.lastThirdMs.toFixed(0)} ms` });
  if (r.playedBpm && Math.abs(r.playedBpm - bpm) / bpm > 0.04)
    out.push({ kind: 'tempo', severity: 'info', message: `Your note spacing implies about ${Math.round(r.playedBpm)} bpm instead of ${bpm}.`, evidence: 'median time between notes' });
  if (pitch && pitch.length) {
    const measured = pitch.filter((p) => p.detectedMidi !== null);
    if (measured.length >= 4) {
      const acc = measured.filter((p) => p.correct).length / measured.length;
      out.push(acc >= 0.9
        ? { kind: 'pitch', severity: 'good', message: 'The pitches you played match the exercise.', evidence: `${Math.round(acc * 100)}% of measured notes correct` }
        : { kind: 'pitch', severity: 'warn', message: 'Some notes did not match the expected pitches. Check fingering and fret placement.', evidence: `${Math.round(acc * 100)}% of measured notes correct (${measured.length} measured)` });
    }
  }
  return out;
}
