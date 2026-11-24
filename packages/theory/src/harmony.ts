/**
 * Keys, the circle of fifths, diatonic harmony, Roman numerals,
 * chord progressions and chord–scale relationships.
 */
import { CHORDS, buildChord, getChord, identifyChord, type BuiltChord, type ChordDef } from './chords';
import { intervalToken, parseInterval, spellInterval } from './intervals';
import { LETTERS, mod, noteName, parseNote, pcOf, spellPc, type SpelledNote } from './pitch';
import { SCALES, buildScale, getScale, preferredRoot, type ScaleDef } from './scales';

// ── Keys and signatures ──────────────────────────────────────────────────

export interface KeySignature {
  sharps: number;
  flats: number;
  accidentals: string[];
}

export function keySignature(root: SpelledNote | string, mode: 'major' | 'minor' = 'major'): KeySignature {
  const r = typeof root === 'string' ? parseNote(root)! : root;
  const scale = buildScale(r, mode === 'major' ? 'major' : 'aeolian');
  const sharpOrder = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
  const flatOrder = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  const sharps = scale.notes.filter((n) => n.acc > 0).map((n) => noteName(n));
  const flats = scale.notes.filter((n) => n.acc < 0).map((n) => noteName(n));
  const order = (names: string[], ord: string[]) => names.sort((a, b) => ord.indexOf(a[0]) - ord.indexOf(b[0]));
  return {
    sharps: scale.notes.filter((n) => n.acc > 0).reduce((a, n) => a + n.acc, 0),
    flats: -scale.notes.filter((n) => n.acc < 0).reduce((a, n) => a + n.acc, 0),
    accidentals: sharps.length ? order(sharps, sharpOrder) : order(flats, flatOrder),
  };
}

/** Major keys around the circle of fifths, clockwise from C, with relative minors. */
export const CIRCLE_OF_FIFTHS: { major: string; minor: string; sharps: number; flats: number; enharmonic?: string }[] = [
  { major: 'C', minor: 'Am', sharps: 0, flats: 0 },
  { major: 'G', minor: 'Em', sharps: 1, flats: 0 },
  { major: 'D', minor: 'Bm', sharps: 2, flats: 0 },
  { major: 'A', minor: 'F#m', sharps: 3, flats: 0 },
  { major: 'E', minor: 'C#m', sharps: 4, flats: 0 },
  { major: 'B', minor: 'G#m', sharps: 5, flats: 0, enharmonic: 'Cb' },
  { major: 'F#', minor: 'D#m', sharps: 6, flats: 0, enharmonic: 'Gb' },
  { major: 'Db', minor: 'Bbm', sharps: 0, flats: 5, enharmonic: 'C#' },
  { major: 'Ab', minor: 'Fm', sharps: 0, flats: 4 },
  { major: 'Eb', minor: 'Cm', sharps: 0, flats: 3 },
  { major: 'Bb', minor: 'Gm', sharps: 0, flats: 2 },
  { major: 'F', minor: 'Dm', sharps: 0, flats: 1 },
];

export function relativeMinor(majorRoot: SpelledNote): SpelledNote {
  return spellInterval(majorRoot, parseInterval('6'));
}

export function relativeMajor(minorRoot: SpelledNote): SpelledNote {
  return spellInterval(minorRoot, parseInterval('b3'));
}

// ── Diatonic harmony ─────────────────────────────────────────────────────

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface DiatonicChord {
  degree: number;
  numeral: string;
  chord: BuiltChord;
  function: 'tonic' | 'subdominant' | 'dominant';
}

function qualitySuffix(def: ChordDef): { upper: boolean; suffix: string } {
  switch (def.id) {
    case 'maj': return { upper: true, suffix: '' };
    case 'm': return { upper: false, suffix: '' };
    case 'dim': return { upper: false, suffix: '°' };
    case 'aug': return { upper: true, suffix: '+' };
    case 'maj7': return { upper: true, suffix: 'maj7' };
    case '7': return { upper: true, suffix: '7' };
    case 'm7': return { upper: false, suffix: '7' };
    case 'm7b5': return { upper: false, suffix: 'ø7' };
    case 'dim7': return { upper: false, suffix: '°7' };
    case 'mMaj7': return { upper: false, suffix: '(maj7)' };
    case 'maj7#5': return { upper: true, suffix: '+maj7' };
    default: return { upper: true, suffix: def.symbols[0] };
  }
}

