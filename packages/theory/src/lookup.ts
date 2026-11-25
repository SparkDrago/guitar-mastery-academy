/**
 * Reverse chord lookup: name the chord(s) formed by a set of notes, from a
 * fretboard shape, a list of note names or pitch classes detected by ear.
 */
import { CHORDS, CHORD_FORMULAS, STANDARD_TUNING_MIDI, chordSymbol, intervalLabel, mod12, pitchClassToName, type ChordDef, type ChordFormula } from './chords';
import { parseFormula } from './intervals';
import { FLAT_NAMES, SHARP_NAMES, mod } from './pitch';
import { midiAt } from './fretboard';
import type { Tuning } from './tunings';

export interface ChordCandidate {
  root: number;
  def: ChordDef;
  /** Full symbol including a slash bass when the bass is not the root, e.g. "C/E". */
  symbol: string;
  /** Formula token of each input pitch class relative to the root, in input order. */
  tokens: { pc: number; token: string }[];
  /** Chord tones absent from the input (all optional, or the root when rootless). */
  missing: string[];
  bassPc?: number;
  inversion: string;
  rootless: boolean;
  /** Lower is a better match. */
  score: number;
}

const INVERSION_BY_TOKEN: Record<string, string> = {
  '1': 'Root position', '3': '1st inversion', b3: '1st inversion', '2': '2 in the bass', '4': '4 in the bass',
  '5': '2nd inversion', b5: '2nd inversion', '#5': '2nd inversion', '6': '6 in the bass', bb7: '3rd inversion',
  '7': '3rd inversion', b7: '3rd inversion',
};

/**
 * Rank every chord type and root that explains the given pitch classes.
 * A candidate must contain every input note and all of its own non-optional
 * tones; rootless voicings (root missing, everything else present) are allowed
 * with a penalty because they are common in jazz comping.
 */
export function reverseChordLookup(pcsIn: number[], opts: { bassPc?: number; preferFlats?: boolean; max?: number; allowRootless?: boolean } = {}): ChordCandidate[] {
  const pcs = [...new Set(pcsIn.map((p) => mod(p, 12)))];
  if (pcs.length < 2) return [];
  const names = opts.preferFlats ? FLAT_NAMES : SHARP_NAMES;
  const set = new Set(pcs);
  const out: ChordCandidate[] = [];
  for (let root = 0; root < 12; root++) {
    for (const def of CHORDS) {
      const ivs = parseFormula(def.formula);
      const tokenByPc = new Map<number, string>();
      const required: number[] = [];
      ivs.forEach((iv, i) => {
        const pc = mod(root + iv.semitones, 12);
        if (!tokenByPc.has(pc)) tokenByPc.set(pc, def.formula[i]);
        if (!(def.optional ?? []).includes(def.formula[i])) required.push(pc);
      });
      if (!pcs.every((p) => tokenByPc.has(p))) continue;
      const rootless = !set.has(root);
      if (rootless && (!opts.allowRootless || pcs.length < 3)) continue;
      const missingRequired = required.filter((p) => !set.has(p) && !(rootless && p === root));
      if (missingRequired.length) continue;
      const missing = [...tokenByPc.entries()].filter(([p]) => !set.has(p)).map(([, t]) => t);
      const bassToken = opts.bassPc !== undefined ? tokenByPc.get(mod(opts.bassPc, 12)) : '1';
      const slash = opts.bassPc !== undefined && mod(opts.bassPc, 12) !== root;
      const symbol = names[root] + chordSymbol(def) + (slash ? `/${names[mod(opts.bassPc!, 12)]}` : '');
      const score = missing.length * 10 + CHORDS.indexOf(def) * 0.15 + (slash ? 4 : 0) + (rootless ? 25 : 0) + (def.formula.length - pcs.length) * 0.5;
      out.push({
        root, def, symbol, missing, bassPc: opts.bassPc, rootless, score,
        tokens: pcs.map((pc) => ({ pc, token: tokenByPc.get(pc)! })),
        inversion: bassToken ? INVERSION_BY_TOKEN[bassToken] ?? `${bassToken} in the bass` : 'Root position',
      });
    }
  }
  out.sort((a, b) => a.score - b.score);
  return out.slice(0, opts.max ?? 12);
}

