/**
 * Metronome timing model (framework- and Web-Audio-independent).
 * Beat times are computed by multiplication from a fixed start time, never by
 * repeated addition, so there is no cumulative drift.
 */

export type AccentLevel = 0 | 1 | 2 | 3; // 0 = silent, 1 = subdivision, 2 = beat, 3 = accent

export interface MetronomeConfig {
  bpm: number;
  beatsPerBar: number;
  /** Note value that gets the beat: 4 = quarter, 8 = eighth (for 6/8, 12/8 felt in eighths). */
  beatUnit: number;
  /** Clicks per beat: 1 quarter, 2 eighths, 3 triplets, 4 sixteenths. */
  subdivision: number;
  /** Accent level for each beat of the bar (length = beatsPerBar). */
  accents: AccentLevel[];
  /** Swing ratio for subdivision 2 (0.5 = straight, 0.667 = triplet swing). */
  swing?: number;
}

export interface ClickEvent {
  time: number;
  bar: number;
  beat: number;
  sub: number;
  level: AccentLevel;
}

export const BPM_MIN = 20;
export const BPM_MAX = 400;

export function clampBpm(bpm: number): number {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
}

export function defaultAccents(beatsPerBar: number): AccentLevel[] {
  return Array.from({ length: beatsPerBar }, (_, i) => (i === 0 ? 3 : 2) as AccentLevel);
}

/** Seconds per beat. */
export function beatDuration(bpm: number): number {
  return 60 / bpm;
}

/** Time of the n-th click (0-based) counted from `start`. */
export function clickTime(cfg: MetronomeConfig, start: number, n: number): number {
  const spb = beatDuration(cfg.bpm);
  const beatIndex = Math.floor(n / cfg.subdivision);
  const sub = n % cfg.subdivision;
  let offset = (sub / cfg.subdivision) * spb;
  if (cfg.subdivision === 2 && sub === 1 && cfg.swing && cfg.swing !== 0.5) offset = cfg.swing * spb;
  return start + beatIndex * spb + offset;
}

export function clickAt(cfg: MetronomeConfig, start: number, n: number): ClickEvent {
  const beatIndex = Math.floor(n / cfg.subdivision);
  const sub = n % cfg.subdivision;
  const bar = Math.floor(beatIndex / cfg.beatsPerBar);
  const beat = beatIndex % cfg.beatsPerBar;
  const beatLevel = cfg.accents[beat] ?? 2;
  const level: AccentLevel = sub === 0 ? beatLevel : beatLevel === 0 ? 0 : 1;
  return { time: clickTime(cfg, start, n), bar, beat, sub, level };
}

/**
 * Lookahead scheduler step: returns every click with time < `until`,
 * starting from click index `next`. The caller stores the returned `next`.
 */
export function scheduleUntil(cfg: MetronomeConfig, start: number, next: number, until: number): { events: ClickEvent[]; next: number } {
  const events: ClickEvent[] = [];
  let n = next;
  while (clickTime(cfg, start, n) < until) {
    events.push(clickAt(cfg, start, n));
    n++;
    if (events.length > 2000) break;
  }
  return { events, next: n };
}

/** Tap tempo: BPM from tap timestamps (ms). Uses the median interval of the last taps. */
export function tapTempo(tapsMs: number[]): number | null {
  const recent = tapsMs.slice(-8);
  if (recent.length < 2) return null;
  const intervals = recent.slice(1).map((t, i) => t - recent[i]).filter((d) => d > 150 && d < 3000);
  if (!intervals.length) return null;
  const sorted = [...intervals].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  return clampBpm(60000 / med);
}

export interface MetronomePreset {
  id: string;
  name: string;
  config: Omit<MetronomeConfig, 'accents'> & { accents?: AccentLevel[] };
  note: string;
}

export const METRONOME_PRESETS: MetronomePreset[] = [
  { id: 'slow-quarters', name: 'Slow quarters', config: { bpm: 60, beatsPerBar: 4, beatUnit: 4, subdivision: 1 }, note: 'First notes and chord changes.' },
  { id: 'eighths-80', name: 'Eighth notes @ 80', config: { bpm: 80, beatsPerBar: 4, beatUnit: 4, subdivision: 2 }, note: 'Alternate-picking foundation.' },
  { id: 'sixteenths-90', name: 'Sixteenths @ 90', config: { bpm: 90, beatsPerBar: 4, beatUnit: 4, subdivision: 4 }, note: 'Picking speed building.' },
  { id: 'triplets-70', name: 'Triplets @ 70', config: { bpm: 70, beatsPerBar: 4, beatUnit: 4, subdivision: 3 }, note: 'Shuffle and triplet feel.' },
  { id: 'shuffle-90', name: 'Shuffle @ 90', config: { bpm: 90, beatsPerBar: 4, beatUnit: 4, subdivision: 2, swing: 0.667 }, note: 'Blues shuffle feel.' },
  { id: 'waltz', name: '3/4 waltz', config: { bpm: 96, beatsPerBar: 3, beatUnit: 4, subdivision: 1 }, note: 'Three beats per bar.' },
  { id: 'twelve-eight', name: '12/8 slow blues', config: { bpm: 54, beatsPerBar: 4, beatUnit: 4, subdivision: 3 }, note: 'Four dotted-quarter beats, each split in three.' },
  { id: 'five-four', name: '5/4', config: { bpm: 100, beatsPerBar: 5, beatUnit: 4, subdivision: 1, accents: [3, 2, 2, 3, 2] }, note: 'Odd meter grouped 3+2.' },
  { id: 'seven-eight', name: '7/8 (2+2+3)', config: { bpm: 180, beatsPerBar: 7, beatUnit: 8, subdivision: 1, accents: [3, 1, 2, 1, 2, 1, 1] }, note: 'Prog-metal odd meter.' },
  { id: 'metal-gallop', name: 'Gallop @ 140', config: { bpm: 140, beatsPerBar: 4, beatUnit: 4, subdivision: 4 }, note: 'Metal gallop rhythms on sixteenths.' },
];
