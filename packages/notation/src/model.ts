/**
 * Structured guitar-tablature model. This is the native format: it keeps rhythm,
 * techniques, tuning and string count. ASCII tab is an import/export view of it.
 */

export type Technique =
  | 'hammer' | 'pull' | 'slideUp' | 'slideDown' | 'slideIn' | 'slideOut'
  | 'bend' | 'prebend' | 'release' | 'vibrato'
  | 'palmMute' | 'harmonic' | 'artificialHarmonic' | 'tap' | 'tremolo' | 'trill'
  | 'ghost' | 'dead' | 'letRing' | 'accent';

export const TECHNIQUES: { id: Technique; label: string; ascii: string; description: string }[] = [
  { id: 'hammer', label: 'Hammer-on', ascii: 'h', description: 'Sound the note by hammering a fret-hand finger onto the string (no pick attack).' },
  { id: 'pull', label: 'Pull-off', ascii: 'p', description: 'Pluck the string with the fret-hand finger as it pulls off to a lower fretted note or open string.' },
  { id: 'slideUp', label: 'Slide up', ascii: '/', description: 'Slide to a higher fret on the same string without re-picking.' },
  { id: 'slideDown', label: 'Slide down', ascii: '\\', description: 'Slide to a lower fret on the same string.' },
  { id: 'slideIn', label: 'Slide in', ascii: '/n', description: 'Slide into the note from a few frets below.' },
  { id: 'slideOut', label: 'Slide out', ascii: 'n\\', description: 'Slide away from the note after it sounds.' },
  { id: 'bend', label: 'Bend', ascii: 'b', description: 'Push the string to raise the pitch. Amounts are written in whole steps: ½ = one fret higher, full = two frets higher.' },
  { id: 'prebend', label: 'Pre-bend', ascii: 'pb', description: 'Bend the string first, then pick it already bent.' },
  { id: 'release', label: 'Release', ascii: 'r', description: 'Let a bent string return to its unbent pitch while it rings.' },
  { id: 'vibrato', label: 'Vibrato', ascii: '~', description: 'Rhythmically bend and release slightly to make the note sing.' },
  { id: 'palmMute', label: 'Palm mute', ascii: 'PM', description: 'Rest the edge of the picking hand on the strings by the bridge for a tight, percussive sound.' },
  { id: 'harmonic', label: 'Natural harmonic', ascii: '<n>', description: 'Touch the string lightly directly over the fret wire (12, 7, 5) and pick.' },
  { id: 'artificialHarmonic', label: 'Artificial / pinch harmonic', ascii: '[n]', description: 'Graze the string with the thumb edge just after picking to bring out an overtone.' },
  { id: 'tap', label: 'Tap', ascii: 't', description: 'Hammer the note with a picking-hand finger.' },
  { id: 'tremolo', label: 'Tremolo picking', ascii: 'tp', description: 'Pick the note as rapidly and evenly as possible.' },
  { id: 'trill', label: 'Trill', ascii: 'tr', description: 'Rapidly alternate hammer-ons and pull-offs between two frets.' },
  { id: 'ghost', label: 'Ghost note', ascii: '(n)', description: 'A very quiet, implied note.' },
  { id: 'dead', label: 'Dead note', ascii: 'x', description: 'A muted, pitchless percussive hit.' },
  { id: 'letRing', label: 'Let ring', ascii: 'LR', description: 'Hold the notes down so they sustain into each other.' },
  { id: 'accent', label: 'Accent', ascii: '>', description: 'Play the note louder than those around it.' },
];

export type Duration = 1 | 2 | 4 | 8 | 16 | 32;

export interface TabNote {
  /** String index, 0 = lowest-pitched string. */
  string: number;
  fret: number;
  techniques?: Technique[];
  /**
   * Bend amount in WHOLE STEPS, as written in notation:
   * 0.25 = quarter-tone, 0.5 = half step (1 semitone), 1 = full (2 semitones), 1.5, 2.
   */
  bend?: number;
  /** Second fret for trills. */
  trillFret?: number;
}