/** Pitch classes and bass note of a fretboard shape (null = muted string). */
export function shapePitches(tuning: Tuning, frets: (number | null)[]): { midis: number[]; pcs: number[]; bassPc?: number } {
  const midis = frets.map((f, s) => (f === null || f === undefined ? null : midiAt(tuning, s, f))).filter((m): m is number => m !== null);
  if (!midis.length) return { midis: [], pcs: [] };
  return { midis, pcs: [...new Set(midis.map((m) => mod(m, 12)))], bassPc: mod(Math.min(...midis), 12) };
}

// ── Reverse lookup from fret positions (semitone formulas) ───────────────

export interface ReverseChordMatch {
  /** e.g. "Cmaj7", "D/F#", "Am9 (no 5)". */
  name: string;
  rootPc: number;
  bassPc: number;
  formula: ChordFormula;
  isInversion: boolean;
  matchedIntervals: string[];
  omittedIntervals: string[];
  /** Always empty: a name must explain every note played. Kept for callers that show it. */
  extraIntervals: string[];
  score: number;
}

const ivLabel = (iv: number) => intervalLabel(iv, iv >= 12);

/**
 * Name the chord a set of fret positions makes. `frets` has one entry per string,
 * lowest first (null = muted). Every played note must be a chord tone; optional
 * tones may be missing (reported as "(no 5)"). All enharmonic readings are
 * returned (C6 and Am7/C both appear), best first.
 */
export function reverseLookupFrets(
  frets: (number | null)[],
  tuning: number[] | Tuning = STANDARD_TUNING_MIDI,
  preferFlat = false,
  limit = 8,
): ReverseChordMatch[] {
  const strings = Array.isArray(tuning) ? tuning : tuning.strings;
  const midi = frets.flatMap((f, i) => (f !== null && f >= 0 && i < strings.length ? [strings[i] + f] : [])).sort((a, b) => a - b);
  if (midi.length < 2) return [];
  const bassPc = mod12(midi[0]);
  const played = new Set(midi.map(mod12));
  if (played.size < 2) return [];
  const out = new Map<string, ReverseChordMatch>();
  for (const rootPc of played) {
    const playedIvs = new Set([...played].map((pc) => mod12(pc - rootPc)));
    for (const formula of CHORD_FORMULAS) {
      const byPc = new Map(formula.intervals.map((iv) => [mod12(iv), iv]));
      const optional = new Set((formula.optional ?? []).map(mod12));
      if ([...playedIvs].some((iv) => !byPc.has(iv))) continue; // unexplained note
      const matched = [...byPc.keys()].filter((pc) => playedIvs.has(pc));
      const omitted = [...byPc.keys()].filter((pc) => !playedIvs.has(pc));
      if (omitted.some((pc) => !optional.has(pc))) continue; // a required tone is missing
      const isInversion = bassPc !== rootPc;
      let name = pitchClassToName(rootPc, preferFlat) + formula.symbol + (isInversion ? `/${pitchClassToName(bassPc, preferFlat)}` : '');
      if (omitted.length) name += ` (no ${omitted.map((pc) => ivLabel(byPc.get(pc)!)).join(', ')})`;
      const score = formula.priority + (isInversion ? 0 : 25) - omitted.length * 14 + matched.length * 5;
      const prev = out.get(name);
      if (prev && prev.score >= score) continue;
      out.set(name, {
        name, rootPc, bassPc, formula, isInversion, score,
        matchedIntervals: matched.map((pc) => ivLabel(byPc.get(pc)!)),
        omittedIntervals: omitted.map((pc) => ivLabel(byPc.get(pc)!)),
        extraIntervals: [],
      });
    }
  }
  return [...out.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
}
