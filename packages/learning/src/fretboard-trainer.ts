/**
 * Fretboard Intelligence Trainer: question generation, answer checking,
 * adaptive difficulty and weakness analytics. Works for any tuning and
 * string count because every calculation goes through the theory engine.
 */
import {
  SEMITONE_INTERVALS, buildChord, buildScale, isNaturalPc, midiAt, mod, noteName, pcName, positionsOfPc,
  type Tuning,
} from '@gma/theory';
import type { TrainerAttempt, TrainerMode } from './types';

export interface TrainerStage {
  stage: number;
  name: string;
  minFret: number;
  maxFret: number;
  naturalsOnly: boolean;
}

export const TRAINER_STAGES: TrainerStage[] = [
  { stage: 1, name: 'Open strings & frets 0–5, natural notes', minFret: 0, maxFret: 5, naturalsOnly: true },
  { stage: 2, name: 'Frets 0–5, all notes', minFret: 0, maxFret: 5, naturalsOnly: false },
  { stage: 3, name: 'Frets 0–12, natural notes', minFret: 0, maxFret: 12, naturalsOnly: true },
  { stage: 4, name: 'Frets 0–12, all notes', minFret: 0, maxFret: 12, naturalsOnly: false },
  { stage: 5, name: 'Whole neck (0–22), all notes', minFret: 0, maxFret: 22, naturalsOnly: false },
];

export const TRAINER_MODES: { id: TrainerMode; name: string; description: string; minStage: number }[] = [
  { id: 'note-id', name: 'Name the note', description: 'A position lights up. Name the note.', minStage: 1 },
  { id: 'find-note', name: 'Find the note', description: 'Click any position of the named note.', minStage: 1 },
  { id: 'string-nav', name: 'Note on a string', description: 'Find the named note on a specific string.', minStage: 1 },
  { id: 'find-all', name: 'Find every occurrence', description: 'Click all positions of a note within the range.', minStage: 2 },
  { id: 'octaves', name: 'Octave shapes', description: 'Click the octaves of the highlighted note.', minStage: 2 },
  { id: 'interval-find', name: 'Find the interval', description: 'Click the note a given interval above the root.', minStage: 3 },
  { id: 'interval-id', name: 'Name the interval', description: 'Two positions light up. Name the interval.', minStage: 3 },
  { id: 'degree-id', name: 'Scale degree', description: 'In a given key, name the scale degree of the highlighted note.', minStage: 3 },
  { id: 'chord-tones', name: 'Chord tones', description: 'Click every root, 3rd and 5th of a chord in the range.', minStage: 3 },
];

export interface Pos { string: number; fret: number }

export interface TrainerQuestion {
  id: string;
  mode: TrainerMode;
  prompt: string;
  /** Positions shown to the student. */
  highlight: (Pos & { role: 'target' | 'root' })[];
  /** For multiple-choice modes. */
  options?: string[];
  answerOption?: number;
  /** For click modes: every accepted position. */
  accept?: Pos[];
  /** All of `accept` must be clicked (find-all, chord-tones, octaves). */
  requireAll?: boolean;
  /** Restrict clicks to one string. */
  onlyString?: number;
  range: { minFret: number; maxFret: number };
  /** Data recorded with the attempt. */
  meta: { string: number; fret: number; pc: number; interval?: number };
  explain: string;
}

/** Deterministic PRNG so sessions are reproducible in tests. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function stringName(tuning: Tuning, s: number): string {
  const num = tuning.strings.length - s;
  return `string ${num} (${pcName(mod(tuning.strings[s], 12))})`;
}

const NOTE_OPTIONS_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteLabel(pc: number, flats: boolean): string {
  return pcName(pc, flats);
}

export interface Weights {
  /** Weight per string index (≥ 1). */
  byString: number[];
  /** Weight per fret range bucket. */
  byRange: Map<string, number>;
}

export function fretBucket(fret: number): string {
  if (fret <= 4) return '0–4';
  if (fret <= 8) return '5–8';
  if (fret <= 12) return '9–12';
  if (fret <= 16) return '13–16';
  return '17+';
}