const FUNCTION_BY_DEGREE: DiatonicChord['function'][] = ['tonic', 'subdominant', 'tonic', 'subdominant', 'dominant', 'tonic', 'dominant'];

/** Triads or seventh chords built by stacking thirds inside any 7-note scale. */
export function diatonicChords(root: SpelledNote | string, scale: ScaleDef | string = 'major', sevenths = false): DiatonicChord[] {
  const built = buildScale(root, scale);
  if (built.notes.length !== 7) throw new Error('Diatonic chords need a seven-note scale');
  const out: DiatonicChord[] = [];
  for (let d = 0; d < 7; d++) {
    const tones = [0, 2, 4, ...(sevenths ? [6] : [])].map((k) => built.notes[(d + k) % 7]);
    const pcs = tones.map(pcOf);
    const match = identifyChord(pcs).find((m) => m.root === pcs[0] && m.omitted === 0);
    const def = match?.def ?? getChord(sevenths ? '7' : 'maj');
    const chord = buildChord(tones[0], def);
    const q = qualitySuffix(def);
    const base = ROMAN[d];
    // Accidental relative to the major scale, so minor keys read i, ii°, bIII, iv, v, bVI, bVII.
    const prefix = built.tokens[d].replace(/\d+$/, '');
    out.push({ degree: d + 1, numeral: prefix + (q.upper ? base : base.toLowerCase()) + q.suffix, chord, function: FUNCTION_BY_DEGREE[d] });
  }
  return out;
}

// ── Roman-numeral parsing ────────────────────────────────────────────────

const NUMERAL_RE = /^(b|#|♭|♯)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/;

const DEGREE_OF: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };

/**
 * Turn a numeral like "I", "vi", "bVII", "V7", "ii7", "IVmaj7", "vii°", "V7/V", "iiø7"
 * into a chord. Numerals are always measured from the MAJOR scale of the tonic, the
 * convention used in rock and pop analysis: in A minor, "i–bVI–bVII" is Am–F–G.
 */
export function numeralToChord(numeral: string, key: SpelledNote | string): BuiltChord {
  const tonic = typeof key === 'string' ? parseNote(key)! : key;
  const [main, target] = numeral.split('/');
  let base = tonic;
  if (target) base = numeralToChord(target, tonic).root;

  const m = NUMERAL_RE.exec(main.trim());
  if (!m) throw new Error(`Invalid Roman numeral "${numeral}"`);
  const acc = m[1] === 'b' || m[1] === '♭' ? -1 : m[1] === '#' || m[1] === '♯' ? 1 : 0;
  const upper = m[2] === m[2].toUpperCase();
  const deg = DEGREE_OF[m[2].toUpperCase()];
  const suffix = m[3] ?? '';

  const scale = buildScale(base, 'major');
  const scaleNote = scale.notes[deg - 1];
  const rootNote: SpelledNote = { letter: scaleNote.letter, acc: scaleNote.acc + acc };

  let chordId: string;
  if (suffix === '°' || suffix === 'o' || suffix === 'dim') chordId = 'dim';
  else if (suffix === '°7' || suffix === 'o7') chordId = 'dim7';
  else if (suffix === 'ø' || suffix === 'ø7' || suffix === 'm7b5') chordId = 'm7b5';
  else if (suffix === '+') chordId = 'aug';
  else if (suffix === '7') chordId = upper ? '7' : 'm7';
  else if (suffix === 'maj7') chordId = upper ? 'maj7' : 'mMaj7';
  else if (suffix === '') chordId = upper ? 'maj' : 'm';
  else {
    const candidates = upper ? [suffix] : ['m' + suffix, suffix];
    const hit = CHORDS.find((c) => c.symbols.some((sym) => candidates.includes(sym)));
    chordId = hit?.id ?? (upper ? 'maj' : 'm');
  }
  return buildChord(rootNote, chordId);
}

// ── Progressions ─────────────────────────────────────────────────────────

export interface ProgressionPreset {
  id: string;
  name: string;
  genres: string[];
  mode: 'major' | 'minor';
  /** One entry per bar; use "|"-free numerals. Two chords in one bar: "I IV". */
  bars: string[];
  description: string;
  /** Suggested scale ids for soloing over the whole progression. */
  soloScales: string[];
}

