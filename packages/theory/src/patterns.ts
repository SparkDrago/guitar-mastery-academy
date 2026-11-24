/**
 * Scale position systems:
 *  - notes-per-string patterns (3NPS for 7-note scales, 2NPS "five positions" for pentatonics)
 *  - fret-window positions (blues scale, CAGED windows, any scale)
 *  - Michael Pillitiere's X/Y/Z shape system (Building the Better Guitar Scale)
 */
import { intervalToken, parseFormula, type Interval } from './intervals';
import { mod } from './pitch';
import { markTones, type FretNote } from './fretboard';
import type { Tuning } from './tunings';

export type PatternSystem = '3nps' | 'five-position' | 'window' | 'caged' | 'pillitiere';

export interface PatternNote extends FretNote {
  degreeIndex: number;
  token: string;
  isRoot: boolean;
  finger?: number;
}

export interface ScalePattern {
  id: string;
  name: string;
  system: PatternSystem;
  /** 1-based scale degree the pattern starts on (lowest note). */
  startDegree: number;
  notes: PatternNote[];
  minFret: number;
  maxFret: number;
  /** Pillitiere shape letters per string, when relevant. */
  shapes?: string[];
}

function toIntervals(intervals: Interval[] | string[]): Interval[] {
  return typeof intervals[0] === 'string' ? parseFormula(intervals as string[]) : (intervals as Interval[]);
}

/** Suggested fret-hand fingers for the notes on one string, given their frets. */
export function suggestFingers(frets: number[]): number[] {
  if (frets.length === 0) return [];
  const base = frets[0];
  const rel = frets.map((f) => f - base);
  const key = rel.join(',');
  const table: Record<string, number[]> = {
    '0': [1],
    '0,1': [1, 2], '0,2': [1, 3], '0,3': [1, 4], '0,4': [1, 4],
    '0,2,4': [1, 2, 4], '0,1,3': [1, 2, 4], '0,2,3': [1, 3, 4], '0,1,2': [1, 2, 3], '0,1,4': [1, 2, 4], '0,3,4': [1, 3, 4],
    '0,2,4,5': [1, 2, 3, 4], '0,1,3,5': [1, 2, 3, 4], '0,2,3,5': [1, 2, 3, 4],
  };
  if (table[key]) return table[key];
  return rel.map((r) => Math.min(4, Math.max(1, r + 1)));
}

/**
 * Generic N-notes-per-string pattern: the scale is played in strict ascending order,
 * N consecutive scale notes on each string, starting on scale degree `startIndex`
 * (0-based) on `startString`. Returns null if the pattern cannot fit within maxFret.
 */
export function notesPerStringPattern(
  tuning: Tuning,
  rootPc: number,
  intervals: Interval[] | string[],
  startIndex: number,
  notesPerString: number,
  opts: { startString?: number; minFret?: number; maxFret?: number } = {},
): PatternNote[] | null {
  const ivs = toIntervals(intervals);
  const semis = ivs.map((i) => mod(i.semitones, 12));
  const n = semis.length;
  const startString = opts.startString ?? 0;
  const minFret = opts.minFret ?? 0;
  const maxFret = opts.maxFret ?? 24;
  const open0 = tuning.strings[startString];
  const startPc = mod(rootPc + semis[startIndex], 12);
  let fret = mod(startPc - open0, 12);
  while (fret < minFret) fret += 12;

  for (let attempt = 0; attempt < 3; attempt++, fret += 12) {
    if (fret > maxFret) return null;
    const notes: PatternNote[] = [];
    let pitch = open0 + fret;
    let deg = startIndex;
    let ok = true;
    for (let s = startString; s < tuning.strings.length && ok; s++) {
      const stringNotes: PatternNote[] = [];
      for (let k = 0; k < notesPerString; k++) {
        const f = pitch - tuning.strings[s];
        if (f < 0) { ok = false; break; }
        if (f > maxFret) return null;
        stringNotes.push({
          string: s, fret: f, midi: pitch, pc: mod(pitch, 12),
          degreeIndex: deg, token: intervalToken(ivs[deg]), isRoot: semis[deg] === 0,
        });
        const nextDeg = (deg + 1) % n;
        const step = mod(semis[nextDeg] - semis[deg], 12) || 12;
        pitch += step;
        deg = nextDeg;
      }
      const fingers = suggestFingers(stringNotes.map((x) => x.fret));
      stringNotes.forEach((x, i) => (x.finger = fingers[i]));
      notes.push(...stringNotes);
    }
    if (ok) return notes;
  }
  return null;
}

