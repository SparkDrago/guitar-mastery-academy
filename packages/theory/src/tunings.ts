/**
 * Tuning definitions. Every tuning stores explicit per-string target pitches as
 * MIDI note numbers, ordered from the LOWEST-pitched string to the highest.
 * Nothing in the app assumes six strings.
 */
import { midiName, midiToFreq, parsePitch } from './pitch';

export type TuningCategory = 'standard' | 'lowered-standard' | 'drop' | 'open' | 'other' | 'extended' | 'custom';

export interface Tuning {
  id: string;
  name: string;
  category: TuningCategory;
  /** MIDI notes, lowest string first. */
  strings: number[];
  description?: string;
  /** True for user-created tunings. */
  custom?: boolean;
}

function t(id: string, name: string, category: TuningCategory, pitches: string, description?: string): Tuning {
  const strings = pitches.split(/\s+/).map((p) => {
    const m = parsePitch(p);
    if (m === null) throw new Error(`Bad pitch "${p}" in tuning ${id}`);
    return m;
  });
  return { id, name, category, strings, description };
}

export const TUNING_CATEGORIES: { id: TuningCategory; name: string }[] = [
  { id: 'standard', name: 'Standard' },
  { id: 'lowered-standard', name: 'Half-step & lowered standard' },
  { id: 'drop', name: 'Drop tunings' },
  { id: 'open', name: 'Open tunings' },
  { id: 'other', name: 'Other popular tunings' },
  { id: 'extended', name: 'Extended range (7 & 8 string)' },
  { id: 'custom', name: 'My tunings' },
];

export const TUNINGS: Tuning[] = [
  t('e-standard', 'E Standard', 'standard', 'E2 A2 D3 G3 B3 E4', 'The default guitar tuning.'),

  t('eb-standard', 'E♭ Standard (half step down)', 'lowered-standard', 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4', 'Every string down one semitone. Hendrix, SRV, Van Halen, Guns N\' Roses.'),
  t('d-standard', 'D Standard', 'lowered-standard', 'D2 G2 C3 F3 A3 D4', 'Every string down a whole step.'),
  t('db-standard', 'D♭ Standard', 'lowered-standard', 'Db2 Gb2 Cb3 Fb3 Ab3 Db4', 'Every string down three semitones.'),
  t('c-standard', 'C Standard', 'lowered-standard', 'C2 F2 Bb2 Eb3 G3 C4', 'Every string down two whole steps.'),
  t('b-standard', 'B Standard', 'lowered-standard', 'B1 E2 A2 D3 F#3 B3', 'Baritone-range standard tuning.'),
  t('bb-standard', 'B♭ Standard', 'lowered-standard', 'Bb1 Eb2 Ab2 Db3 F3 Bb3', 'Six semitones below E standard.'),
  t('a-standard', 'A Standard', 'lowered-standard', 'A1 D2 G2 C3 E3 A3', 'A fourth below E standard; baritone guitars.'),

  t('drop-d', 'Drop D', 'drop', 'D2 A2 D3 G3 B3 E4', 'Low E dropped to D: one-finger power chords on the bottom three strings.'),
  t('drop-db', 'Drop D♭', 'drop', 'Db2 Ab2 Db3 Gb3 Bb3 Eb4', 'E♭ standard with the low string dropped a whole step.'),
  t('drop-c', 'Drop C', 'drop', 'C2 G2 C3 F3 A3 D4', 'D standard with the low string dropped to C.'),
  t('drop-b', 'Drop B', 'drop', 'B1 F#2 B2 E3 G#3 C#4', 'D♭ standard with the low string dropped to B.'),
  t('drop-bb', 'Drop B♭', 'drop', 'Bb1 F2 Bb2 Eb3 G3 C4', 'C standard with the low string dropped to B♭.'),
  t('drop-a', 'Drop A', 'drop', 'A1 E2 A2 D3 F#3 B3', 'B standard with the low string dropped to A.'),
  t('drop-g', 'Drop G', 'drop', 'G1 D2 G2 C3 E3 A3', 'A standard with the low string dropped to G.'),

  t('open-e', 'Open E', 'open', 'E2 B2 E3 G#3 B3 E4', 'Open strings form an E major chord; slide guitar favourite.'),
  t('open-d', 'Open D', 'open', 'D2 A2 D3 F#3 A3 D4', 'Open strings form a D major chord.'),
  t('open-dm', 'Open D minor', 'open', 'D2 A2 D3 F3 A3 D4', 'Open strings form a D minor chord.'),
  t('open-g', 'Open G', 'open', 'D2 G2 D3 G3 B3 D4', 'Open strings form a G major chord (Keith Richards often removes the low string).'),
  t('open-a', 'Open A', 'open', 'E2 A2 E3 A3 C#4 E4', 'Open strings form an A major chord.'),
  t('open-c', 'Open C', 'open', 'C2 G2 C3 G3 C4 E4', 'Open strings form a C major chord.'),
  t('open-c6', 'Open C6', 'open', 'C2 A2 C3 G3 C4 E4', 'C6 chord on the open strings (Jimmy Page).'),
  t('open-g6', 'Open G6', 'open', 'D2 G2 D3 G3 B3 E4', 'G6 chord on the open strings.'),
  t('open-f', 'Open F', 'open', 'C2 F2 C3 F3 A3 F4', 'Open strings form an F major chord.'),
  t('open-em', 'Open E minor', 'open', 'E2 B2 E3 G3 B3 E4', 'Open strings form an E minor chord.'),
  t('open-gm', 'Open G minor', 'open', 'D2 G2 D3 G3 Bb3 D4', 'Open strings form a G minor chord.'),

  t('dadgad', 'DADGAD', 'other', 'D2 A2 D3 G3 A3 D4', 'Dsus4 on the open strings; Celtic and modal playing.'),
  t('dgdgbd', 'DGDGBD', 'other', 'D2 G2 D3 G3 B3 D4', 'Same pitches as Open G, listed by its string names.'),
  t('dadf#ad', 'DADF♯AD', 'other', 'D2 A2 D3 F#3 A3 D4', 'Same pitches as Open D, listed by its string names.'),
  t('cgcgce', 'CGCGCE', 'other', 'C2 G2 C3 G3 C4 E4', 'Same pitches as Open C, listed by its string names.'),
  t('facgce', 'FACGCE', 'other', 'F2 A2 C3 G3 C4 E4', 'Fmaj7-flavoured open tuning used in alternative rock.'),
  t('nst', 'New Standard Tuning (NST)', 'other', 'C2 G2 D3 A3 E4 G4', 'Robert Fripp\'s tuning: fifths with a minor-3rd top string.'),

  t('7-standard', '7-string Standard', 'extended', 'B1 E2 A2 D3 G3 B3 E4', 'Standard tuning plus a low B.'),
  t('7-drop-a', '7-string Drop A', 'extended', 'A1 E2 A2 D3 G3 B3 E4', 'Low B dropped to A.'),
  t('7-drop-g', '7-string Drop G', 'extended', 'G1 D2 G2 C3 F3 A3 D4', 'Whole step down with the low string dropped to G.'),
  t('7-drop-f#', '7-string Drop F♯', 'extended', 'F#1 C#2 F#2 B2 E3 G#3 C#4', 'Three semitones down with the low string dropped to F♯.'),
  t('8-standard', '8-string Standard', 'extended', 'F#1 B1 E2 A2 D3 G3 B3 E4', '7-string standard plus a low F♯.'),
  t('8-drop-e', '8-string Drop E', 'extended', 'E1 B1 E2 A2 D3 G3 B3 E4', 'Low F♯ dropped to E.'),
  t('8-drop-d', '8-string Drop D', 'extended', 'D1 A1 D2 G2 C3 F3 A3 D4', 'Whole step down with the low string dropped to D.'),
];

