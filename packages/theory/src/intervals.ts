/**
 * Intervals expressed the way guitarists and theory books write formulas:
 * "1 b3 5 b7", "1 2 #4", "1 3 b7 #9".
 */
import { LETTER_PC, mod, pcOf, type SpelledNote } from './pitch';

export interface Interval {
  /** Generic size 1..15 (1 = unison, 3 = third, 9 = ninth ...). */
  degree: number;
  /** Semitones above the root (may exceed 12 for compound intervals). */
  semitones: number;
}

/** Semitones of each major-scale degree, used as the reference for formula tokens. */
const MAJOR_DEGREE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

function majorDegreeSemitones(degree: number): number {
  const d = degree - 1;
  return MAJOR_DEGREE_SEMITONES[d % 7] + 12 * Math.floor(d / 7);
}

/** Parse a formula token like "1", "b3", "#4", "bb7", "#11", "b13". */
export function parseInterval(token: string): Interval {
  const m = /^(bb|b|##|#)?(\d{1,2})$/.exec(token.trim().replace(/♭/g, 'b').replace(/♯/g, '#'));
  if (!m) throw new Error(`Invalid interval token "${token}"`);
  const accStr = m[1] ?? '';
  const degree = Number(m[2]);
  if (degree < 1 || degree > 15) throw new Error(`Interval degree out of range in "${token}"`);
  const acc = accStr === '' ? 0 : accStr.startsWith('#') ? accStr.length : -accStr.length;
  return { degree, semitones: majorDegreeSemitones(degree) + acc };
}

export function parseFormula(formula: string | string[]): Interval[] {
  const tokens = Array.isArray(formula) ? formula : formula.split(/\s+/).filter(Boolean);
  return tokens.map(parseInterval);
}

/** Token for an interval, relative to the major scale ("b3", "#11", "5"). */
export function intervalToken(iv: Interval): string {
  const diff = iv.semitones - majorDegreeSemitones(iv.degree);
  const acc = diff === 0 ? '' : diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
  return acc + iv.degree;
}

const PERFECT_DEGREES = new Set([1, 4, 5, 8, 11, 12, 15]);

/** Quality name: perfect, major, minor, augmented, diminished. */
export function intervalQuality(iv: Interval): string {
  const diff = iv.semitones - majorDegreeSemitones(iv.degree);
  if (PERFECT_DEGREES.has(iv.degree)) {
    if (diff === 0) return 'perfect';
    return diff > 0 ? (diff === 1 ? 'augmented' : 'doubly augmented') : diff === -1 ? 'diminished' : 'doubly diminished';
  }
  if (diff === 0) return 'major';
  if (diff === -1) return 'minor';
  if (diff > 0) return diff === 1 ? 'augmented' : 'doubly augmented';
  return diff === -2 ? 'diminished' : 'doubly diminished';
}

const ORDINALS: Record<number, string> = {
  1: 'unison', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: 'octave',
  9: '9th', 10: '10th', 11: '11th', 12: '12th', 13: '13th', 14: '14th', 15: 'double octave',
};

/** "minor 3rd", "perfect 5th", "augmented 4th", "major 9th". */
export function intervalLongName(iv: Interval): string {
  const q = intervalQuality(iv);
  if (iv.degree === 1 && q === 'perfect') return 'unison';
  if (iv.degree === 8 && q === 'perfect') return 'octave';
  return `${q} ${ORDINALS[iv.degree] ?? iv.degree + 'th'}`;
}

/** Short names by semitone distance within an octave (generic, spelling-free). */
export const SEMITONE_INTERVALS = [
  { semitones: 0, short: 'P1', name: 'Unison', token: '1' },
  { semitones: 1, short: 'm2', name: 'Minor 2nd', token: 'b2' },
  { semitones: 2, short: 'M2', name: 'Major 2nd', token: '2' },
  { semitones: 3, short: 'm3', name: 'Minor 3rd', token: 'b3' },
  { semitones: 4, short: 'M3', name: 'Major 3rd', token: '3' },
  { semitones: 5, short: 'P4', name: 'Perfect 4th', token: '4' },
  { semitones: 6, short: 'TT', name: 'Tritone (aug 4th / dim 5th)', token: 'b5' },
  { semitones: 7, short: 'P5', name: 'Perfect 5th', token: '5' },
  { semitones: 8, short: 'm6', name: 'Minor 6th', token: 'b6' },
  { semitones: 9, short: 'M6', name: 'Major 6th', token: '6' },
  { semitones: 10, short: 'm7', name: 'Minor 7th', token: 'b7' },
  { semitones: 11, short: 'M7', name: 'Major 7th', token: '7' },
  { semitones: 12, short: 'P8', name: 'Octave', token: '8' },
] as const;

export function semitoneIntervalName(semitones: number): string {
  const s = mod(semitones, 12);
  const base = SEMITONE_INTERVALS[s].name;
  return semitones >= 12 && s === 0 ? 'Octave' : base;
}

/**
 * Spell the note an interval above a spelled root.
 * The result's letter is always `degree - 1` letters above the root letter,
 * which is what gives correct key-signature spelling.
 */
export function spellInterval(root: SpelledNote, iv: Interval): SpelledNote {
  const letter = mod(root.letter + iv.degree - 1, 7);
  const targetPc = mod(pcOf(root) + iv.semitones, 12);
  const naturalPc = LETTER_PC[letter];
  const acc = mod(targetPc - naturalPc + 6, 12) - 6;
  return { letter, acc };
}

/** Semitone distance from pitch class a up to pitch class b (0..11). */
export function pcInterval(a: number, b: number): number {
  return mod(b - a, 12);
}

/** Degree interval between two spelled notes (a below b, within an octave). */
export function intervalBetween(a: SpelledNote, b: SpelledNote): Interval {
  const degree = mod(b.letter - a.letter, 7) + 1;
  const semitones = pcInterval(pcOf(a), pcOf(b));
  return { degree, semitones };
}
