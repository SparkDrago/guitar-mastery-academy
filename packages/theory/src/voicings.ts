/**
 * Playable chord-voicing search for any tuning and string count.
 * A voicing assigns each string either a fret (0 = open) or null (muted).
 */
import { STANDARD_TUNING_MIDI, intervalLabel, mod12, pitchClassToName, type BuiltChord, type ChordFormula } from './chords';
import { mod, pcOf } from './pitch';
import type { Tuning } from './tunings';

export interface Voicing {
  /** One entry per string, lowest first. null = muted. */
  frets: (number | null)[];
  /** Suggested fingers per string (0 = open, null = muted). */
  fingers: (number | null)[];
  /** Fret where a barre is placed, if any. */
  barre?: { fret: number; fromString: number; toString: number };
  /** Formula token sounded by each string. */
  tokens: (string | null)[];
  baseFret: number;
  bassPc: number;
  score: number;
  inversion: string;
}

export interface VoicingOptions {
  maxFret?: number;
  /** Maximum distance between lowest and highest fretted note. */
  maxSpan?: number;
  /** Require the bass note to be the chord root (default) or a specific pc (slash chords). */
  bassPc?: number | 'any';
  minStrings?: number;
  limit?: number;
}

function assignFingers(frets: (number | null)[]): { fingers: (number | null)[]; barre?: Voicing['barre'] } | null {
  const fretted = frets.map((f, s) => ({ f, s })).filter((x) => x.f !== null && x.f > 0) as { f: number; s: number }[];
  const fingers: (number | null)[] = frets.map((f) => (f === null ? null : f === 0 ? 0 : null));
  if (fretted.length === 0) return { fingers };
  const min = Math.min(...fretted.map((x) => x.f));
  const atMin = fretted.filter((x) => x.f === min);
  let barre: Voicing['barre'] | undefined;
  let available = [1, 2, 3, 4];
  let rest = fretted;
  if (atMin.length >= 2) {
    const from = Math.min(...atMin.map((x) => x.s));
    const to = Math.max(...atMin.map((x) => x.s));
    // A barre is only possible if no string inside it is open or fretted lower.
    const blocked = frets.slice(from, to + 1).some((f) => f === 0);
    if (!blocked && (fretted.length > 4 || atMin.length >= 3)) {
      barre = { fret: min, fromString: from, toString: to };
      atMin.forEach((x) => (fingers[x.s] = 1));
      rest = fretted.filter((x) => x.f !== min);
      available = [2, 3, 4];
    }
  }
  // Adjacent strings at the same fret can share one finger (a partial barre, e.g. x13331).
  const groups: { f: number; strings: number[] }[] = [];
  for (const x of [...rest].sort((a, b) => a.f - b.f || a.s - b.s)) {
    const g = groups.find((gr) => gr.f === x.f && gr.strings[gr.strings.length - 1] === x.s - 1);
    if (g) g.strings.push(x.s);
    else groups.push({ f: x.f, strings: [x.s] });
  }
  if (groups.length > available.length) return null;
  let lastFinger = barre ? 1 : 0;
  for (const g of groups) {
    const ideal = Math.max(lastFinger + 1, g.f - min + 1);
    const finger = available.find((f) => f >= ideal) ?? available.find((f) => f > lastFinger);
    if (!finger) return null;
    g.strings.forEach((st) => (fingers[st] = finger));
    available = available.filter((f) => f !== finger);
    lastFinger = finger;
  }
  return { fingers, barre };
}