function bounds(notes: { fret: number }[]): { minFret: number; maxFret: number } {
  return { minFret: Math.min(...notes.map((x) => x.fret)), maxFret: Math.max(...notes.map((x) => x.fret)) };
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/** All 3NPS patterns for a seven-note scale (one per starting degree). */
export function threeNpsPatterns(tuning: Tuning, rootPc: number, intervals: Interval[] | string[], minFret = 0, maxFret = 24): ScalePattern[] {
  const ivs = toIntervals(intervals);
  if (ivs.length !== 7) return [];
  const out: ScalePattern[] = [];
  for (let d = 0; d < 7; d++) {
    const notes = notesPerStringPattern(tuning, rootPc, ivs, d, 3, { minFret, maxFret });
    if (!notes) continue;
    out.push({ id: `3nps-${d + 1}`, name: `Pattern ${d + 1} (from the ${ORDINAL[d]} degree)`, system: '3nps', startDegree: d + 1, notes, ...bounds(notes) });
  }
  return out.sort((a, b) => a.minFret - b.minFret);
}

/** The five 2-notes-per-string positions of a pentatonic scale. */
export function fivePositionPatterns(tuning: Tuning, rootPc: number, intervals: Interval[] | string[], minFret = 0, maxFret = 24): ScalePattern[] {
  const ivs = toIntervals(intervals);
  if (ivs.length !== 5) return [];
  const out: ScalePattern[] = [];
  for (let d = 0; d < 5; d++) {
    const notes = notesPerStringPattern(tuning, rootPc, ivs, d, 2, { minFret, maxFret });
    if (!notes) continue;
    out.push({ id: `pos-${d + 1}`, name: `Position ${d + 1}`, system: 'five-position', startDegree: d + 1, notes, ...bounds(notes) });
  }
  return out.sort((a, b) => a.minFret - b.minFret).map((p, i) => ({ ...p, id: `pos-${i + 1}`, name: `Position ${i + 1}` }));
}

/** Every scale tone inside a fret window, as a pattern. */
export function windowPattern(
  tuning: Tuning, rootPc: number, intervals: Interval[] | string[], lo: number, hi: number, id: string, name: string, system: PatternSystem = 'window',
): ScalePattern | null {
  const ivs = toIntervals(intervals);
  const marked = markTones(tuning, rootPc, ivs, Math.max(0, hi), Math.max(0, lo));
  if (!marked.length) return null;
  const notes: PatternNote[] = marked.map((m) => ({
    string: m.string, fret: m.fret, midi: m.midi, pc: m.pc, degreeIndex: m.toneIndex, token: m.token, isRoot: m.isRoot,
  }));
  for (let s = 0; s < tuning.strings.length; s++) {
    const on = notes.filter((x) => x.string === s).sort((a, b) => a.fret - b.fret);
    const fingers = on.map((x) => Math.min(4, Math.max(1, x.fret - Math.max(0, lo) + (lo <= 0 ? 0 : 1))));
    on.forEach((x, i) => (x.finger = x.fret === 0 ? 0 : fingers[i]));
  }
  const lowest = notes.reduce((a, b) => (a.midi < b.midi ? a : b));
  return { id, name, system, startDegree: lowest.degreeIndex + 1, notes, ...bounds(notes) };
}

/**
 * Window positions for any scale, anchored on the five pentatonic-style windows of
 * the root: the windows are derived from the minor-pentatonic positions of the same root,
 * so blues and hexatonic scales line up with the pentatonic boxes students already know.
 */
export function anchoredWindowPatterns(tuning: Tuning, rootPc: number, intervals: Interval[] | string[], minFret = 0, maxFret = 24): ScalePattern[] {
  const anchors = fivePositionPatterns(tuning, rootPc, ['1', 'b3', '4', '5', 'b7'], minFret, maxFret);
  return anchors
    .map((a, i) => windowPattern(tuning, rootPc, intervals, a.minFret, a.maxFret, `win-${i + 1}`, `Position ${i + 1}`))
    .filter((p): p is ScalePattern => p !== null);
}

// ── CAGED ────────────────────────────────────────────────────────────────

interface CagedTemplate {
  shape: 'C' | 'A' | 'G' | 'E' | 'D';
  /** Root string index in standard 6-string tuning (0 = low E). */
  rootString: number;
  /** Major chord shape as [string, fret offset from root fret]. */
  chord: [number, number][];
  /** Scale window relative to the root fret. */
  lo: number;
  hi: number;
}

export const CAGED_TEMPLATES: CagedTemplate[] = [
  { shape: 'C', rootString: 1, chord: [[1, 0], [2, -1], [3, -3], [4, -2], [5, -3]], lo: -3, hi: 1 },
  { shape: 'A', rootString: 1, chord: [[1, 0], [2, 2], [3, 2], [4, 2], [5, 0]], lo: -1, hi: 3 },
  { shape: 'G', rootString: 0, chord: [[0, 0], [1, -1], [2, -3], [3, -3], [4, -3], [5, 0]], lo: -3, hi: 1 },
  { shape: 'E', rootString: 0, chord: [[0, 0], [1, 2], [2, 2], [3, 1], [4, 0], [5, 0]], lo: -1, hi: 3 },
  { shape: 'D', rootString: 2, chord: [[2, 0], [3, 2], [4, 3], [5, 2]], lo: -1, hi: 3 },
];

const STANDARD_6 = [40, 45, 50, 55, 59, 64];

export function isStandardSix(tuning: Tuning): boolean {
  return tuning.strings.length === 6 && tuning.strings.every((m, i) => m === STANDARD_6[i]);
}

/** Intervals between strings match standard tuning (any transposition, 6 strings). */
export function hasStandardIntervals(tuning: Tuning): boolean {
  if (tuning.strings.length !== 6) return false;
  return tuning.strings.every((m, i) => i === 0 || m - tuning.strings[i - 1] === STANDARD_6[i] - STANDARD_6[i - 1]);
}

export interface CagedPosition extends ScalePattern {
  shape: CagedTemplate['shape'];
  chordShape: { string: number; fret: number }[];
}

/**
 * CAGED positions (chord shape + surrounding scale window). Defined only for tunings
 * with standard-tuning intervals; returns [] otherwise.
 */
export function cagedPositions(tuning: Tuning, rootPc: number, intervals: Interval[] | string[], maxFret = 22): CagedPosition[] {
  if (!hasStandardIntervals(tuning)) return [];
  const out: CagedPosition[] = [];
  for (const tpl of CAGED_TEMPLATES) {
    let r = mod(rootPc - tuning.strings[tpl.rootString], 12);
    while (r + tpl.lo < -1) r += 12;
    if (r + tpl.hi > maxFret) continue;
    const lo = Math.max(0, r + tpl.lo);
    const hi = r + tpl.hi;
    const win = windowPattern(tuning, rootPc, intervals, lo, hi, `caged-${tpl.shape}`, `${tpl.shape} shape`, 'caged');
    if (!win) continue;
    const chordShape = tpl.chord.map(([s, off]) => ({ string: s, fret: r + off })).filter((p) => p.fret >= 0);
    out.push({ ...win, shape: tpl.shape, chordShape });
  }
  return out.sort((a, b) => a.minFret - b.minFret);
}

// ── Pillitiere X / Y / Z system ──────────────────────────────────────────

export type PillitiereShape = 'X' | 'Y' | 'Z';

/** Fret offsets of each per-string finger shape (relative to the first finger). */
export const PILLITIERE_SHAPE_FRETS: Record<PillitiereShape, number[]> = {
  X: [0, 2, 4], // whole – whole, fingers 1-2-4
  Y: [0, 1, 3], // half  – whole, fingers 1-2-4
  Z: [0, 2, 3], // whole – half,  fingers 1-3-4
};

export const PILLITIERE_SHAPE_FINGERS: Record<PillitiereShape, number[]> = { X: [1, 2, 4], Y: [1, 2, 4], Z: [1, 3, 4] };

/**
 * The 7-string cycle "X X X Y Y Z Z". Each entry is labelled with the major-scale
 * degree that a 3NPS group of that shape starts on.
 */
export const PILLITIERE_CYCLE: { shape: PillitiereShape; degree: number }[] = [
  { shape: 'X', degree: 5 }, { shape: 'X', degree: 1 }, { shape: 'X', degree: 4 },
  { shape: 'Y', degree: 7 }, { shape: 'Y', degree: 3 },
  { shape: 'Z', degree: 6 }, { shape: 'Z', degree: 2 },
];

/** Pillitiere's chart: first shapes of the pattern that starts on each major-scale degree. */
export const PILLITIERE_START_SHAPES: Record<number, string> = { 1: 'XX', 2: 'ZX', 3: 'YZ', 4: 'XY', 5: 'XXX', 6: 'ZZ', 7: 'YY' };

/** Mode associated with each starting shape (pattern started on the mode's own 1st degree). */
export const PILLITIERE_MODES: { shapes: string; mode: string; parentDegree: number }[] = [
  { shapes: 'XX', mode: 'major', parentDegree: 1 },
  { shapes: 'ZX', mode: 'dorian', parentDegree: 2 },
  { shapes: 'YZ', mode: 'phrygian', parentDegree: 3 },
  { shapes: 'XY', mode: 'lydian', parentDegree: 4 },
  { shapes: 'XXX', mode: 'mixolydian', parentDegree: 5 },
  { shapes: 'ZZ', mode: 'aeolian', parentDegree: 6 },
  { shapes: 'YY', mode: 'locrian', parentDegree: 7 },
];

/** Shape sequence for `count` strings, starting on major-scale degree `degree` (1..7). */
export function pillitiereShapes(degree: number, count: number): PillitiereShape[] {
  const start = PILLITIERE_CYCLE.findIndex((c) => c.degree === degree);
  if (start < 0) throw new Error(`Degree must be 1..7, got ${degree}`);
  return Array.from({ length: count }, (_, i) => PILLITIERE_CYCLE[(start + i) % 7].shape);
}

/**
 * The fret shift of the first finger when moving to the next string.
 * Pillitiere's two rules for standard tuning:
 *   1. X followed by Y: up one fret.
 *   2. Crossing from the 3rd to the 2nd string (a major-3rd gap): up one fret.
 * Rule 2 is generalised here as (5 − gap): a perfect-4th gap shifts 0, a major 3rd +1,
 * a perfect 5th (e.g. a drop-tuned low string) −2. This generalisation is an extension
 * of the source, which only describes standard tuning.
 */
export function pillitiereShift(from: PillitiereShape, to: PillitiereShape, stringGap: number): number {
  return (from === 'X' && to === 'Y' ? 1 : 0) + (5 - stringGap);
}

const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];