/** Starting points for the "custom 7-string" and "custom 8-string" editors. */
export const CUSTOM_TEMPLATES: Tuning[] = [
  { ...t('custom-7-template', 'Custom 7-string', 'custom', 'B1 E2 A2 D3 G3 B3 E4'), custom: true },
  { ...t('custom-8-template', 'Custom 8-string', 'custom', 'F#1 B1 E2 A2 D3 G3 B3 E4'), custom: true },
];

export const STANDARD_TUNING = TUNINGS[0];

export function findTuning(id: string, extra: Tuning[] = []): Tuning | undefined {
  return TUNINGS.find((x) => x.id === id) ?? extra.find((x) => x.id === id);
}

export function tuningNoteNames(tuning: Tuning, preferFlats = false): string[] {
  return tuning.strings.map((m) => midiName(m, preferFlats));
}

export function tuningFrequencies(tuning: Tuning, a4 = 440): number[] {
  return tuning.strings.map((m) => midiToFreq(m, a4));
}

/** "E A D G B E" style label, lowest first. */
export function tuningLabel(tuning: Tuning, preferFlats?: boolean): string {
  const flats = preferFlats ?? tuning.name.includes('♭');
  return tuning.strings.map((m) => midiName(m, flats).replace(/-?\d+$/, '')).join(' ');
}

export const MIN_STRINGS = 4;
export const MAX_STRINGS = 9;
/** MIDI range accepted for custom tunings (C0 to E6 is far beyond any guitar). */
export const MIN_TUNING_MIDI = 12;
export const MAX_TUNING_MIDI = 88;

export interface TuningValidation {
  ok: boolean;
  errors: string[];
}

export function validateTuning(input: { name: string; strings: number[] }): TuningValidation {
  const errors: string[] = [];
  if (!input.name || !input.name.trim()) errors.push('Give the tuning a name.');
  if (input.name && input.name.length > 60) errors.push('Name must be 60 characters or fewer.');
  if (!Array.isArray(input.strings)) errors.push('Strings must be a list of pitches.');
  else {
    if (input.strings.length < MIN_STRINGS || input.strings.length > MAX_STRINGS)
      errors.push(`A tuning needs between ${MIN_STRINGS} and ${MAX_STRINGS} strings.`);
    input.strings.forEach((m, i) => {
      if (!Number.isInteger(m) || m < MIN_TUNING_MIDI || m > MAX_TUNING_MIDI)
        errors.push(`String ${i + 1} has an out-of-range pitch.`);
    });
  }
  return { ok: errors.length === 0, errors };
}

/** Semitone gaps between adjacent strings, lowest pair first. */
export function stringIntervals(tuning: Tuning): number[] {
  return tuning.strings.slice(1).map((m, i) => m - tuning.strings[i]);
}

/** Conventional string number (1 = highest pitch) for an internal index (0 = lowest). */
export function stringNumber(tuning: Tuning, index: number): number {
  return tuning.strings.length - index;
}