/** Search playable voicings of a chord. Results are sorted by position, best first per position. */
export function findVoicings(chord: BuiltChord, tuning: Tuning, opts: VoicingOptions = {}): Voicing[] {
  const maxFret = opts.maxFret ?? 15;
  const maxSpan = opts.maxSpan ?? 4;
  const limit = opts.limit ?? 24;
  const n = tuning.strings.length;
  const rootPc = chord.pcs[0];
  const slashBass = chord.bass ? pcOf(chord.bass) : null;
  const bassTarget = slashBass !== null ? null : opts.bassPc === 'any' ? null : opts.bassPc ?? rootPc;
  const tokenByPc = new Map<number, string>();
  chord.pcs.forEach((pc, i) => { if (!tokenByPc.has(pc)) tokenByPc.set(pc, chord.tokens[i]); });
  const optional = new Set((chord.def.optional ?? []).map((t) => chord.pcs[chord.tokens.indexOf(t)]).filter((x) => x !== undefined));
  const required = new Set(chord.pcs.filter((p) => !optional.has(p)));
  if (slashBass !== null) tokenByPc.set(slashBass, tokenByPc.get(slashBass) ?? 'bass');
  const minStrings = opts.minStrings ?? Math.min(n, Math.max(3, required.size));

  const seen = new Set<string>();
  const results: Voicing[] = [];

  for (let lo = 0; lo <= maxFret; lo++) {
    const hi = lo + maxSpan - 1;
    const options: (number | null)[][] = tuning.strings.map((open) => {
      const o: (number | null)[] = [null];
      if (tokenByPc.has(mod(open, 12))) o.push(0);
      for (let f = Math.max(1, lo); f <= Math.min(hi, maxFret); f++) if (tokenByPc.has(mod(open + f, 12))) o.push(f);
      return o;
    });
    const cur: (number | null)[] = new Array(n).fill(null);
    const dfs = (s: number) => {
      if (s === n) {
        const sounding = cur.map((f, i) => (f === null ? null : mod(tuning.strings[i] + f, 12)));
        const played = sounding.filter((p): p is number => p !== null);
        if (played.length < minStrings) return;
        const firstIdx = sounding.findIndex((p) => p !== null);
        const bass = sounding[firstIdx]!;
        if (slashBass !== null ? bass !== slashBass : bassTarget !== null && bass !== bassTarget) return;
        const set = new Set(played);
        if (![...required].every((p) => set.has(p))) return;
        const fretted = cur.filter((f): f is number => f !== null && f > 0);
        if (fretted.length && Math.max(...fretted) - Math.min(...fretted) >= maxSpan) return;
        // Muted strings inside the voicing are hard to damp; allow at most one.
        const lastIdx = n - 1 - [...sounding].reverse().findIndex((p) => p !== null);
        const interiorMutes = sounding.slice(firstIdx, lastIdx + 1).filter((p) => p === null).length;
        if (interiorMutes > 1) return;
        const fing = assignFingers(cur);
        if (!fing) return;
        const key = cur.join(',');
        if (seen.has(key)) return;
        seen.add(key);
        const baseFret = fretted.length ? Math.min(...fretted) : 0;
        const topFret = fretted.length ? Math.max(...fretted) : 0;
        const opens = cur.filter((f) => f === 0).length;
        const span = fretted.length ? topFret - baseFret : 0;
        // An open string sandwiched between notes at fret 3+ is awkward to keep ringing.
        let awkwardOpens = 0;
        cur.forEach((f, i) => {
          if (f !== 0) return;
          const below = cur.slice(0, i).reverse().find((x) => x !== null);
          const above = cur.slice(i + 1).find((x) => x !== null);
          if (below != null && above != null && below > 0 && above > 0 && Math.max(below, above) >= 3) awkwardOpens++;
        });
        const openScore = topFret <= 3 ? opens * 1.2 : -opens * 2;
        const barreScore = fing.barre ? (played.length >= 5 ? 1 : -0.5) : 0;
        const score = played.length * 3 - interiorMutes * 4 - span * 1.5 - baseFret * 0.15 + openScore - awkwardOpens * 1.5 + barreScore - (n - lastIdx - 1) * 1.5;
        const invIdx = chord.pcs.indexOf(bass);
        results.push({
          frets: [...cur],
          fingers: fing.fingers,
          barre: fing.barre,
          tokens: sounding.map((p) => (p === null ? null : tokenByPc.get(p) ?? null)),
          baseFret,
          bassPc: bass,
          score,
          inversion: slashBass !== null ? 'slash bass' : invIdx <= 0 ? 'root position' : ['root position', '1st inversion', '2nd inversion', '3rd inversion'][invIdx] ?? 'inversion',
        });
        return;
      }
      for (const f of options[s]) {
        cur[s] = f;
        dfs(s + 1);
      }
      cur[s] = null;
    };
    dfs(0);
  }

  // Keep the best voicing per base position, then sort by position.
  const bestByPos = new Map<number, Voicing[]>();
  for (const v of results) {
    const arr = bestByPos.get(v.baseFret) ?? [];
    arr.push(v);
    bestByPos.set(v.baseFret, arr);
  }
  const picked: Voicing[] = [];
  for (const [, arr] of [...bestByPos.entries()].sort((a, b) => a[0] - b[0])) {
    arr.sort((a, b) => b.score - a.score);
    picked.push(...arr.slice(0, 3));
  }
  return picked
    .filter((v, i, all) => all.findIndex((w) => w.frets.join() === v.frets.join()) === i)
    .sort((a, b) => a.baseFret - b.baseFret || b.score - a.score)
    .slice(0, limit);
}

