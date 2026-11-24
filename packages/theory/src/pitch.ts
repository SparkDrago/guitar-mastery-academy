/**
 * Pitch primitives: letters, spelled notes, pitch classes, MIDI and frequency.
 *
 * A *spelled note* keeps its letter so that scales and chords are spelled the
 * way musicians write them (F major contains B♭, not A♯). A *pitch class* (pc)
 * is the spelling-free integer 0–11 with C = 0.
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

/** Pitch class of each natural letter, indexed like LETTERS. */
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11] as const;

export interface SpelledNote {
  /** 0..6, index into LETTERS */
  letter: number;
  /** accidental in semitones: -2 (double flat) .. +2 (double sharp) */
  acc: number;
}

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

/** Mathematical modulo that is always non-negative. */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function pcOf(note: SpelledNote): number {
  return mod(LETTER_PC[note.letter] + note.acc, 12);
}

export function accidentalString(acc: number, unicode = false): string {
  if (acc === 0) return '';
  if (unicode) return acc > 0 ? (acc === 2 ? '𝄪' : '♯'.repeat(acc)) : acc === -2 ? '𝄫' : '♭'.repeat(-acc);
  return acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc);
}

export function noteName(note: SpelledNote, unicode = false): string {
  return LETTERS[note.letter] + accidentalString(note.acc, unicode);
}

/**
 * Parse a note name such as "C", "f#", "Bb", "Ebb", "C♯" or "G𝄪".
 * Returns null for anything that is not a valid note name.
 */
export function parseNote(input: string): SpelledNote | null {
  const s = input.trim().replace(/♯/g, '#').replace(/♭/g, 'b').replace(/𝄪/g, '##').replace(/𝄫/g, 'bb');
  const m = /^([A-Ga-g])(#{1,2}|b{1,2})?$/.exec(s);
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1].toUpperCase() as Letter);
  const accStr = m[2] ?? '';
  const acc = accStr.startsWith('#') ? accStr.length : -accStr.length;
  return { letter, acc };
}

/** Name of a pitch class using sharps or flats. */
export function pcName(pc: number, preferFlats = false): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[mod(pc, 12)];
}

/** Both enharmonic spellings of a pitch class that need at most one accidental. */
export function enharmonicNames(pc: number): string[] {
  const s = SHARP_NAMES[mod(pc, 12)];
  const f = FLAT_NAMES[mod(pc, 12)];
  return s === f ? [s] : [s, f];
}

/** Simple spelled note for a pitch class (natural if possible, else sharp/flat). */
export function spellPc(pc: number, preferFlats = false): SpelledNote {
  return parseNote(pcName(pc, preferFlats))!;
}

export const A4_MIDI = 69;

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Fractional MIDI number for a frequency. */
export function freqToMidi(freq: number, a4 = 440): number {
  return A4_MIDI + 12 * Math.log2(freq / a4);
}

/** Deviation of `freq` from `refFreq` in cents (positive = sharp). */
export function centsBetween(freq: number, refFreq: number): number {
  return 1200 * Math.log2(freq / refFreq);
}

export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** "E2", "C#4" or "Db4" style name for a MIDI note. */
export function midiName(midi: number, preferFlats = false): string {
  return pcName(mod(midi, 12), preferFlats) + midiOctave(midi);
}

/**
 * Parse scientific pitch notation ("E2", "F#3", "Bb1", "Cb4") to MIDI.
 * The octave belongs to the letter, so B#3 is MIDI 60 (same as C4)
 * and Cb4 is MIDI 59 (same as B3).
 */
export function parsePitch(input: string): number | null {
  const m = /^\s*([A-Ga-g](?:#{1,2}|b{1,2}|♯|♭)?)(-?\d)\s*$/.exec(input);
  if (!m) return null;
  const note = parseNote(m[1]);
  if (!note) return null;
  const octave = Number(m[2]);
  return (octave + 1) * 12 + LETTER_PC[note.letter] + note.acc;
}

/** Spelled note for a pc chosen to match an existing letter when possible. */
export function sameNote(a: SpelledNote, b: SpelledNote): boolean {
  return a.letter === b.letter && a.acc === b.acc;
}
