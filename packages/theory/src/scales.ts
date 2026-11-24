/**
 * Scale catalog and scale construction.
 * Formulas are written relative to the major scale (the Pillitiere-style
 * "everything is a variation of the major scale" view).
 */
import {
  intervalToken,
  parseFormula,
  spellInterval,
  type Interval,
} from './intervals';
import { FLAT_NAMES, SHARP_NAMES, mod, parseNote, pcOf, type SpelledNote } from './pitch';

export type ScaleCategory =
  | 'diatonic'
  | 'pentatonic'
  | 'blues'
  | 'minor-variant'
  | 'harmonic-minor-mode'
  | 'melodic-minor-mode'
  | 'symmetrical'
  | 'exotic'
  | 'bebop'
  | 'chromatic';

export interface ScaleDef {
  id: string;
  name: string;
  aliases?: string[];
  formula: string[];
  category: ScaleCategory;
  /** Parent scale and degree, for modes. */
  modeOf?: { parent: string; degree: number };
  /** Notes that give the scale its colour, as formula tokens. */
  characteristic?: string[];
  /** Short description of the sound. */
  sound: string;
  /** Where the scale is used. */
  applications: string[];
  /** Chord qualities (chord ids) the scale fits on its root. */
  chordFit: string[];
  /** True for the 7-note scales that Pillitiere's shape system covers. */
  naturalDiatonic?: boolean;
}