/** Notation like "x32010" (lowest string first). Frets above 9 use parentheses: "x(10)(12)...". */
export function voicingString(frets: (number | null)[]): string {
  return frets.map((f) => (f === null ? 'x' : f > 9 ? `(${f})` : String(f))).join('');
}

// ── Semitone-formula voicing generator (any root, quality, slash bass, tuning) ──

export type VoicingFilter = 'all' | 'open' | 'barre' | 'shell' | 'triad';

export interface ChordVoicing {
  /** One entry per string, lowest first; null = muted. */
  frets: (number | null)[];
  /** Suggested fingers per string (0 = open, null = muted). */
  fingers: (number | null)[];
  /** Sounding notes, lowest string first. */
  midiNotes: number[];
  baseFret: number;
  maxFret: number;
  /** Distance between the lowest and highest fretted note. */
  span: number;
  isOpen: boolean;
  barreFret: number | null;
  /** Pitch class of the lowest sounding note. */
  bassPc: number;
  /** Higher = more playable and idiomatic. */
  score: number;
}

export interface ChordVoicingOptions {
  /** MIDI note per string, lowest first (default standard tuning). */
  tuning?: number[];
  maxFret?: number;
  /** Width of the fret window a hand covers (4 = e.g. frets 5–8). */
  maxSpan?: number;
  /** Slash bass, e.g. C/E → 4. Default: the root must be the lowest note. */
  bassPc?: number | null;
  filter?: VoicingFilter;
  limit?: number;
}

/**
 * Playable voicings of `rootPc` + `formula`: slides a hand-sized fret window up the
 * neck, tries every combination of chord tones (and mutes) in it, and keeps shapes
 * that contain every required tone, have the right bass, can be fingered (barres
 * included) and mute at most one inner string.
 */
export function generateVoicings(rootPc: number, formula: ChordFormula, options: ChordVoicingOptions = {}): ChordVoicing[] {
  const { tuning = STANDARD_TUNING_MIDI, maxFret = 15, maxSpan = 4, bassPc = null, filter = 'all', limit = 24 } = options;
  const chordPcs = new Set(formula.intervals.map((i) => mod12(rootPc + i)));
  const optionalPcs = new Set((formula.optional ?? []).map((i) => mod12(rootPc + i)));
  const requiredPcs = new Set([...chordPcs].filter((pc) => !optionalPcs.has(pc)));
  const allowed = new Set(chordPcs);
  if (bassPc !== null) allowed.add(mod12(bassPc));
  const wantBass = mod12(bassPc ?? rootPc);

  const results: ChordVoicing[] = [];
  const seen = new Set<string>();
  const current: (number | null)[] = tuning.map(() => null);
  for (let start = 1; start <= Math.max(1, maxFret - maxSpan + 1); start++) {
    const end = start + maxSpan - 1;
    const candidates = tuning.map((open) => {
      const opts: (number | null)[] = [null];
      if (start === 1 && allowed.has(mod12(open))) opts.push(0); // open strings belong to the first position
      for (let f = start; f <= end; f++) if (allowed.has(mod12(open + f))) opts.push(f);
      return opts;
    });
    const walk = (s: number) => {
      if (s === tuning.length) {
        const key = current.join(',');
        if (seen.has(key)) return;
        const v = evaluateVoicing(current, tuning, requiredPcs, wantBass, filter);
        if (v) { seen.add(key); results.push(v); }
        return;
      }
      for (const f of candidates[s]) { current[s] = f; walk(s + 1); }
    };
    walk(0);
  }
  results.sort((a, b) => b.score - a.score || a.baseFret - b.baseFret);
  // Spread the picks over the neck: at most three per position first, then the best of the rest.
  const perPos = new Map<number, number>();
  const picked: ChordVoicing[] = [];
  const rest: ChordVoicing[] = [];
  for (const v of results) {
    const pos = v.isOpen ? 0 : v.baseFret;
    const n = perPos.get(pos) ?? 0;
    if (n < 3 && picked.length < limit) { picked.push(v); perPos.set(pos, n + 1); } else rest.push(v);
  }
  return [...picked, ...rest.slice(0, Math.max(0, limit - picked.length))].sort((a, b) => b.score - a.score || a.baseFret - b.baseFret);
}