export interface PillitiereStep {
  string: number;
  shape: PillitiereShape;
  firstFret: number;
  shift: number;
  reasons: string[];
}

export interface PillitierePattern extends ScalePattern {
  steps: PillitiereStep[];
}

/**
 * Build a major-scale (or mode) pattern using ONLY Pillitiere's rules:
 * starting degree + shape cycle + the two shift rules. No scale lookup is used
 * after the first note, which is what makes it a faithful model of the method.
 *
 * @param keyPc   pitch class of the parent MAJOR key (Ionian tonic)
 * @param degree  major-scale degree of the starting note (1..7)
 */
export function buildPillitierePattern(
  tuning: Tuning, keyPc: number, degree: number, opts: { startString?: number; minFret?: number } = {},
): PillitierePattern {
  const startString = opts.startString ?? 0;
  const count = tuning.strings.length - startString;
  const shapes = pillitiereShapes(degree, count);
  const startPc = mod(keyPc + MAJOR_SEMIS[degree - 1], 12);
  let first = mod(startPc - tuning.strings[startString], 12);
  while (first < (opts.minFret ?? 0)) first += 12;

  const notes: PatternNote[] = [];
  const steps: PillitiereStep[] = [];
  let deg = degree - 1;
  for (let i = 0; i < count; i++) {
    const s = startString + i;
    const shape = shapes[i];
    let shift = 0;
    const reasons: string[] = [];
    if (i > 0) {
      const gap = tuning.strings[s] - tuning.strings[s - 1];
      shift = pillitiereShift(shapes[i - 1], shape, gap);
      if (shapes[i - 1] === 'X' && shape === 'Y') reasons.push('X → Y: first finger up one fret');
      if (gap === 4) reasons.push('Major-3rd string gap (G→B in standard): first finger up one fret');
      else if (gap !== 5) reasons.push(`String gap of ${gap} semitones: first finger moves ${5 - gap > 0 ? 'up' : 'down'} ${Math.abs(5 - gap)} (generalised rule)`);
      first += shift;
    }
    steps.push({ string: s, shape, firstFret: first, shift, reasons });
    PILLITIERE_SHAPE_FRETS[shape].forEach((off, k) => {
      const fret = first + off;
      const midi = tuning.strings[s] + fret;
      notes.push({
        string: s, fret, midi, pc: mod(midi, 12),
        degreeIndex: deg, token: String(deg + 1), isRoot: deg === 0,
        finger: PILLITIERE_SHAPE_FINGERS[shape][k],
      });
      deg = (deg + 1) % 7;
    });
  }
  return {
    id: `pillitiere-${degree}`,
    name: `Pattern from degree ${degree} (${PILLITIERE_START_SHAPES[degree]})`,
    system: 'pillitiere',
    startDegree: degree,
    notes,
    shapes,
    steps,
    ...bounds(notes),
  };
}

/**
 * Pillitiere's renumbering for modes: to start mode `modeIndex` (1 = Ionian … 7 = Locrian)
 * on its own degree `modeDegree`, play the parent-major pattern that starts on this degree.
 */
export function pillitiereParentDegree(modeIndex: number, modeDegree: number): number {
  return mod(modeIndex - 1 + modeDegree - 1, 7) + 1;
}