export const SCALES: ScaleDef[] = [
  // ── Major-scale modes (natural diatonic) ──────────────────────────────
  {
    id: 'major', name: 'Major (Ionian)', aliases: ['ionian'], formula: ['1', '2', '3', '4', '5', '6', '7'],
    category: 'diatonic', modeOf: { parent: 'major', degree: 1 }, characteristic: ['3', '7'], naturalDiatonic: true,
    sound: 'Bright, settled and resolved. The reference sound of Western music.',
    applications: ['Pop, rock and country melodies', 'Soloing over I chords in major keys', 'The parent system for every mode'],
    chordFit: ['maj', 'maj7', '6', 'add9', 'maj9', 'sus2'],
  },
  {
    id: 'dorian', name: 'Dorian', formula: ['1', '2', 'b3', '4', '5', '6', 'b7'],
    category: 'diatonic', modeOf: { parent: 'major', degree: 2 }, characteristic: ['6'], naturalDiatonic: true,
    sound: 'Minor, but with a hopeful lift from the natural 6th.',
    applications: ['Funk, soul, jazz and Santana-style rock over minor vamps', 'The ii chord of a major key', 'Minor progressions that contain a major IV chord'],
    chordFit: ['m', 'm7', 'm6', 'm9', 'm11', 'm13'],
  },
  {
    id: 'phrygian', name: 'Phrygian', formula: ['1', 'b2', 'b3', '4', '5', 'b6', 'b7'],
    category: 'diatonic', modeOf: { parent: 'major', degree: 3 }, characteristic: ['b2'], naturalDiatonic: true,
    sound: 'Dark and tense; the ♭2 sits a half step above the root.',
    applications: ['Metal riffs and flamenco-flavoured lines', 'The iii chord of a major key', 'Minor vamps with a ♭II chord'],
    chordFit: ['m', 'm7', '7sus4b9'],
  },
  {
    id: 'lydian', name: 'Lydian', formula: ['1', '2', '3', '#4', '5', '6', '7'],
    category: 'diatonic', modeOf: { parent: 'major', degree: 4 }, characteristic: ['#4'], naturalDiatonic: true,
    sound: 'Dreamy and floating; the ♯4 removes the major scale\'s tension against the 3rd.',
    applications: ['Film scores, progressive rock and fusion', 'The IV chord of a major key', 'Major chords where the 4th would clash'],
    chordFit: ['maj', 'maj7', 'maj7#11', 'maj9'],
  },
  {
    id: 'mixolydian', name: 'Mixolydian', formula: ['1', '2', '3', '4', '5', '6', 'b7'],
    category: 'diatonic', modeOf: { parent: 'major', degree: 5 }, characteristic: ['b7'], naturalDiatonic: true,
    sound: 'Major with a bluesy ♭7: confident and unresolved.',
    applications: ['Blues, classic rock and jam-band soloing', 'Dominant 7th chords (the V of a major key)', 'Rock songs built on I–♭VII–IV'],
    chordFit: ['7', '9', '13', 'maj', '7sus4', '9sus4'],
  },
  {
    id: 'aeolian', name: 'Natural Minor (Aeolian)', aliases: ['minor', 'natural-minor'], formula: ['1', '2', 'b3', '4', '5', 'b6', 'b7'],
    category: 'diatonic', modeOf: { parent: 'major', degree: 6 }, characteristic: ['b6'], naturalDiatonic: true,
    sound: 'Sad, serious and dramatic. The relative minor of the major scale.',
    applications: ['Rock and metal riffs and solos', 'The vi chord of a major key', 'Minor keys (i–♭VI–♭VII progressions)'],
    chordFit: ['m', 'm7', 'm9', 'madd9'],
  },
  {
    id: 'locrian', name: 'Locrian', formula: ['1', 'b2', 'b3', '4', 'b5', 'b6', 'b7'],
    category: 'diatonic', modeOf: { parent: 'major', degree: 7 }, characteristic: ['b5', 'b2'], naturalDiatonic: true,
    sound: 'Unstable: the diminished 5th means the root chord never sounds at rest.',
    applications: ['Half-diminished (m7♭5) chords', 'The vii chord of a major key', 'Occasional extreme-metal riffing'],
    chordFit: ['dim', 'm7b5'],
  },

  // ── Pentatonic and blues ──────────────────────────────────────────────
  {
    id: 'minor-pentatonic', name: 'Minor Pentatonic', formula: ['1', 'b3', '4', '5', 'b7'], category: 'pentatonic',
    characteristic: ['b3', 'b7'],
    sound: 'Raw and vocal: five notes with no half steps, so nothing clashes.',
    applications: ['The first lead-guitar scale for rock and blues', 'Soloing over minor chords and whole minor keys', 'Over dominant and major chords for a bluesy "against the grain" sound'],
    chordFit: ['m', 'm7', '5', '7'],
  },
  {
    id: 'major-pentatonic', name: 'Major Pentatonic', formula: ['1', '2', '3', '5', '6'], category: 'pentatonic',
    characteristic: ['3', '6'],
    sound: 'Sweet and open: country, Southern rock and soul.',
    applications: ['Major-key melodies and solos', 'Over I, IV and V chords in country and pop', 'Mixing with minor pentatonic in blues'],
    chordFit: ['maj', '6', 'add9', '7', '6/9'],
  },
  {
    id: 'blues', name: 'Blues Scale (minor)', aliases: ['minor-blues'], formula: ['1', 'b3', '4', 'b5', '5', 'b7'], category: 'blues',
    characteristic: ['b5'],
    sound: 'Minor pentatonic plus the ♭5 "blue note", used as a passing tone.',
    applications: ['12-bar blues soloing over all three chords', 'Rock and metal licks', 'Chromatic passing between 4 and 5'],
    chordFit: ['m', 'm7', '7', '5'],
  },
  {
    id: 'major-blues', name: 'Major Blues Scale', formula: ['1', '2', 'b3', '3', '5', '6'], category: 'blues',
    characteristic: ['b3'],
    sound: 'Major pentatonic with the ♭3 sliding up into the 3rd.',
    applications: ['Country and blues-rock over major and dominant chords'],
    chordFit: ['maj', '7', '6'],
  },

  // ── Minor variants and their modes ────────────────────────────────────
  {
    id: 'harmonic-minor', name: 'Harmonic Minor', formula: ['1', '2', 'b3', '4', '5', 'b6', '7'], category: 'minor-variant',
    modeOf: { parent: 'harmonic-minor', degree: 1 }, characteristic: ['7', 'b6'],
    sound: 'Exotic and classical: the raised 7th creates a 1½-step gap after the ♭6.',
    applications: ['Neoclassical metal', 'Creating a major V chord (V7) in minor keys', 'Over minor-major 7th chords'],
    chordFit: ['m', 'mMaj7'],
  },
  {
    id: 'locrian-nat6', name: 'Locrian ♮6', formula: ['1', 'b2', 'b3', '4', 'b5', '6', 'b7'], category: 'harmonic-minor-mode',
    modeOf: { parent: 'harmonic-minor', degree: 2 }, characteristic: ['6'],
    sound: 'Half-diminished with a brighter natural 6th.', applications: ['iiø chords in minor keys'], chordFit: ['m7b5'],
  },
  {
    id: 'ionian-sharp5', name: 'Ionian ♯5', formula: ['1', '2', '3', '4', '#5', '6', '7'], category: 'harmonic-minor-mode',
    modeOf: { parent: 'harmonic-minor', degree: 3 }, characteristic: ['#5'],
    sound: 'Major with an augmented 5th: bright but unsettled.', applications: ['Augmented major 7th chords'], chordFit: ['aug', 'maj7#5'],
  },
  {
    id: 'dorian-sharp4', name: 'Dorian ♯4 (Ukrainian Dorian)', formula: ['1', '2', 'b3', '#4', '5', '6', 'b7'], category: 'harmonic-minor-mode',
    modeOf: { parent: 'harmonic-minor', degree: 4 }, characteristic: ['#4'],
    sound: 'Minor with a Romani/Eastern European flavour.', applications: ['Folk-influenced minor vamps', 'Gypsy jazz colours'], chordFit: ['m', 'm7'],
  },
  {
    id: 'phrygian-dominant', name: 'Phrygian Dominant', aliases: ['spanish-phrygian'], formula: ['1', 'b2', '3', '4', '5', 'b6', 'b7'], category: 'harmonic-minor-mode',
    modeOf: { parent: 'harmonic-minor', degree: 5 }, characteristic: ['b2', '3'],
    sound: 'Spanish, Middle-Eastern, and very metal: a major 3rd over a ♭2.',
    applications: ['The V7 chord in a minor key', 'Flamenco and neoclassical metal', 'Middle-Eastern-flavoured riffs'],
    chordFit: ['7', '7b9', '7b13'],
  },
  {
    id: 'lydian-sharp2', name: 'Lydian ♯2', formula: ['1', '#2', '3', '#4', '5', '6', '7'], category: 'harmonic-minor-mode',
    modeOf: { parent: 'harmonic-minor', degree: 6 }, characteristic: ['#2', '#4'],
    sound: 'Bright and strange, with an augmented 2nd.', applications: ['Colour over major 7th chords in minor keys'], chordFit: ['maj7', 'maj7#11'],
  },
  {
    id: 'ultralocrian', name: 'Ultralocrian (Altered ♭♭7)', formula: ['1', 'b2', 'b3', 'b4', 'b5', 'b6', 'bb7'], category: 'harmonic-minor-mode',
    modeOf: { parent: 'harmonic-minor', degree: 7 }, characteristic: ['bb7'],
    sound: 'Very dark: fits a fully diminished seventh chord.', applications: ['vii°7 chords in minor keys'], chordFit: ['dim', 'dim7'],
  },
  {
    id: 'melodic-minor', name: 'Melodic Minor (jazz minor)', formula: ['1', '2', 'b3', '4', '5', '6', '7'], category: 'minor-variant',
    modeOf: { parent: 'melodic-minor', degree: 1 }, characteristic: ['b3', '7'],
    sound: 'A major scale with a minor 3rd: smooth, sophisticated minor.',
    applications: ['Jazz and fusion minor chords', 'Minor-major 7th chords', 'Parent of the altered and Lydian dominant scales'],
    chordFit: ['m', 'mMaj7', 'm6'],
  },
  {
    id: 'dorian-b2', name: 'Dorian ♭2 (Phrygian ♮6)', formula: ['1', 'b2', 'b3', '4', '5', '6', 'b7'], category: 'melodic-minor-mode',
    modeOf: { parent: 'melodic-minor', degree: 2 }, characteristic: ['b2', '6'],
    sound: 'Dorian with a dark ♭2.', applications: ['Suspended ♭9 chords'], chordFit: ['m7', '7sus4b9'],
  },
  {
    id: 'lydian-augmented', name: 'Lydian Augmented', formula: ['1', '2', '3', '#4', '#5', '6', '7'], category: 'melodic-minor-mode',
    modeOf: { parent: 'melodic-minor', degree: 3 }, characteristic: ['#5'],
    sound: 'Lydian with a raised 5th.', applications: ['maj7♯5 chords'], chordFit: ['maj7#5', 'aug'],
  },
  {
    id: 'lydian-dominant', name: 'Lydian Dominant', aliases: ['overtone'], formula: ['1', '2', '3', '#4', '5', '6', 'b7'], category: 'melodic-minor-mode',
    modeOf: { parent: 'melodic-minor', degree: 4 }, characteristic: ['#4', 'b7'],
    sound: 'Dominant 7th with a ♯11: the "Simpsons theme" sound.',
    applications: ['Non-resolving dominant chords (♭VII7, II7, tritone subs)', 'Fusion'], chordFit: ['7', '7#11', '9'],
  },
  {
    id: 'mixolydian-b6', name: 'Mixolydian ♭6 (Aeolian dominant)', formula: ['1', '2', '3', '4', '5', 'b6', 'b7'], category: 'melodic-minor-mode',
    modeOf: { parent: 'melodic-minor', degree: 5 }, characteristic: ['b6'],
    sound: 'Major 3rd but minor 6th: bittersweet.', applications: ['Dominant chords resolving to minor'], chordFit: ['7', '7b13'],
  },
  {
    id: 'locrian-nat2', name: 'Locrian ♮2 (half-diminished)', formula: ['1', '2', 'b3', '4', 'b5', 'b6', 'b7'], category: 'melodic-minor-mode',
    modeOf: { parent: 'melodic-minor', degree: 6 }, characteristic: ['2'],
    sound: 'The preferred jazz sound for half-diminished chords.', applications: ['m7♭5 chords'], chordFit: ['m7b5'],
  },
  {
    id: 'altered', name: 'Altered (Super Locrian)', aliases: ['super-locrian'], formula: ['1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'], category: 'melodic-minor-mode',
    modeOf: { parent: 'melodic-minor', degree: 7 }, characteristic: ['b2', 'b4'],
    sound: 'Maximum tension over a dominant chord: ♭9, ♯9, ♯11 and ♭13 all at once.',
    applications: ['Altered dominant chords resolving to I or i', 'Jazz and fusion lines'], chordFit: ['7alt', '7#9', '7b9', '7#5'],
  },

  // ── Symmetrical ───────────────────────────────────────────────────────
  {
    id: 'whole-tone', name: 'Whole Tone', formula: ['1', '2', '3', '#4', '#5', 'b7'], category: 'symmetrical',
    characteristic: ['#4', '#5'],
    sound: 'Dreamlike, with no sense of home: every step is a whole step.',
    applications: ['Augmented and 7♯5 chords', 'Impressionist colour', 'Fusion and prog'], chordFit: ['aug', '7#5', '9#5'],
  },
  {
    id: 'diminished-hw', name: 'Half-Whole Diminished (dominant diminished)', formula: ['1', 'b2', '#2', '3', '#4', '5', '6', 'b7'], category: 'symmetrical',
    characteristic: ['b2', '#2', '#4'],
    sound: 'Tense and symmetrical; repeats every minor 3rd.',
    applications: ['Dominant 7♭9 and 13♭9 chords', 'Metal and fusion runs'], chordFit: ['7', '7b9', '13'],
  },
  {
    id: 'diminished-wh', name: 'Whole-Half Diminished', formula: ['1', '2', 'b3', '4', 'b5', 'b6', '6', '7'], category: 'symmetrical',
    characteristic: ['b5', '7'],
    sound: 'The "true" diminished scale for diminished 7th chords.',
    applications: ['Diminished 7th chords', 'Neoclassical runs'], chordFit: ['dim', 'dim7'],
  },
  {
    id: 'augmented', name: 'Augmented (hexatonic)', formula: ['1', '#2', '3', '5', '#5', '7'], category: 'symmetrical',
    sound: 'Two augmented triads a half step apart; angular and modern.', applications: ['Modern jazz and fusion lines'], chordFit: ['maj7', 'aug'],
  },
  {
    id: 'chromatic', name: 'Chromatic', formula: ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'], category: 'chromatic',
    sound: 'All twelve notes. A technique and passing-tone resource rather than a key.',
    applications: ['Finger-independence warm-ups', 'Chromatic passing and approach tones'], chordFit: [],
  },

  // ── Exotic ────────────────────────────────────────────────────────────
  {
    id: 'hungarian-minor', name: 'Hungarian Minor', formula: ['1', '2', 'b3', '#4', '5', 'b6', '7'], category: 'exotic',
    characteristic: ['#4', '7'], sound: 'Harmonic minor with a ♯4: two augmented 2nds.', applications: ['Neoclassical and folk-metal melodies'], chordFit: ['m', 'mMaj7'],
  },
  {
    id: 'double-harmonic', name: 'Double Harmonic Major (Byzantine)', formula: ['1', 'b2', '3', '4', '5', 'b6', '7'], category: 'exotic',
    characteristic: ['b2', '7'], sound: 'Strongly Middle-Eastern.', applications: ['Exotic melodic colour over a major chord'], chordFit: ['maj', 'maj7'],
  },
  {
    id: 'neapolitan-minor', name: 'Neapolitan Minor', formula: ['1', 'b2', 'b3', '4', '5', 'b6', '7'], category: 'exotic',
    characteristic: ['b2', '7'], sound: 'Harmonic minor with a ♭2: dark and operatic.', applications: ['Neoclassical metal'], chordFit: ['m', 'mMaj7'],
  },
  {
    id: 'hirajoshi', name: 'Hirajōshi', formula: ['1', '2', 'b3', '5', 'b6'], category: 'exotic',
    sound: 'A Japanese pentatonic with half steps; haunting.', applications: ['Pentatonic alternative over minor chords'], chordFit: ['m'],
  },
  {
    id: 'in-sen', name: 'In Sen', formula: ['1', 'b2', '4', '5', 'b7'], category: 'exotic',
    sound: 'Sparse Japanese pentatonic with a ♭2.', applications: ['Atmospheric, suspended colour'], chordFit: ['7sus4', 'm'],
  },
  {
    id: 'bebop-dominant', name: 'Bebop Dominant', formula: ['1', '2', '3', '4', '5', '6', 'b7', '7'], category: 'bebop',
    characteristic: ['7'], sound: 'Mixolydian with a chromatic passing major 7th, so chord tones land on beats.',
    applications: ['Jazz eighth-note lines over dominant chords'], chordFit: ['7', '9', '13'],
  },
];