/** Weighted sampling favouring weak strings and fret regions. */
export function weightsFromAttempts(tuning: Tuning, attempts: TrainerAttempt[]): Weights {
  const byString = tuning.strings.map(() => 1);
  const byRange = new Map<string, number>();
  const recent = attempts.slice(-300);
  const an = analyse(recent, tuning);
  for (const st of an.byString)
    if (st.attempts >= 3) byString[Number(st.key)] = 1 + 3 * (1 - st.accuracy) + (st.avgMs > 4000 ? 0.5 : 0);
  for (const r of an.byRange) if (r.attempts >= 3) byRange.set(r.key, 1 + 3 * (1 - r.accuracy));
  return { byString, byRange };
}

function weightedPosition(tuning: Tuning, stage: TrainerStage, r: () => number, w?: Weights, strings?: number[]): Pos {
  const cands: { p: Pos; w: number }[] = [];
  const allowed = strings && strings.length ? strings : tuning.strings.map((_, i) => i);
  for (const s of allowed)
    for (let f = stage.minFret; f <= stage.maxFret; f++) {
      const pc = mod(midiAt(tuning, s, f), 12);
      if (stage.naturalsOnly && !isNaturalPc(pc)) continue;
      const weight = (w?.byString[s] ?? 1) * (w?.byRange.get(fretBucket(f)) ?? 1);
      cands.push({ p: { string: s, fret: f }, w: weight });
    }
  const total = cands.reduce((a, c) => a + c.w, 0);
  let x = r() * total;
  for (const c of cands) {
    x -= c.w;
    if (x <= 0) return c.p;
  }
  return cands[cands.length - 1].p;
}

export interface GenerateOptions {
  tuning: Tuning;
  stage: TrainerStage;
  mode: TrainerMode;
  seed: number;
  flats?: boolean;
  weights?: Weights;
  /** Restrict to these string indices. */
  strings?: number[];
  /** Key for degree mode (e.g. "G"). */
  key?: string;
}

