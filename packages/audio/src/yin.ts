/**
 * YIN fundamental-frequency estimator (de Cheveigné & Kawahara, 2002).
 *
 * Steps: squared-difference function → cumulative mean normalised difference
 * (CMND) → absolute threshold → local-minimum search → parabolic interpolation.
 * Pure TypeScript, no Web Audio dependency, so it runs in tests and workers.
 */

export interface PitchEstimate {
  /** Fundamental frequency in Hz. */
  freq: number;
  /** 1 − CMND at the chosen lag: ~1 for a clean periodic tone, low for noise. */
  probability: number;
  /** Root-mean-square level of the analysed frame (linear, 0..1). */
  rms: number;
}

export interface YinOptions {
  /** CMND threshold; lower is stricter. 0.10–0.20 suits guitar. */
  threshold?: number;
  minFreq?: number;
  maxFreq?: number;
}

export function rms(buf: Float32Array | number[]): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, buf.length));
}

export function toDb(linear: number): number {
  return linear <= 0 ? -Infinity : 20 * Math.log10(linear);
}

/**
 * Estimate the pitch of a mono frame. Returns null if the frame is silent or
 * too short for the requested minimum frequency.
 */
export function yin(buf: Float32Array, sampleRate: number, opts: YinOptions = {}): PitchEstimate | null {
  const threshold = opts.threshold ?? 0.15;
  const minFreq = opts.minFreq ?? 30;
  const maxFreq = opts.maxFreq ?? 1500;
  const level = rms(buf);
  if (level < 1e-5) return null;

  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreq));
  const tauMax = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2));
  if (tauMax <= tauMin + 2) return null;
  const W = buf.length - tauMax;

  const diff = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const d = buf[j] - buf[j + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += diff[tau];
    cmnd[tau] = running > 0 ? (diff[tau] * tau) / running : 1;
  }

  let tauEst = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEst = tau;
      break;
    }
  }
  if (tauEst < 0) {
    // No dip under the threshold: report the global minimum with its (low) probability.
    let best = tauMin;
    for (let tau = tauMin + 1; tau <= tauMax; tau++) if (cmnd[tau] < cmnd[best]) best = tau;
    tauEst = best;
  }

  let refined = tauEst;
  if (tauEst > 1 && tauEst < tauMax) {
    const s0 = cmnd[tauEst - 1];
    const s1 = cmnd[tauEst];
    const s2 = cmnd[tauEst + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) refined = tauEst + (s2 - s0) / denom;
  }
  return { freq: sampleRate / refined, probability: Math.max(0, Math.min(1, 1 - cmnd[tauEst])), rms: level };
}

/** One-pole high-pass filter (DC and rumble removal), in place. */
export function highPass(buf: Float32Array, sampleRate: number, cutoff = 25): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const a = rc / (rc + dt);
  let prevIn = buf[0];
  let prevOut = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = a * (prevOut + x - prevIn);
    prevIn = x;
    prevOut = y;
    buf[i] = y;
  }
  return buf;
}