export const PROGRESSIONS: ProgressionPreset[] = [
  { id: '12-bar-blues', name: '12-bar blues (standard)', genres: ['blues', 'rock'], mode: 'major',
    bars: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
    description: 'The foundational blues form: three four-bar phrases on I, IV and V dominant chords, with a V-chord turnaround.',
    soloScales: ['blues', 'minor-pentatonic', 'major-pentatonic', 'mixolydian'] },
  { id: '12-bar-quick', name: '12-bar blues (quick change)', genres: ['blues'], mode: 'major',
    bars: ['I7', 'IV7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
    description: 'Same as the standard form but the IV chord arrives in bar 2.',
    soloScales: ['blues', 'minor-pentatonic', 'mixolydian'] },
  { id: 'minor-blues', name: 'Minor blues', genres: ['blues', 'jazz'], mode: 'minor',
    bars: ['i7', 'iv7', 'i7', 'i7', 'iv7', 'iv7', 'i7', 'i7', 'bVI7', 'V7', 'i7', 'V7'],
    description: 'A 12-bar form with minor seventh chords on i and iv and a dominant V.',
    soloScales: ['minor-pentatonic', 'blues', 'dorian', 'aeolian'] },
  { id: 'pop-axis', name: 'I–V–vi–IV ("axis")', genres: ['pop', 'rock'], mode: 'major',
    bars: ['I', 'V', 'vi', 'IV'], description: 'The most common pop progression of the last 40 years.',
    soloScales: ['major-pentatonic', 'major'] },
  { id: 'doo-wop', name: 'I–vi–IV–V', genres: ['pop', 'rock'], mode: 'major',
    bars: ['I', 'vi', 'IV', 'V'], description: '1950s "doo-wop" changes; still everywhere.',
    soloScales: ['major-pentatonic', 'major'] },
  { id: 'rock-mixo', name: 'I–♭VII–IV (Mixolydian rock)', genres: ['rock', 'hard-rock', 'modal-rock'], mode: 'major',
    bars: ['I', 'bVII', 'IV', 'I'], description: 'Borrowed ♭VII gives the classic-rock Mixolydian sound.',
    soloScales: ['mixolydian', 'major-pentatonic', 'minor-pentatonic'] },
  { id: 'minor-rock', name: 'i–♭VI–♭VII', genres: ['rock', 'metal', 'hard-rock'], mode: 'minor',
    bars: ['i', 'bVI', 'bVII', 'i'], description: 'The heroic natural-minor rock and metal progression.',
    soloScales: ['aeolian', 'minor-pentatonic'] },
  { id: 'andalusian', name: 'Andalusian cadence (i–♭VII–♭VI–V)', genres: ['metal', 'neoclassical', 'rock'], mode: 'minor',
    bars: ['i', 'bVII', 'bVI', 'V7'], description: 'A descending flamenco progression; the major V calls for harmonic minor.',
    soloScales: ['aeolian', 'harmonic-minor', 'phrygian-dominant'] },
  { id: 'neoclassical', name: 'Neoclassical i–iv–V–i', genres: ['neoclassical', 'metal'], mode: 'minor',
    bars: ['i', 'iv', 'V7', 'i'], description: 'Classical-style minor cadence with a dominant V.',
    soloScales: ['harmonic-minor', 'aeolian'] },
  { id: 'dorian-vamp', name: 'Dorian vamp (i7–IV7)', genres: ['funk', 'fusion', 'modal-rock'], mode: 'minor',
    bars: ['i7', 'IV7', 'i7', 'IV7'], description: 'The major IV chord in a minor key is the Dorian signature.',
    soloScales: ['dorian', 'minor-pentatonic'] },
  { id: 'jazz-ii-v-i', name: 'Jazz ii–V–I', genres: ['jazz', 'fusion'], mode: 'major',
    bars: ['ii7', 'V7', 'Imaj7', 'Imaj7'], description: 'The core cadence of jazz harmony.',
    soloScales: ['major'] },
  { id: 'jazz-turnaround', name: 'I–vi–ii–V turnaround', genres: ['jazz'], mode: 'major',
    bars: ['Imaj7', 'vi7', 'ii7', 'V7'], description: 'A cyclic turnaround used to return to the top of a tune.',
    soloScales: ['major'] },
  { id: 'phrygian-metal', name: 'Phrygian metal (i–♭II)', genres: ['metal', 'thrash-metal'], mode: 'minor',
    bars: ['i', 'bII', 'i', 'bII'], description: 'The half-step ♭II gives a dark, menacing Phrygian sound.',
    soloScales: ['phrygian', 'minor-pentatonic'] },
  { id: 'lydian-float', name: 'Lydian float (I–II)', genres: ['ambient', 'progressive-metal', 'fusion'], mode: 'major',
    bars: ['Imaj7', 'II', 'Imaj7', 'II'], description: 'The major II chord highlights Lydian\'s ♯4.',
    soloScales: ['lydian'] },
  { id: 'prog-minor', name: 'Progressive i–♭VI–♭III–♭VII', genres: ['progressive-metal', 'rock'], mode: 'minor',
    bars: ['i', 'bVI', 'bIII', 'bVII'], description: 'Epic natural-minor loop.',
    soloScales: ['aeolian', 'minor-pentatonic'] },
  { id: 'funk-one', name: 'Funk one-chord vamp (I9)', genres: ['funk'], mode: 'major',
    bars: ['I9', 'I9', 'I9', 'I9'], description: 'Groove over one dominant chord; rhythm is everything.',
    soloScales: ['mixolydian', 'minor-pentatonic', 'dorian'] },
  { id: 'ambient-pad', name: 'Ambient Imaj7–IVmaj7', genres: ['ambient'], mode: 'major',
    bars: ['Imaj7', 'Imaj7', 'IVmaj7', 'IVmaj7'], description: 'Slow, spacious major-seventh colours.',
    soloScales: ['major', 'lydian', 'major-pentatonic'] },
];

export interface ResolvedChord {
  bar: number;
  /** Fraction of the bar this chord occupies. */
  beats: number;
  numeral: string;
  chord: BuiltChord;
}

export function resolveProgression(bars: string[], key: SpelledNote | string, beatsPerBar = 4): ResolvedChord[] {
  const out: ResolvedChord[] = [];
  bars.forEach((bar, i) => {
    const parts = bar.trim().split(/\s+/).filter(Boolean);
    parts.forEach((numeral) => {
      out.push({ bar: i, beats: beatsPerBar / parts.length, numeral, chord: numeralToChord(numeral, key) });
    });
  });
  return out;
}

// ── Chord–scale relationships ────────────────────────────────────────────

export interface ScaleSuggestion {
  scale: ScaleDef;
  root: SpelledNote;
  /** Notes shared with the key's parent scale (0..7). */
  keyNotesShared: number;
  /** Chord-scale notes that are not in the key, named. */
  outsideNotes: string[];
  reason: string;
}

export interface ChordScaleAnalysis {
  chord: BuiltChord;
  chordTones: { name: string; token: string }[];
  /** 3rd and 7th (or 3rd and root for triads): the notes that define the chord. */
  guideTones: string[];
  suggestions: ScaleSuggestion[];
  /** Scale tones a half step above a chord tone: tension notes to resolve, not to sit on. */
  tensionNotes: string[];
  inKey: boolean;
}

const CANDIDATE_SCALE_IDS = [
  'major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian',
  'harmonic-minor', 'phrygian-dominant', 'melodic-minor', 'lydian-dominant', 'altered', 'locrian-nat2', 'mixolydian-b6',
  'diminished-hw', 'diminished-wh', 'whole-tone',
];

/**
 * Recommend scales for a chord in the context of a key.
 * Rule: the scale must be built on the chord root and contain every chord tone;
 * among those, prefer the one sharing the most notes with the prevailing key
 * (so the line stays "in key" while still outlining the chord).
 */
export function chordScales(chord: BuiltChord, key: SpelledNote | string, mode: 'major' | 'minor' = 'major', max = 3): ChordScaleAnalysis {
  const tonic = typeof key === 'string' ? parseNote(key)! : key;
  const keyScale = buildScale(tonic, mode === 'major' ? 'major' : 'aeolian');
  const keyPcs = new Set(keyScale.pcs);
  const chordPcs = new Set(chord.pcs);
  const suggestions: ScaleSuggestion[] = [];
  for (const id of CANDIDATE_SCALE_IDS) {
    const def = getScale(id);
    const built = buildScale(chord.root, def);
    const pcs = new Set(built.pcs);
    if (![...chordPcs].every((p) => pcs.has(p))) continue;
    const shared = built.pcs.filter((p) => keyPcs.has(p)).length;
    const outside = built.notes.filter((n) => !keyPcs.has(pcOf(n))).map((n) => noteName(n));
    const rootName = noteName(chord.root);
    let reason: string;
    if (outside.length === 0)
      reason = `Uses only notes of the key (${noteName(tonic)} ${mode}) starting from ${rootName}, and contains every tone of ${chord.symbol}.`;
    else
      reason = `Contains every tone of ${chord.symbol}; differs from the key by ${outside.join(', ')}, which ${outside.length === 1 ? 'is' : 'are'} needed to match the chord.`;
    suggestions.push({ scale: def, root: chord.root, keyNotesShared: shared, outsideNotes: outside, reason });
  }
  const simplicity = (id: string) => CANDIDATE_SCALE_IDS.indexOf(id);
  suggestions.sort((a, b) => b.keyNotesShared - a.keyNotesShared || simplicity(a.scale.id) - simplicity(b.scale.id));

  const top = suggestions[0];
  const tension = top
    ? buildScale(chord.root, top.scale).notes.filter((n) => {
        const pc = pcOf(n);
        return !chordPcs.has(pc) && chord.pcs.some((c) => mod(pc - c, 12) === 1);
      }).map((n) => noteName(n))
    : [];

  const thirdIdx = chord.tokens.findIndex((t) => t === '3' || t === 'b3');
  const seventhIdx = chord.tokens.findIndex((t) => /7$/.test(t));
  const guide = [thirdIdx, seventhIdx].filter((i) => i >= 0).map((i) => noteName(chord.notes[i]));

  return {
    chord,
    chordTones: chord.notes.map((n, i) => ({ name: noteName(n), token: chord.tokens[i] })),
    guideTones: guide.length ? guide : [noteName(chord.notes[0])],
    suggestions: suggestions.slice(0, max),
    tensionNotes: tension,
    inKey: chord.pcs.every((p) => keyPcs.has(p)),
  };
}

/** Explain why a single note sounds the way it does over a chord. */
export function noteOverChord(notePc: number, chord: BuiltChord): { token: string; role: 'chord tone' | 'tension' | 'avoid'; explanation: string } {
  const semis = mod(notePc - pcOf(chord.root), 12);
  const name = noteName(spellPc(notePc));
  const idx = chord.pcs.indexOf(mod(notePc, 12));
  if (idx >= 0) {
    const token = chord.tokens[idx];
    const role = token === '1' ? 'the root: maximum stability' : token.endsWith('3') ? 'the 3rd: it defines major or minor' : token.endsWith('7') ? 'the 7th: it adds colour and pull' : token.endsWith('5') ? 'the 5th: strong but neutral' : 'a chord extension that is part of this chord';
    return { token, role: 'chord tone', explanation: `${name} is ${role}. Landing on it sounds resolved over ${chord.symbol}.` };
  }
  const halfStepAbove = chord.pcs.some((c) => mod(notePc - c, 12) === 1);
  const tokenNames = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];
  const token = tokenNames[semis];
  if (halfStepAbove)
    return { token, role: 'avoid', explanation: `${name} sits a half step above a chord tone of ${chord.symbol}, so it clashes if held. Use it as a passing note and resolve it down.` };
  return { token, role: 'tension', explanation: `${name} is a colour tone (${token}) over ${chord.symbol}: it adds tension that resolves nicely to a nearby chord tone.` };
}

export function keyLabel(root: SpelledNote, mode: 'major' | 'minor'): string {
  return `${noteName(root)} ${mode}`;
}

/** Key choices for UI selectors, spelled the common way. */
export const KEY_ROOTS_MAJOR = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
export const KEY_ROOTS_MINOR = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'Bb', 'F', 'C', 'G', 'D'];

export { LETTERS, intervalToken, preferredRoot, SCALES };

/**
 * Parent major key of a mode: the mode with index `modeIndex` (1 = Ionian … 7 = Locrian)
 * on `root` uses the notes of this major scale. D Dorian → C, E Phrygian → C, F# Locrian → G.
 */
export function parentMajorOf(root: SpelledNote | string, modeIndex: number): SpelledNote {
  const r = typeof root === 'string' ? parseNote(root)! : root;
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const letter = mod(r.letter - (modeIndex - 1), 7);
  const target = mod(pcOf(r) - MAJOR[modeIndex - 1], 12);
  const natural = [0, 2, 4, 5, 7, 9, 11][letter];
  return { letter, acc: mod(target - natural + 6, 12) - 6 };
}