export function generateQuestion(o: GenerateOptions): TrainerQuestion {
  const r = rng(o.seed);
  const { tuning, stage } = o;
  const flats = !!o.flats;
  const range = { minFret: stage.minFret, maxFret: stage.maxFret };
  const pos = weightedPosition(tuning, stage, r, o.weights, o.strings);
  const pc = mod(midiAt(tuning, pos.string, pos.fret), 12);
  const name = noteLabel(pc, flats);
  const id = `${o.mode}-${o.seed}`;
  const meta = { string: pos.string, fret: pos.fret, pc };
  const allOf = (p: number) =>
    positionsOfPc(tuning, p, stage.maxFret, stage.minFret)
      .filter((x) => !o.strings?.length || o.strings.includes(x.string))
      .map((x) => ({ string: x.string, fret: x.fret }));

  switch (o.mode) {
    case 'note-id': {
      const pool = stage.naturalsOnly ? NOTE_OPTIONS_SHARP.filter((_, i) => isNaturalPc(i)) : NOTE_OPTIONS_SHARP;
      const wrong = shuffle(pool.map((_, i) => i).filter((i) => (stage.naturalsOnly ? isNaturalPc(i) : true) && i !== pc), r).slice(0, 3);
      const options = shuffle([pc, ...wrong], r).map((p) => noteLabel(p, flats));
      return {
        id, mode: o.mode, prompt: `What note is at fret ${pos.fret} on ${stringName(tuning, pos.string)}?`,
        highlight: [{ ...pos, role: 'target' }], options, answerOption: options.indexOf(name), range, meta,
        explain: `Open ${pcName(mod(tuning.strings[pos.string], 12), flats)} + ${pos.fret} semitone${pos.fret === 1 ? '' : 's'} = ${name}.`,
      };
    }
    case 'find-note':
      return {
        id, mode: o.mode, prompt: `Find ${name} anywhere between frets ${stage.minFret} and ${stage.maxFret}.`, highlight: [],
        accept: allOf(pc), range, meta, explain: `${name} appears ${allOf(pc).length} times in this range.`,
      };
    case 'string-nav':
      return {
        id, mode: o.mode, prompt: `Find ${name} on ${stringName(tuning, pos.string)}.`, highlight: [], onlyString: pos.string,
        accept: allOf(pc).filter((p) => p.string === pos.string), range, meta,
        explain: `Count up from the open ${pcName(mod(tuning.strings[pos.string], 12), flats)}: ${name} is at fret ${pos.fret}${pos.fret + 12 <= stage.maxFret ? ` and ${pos.fret + 12}` : ''}.`,
      };
    case 'find-all':
      return {
        id, mode: o.mode, prompt: `Click every ${name} between frets ${stage.minFret} and ${stage.maxFret}.`, highlight: [],
        accept: allOf(pc), requireAll: true, range, meta, explain: `Use octave shapes: each ${name} is linked to the next by a fixed shape.`,
      };
    case 'octaves': {
      const base = midiAt(tuning, pos.string, pos.fret);
      const acc = allOf(pc).filter((p) => !(p.string === pos.string && p.fret === pos.fret) && (midiAt(tuning, p.string, p.fret) - base) % 12 === 0);
      return {
        id, mode: o.mode, prompt: `Click every other ${name} (all octaves) of the highlighted note.`, highlight: [{ ...pos, role: 'root' }],
        accept: acc, requireAll: true, range, meta,
        explain: 'Common octave shapes: two strings up and two frets up; three strings up and three frets down (adjust by one fret when crossing a major-3rd string gap).',
      };
    }
    case 'interval-find': {
      const iv = pick([3, 4, 5, 7, 9, 10, 11, 12, 2, 6, 8, 1], r);
      const target = mod(pc + iv, 12);
      const info = SEMITONE_INTERVALS[iv === 12 ? 12 : iv];
      const acc = positionsOfPc(tuning, target, stage.maxFret, stage.minFret)
        .filter((p) => {
          const d = midiAt(tuning, p.string, p.fret) - midiAt(tuning, pos.string, pos.fret);
          return d === (iv === 12 ? 12 : iv) && Math.abs(p.fret - pos.fret) <= 5;
        })
        .map((p) => ({ string: p.string, fret: p.fret }));
      if (!acc.length) return generateQuestion({ ...o, seed: o.seed + 7919 });
      return {
        id, mode: o.mode, prompt: `Root is ${name}. Click the ${info.name.toLowerCase()} above it (within a hand position).`,
        highlight: [{ ...pos, role: 'root' }], accept: acc, range, meta: { ...meta, interval: iv },
        explain: `A ${info.name.toLowerCase()} is ${iv} semitones above the root: ${name} → ${noteLabel(target, flats)}.`,
      };
    }
    case 'interval-id': {
      const iv = pick([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12], r);
      const target = positionsOfPc(tuning, mod(pc + iv, 12), stage.maxFret, stage.minFret).find((p) => midiAt(tuning, p.string, p.fret) - midiAt(tuning, pos.string, pos.fret) === iv && Math.abs(p.fret - pos.fret) <= 5);
      if (!target) return generateQuestion({ ...o, seed: o.seed + 104729 });
      const correct = SEMITONE_INTERVALS[iv].name;
      const wrongs = shuffle(SEMITONE_INTERVALS.filter((x) => x.semitones !== iv && x.semitones > 0).map((x) => x.name), r).slice(0, 3);
      const options = shuffle([correct, ...wrongs], r);
      return {
        id, mode: o.mode, prompt: 'Name the interval from the root (ring) up to the target (dot).',
        highlight: [{ ...pos, role: 'root' }, { string: target.string, fret: target.fret, role: 'target' }],
        options, answerOption: options.indexOf(correct), range, meta: { ...meta, interval: iv },
        explain: `${name} up to ${noteLabel(mod(pc + iv, 12), flats)} is ${iv} semitones: a ${correct.toLowerCase()}.`,
      };
    }
    case 'degree-id': {
      const key = o.key ?? pick(['C', 'G', 'D', 'A', 'E', 'F', 'Bb'], r);
      const scale = buildScale(key, 'major');
      const inKey = [] as Pos[];
      for (let s = 0; s < tuning.strings.length; s++)
        for (let f = stage.minFret; f <= stage.maxFret; f++) if (scale.pcs.includes(mod(midiAt(tuning, s, f), 12))) inKey.push({ string: s, fret: f });
      const p = pick(inKey, r);
      const ppc = mod(midiAt(tuning, p.string, p.fret), 12);
      const deg = scale.pcs.indexOf(ppc) + 1;
      const options = ['1', '2', '3', '4', '5', '6', '7'];
      return {
        id, mode: o.mode, prompt: `In ${key} major, which scale degree is the highlighted note?`, highlight: [{ ...p, role: 'target' }],
        options, answerOption: deg - 1, range, meta: { string: p.string, fret: p.fret, pc: ppc, interval: mod(ppc - scale.pcs[0], 12) },
        explain: `${noteName(scale.notes[deg - 1])} is degree ${deg} of ${key} major (${scale.notes.map((n) => noteName(n)).join(' ')}).`,
      };
    }
    case 'chord-tones': {
      const quality = pick(['maj', 'm'], r);
      const root = pick(['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'B'], r);
      const built = buildChord(root, quality);
      const lo = Math.max(stage.minFret, Math.min(stage.maxFret - 4, pos.fret));
      const hi = Math.min(stage.maxFret, lo + 4);
      const acc: Pos[] = [];
      for (let s = 0; s < tuning.strings.length; s++)
        for (let f = lo; f <= hi; f++) if (built.pcs.includes(mod(midiAt(tuning, s, f), 12))) acc.push({ string: s, fret: f });
      return {
        id, mode: o.mode, prompt: `Click every chord tone of ${built.symbol} (${built.notes.map((n) => noteName(n)).join(' – ')}) between frets ${lo} and ${hi}.`,
        highlight: [], accept: acc, requireAll: true, range: { minFret: lo, maxFret: hi }, meta,
        explain: `${built.symbol} = root ${noteName(built.notes[0])}, ${built.tokens[1] === 'b3' ? 'minor' : 'major'} 3rd ${noteName(built.notes[1])}, 5th ${noteName(built.notes[2])}.`,
      };
    }
  }
}

export interface ClickResult {
  correct: boolean;
  complete: boolean;
  /** Positions clicked that were wrong. */
  wrong: Pos[];
  found: Pos[];
}

/** Evaluate clicks for click-based modes. */
export function checkClicks(q: TrainerQuestion, clicks: Pos[]): ClickResult {
  const accept = q.accept ?? [];
  const isAcc = (p: Pos) => accept.some((a) => a.string === p.string && a.fret === p.fret);
  const found = clicks.filter(isAcc).filter((p, i, arr) => arr.findIndex((x) => x.string === p.string && x.fret === p.fret) === i);
  const wrong = clicks.filter((p) => !isAcc(p));
  if (q.requireAll) return { correct: wrong.length === 0 && found.length === accept.length, complete: found.length === accept.length || wrong.length > 0, wrong, found };
  return { correct: found.length > 0 && wrong.length === 0, complete: clicks.length > 0, wrong, found };
}

// ── Adaptive difficulty ──────────────────────────────────────────────────

export interface AdaptiveState {
  stage: number;
  streak: number;
  recent: boolean[];
}

/**
 * Promote after 10 correct in a row (averaging under 4 s); demote when accuracy
 * over the last 10 drops below 60%.
 */
export function adapt(s: AdaptiveState, correct: boolean, ms: number, recentMs: number[]): AdaptiveState {
  const recent = [...s.recent, correct].slice(-10);
  const streak = correct ? s.streak + 1 : 0;
  let stage = s.stage;
  const avg = recentMs.length ? recentMs.reduce((a, b) => a + b, 0) / recentMs.length : ms;
  if (streak >= 10 && avg < 4000 && stage < TRAINER_STAGES.length) return { stage: stage + 1, streak: 0, recent: [] };
  if (recent.length >= 10 && recent.filter(Boolean).length / recent.length < 0.6 && stage > 1) {
    stage -= 1;
    return { stage, streak: 0, recent: [] };
  }
  return { stage, streak, recent };
}

// ── Analytics ────────────────────────────────────────────────────────────

export interface Bucket {
  key: string;
  label: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avgMs: number;
}

function bucketize(attempts: TrainerAttempt[], keyOf: (a: TrainerAttempt) => string | null, labelOf: (k: string) => string): Bucket[] {
  const m = new Map<string, { a: number; c: number; ms: number }>();
  for (const a of attempts) {
    const k = keyOf(a);
    if (k === null) continue;
    const v = m.get(k) ?? { a: 0, c: 0, ms: 0 };
    v.a++;
    if (a.correct) v.c++;
    v.ms += a.ms;
    m.set(k, v);
  }
  return [...m.entries()].map(([key, v]) => ({ key, label: labelOf(key), attempts: v.a, correct: v.c, accuracy: v.c / v.a, avgMs: v.ms / v.a }));
}

export interface TrainerAnalytics {
  total: number;
  accuracy: number;
  avgMs: number;
  bestStreak: number;
  byString: Bucket[];
  byRange: Bucket[];
  byNote: Bucket[];
  byInterval: Bucket[];
  byMode: Bucket[];
  weakest: Bucket[];
  daily: { day: string; accuracy: number; attempts: number; avgMs: number }[];
}

export function analyse(attempts: TrainerAttempt[], tuning: Tuning): TrainerAnalytics {
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  let best = 0;
  let cur = 0;
  for (const a of attempts) {
    cur = a.correct ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  const byString = bucketize(attempts, (a) => (a.string < tuning.strings.length ? String(a.string) : null), (k) => stringName(tuning, Number(k)))
    .sort((a, b) => Number(a.key) - Number(b.key));
  const order = ['0–4', '5–8', '9–12', '13–16', '17+'];
  const byRange = bucketize(attempts, (a) => fretBucket(a.fret), (k) => `Frets ${k}`).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const byNote = bucketize(attempts, (a) => String(a.pc), (k) => pcName(Number(k))).sort((a, b) => Number(a.key) - Number(b.key));
  const byInterval = bucketize(attempts, (a) => (a.interval === undefined ? null : String(a.interval)), (k) => SEMITONE_INTERVALS[Number(k)]?.name ?? k)
    .sort((a, b) => Number(a.key) - Number(b.key));
  const byMode = bucketize(attempts, (a) => a.mode, (k) => TRAINER_MODES.find((m) => m.id === k)?.name ?? k);
  const weakest = [...byString, ...byRange, ...byNote, ...byInterval]
    .filter((b) => b.attempts >= 5)
    .sort((a, b) => a.accuracy - b.accuracy || b.avgMs - a.avgMs)
    .slice(0, 4);
  const days = new Map<string, { a: number; c: number; ms: number }>();
  for (const a of attempts) {
    const d = a.at.slice(0, 10);
    const v = days.get(d) ?? { a: 0, c: 0, ms: 0 };
    v.a++;
    if (a.correct) v.c++;
    v.ms += a.ms;
    days.set(d, v);
  }
  return {
    total, accuracy: total ? correct / total : 0, avgMs: total ? attempts.reduce((a, b) => a + b.ms, 0) / total : 0, bestStreak: best,
    byString, byRange, byNote, byInterval, byMode, weakest,
    daily: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, v]) => ({ day, accuracy: v.c / v.a, attempts: v.a, avgMs: v.ms / v.a })),
  };
}

