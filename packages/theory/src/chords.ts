/**
 * Chord catalog, chord-symbol parsing, chord identification and inversions.
 */
import { intervalToken, parseFormula, spellInterval, type Interval } from './intervals';
import { FLAT_NAMES, SHARP_NAMES, mod, noteName, parseNote, pcOf, type SpelledNote } from './pitch';

export type ChordCategory =
  | 'power'
  | 'triad'
  | 'suspended'
  | 'sixth'
  | 'seventh'
  | 'add'
  | 'extended'
  | 'altered';

export interface ChordDef {
  id: string;
  /** Suffix written after the root, e.g. "m7b5". The first entry of `symbols` is preferred. */
  symbols: string[];
  name: string;
  formula: string[];
  category: ChordCategory;
  /** Formula tokens that may be left out of a guitar voicing. */
  optional?: string[];
  description: string;
}

export const CHORDS: ChordDef[] = [
  { id: '5', symbols: ['5'], name: 'Power chord', formula: ['1', '5'], category: 'power', description: 'Root and 5th only: neither major nor minor, so it stays clear under heavy distortion.' },
  { id: 'maj', symbols: ['', 'maj', 'M'], name: 'Major triad', formula: ['1', '3', '5'], category: 'triad', description: 'Root, major 3rd, perfect 5th. Bright and stable.' },
  { id: 'm', symbols: ['m', 'min', '-'], name: 'Minor triad', formula: ['1', 'b3', '5'], category: 'triad', description: 'Root, minor 3rd, perfect 5th. Darker and sadder.' },
  { id: 'dim', symbols: ['dim', '°', 'o'], name: 'Diminished triad', formula: ['1', 'b3', 'b5'], category: 'triad', description: 'Two stacked minor 3rds. Tense and unstable; wants to resolve.' },
  { id: 'aug', symbols: ['aug', '+'], name: 'Augmented triad', formula: ['1', '3', '#5'], category: 'triad', description: 'Two stacked major 3rds. Symmetrical and suspenseful.' },
  { id: 'sus2', symbols: ['sus2'], name: 'Suspended 2nd', formula: ['1', '2', '5'], category: 'suspended', description: 'The 3rd is replaced by the 2nd: open and ambiguous.' },
  { id: 'sus4', symbols: ['sus4', 'sus'], name: 'Suspended 4th', formula: ['1', '4', '5'], category: 'suspended', description: 'The 3rd is replaced by the 4th, which pulls back down to the 3rd.' },
  { id: '6', symbols: ['6'], name: 'Major 6th', formula: ['1', '3', '5', '6'], category: 'sixth', optional: ['5'], description: 'Major triad plus the 6th: sweet, vintage sound.' },
  { id: 'm6', symbols: ['m6'], name: 'Minor 6th', formula: ['1', 'b3', '5', '6'], category: 'sixth', optional: ['5'], description: 'Minor triad with a major 6th: the Dorian chord.' },
  { id: '6/9', symbols: ['6/9', '69'], name: 'Six-nine', formula: ['1', '3', '5', '6', '9'], category: 'sixth', optional: ['5'], description: 'Major 6th with an added 9th; a lush final chord.' },
  { id: 'maj7', symbols: ['maj7', 'M7', 'Δ7', 'Δ'], name: 'Major 7th', formula: ['1', '3', '5', '7'], category: 'seventh', optional: ['5'], description: 'Major triad plus major 7th: smooth and jazzy.' },
  { id: '7', symbols: ['7', 'dom7'], name: 'Dominant 7th', formula: ['1', '3', '5', 'b7'], category: 'seventh', optional: ['5'], description: 'Major triad plus minor 7th. The tritone between 3 and ♭7 drives resolution; the core blues chord.' },
  { id: 'm7', symbols: ['m7', 'min7', '-7'], name: 'Minor 7th', formula: ['1', 'b3', '5', 'b7'], category: 'seventh', optional: ['5'], description: 'Minor triad plus minor 7th: mellow and soulful.' },
  { id: 'm7b5', symbols: ['m7b5', 'ø', 'ø7'], name: 'Half-diminished 7th', formula: ['1', 'b3', 'b5', 'b7'], category: 'seventh', description: 'Diminished triad plus minor 7th; the ii chord of minor keys.' },
  { id: 'dim7', symbols: ['dim7', '°7', 'o7'], name: 'Diminished 7th', formula: ['1', 'b3', 'b5', 'bb7'], category: 'seventh', description: 'Stacked minor 3rds; symmetrical every three frets.' },
  { id: 'mMaj7', symbols: ['mMaj7', 'm(maj7)', 'mM7'], name: 'Minor-major 7th', formula: ['1', 'b3', '5', '7'], category: 'seventh', optional: ['5'], description: 'Minor triad with a major 7th: the film-noir chord.' },
  { id: '7sus4', symbols: ['7sus4', '7sus'], name: 'Dominant 7 sus4', formula: ['1', '4', '5', 'b7'], category: 'suspended', optional: ['5'], description: 'Dominant 7th with the 4th replacing the 3rd.' },
  { id: 'add9', symbols: ['add9', 'add2'], name: 'Add 9', formula: ['1', '3', '5', '9'], category: 'add', optional: ['5'], description: 'Major triad plus the 9th, without a 7th.' },
  { id: 'madd9', symbols: ['madd9', 'm(add9)'], name: 'Minor add 9', formula: ['1', 'b3', '5', '9'], category: 'add', optional: ['5'], description: 'Minor triad plus the 9th; moody and modern.' },
  { id: 'add4', symbols: ['add4', 'add11'], name: 'Add 4', formula: ['1', '3', '4', '5'], category: 'add', optional: ['5'], description: 'Major triad with the 4th added (the 3rd stays).' },
  { id: 'maj9', symbols: ['maj9', 'M9'], name: 'Major 9th', formula: ['1', '3', '5', '7', '9'], category: 'extended', optional: ['5'], description: 'Major 7th plus 9th.' },
  { id: '9', symbols: ['9'], name: 'Dominant 9th', formula: ['1', '3', '5', 'b7', '9'], category: 'extended', optional: ['5'], description: 'Dominant 7th plus 9th; funk and blues staple.' },
  { id: 'm9', symbols: ['m9', 'min9'], name: 'Minor 9th', formula: ['1', 'b3', '5', 'b7', '9'], category: 'extended', optional: ['5'], description: 'Minor 7th plus 9th.' },
  { id: '11', symbols: ['11'], name: 'Dominant 11th', formula: ['1', '3', '5', 'b7', '9', '11'], category: 'extended', optional: ['3', '5', '9'], description: 'Usually voiced without the 3rd, which clashes with the 11th.' },
  { id: 'm11', symbols: ['m11'], name: 'Minor 11th', formula: ['1', 'b3', '5', 'b7', '9', '11'], category: 'extended', optional: ['5', '9'], description: 'Open, modern minor sound.' },
  { id: '13', symbols: ['13'], name: 'Dominant 13th', formula: ['1', '3', '5', 'b7', '9', '11', '13'], category: 'extended', optional: ['5', '9', '11'], description: 'Usually voiced 1–3–♭7–13.' },
  { id: 'maj13', symbols: ['maj13'], name: 'Major 13th', formula: ['1', '3', '5', '7', '9', '13'], category: 'extended', optional: ['5', '9'], description: 'Major 7th with 9th and 13th.' },
  { id: 'm13', symbols: ['m13'], name: 'Minor 13th', formula: ['1', 'b3', '5', 'b7', '9', '11', '13'], category: 'extended', optional: ['5', '9', '11'], description: 'Minor 7th with 13th; Dorian colour.' },
  { id: '9sus4', symbols: ['9sus4', '9sus'], name: 'Dominant 9 sus4', formula: ['1', '4', '5', 'b7', '9'], category: 'suspended', optional: ['5'], description: 'A soft, modern dominant sound.' },
  { id: '7b9', symbols: ['7b9'], name: 'Dominant 7♭9', formula: ['1', '3', '5', 'b7', 'b9'], category: 'altered', optional: ['5'], description: 'Dominant with ♭9; strong pull to a minor chord.' },
  { id: '7#9', symbols: ['7#9'], name: 'Dominant 7♯9', formula: ['1', '3', '5', 'b7', '#9'], category: 'altered', optional: ['5'], description: 'The "Hendrix chord": major and minor 3rd at once.' },
  { id: '7b5', symbols: ['7b5'], name: 'Dominant 7♭5', formula: ['1', '3', 'b5', 'b7'], category: 'altered', description: 'Dominant with a lowered 5th.' },
  { id: '7#5', symbols: ['7#5', '+7', 'aug7'], name: 'Dominant 7♯5', formula: ['1', '3', '#5', 'b7'], category: 'altered', description: 'Augmented dominant; whole-tone flavour.' },
  { id: '7#11', symbols: ['7#11'], name: 'Dominant 7♯11', formula: ['1', '3', '5', 'b7', '#11'], category: 'altered', optional: ['5'], description: 'Lydian dominant chord.' },
  { id: '7b13', symbols: ['7b13'], name: 'Dominant 7♭13', formula: ['1', '3', '5', 'b7', 'b13'], category: 'altered', optional: ['5'], description: 'Dominant with ♭13, leaning to minor.' },
  { id: '7alt', symbols: ['7alt', 'alt'], name: 'Altered dominant', formula: ['1', '3', 'b7', 'b9', '#5'], category: 'altered', description: 'Dominant with altered tensions; one common voicing uses ♭9 and ♯5.' },
  { id: 'maj7#11', symbols: ['maj7#11'], name: 'Major 7♯11', formula: ['1', '3', '5', '7', '#11'], category: 'altered', optional: ['5'], description: 'The Lydian chord.' },
  { id: 'maj7#5', symbols: ['maj7#5', '+maj7'], name: 'Major 7♯5', formula: ['1', '3', '#5', '7'], category: 'altered', description: 'Augmented major 7th.' },
  { id: '7sus4b9', symbols: ['7sus4b9', 'sus4b9'], name: '7 sus4 ♭9', formula: ['1', '4', '5', 'b7', 'b9'], category: 'altered', optional: ['5'], description: 'Phrygian-flavoured suspended dominant.' },
];

