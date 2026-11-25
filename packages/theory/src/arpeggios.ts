/**
 * Chord arpeggios on the fretboard: every chord tone across the neck, five
 * positions (CAGED shapes for standard-interval six-string tunings, root-anchored
 * fret windows otherwise) and a sweep path through each position.
 */
import { STANDARD_TUNING_MIDI, intervalLabel, mod12, pitchClassToName, type ChordFormula } from './chords';
import { CAGED_TEMPLATES, hasStandardIntervals } from './patterns';
import type { Tuning } from './tunings';

export interface ArpeggioNode {
  /** 0 = lowest string. */
  stringIndex: number;
  fret: number;
  midi: number;
  noteName: string;
  /** "R", "3", "5", "b7", "9"… */
  interval: string;
  isRoot: boolean;
  /** 3rd or 7th: the notes that define the chord's quality. */
  isGuideTone: boolean;
}

export interface ArpeggioPosition {
  id: string;
  /** e.g. "E shape (frets 7–11)" or "Position 1 (frets 0–4)". */
  label: string;
  /** CAGED shape letter when the position comes from a CAGED template. */
  shape?: 'C' | 'A' | 'G' | 'E' | 'D';
  minFret: number;
  maxFret: number;
  nodes: ArpeggioNode[];
  /** Notes in sweep order: string by string from the lowest, ascending on each string. */
  sweep: ArpeggioNode[];
  /** Distinct pitches, ascending (for playback). */
  orderedMidi: number[];
}

const stringsOf = (t: number[] | Tuning) => (Array.isArray(t) ? t : t.strings);

export function buildFullNeckArpeggio(
  rootPc: number,
  formula: ChordFormula,
  tuning: number[] | Tuning = STANDARD_TUNING_MIDI,
  maxFret = 15,
  preferFlat = false,
): ArpeggioNode[] {
  const strings = stringsOf(tuning);
  const ivByPc = new Map(formula.intervals.map((iv) => [mod12(rootPc + iv), iv]));
  const nodes: ArpeggioNode[] = [];
  strings.forEach((open, s) => {
    for (let f = 0; f <= maxFret; f++) {
      const midi = open + f;
      const iv = ivByPc.get(mod12(midi));
      if (iv === undefined) continue;
      const pc = mod12(iv);
      nodes.push({
        stringIndex: s, fret: f, midi, noteName: pitchClassToName(midi, preferFlat),
        interval: intervalLabel(iv, iv >= 12), isRoot: pc === 0, isGuideTone: pc === 3 || pc === 4 || pc === 10 || pc === 11,
      });
    }
  });
  return nodes;
}

function position(id: string, label: string, minFret: number, maxFret: number, all: ArpeggioNode[], shape?: ArpeggioPosition['shape']): ArpeggioPosition {
  const nodes = all.filter((n) => n.fret >= minFret && n.fret <= maxFret);
  const sweep = [...nodes].sort((a, b) => a.stringIndex - b.stringIndex || a.fret - b.fret);
  return { id, label, ...(shape ? { shape } : {}), minFret, maxFret, nodes, sweep, orderedMidi: [...new Set(nodes.map((n) => n.midi))].sort((a, b) => a - b) };
}

/** Five positions covering the neck, ordered by fret. */
export function buildArpeggioPositions(
  rootPc: number,
  formula: ChordFormula,
  tuning: number[] | Tuning = STANDARD_TUNING_MIDI,
  preferFlat = false,
  maxFret = 17,
): ArpeggioPosition[] {
  const strings = stringsOf(tuning);
  const all = buildFullNeckArpeggio(rootPc, formula, strings, maxFret, preferFlat);
  if (hasStandardIntervals({ id: 'x', name: '', category: 'standard', strings } as Tuning)) {
    // CAGED: each shape's window sits around its root on the shape's root string.
    const out: ArpeggioPosition[] = [];
    for (const tpl of CAGED_TEMPLATES) {
      let r = mod12(rootPc - strings[tpl.rootString]);
      while (r + tpl.lo < -1) r += 12;
      if (r + tpl.hi > maxFret) r -= 12;
      if (r + tpl.lo < -1) continue;
      const lo = Math.max(0, r + tpl.lo), hi = r + tpl.hi;
      out.push(position(`caged-${tpl.shape}`, `${tpl.shape} shape (frets ${lo}–${hi})`, lo, hi, all, tpl.shape));
    }
    return out.sort((a, b) => a.minFret - b.minFret).map((p, i) => ({ ...p, label: `${i + 1}. ${p.label}` }));
  }
  // Other tunings: five overlapping hand positions, starting at the first root on the lowest string.
  const r0 = mod12(rootPc - strings[0]);
  const starts = [0, 3, 5, 7, 10].map((o) => r0 + o - 1);
  return starts.map((st, i) => {
    const lo = Math.max(0, st > maxFret - 4 ? st - 12 : st);
    return position(`pos-${i + 1}`, `Position ${i + 1} (frets ${lo}–${lo + 4})`, lo, lo + 4, all);
  }).sort((a, b) => a.minFret - b.minFret);
}