/** Plain-language recommendations derived from the analytics. */
export function trainerRecommendations(an: TrainerAnalytics): string[] {
  const out: string[] = [];
  if (an.total < 20) {
    out.push('Answer at least 20 questions so the trainer can find your weak spots.');
    return out;
  }
  for (const w of an.weakest) {
    if (w.accuracy >= 0.85) continue;
    if (w.key.match(/^\d+$/) && an.byString.includes(w)) out.push(`${w.label}: ${Math.round(w.accuracy * 100)}% correct. Practise "Note on a string" restricted to this string.`);
    else if (an.byRange.includes(w)) out.push(`${w.label}: ${Math.round(w.accuracy * 100)}% correct. Learn the landmark notes there (frets 5, 7, 9 and 12) and run "Find every occurrence".`);
    else if (an.byNote.includes(w)) out.push(`The note ${w.label}: ${Math.round(w.accuracy * 100)}% correct. Locate it on every string using octave shapes.`);
    else if (an.byInterval.includes(w)) out.push(`${w.label}: ${Math.round(w.accuracy * 100)}% correct. Drill "Find the interval" and sing the interval as you play it.`);
  }
  if (an.avgMs > 5000) out.push(`Average answer time is ${(an.avgMs / 1000).toFixed(1)} s. Aim for under 3 s so the knowledge becomes automatic.`);
  if (!out.length) out.push('Accuracy is strong everywhere. Move up a stage or switch to interval and degree modes.');
  return out;
}