const SCALE_MAP = new Map<string, ScaleDef>();
for (const s of SCALES) {
  SCALE_MAP.set(s.id, s);
  for (const a of s.aliases ?? []) SCALE_MAP.set(a, s);
}

export function getScale(id: string): ScaleDef {
  const s = SCALE_MAP.get(id);
  if (!s) throw new Error(`Unknown scale "${id}"`);
  return s;
}

export function findScale(id: string): ScaleDef | undefined {
  return SCALE_MAP.get(id);
}

export function scaleIntervals(scale: ScaleDef | string): Interval[] {
  const def = typeof scale === 'string' ? getScale(scale) : scale;
  return parseFormula(def.formula);
}

export interface BuiltScale {
  def: ScaleDef;
  root: SpelledNote;
  intervals: Interval[];
  notes: SpelledNote[];
  pcs: number[];
  tokens: string[];
}

export function buildScale(root: SpelledNote | string, scale: ScaleDef | string): BuiltScale {
  const r = typeof root === 'string' ? parseNote(root) : root;
  if (!r) throw new Error(`Invalid root "${String(root)}"`);
  const def = typeof scale === 'string' ? getScale(scale) : scale;
  const intervals = parseFormula(def.formula);
  const notes = intervals.map((iv) => spellInterval(r, iv));
  return {
    def,
    root: r,
    intervals,
    notes,
    pcs: notes.map(pcOf),
    tokens: intervals.map(intervalToken),
  };
}

