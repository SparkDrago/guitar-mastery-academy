/**
 * Chart-to-recording synchronisation.
 *
 * Convention (shared with Play mode): chartTime = audioTime + offset. A note
 * charted at t sounds in the recording at t - offset.
 *
 * Rocksmith-style charts are authored against their recording, so offset 0
 * is the prior. The estimator checks that against the audio: it builds an
 * onset envelope of the recording and slides the chart's note times over it,
 * scoring how much attack energy lines up. It keeps 0 unless a different
 * shift is clearly better, and reports a confidence so the UI can say when to
 * adjust by hand.
 */

/** Onset strength per hop: half-wave-rectified rise in log energy of a high-passed signal, with the local mean removed. */
export function onsetEnvelope(samples: Float32Array, sampleRate: number, hopSec = 0.01): Float32Array {
  // Fractional hop, so frame f starts exactly at f × hopSec (no drift over a long song).
  const hop = sampleRate * hopSec;
  const frames = Math.floor(samples.length / hop);
  const energy = new Float32Array(frames);
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const start = Math.round(f * hop), end = Math.min(samples.length, Math.round((f + 1) * hop));
    for (let i = start; i < end; i++) {
      const x = samples[i];
      const d = x - prev; // first difference: emphasises attacks over sustained low end
      prev = x;
      e += d * d;
    }
    energy[f] = Math.log1p(1000 * (e / Math.max(1, end - start)));
  }
  const rise = new Float32Array(frames);
  for (let f = 1; f < frames; f++) rise[f] = Math.max(0, energy[f] - energy[f - 1]);
  // Remove the local mean (≈ 0.5 s window) so loud passages do not dominate.
  const w = Math.max(1, Math.round(0.25 / hopSec));
  const out = new Float32Array(frames);
  let acc = 0;
  for (let f = 0; f < Math.min(frames, w); f++) acc += rise[f];
  for (let f = 0; f < frames; f++) {
    if (f + w < frames) acc += rise[f + w];
    if (f - w - 1 >= 0) acc -= rise[f - w - 1];
    const n = Math.min(frames - 1, f + w) - Math.max(0, f - w) + 1;
    out[f] = Math.max(0, rise[f] - acc / n);
  }
  return out;
}

/** Minimum rise in log energy that counts as an attack. */
const ONSET_FLOOR = 0.5;

export interface OffsetEstimate {
  /** Seconds to add to the audio clock (chartTime = audioTime + offset). */
  offset: number;
  /** Robust z-score of the chosen shift against all shifts tried (≥ 4 is a clear match). */
  confidence: number;
  /** Alignment score at offset 0 relative to the best score (1 = as good as the best). */
  zeroRatio: number;
  method: 'chart' | 'onsets' | 'none';
  /** Another shift fits almost as well (a strictly repetitive part): check by ear. */
  ambiguous?: boolean;
}

export function estimateOffset(env: Float32Array, hopSec: number, noteTimes: number[], opts: { maxShift?: number; preferZeroWithin?: number } = {}): OffsetEstimate {
  const maxShift = opts.maxShift ?? 8;
  const preferZero = opts.preferZeroWithin ?? 0.9;
  const times = [...new Set(noteTimes.map((t) => Math.round(t / hopSec)))].sort((a, b) => a - b);
  if (times.length < 8 || env.length < 100) return { offset: 0, confidence: 0, zeroRatio: 1, method: 'none' };
  // Widen each onset by ±2 hops (timing jitter in charts and detection).
  const wide = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) {
    let m = 0;
    for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < env.length && env[j] > m) m = env[j]; }
    wide[i] = m;
  }
  const maxLag = Math.round(maxShift / hopSec);
  const scores = new Float32Array(2 * maxLag + 1);
  for (let li = 0; li < scores.length; li++) {
    const lag = li - maxLag; // offset in hops
    let s = 0;
    for (const t of times) {
      const j = t - lag;
      if (j >= 0 && j < wide.length) s += wide[j];
    }
    scores[li] = s;
  }
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  // Repetitive rhythms score almost as well one beat or bar away: among near-ties, take the smallest shift
  // and say that the result is ambiguous.
  const top = scores[best];
  let ambiguous = false;
  for (let i = 1; i < scores.length - 1; i++) {
    const isPeak = scores[i] >= scores[i - 1] && scores[i] >= scores[i + 1];
    if (!isPeak || scores[i] < top * 0.97 || Math.abs(i - best) <= 5) continue;
    ambiguous = true;
    if (Math.abs(i - maxLag) < Math.abs(best - maxLag)) best = i;
  }
  // The ±2-hop widening makes a plateau around the true shift: take its centre.
  let lo = best, hi = best;
  while (lo > 0 && scores[lo - 1] >= scores[best] * 0.98) lo--;
  while (hi < scores.length - 1 && scores[hi + 1] >= scores[best] * 0.98) hi++;
  const centre = Math.round((lo + hi) / 2);
  const sorted = Float32Array.from(scores).sort();
  const median = sorted[sorted.length >> 1];
  const mad = Float32Array.from(scores.map((s) => Math.abs(s - median))).sort()[scores.length >> 1] * 1.4826 + 1e-9;
  const z = Math.min(99, (scores[best] - median) / mad);
  const zero = scores[maxLag];
  const zeroRatio = scores[best] > 0 ? zero / scores[best] : 1;
  // Absolute check: at the best shift, enough charted notes must land on a real attack.
  const lag = centre - maxLag;
  let hits = 0;
  for (const t of times) { const j = t - lag; if (j >= 0 && j < wide.length && wide[j] >= ONSET_FLOOR) hits++; }
  const hitRatio = hits / times.length;
  if (scores[best] <= 0 || z < 3 || hitRatio < 0.3) return { offset: 0, confidence: Math.min(z, hitRatio * 10), zeroRatio, method: 'none' };
  if (zeroRatio >= preferZero || Math.abs(lag) <= 3) return { offset: 0, confidence: z, zeroRatio, method: 'chart', ambiguous };
  return { offset: lag * hopSec, confidence: z, zeroRatio, method: 'onsets', ambiguous };
}

export interface LengthCheck {
  /** audio duration − declared song length, seconds (undefined when either is unknown). */
  difference?: number;
  verdict: 'match' | 'close' | 'mismatch' | 'unknown';
  message: string;
}

/** Compares the recording's length with the chart's declared length. */
export function checkLengths(audioDuration: number | undefined, songLength: number | undefined, chartEnd: number): LengthCheck {
  if (!audioDuration) return { verdict: 'unknown', message: 'Recording length unknown.' };
  if (chartEnd > audioDuration + 1) {
    return { difference: audioDuration - chartEnd, verdict: 'mismatch', message: `The chart has notes until ${fmt(chartEnd)} but the recording ends at ${fmt(audioDuration)}: it may be a preview clip or a different version.` };
  }
  if (!songLength) return { verdict: 'unknown', message: `Recording is ${fmt(audioDuration)}; the chart declares no length.` };
  const d = audioDuration - songLength;
  if (Math.abs(d) <= 0.5) return { difference: d, verdict: 'match', message: `Recording length matches the chart (${fmt(audioDuration)}).` };
  if (Math.abs(d) <= 5) return { difference: d, verdict: 'close', message: `Recording is ${Math.abs(d).toFixed(1)} s ${d > 0 ? 'longer' : 'shorter'} than the chart declares.` };
  return { difference: d, verdict: 'mismatch', message: `Recording (${fmt(audioDuration)}) and chart (${fmt(songLength)}) lengths differ by ${Math.abs(d).toFixed(0)} s: check that it is the same version of the song.` };
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