const CHORD_MAP = new Map(CHORDS.map((c) => [c.id, c]));

export function getChord(id: string): ChordDef {
  const c = CHORD_MAP.get(id);
  if (!c) throw new Error(`Unknown chord "${id}"`);
  return c;
}

export function chordSymbol(def: ChordDef): string {
  return def.symbols[0];
}

export interface BuiltChord {
  def: ChordDef;
  root: SpelledNote;
  bass?: SpelledNote;
  intervals: Interval[];
  notes: SpelledNote[];
  pcs: number[];
  tokens: string[];
  symbol: string;
}

export function buildChord(root: SpelledNote | string, chord: ChordDef | string, bass?: SpelledNote): BuiltChord {
  const r = typeof root === 'string' ? parseNote(root) : root;
  if (!r) throw new Error(`Invalid chord root "${String(root)}"`);
  const def = typeof chord === 'string' ? getChord(chord) : chord;
  const intervals = parseFormula(def.formula);
  const notes = intervals.map((iv) => spellInterval(r, iv));
  const symbol = noteName(r) + chordSymbol(def) + (bass ? '/' + noteName(bass) : '');
  return { def, root: r, bass, intervals, notes, pcs: notes.map(pcOf), tokens: intervals.map(intervalToken), symbol };
}

/** All symbol spellings sorted longest first, for greedy parsing. */
const SYMBOL_INDEX: { symbol: string; def: ChordDef }[] = CHORDS.flatMap((def) =>
  def.symbols.map((symbol) => ({ symbol, def })),
).sort((a, b) => b.symbol.length - a.symbol.length);

