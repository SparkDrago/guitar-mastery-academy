/**
 * Playable chord-voicing search for any tuning and string count.
 * A voicing assigns each string either a fret (0 = open) or null (muted).
 */
import type { BuiltChord } from './chords';
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