function evaluateVoicing(frets: (number | null)[], tuning: number[], requiredPcs: Set<number>, wantBass: number, filter: VoicingFilter): ChordVoicing | null {
  const sounded: number[] = [];
  const midiNotes: number[] = [];
  const fretted: number[] = [];
  frets.forEach((f, i) => { if (f !== null) { sounded.push(i); midiNotes.push(tuning[i] + f); if (f > 0) fretted.push(f); } });
  if (sounded.length < 2 || (sounded.length < 3 && requiredPcs.size >= 3)) return null;
  const pcs = new Set(midiNotes.map(mod12));
  for (const r of requiredPcs) if (!pcs.has(r)) return null;
  // The bass is the lowest *pitch*, which is not always the lowest string (e.g. an open D under a G-string note).
  const bassPc = mod12(Math.min(...midiNotes));
  if (bassPc !== wantBass) return null;

  let innerMutes = 0;
  for (let i = sounded[0] + 1; i < sounded[sounded.length - 1]; i++) if (frets[i] === null) innerMutes++;
  if (innerMutes > 1) return null;

  const minF = fretted.length ? Math.min(...fretted) : 0;
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const span = fretted.length ? maxF - minF : 0;
  const fingering = assignFingers(frets);
  if (!fingering) return null;
  const isOpen = frets.some((f) => f === 0);
  const barreFret = fingering.barre?.fret ?? null;

  if (filter === 'open' && !isOpen) return null;
  if (filter === 'barre' && barreFret === null) return null;
  if (filter === 'triad' && sounded.length !== 3) return null;
  if (filter === 'shell' && (sounded.length < 3 || sounded.length > 4)) return null;

  let score = 100 - span * 6 - innerMutes * 18 - minF * 1.5 + sounded.length * 4;
  if (isOpen) score += 12;
  if (barreFret !== null) score += 4;
  if (fretted.length <= 3) score += 6;
  return { frets: [...frets], fingers: fingering.fingers, midiNotes, baseFret: minF || 1, maxFret: maxF, span, isOpen, barreFret, bassPc, score };
}

/** Adapt a generated voicing to the `Voicing` shape used by chord diagrams. */
export function toDiagramVoicing(v: ChordVoicing, rootPc: number, formula: ChordFormula): Voicing {
  const byPc = new Map(formula.intervals.map((iv) => [mod12(rootPc + iv), iv]));
  const tokens = v.frets.map((f, i) => {
    if (f === null) return null;
    const iv = byPc.get(mod12(v.midiNotes[v.frets.slice(0, i).filter((x) => x !== null).length]));
    return iv === undefined ? 'bass' : intervalLabel(iv, iv >= 12).replace('R', '1');
  });
  const fing = assignFingers(v.frets);
  return {
    frets: v.frets, fingers: v.fingers, barre: fing?.barre, tokens, baseFret: v.baseFret, bassPc: v.bassPc, score: v.score,
    inversion: v.bassPc === mod12(rootPc) ? 'root position' : `${pitchClassToName(v.bassPc)} in the bass`,
  };
}