export interface TabBeat {
  duration: Duration;
  dotted?: boolean;
  triplet?: boolean;
  notes: TabNote[];
  rest?: boolean;
  /** Optional chord label shown above the beat. */
  chord?: string;
}

export interface TabMeasure {
  beats: TabBeat[];
  repeatStart?: boolean;
  /** Number of times to play when this measure closes a repeat. */
  repeatEnd?: number;
}

export interface TabScore {
  format: 'gma-tab';
  version: 1;
  title: string;
  tuning: { name: string; strings: number[] };
  tempo: number;
  timeSignature: [number, number];
  measures: TabMeasure[];
}

export const MAX_FRET = 30;

/** Length of a beat in quarter notes. */
export function beatLength(b: Pick<TabBeat, 'duration' | 'dotted' | 'triplet'>): number {
  let len = 4 / b.duration;
  if (b.dotted) len *= 1.5;
  if (b.triplet) len *= 2 / 3;
  return len;
}

/** Capacity of a measure in quarter notes. */
export function measureCapacity(ts: [number, number]): number {
  return (ts[0] * 4) / ts[1];
}

export function measureLength(m: TabMeasure): number {
  return m.beats.reduce((a, b) => a + beatLength(b), 0);
}

export function emptyScore(strings: number[], tuningName = 'E Standard', title = 'Untitled exercise'): TabScore {
  return {
    format: 'gma-tab', version: 1, title,
    tuning: { name: tuningName, strings: [...strings] },
    tempo: 90,
    timeSignature: [4, 4],
    measures: [{ beats: [] }],
  };
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
  measure?: number;
  beat?: number;
}

const DURATIONS: Duration[] = [1, 2, 4, 8, 16, 32];
const TECHNIQUE_IDS = new Set(TECHNIQUES.map((t) => t.id));

/** Validate a score (structure and musical sanity). Errors block saving; warnings do not. */
export function validateScore(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (message: string, measure?: number, beat?: number) => issues.push({ level: 'error', message, measure, beat });
  const warn = (message: string, measure?: number, beat?: number) => issues.push({ level: 'warning', message, measure, beat });
  const s = input as Partial<TabScore>;
  if (!s || typeof s !== 'object') return [{ level: 'error', message: 'Not a tab document.' }];
  if (s.format !== 'gma-tab') err('Missing format marker "gma-tab".');
  if (s.version !== 1) err('Unsupported version (expected 1).');
  if (typeof s.title !== 'string' || !s.title.trim()) err('Title is required.');
  if (!s.tuning || !Array.isArray(s.tuning.strings) || s.tuning.strings.length < 4 || s.tuning.strings.length > 9 || !s.tuning.strings.every((m) => Number.isInteger(m) && m >= 12 && m <= 88))
    err('Tuning must list 4–9 strings as MIDI numbers.');
  if (typeof s.tempo !== 'number' || s.tempo < 20 || s.tempo > 400) err('Tempo must be between 20 and 400 bpm.');
  if (!Array.isArray(s.timeSignature) || s.timeSignature.length !== 2 || !(s.timeSignature[0] >= 1 && s.timeSignature[0] <= 32) || ![1, 2, 4, 8, 16].includes(s.timeSignature[1]))
    err('Time signature must be like [4, 4] or [7, 8].');
  if (!Array.isArray(s.measures) || s.measures.length === 0) err('At least one measure is required.');
  if (issues.some((i) => i.level === 'error')) return issues;
  const strings = s.tuning!.strings.length;
  const cap = measureCapacity(s.timeSignature as [number, number]);
  s.measures!.forEach((m, mi) => {
    if (!m || !Array.isArray(m.beats)) { err('Measure has no beat list.', mi); return; }
    m.beats.forEach((b, bi) => {
      if (!DURATIONS.includes(b.duration)) err('Invalid note duration.', mi, bi);
      if (!Array.isArray(b.notes)) { err('Beat has no note list.', mi, bi); return; }
      const used = new Set<number>();
      b.notes.forEach((n) => {
        if (!Number.isInteger(n.string) || n.string < 0 || n.string >= strings) err(`Note on string ${n.string + 1} does not exist on a ${strings}-string guitar.`, mi, bi);
        if (!Number.isInteger(n.fret) || n.fret < 0 || n.fret > MAX_FRET) err(`Fret ${n.fret} is out of range (0–${MAX_FRET}).`, mi, bi);
        if (used.has(n.string)) err('Two notes on the same string in one beat.', mi, bi);
        used.add(n.string);
        (n.techniques ?? []).forEach((t) => { if (!TECHNIQUE_IDS.has(t)) err(`Unknown technique "${t}".`, mi, bi); });
        if (n.bend !== undefined && (n.bend <= 0 || n.bend > 2)) err('Bend amount must be between ¼ and 2 whole steps.', mi, bi);
      });
    });
    const len = measureLength(m);
    if (len > cap + 1e-6) warn(`Measure ${mi + 1} is too long (${len.toFixed(2)} of ${cap} beats).`, mi);
    else if (len < cap - 1e-6 && mi < s.measures!.length - 1 && m.beats.length) warn(`Measure ${mi + 1} is incomplete (${len.toFixed(2)} of ${cap} beats).`, mi);
  });
  return issues;
}

