/**
 * Fretboard calculation engine. String index 0 is the LOWEST-pitched string.
 * All functions take a tuning, so 6-, 7- and 8-string boards and every
 * alternate tuning work the same way.
 */
import { intervalToken, parseFormula, type Interval } from './intervals';
import { mod } from './pitch';
import type { Tuning } from './tunings';

export interface FretPos {
  string: number;
  fret: number;
}

export interface FretNote extends FretPos {
  midi: number;
  pc: number;
}

export function midiAt(tuning: Tuning, string: number, fret: number): number {
  return tuning.strings[string] + fret;
}

export function noteAt(tuning: Tuning, string: number, fret: number): FretNote {
  const midi = midiAt(tuning, string, fret);
  return { string, fret, midi, pc: mod(midi, 12) };
}

export function allNotes(tuning: Tuning, maxFret: number, minFret = 0): FretNote[] {
  const out: FretNote[] = [];
  for (let s = 0; s < tuning.strings.length; s++)
    for (let f = minFret; f <= maxFret; f++) out.push(noteAt(tuning, s, f));
  return out;
}

/** Every position of a pitch class within a fret range. */
export function positionsOfPc(tuning: Tuning, pc: number, maxFret: number, minFret = 0): FretNote[] {
  return allNotes(tuning, maxFret, minFret).filter((n) => n.pc === mod(pc, 12));
}

/** Every position of an exact MIDI pitch (the same note in the same octave). */
export function positionsOfMidi(tuning: Tuning, midi: number, maxFret: number): FretNote[] {
  const out: FretNote[] = [];
  tuning.strings.forEach((open, s) => {
    const f = midi - open;
    if (f >= 0 && f <= maxFret) out.push({ string: s, fret: f, midi, pc: mod(midi, 12) });
  });
  return out;
}

/** Positions of the same pitch class an exact number of octaves away from a note. */
export function octavesOf(tuning: Tuning, pos: FretPos, maxFret: number): (FretNote & { octaves: number })[] {
  const base = midiAt(tuning, pos.string, pos.fret);
  return positionsOfPc(tuning, mod(base, 12), maxFret)
    .filter((n) => !(n.string === pos.string && n.fret === pos.fret))
    .map((n) => ({ ...n, octaves: (n.midi - base) / 12 }));
}

export interface MarkedNote extends FretNote {
  /** Index of the matching scale/chord tone. */
  toneIndex: number;
  /** Formula token relative to the root, e.g. "b3". */
  token: string;
  /** Semitones above the root (0..11). */
  semitones: number;
  isRoot: boolean;
}

/**
 * Mark every fretboard position whose pitch class belongs to a set of tones
 * built from `rootPc` + `intervals` (a scale, chord or arpeggio).
 */
export function markTones(
  tuning: Tuning,
  rootPc: number,
  intervals: Interval[] | string[],
  maxFret: number,
  minFret = 0,
): MarkedNote[] {
  const ivs: Interval[] = typeof intervals[0] === 'string' ? parseFormula(intervals as string[]) : (intervals as Interval[]);
  const byPc = new Map<number, { idx: number; iv: Interval }>();
  ivs.forEach((iv, idx) => {
    const pc = mod(rootPc + iv.semitones, 12);
    if (!byPc.has(pc)) byPc.set(pc, { idx, iv });
  });
  const out: MarkedNote[] = [];
  for (const n of allNotes(tuning, maxFret, minFret)) {
    const hit = byPc.get(n.pc);
    if (!hit) continue;
    out.push({
      ...n,
      toneIndex: hit.idx,
      token: intervalToken(hit.iv),
      semitones: mod(hit.iv.semitones, 12),
      isRoot: mod(hit.iv.semitones, 12) === 0,
    });
  }
  return out;
}

/** Semitone interval from one fretboard position to another (signed). */
export function intervalBetweenPositions(tuning: Tuning, a: FretPos, b: FretPos): number {
  return midiAt(tuning, b.string, b.fret) - midiAt(tuning, a.string, a.fret);
}

/** Natural notes only (no sharps or flats). */
export function isNaturalPc(pc: number): boolean {
  return [0, 2, 4, 5, 7, 9, 11].includes(mod(pc, 12));
}

/** Frets that conventionally carry inlay dots. */
export const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
export const DOUBLE_INLAY_FRETS = [12, 24];
