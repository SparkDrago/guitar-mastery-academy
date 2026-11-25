/**
 * Chroma (pitch-class profile) analysis for chord recognition and for scoring
 * chords in Play mode. Monophonic pitch uses YIN (see yin.ts); chords need the
 * energy of all 12 pitch classes at once.
 */
import { fft } from './analysis';

export interface ChromaOptions {
  minHz?: number;
  maxHz?: number;
  a4?: number;
}

/** 12-bin pitch-class energy profile of one frame, normalised so the largest bin is 1 (all zeros for silence). */
export function chroma(frame: Float32Array, sampleRate: number, opts: ChromaOptions = {}): Float32Array {
  const minHz = opts.minHz ?? 70;
  const maxHz = opts.maxHz ?? 2100;
  const a4 = opts.a4 ?? 440;
  let n = 1;
  while (n * 2 <= frame.length) n *= 2;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  let energy = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    re[i] = frame[i] * w;
    energy += frame[i] * frame[i];
  }
  const out = new Float32Array(12);
  if (energy / n < 1e-7) return out;
  fft(re, im);
  const binHz = sampleRate / n;
  const lo = Math.max(1, Math.floor(minHz / binHz));
  const hi = Math.min(n / 2 - 1, Math.ceil(maxHz / binHz));
  const mags = new Float32Array(hi + 1);
  for (let k = lo; k <= hi; k++) mags[k] = Math.hypot(re[k], im[k]);
  // Only spectral peaks contribute; this suppresses leakage between neighbouring bins.
  for (let k = lo + 1; k < hi; k++) {
    const m = mags[k];
    if (m <= mags[k - 1] || m < mags[k + 1]) continue;
    // Parabolic interpolation of the peak frequency.
    const a = mags[k - 1], b = m, c = mags[k + 1];
    const p = (a - 2 * b + c) !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
    const f = (k + p) * binHz;
    const midi = 69 + 12 * Math.log2(f / a4);
    const nearest = Math.round(midi);
    if (Math.abs(midi - nearest) > 0.35) continue;
    // Log compression keeps one loud note from swamping quieter chord tones; higher
    // partials are down-weighted because they mostly repeat lower pitch classes.
    const weight = Math.log1p(m * 50) / Math.sqrt(1 + Math.max(0, f - 300) / 600);
    out[((nearest % 12) + 12) % 12] += weight;
  }
  const max = Math.max(...out);
  if (max > 0) for (let i = 0; i < 12; i++) out[i] /= max;
  return out;
}

/** Pitch classes whose chroma energy is at least `threshold` of the strongest. */
export function activePitchClasses(c: Float32Array, threshold = 0.55): number[] {
  const out: number[] = [];
  for (let i = 0; i < 12; i++) if (c[i] >= threshold) out.push(i);
  return out;
}

/**
 * How well a frame matches an expected chord. `coverage` is the share of expected
 * pitch classes that are clearly present; `contrast` compares expected and other bins.
 */
export function matchChroma(c: Float32Array, expected: number[], opts: { presentAt?: number } = {}): { coverage: number; contrast: number; matched: boolean } {
  const exp = [...new Set(expected.map((p) => ((p % 12) + 12) % 12))];
  if (!exp.length || Math.max(...c) === 0) return { coverage: 0, contrast: 0, matched: false };
  const presentAt = opts.presentAt ?? 0.35;
  const present = exp.filter((p) => c[p] >= presentAt).length;
  const others = [...Array(12).keys()].filter((p) => !exp.includes(p));
  const meanExp = exp.reduce((a, p) => a + c[p], 0) / exp.length;
  const meanOther = others.length ? others.reduce((a, p) => a + c[p], 0) / others.length : 0;
  const coverage = present / exp.length;
  const contrast = meanExp / (meanOther + 0.05);
  // Allow one missing tone in chords of three or more notes (e.g. an unplayed 5th).
  const need = exp.length >= 3 ? exp.length - 1 : exp.length;
  return { coverage, contrast, matched: present >= need && contrast > 1.6 };
}