export interface PlaybackNote {
  /** Start in quarter-note beats. */
  time: number;
  /** Duration in quarter-note beats. */
  duration: number;
  midi: number;
  string: number;
  fret: number;
  techniques: Technique[];
  bend?: number;
  measure: number;
}

/** Flatten a score into timed notes, expanding repeats. */
export function toPlayback(score: TabScore): PlaybackNote[] {
  const order: number[] = [];
  let repeatFrom = 0;
  score.measures.forEach((m, i) => {
    if (m.repeatStart) repeatFrom = i;
    order.push(i);
    if (m.repeatEnd && m.repeatEnd > 1) {
      for (let k = 1; k < m.repeatEnd; k++) for (let j = repeatFrom; j <= i; j++) order.push(j);
      repeatFrom = i + 1;
    }
  });
  const out: PlaybackNote[] = [];
  let t = 0;
  for (const mi of order) {
    const m = score.measures[mi];
    for (const b of m.beats) {
      const len = beatLength(b);
      if (!b.rest)
        for (const n of b.notes) {
          const tech = n.techniques ?? [];
          out.push({
            time: t, duration: len, midi: score.tuning.strings[n.string] + n.fret + (tech.includes('prebend') ? Math.round((n.bend ?? 0) * 2) : 0),
            string: n.string, fret: n.fret, techniques: tech, bend: n.bend, measure: mi,
          });
        }
      t += len;
    }
  }
  return out;
}

/** Total duration in quarter-note beats (with repeats). */
export function scoreLength(score: TabScore): number {
  const notes = toPlayback(score);
  if (!notes.length) return score.measures.reduce((a, m) => a + measureLength(m), 0);
  const last = notes[notes.length - 1];
  return Math.max(last.time + last.duration, score.measures.reduce((a, m) => a + measureLength(m), 0));
}

export function cloneScore(score: TabScore): TabScore {
  return JSON.parse(JSON.stringify(score));
}

/** Expected MIDI pitches of a monophonic score, in order (for the Playing Analyzer). */
export function monophonicPitches(score: TabScore): number[] {
  const notes = toPlayback(score);
  const byTime = new Map<number, number>();
  for (const n of notes) if (!n.techniques.includes('dead') && !byTime.has(n.time)) byTime.set(n.time, n.midi);
  return [...byTime.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}

/** Note start times in quarter-note beats (one per beat that has notes). */
export function onsetBeats(score: TabScore): number[] {
  const times = new Set(toPlayback(score).filter((n) => !n.techniques.includes('hammer') && !n.techniques.includes('pull') && !n.techniques.includes('slideUp') && !n.techniques.includes('slideDown')).map((n) => n.time));
  return [...times].sort((a, b) => a - b);
}