/** Step pattern (in semitones) between consecutive scale notes, closing the octave. */
export function stepPattern(scale: ScaleDef | string): number[] {
  const ivs = scaleIntervals(scale);
  const semis = ivs.map((i) => i.semitones);
  return semis.map((s, i) => (i === semis.length - 1 ? 12 - s : semis[i + 1] - s));
}

/** "W W H W W W H" style description of a step pattern. */
export function stepNames(steps: number[]): string {
  return steps.map((s) => (s === 1 ? 'H' : s === 2 ? 'W' : s === 3 ? 'W+H' : `${s}`)).join(' ');
}

/** Rotate a heptatonic (or any) scale to produce its n-th mode formula (degree 1-based). */
export function modeFormula(parent: ScaleDef | string, degree: number): number[] {
  const semis = scaleIntervals(parent).map((i) => i.semitones);
  const start = semis[degree - 1];
  return semis.slice(degree - 1).concat(semis.slice(0, degree - 1)).map((s) => mod(s - start, 12));
}

function accidentalWeight(notes: SpelledNote[]): number {
  return notes.reduce((n, x) => n + Math.abs(x.acc) * (Math.abs(x.acc) > 1 ? 3 : 1), 0);
}

/**
 * Pick the most readable spelling for a root pitch class in a given scale
 * (fewest accidentals, no double sharps or flats where avoidable).
 */
export function preferredRoot(pc: number, scale: ScaleDef | string = 'major'): SpelledNote {
  const candidates = [SHARP_NAMES[mod(pc, 12)], FLAT_NAMES[mod(pc, 12)]];
  let best = parseNote(candidates[0])!;
  let bestW = Infinity;
  for (const c of candidates) {
    const n = parseNote(c)!;
    const w = accidentalWeight(buildScale(n, scale).notes);
    if (w < bestW) {
      best = n;
      bestW = w;
    }
  }
  return best;
}

/** All modes (as ScaleDefs) of a parent scale, ordered by degree. */
export function modesOf(parentId: string): ScaleDef[] {
  return SCALES.filter((s) => s.modeOf?.parent === parentId).sort((a, b) => a.modeOf!.degree - b.modeOf!.degree);
}

export const MAJOR_MODE_IDS = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'] as const;