/** Parse "C", "F#m7", "Bbmaj7", "Asus2", "G/B", "E7#9", "Dm7b5". */
export function parseChordSymbol(input: string): BuiltChord | null {
  const s = input.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(s);
  if (!m) return null;
  const root = parseNote(m[1]);
  if (!root) return null;
  let rest = m[2];
  let bass: SpelledNote | undefined;
  const slash = /^(.*)\/([A-G](?:#|b)?)$/.exec(rest);
  if (slash) {
    rest = slash[1];
    bass = parseNote(slash[2]) ?? undefined;
  }
  const hit = SYMBOL_INDEX.find((e) => e.symbol === rest);
  if (!hit) return null;
  return buildChord(root, hit.def, bass);
}

export interface ChordMatch {
  root: number;
  def: ChordDef;
  /** Number of chord tones missing from the input set (optional tones only). */
  omitted: number;
}

/**
 * Identify chords whose tones match a set of pitch classes exactly
 * (allowing optional tones to be omitted). Results are sorted by simplicity.
 */
export function identifyChord(pcs: number[], bassPc?: number): ChordMatch[] {
  const set = new Set(pcs.map((p) => mod(p, 12)));
  const out: ChordMatch[] = [];
  for (let root = 0; root < 12; root++) {
    if (!set.has(root)) continue;
    for (const def of CHORDS) {
      const ivs = parseFormula(def.formula);
      const required = new Set<number>();
      const all = new Set<number>();
      ivs.forEach((iv, i) => {
        const pc = mod(root + iv.semitones, 12);
        all.add(pc);
        if (!(def.optional ?? []).includes(def.formula[i])) required.add(pc);
      });
      const coversInput = [...set].every((p) => all.has(p));
      const hasRequired = [...required].every((p) => set.has(p));
      if (coversInput && hasRequired) out.push({ root, def, omitted: all.size - set.size });
    }
  }
  const rank = (m: ChordMatch) =>
    m.omitted * 10 + CHORDS.indexOf(m.def) * 0.1 + (bassPc !== undefined && m.root !== mod(bassPc, 12) ? 5 : 0);
  return out.sort((a, b) => rank(a) - rank(b));
}

export function chordNameFromPcs(pcs: number[], bassPc?: number, preferFlats = false): string | null {
  const m = identifyChord(pcs, bassPc)[0];
  if (!m) return null;
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  const base = names[m.root] + chordSymbol(m.def);
  return bassPc !== undefined && mod(bassPc, 12) !== m.root ? `${base}/${names[mod(bassPc, 12)]}` : base;
}

/** Triad/seventh inversions: returns note orders from bass upward. */
export function inversions(chord: BuiltChord): { name: string; notes: SpelledNote[] }[] {
  const names = ['Root position', '1st inversion', '2nd inversion', '3rd inversion', '4th inversion'];
  const n = chord.notes;
  return n.map((_, i) => ({ name: names[i] ?? `${i}th inversion`, notes: n.slice(i).concat(n.slice(0, i)) }));
}

/** Diatonic triad quality from three stacked pitch classes. */
export function triadQuality(root: number, third: number, fifth: number): 'maj' | 'm' | 'dim' | 'aug' | null {
  const t = mod(third - root, 12);
  const f = mod(fifth - root, 12);
  if (t === 4 && f === 7) return 'maj';
  if (t === 3 && f === 7) return 'm';
  if (t === 3 && f === 6) return 'dim';
  if (t === 4 && f === 8) return 'aug';
  return null;
}
