/**
 * Ear-training question generators. Each question carries what to play
 * (MIDI note groups with timing) and multiple-choice options. Audio is
 * rendered by the app's synthesizer, so no recordings are needed.
 */
import { SEMITONE_INTERVALS, buildChord, buildScale, resolveProgression, mod, noteName, parseNote, type ChordDef } from '@gma/theory';
import { rng } from './fretboard-trainer';
import type { EarAttempt, EarKind } from './types';

export interface PlayStep {
  /** Notes sounding together. Empty = rest. */
  notes: number[];
  /** Seconds. */
  duration: number;
  /** Use a click sound instead of a pitched tone (rhythm questions). */
  click?: boolean;
}

export interface EarQuestion {
  id: string;
  kind: EarKind;
  prompt: string;
  play: PlayStep[];
  /** Optional reference played first (e.g. the key's tonic chord). */
  reference?: PlayStep[];
  options: string[];
  answer: number;
  item: string;
  explain: string;
}

export interface EarLevel {
  level: number;
  name: string;
}

export const EAR_KINDS: { id: EarKind; name: string; description: string; levels: EarLevel[] }[] = [
  { id: 'major-minor', name: 'Major or minor?', description: 'Hear the difference in chord quality.', levels: [{ level: 1, name: 'Triads' }, { level: 2, name: 'Seventh chords' }] },
  { id: 'interval', name: 'Intervals', description: 'Identify the distance between two notes.', levels: [{ level: 1, name: 'P4, P5, octave' }, { level: 2, name: '+ major & minor 3rds' }, { level: 3, name: '+ 2nds, 6ths' }, { level: 4, name: 'All, incl. 7ths & tritone' }, { level: 5, name: 'All, descending & harmonic' }] },
  { id: 'chord', name: 'Chord quality', description: 'Name the chord type.', levels: [{ level: 1, name: 'maj / min / dim / aug' }, { level: 2, name: '+ sus2 / sus4' }, { level: 3, name: 'Seventh chords' }] },
  { id: 'scale', name: 'Scales & modes', description: 'Recognise a scale or mode by its colour.', levels: [{ level: 1, name: 'Major, minor, pentatonics' }, { level: 2, name: 'Modes of the major scale' }, { level: 3, name: '+ harmonic & melodic minor' }] },
  { id: 'progression', name: 'Progressions', description: 'Identify common chord progressions.', levels: [{ level: 1, name: 'Common pop & rock' }, { level: 2, name: '+ minor & modal' }] },
  { id: 'rhythm', name: 'Rhythm', description: 'Match what you hear to the notation.', levels: [{ level: 1, name: 'Quarters & eighths' }, { level: 2, name: '+ sixteenths & rests' }, { level: 3, name: '+ triplets & syncopation' }] },
  { id: 'melody', name: 'Melodic dictation', description: 'Write the scale degrees of a short melody.', levels: [{ level: 1, name: '3 notes, steps' }, { level: 2, name: '4 notes, skips' }, { level: 3, name: '5 notes, whole scale' }] },
  { id: 'relative-pitch', name: 'Relative pitch', description: 'Given a named note, name the second note.', levels: [{ level: 1, name: 'Within an octave' }] },
];

const INTERVAL_SETS: Record<number, number[]> = {
  1: [5, 7, 12],
  2: [3, 4, 5, 7, 12],
  3: [2, 3, 4, 5, 7, 8, 9, 12],
  4: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  5: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}

function optionsWith(correct: string, pool: string[], r: () => number, n = 4): { options: string[]; answer: number } {
  const wrong = shuffle(pool.filter((p) => p !== correct), r).slice(0, n - 1);
  const options = shuffle([correct, ...wrong], r);
  return { options, answer: options.indexOf(correct) };
}

const CHORD_SETS: Record<number, string[]> = { 1: ['maj', 'm', 'dim', 'aug'], 2: ['maj', 'm', 'dim', 'aug', 'sus2', 'sus4'], 3: ['maj7', '7', 'm7', 'm7b5', 'dim7'] };
const CHORD_LABEL: Record<string, string> = { maj: 'Major', m: 'Minor', dim: 'Diminished', aug: 'Augmented', sus2: 'Sus2', sus4: 'Sus4', maj7: 'Major 7th', '7': 'Dominant 7th', m7: 'Minor 7th', m7b5: 'Half-diminished', dim7: 'Diminished 7th' };
const SCALE_SETS: Record<number, string[]> = {
  1: ['major', 'aeolian', 'major-pentatonic', 'minor-pentatonic'],
  2: ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'],
  3: ['major', 'dorian', 'mixolydian', 'aeolian', 'harmonic-minor', 'melodic-minor', 'phrygian-dominant'],
};
const SCALE_LABEL: Record<string, string> = {
  major: 'Major', aeolian: 'Natural minor', 'major-pentatonic': 'Major pentatonic', 'minor-pentatonic': 'Minor pentatonic', dorian: 'Dorian', phrygian: 'Phrygian',
  lydian: 'Lydian', mixolydian: 'Mixolydian', locrian: 'Locrian', 'harmonic-minor': 'Harmonic minor', 'melodic-minor': 'Melodic minor', 'phrygian-dominant': 'Phrygian dominant',
};

const PROGRESSION_SETS: Record<number, { label: string; bars: string[] }[]> = {
  1: [
    { label: 'I – IV – V – I', bars: ['I', 'IV', 'V', 'I'] },
    { label: 'I – V – vi – IV', bars: ['I', 'V', 'vi', 'IV'] },
    { label: 'I – vi – IV – V', bars: ['I', 'vi', 'IV', 'V'] },
    { label: 'ii – V – I', bars: ['ii', 'V', 'I', 'I'] },
  ],
  2: [
    { label: 'I – IV – V – I', bars: ['I', 'IV', 'V', 'I'] },
    { label: 'I – V – vi – IV', bars: ['I', 'V', 'vi', 'IV'] },
    { label: 'i – bVI – bVII – i', bars: ['i', 'bVI', 'bVII', 'i'] },
    { label: 'I – bVII – IV – I', bars: ['I', 'bVII', 'IV', 'I'] },
    { label: 'i – iv – V – i', bars: ['i', 'iv', 'V', 'i'] },
    { label: 'vi – IV – I – V', bars: ['vi', 'IV', 'I', 'V'] },
  ],
};

interface RhythmPattern { label: string; beats: (number | 'r')[]; }

/** Rhythm patterns for one 4/4 bar. Numbers are note lengths in beats; 'r' entries are quarter rests. */
const RHYTHM_SETS: Record<number, RhythmPattern[]> = {
  1: [
    { label: '♩ ♩ ♩ ♩', beats: [1, 1, 1, 1] },
    { label: '♫ ♩ ♩ ♩', beats: [0.5, 0.5, 1, 1, 1] },
    { label: '♩ ♫ ♩ ♫', beats: [1, 0.5, 0.5, 1, 0.5, 0.5] },
    { label: '♫ ♫ ♫ ♫', beats: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] },
    { label: '𝅗𝅥 ♩ ♩', beats: [2, 1, 1] },
  ],
  2: [
    { label: '♬♬ ♩ ♩ ♩', beats: [0.25, 0.25, 0.25, 0.25, 1, 1, 1] },
    { label: '♩ 𝄽 ♫ ♩', beats: [1, 'r', 0.5, 0.5, 1] },
    { label: '♫ ♬♬ ♩ ♩', beats: [0.5, 0.5, 0.25, 0.25, 0.25, 0.25, 1, 1] },
    { label: '♩ ♩ 𝄽 ♩', beats: [1, 1, 'r', 1] },
    { label: '♪♬ ♩ ♩ ♩', beats: [0.5, 0.25, 0.25, 1, 1, 1] },
  ],
  3: [
    { label: '♩ ³♫♪ ♩ ♩', beats: [1, 1 / 3, 1 / 3, 1 / 3, 1, 1] },
    { label: '♪♩♪ ♩ ♩', beats: [0.5, 1, 0.5, 1, 1] },
    { label: '³♫♪ ³♫♪ ♩ ♩', beats: [1 / 3, 1 / 3, 1 / 3, 1 / 3, 1 / 3, 1 / 3, 1, 1] },
    { label: '♩. ♪ ♩ ♩', beats: [1.5, 0.5, 1, 1] },
    { label: '♪♩. ♩ ♩', beats: [0.5, 1.5, 1, 1] },
  ],
};

export interface EarOptions {
  kind: EarKind;
  level: number;
  seed: number;
  /** Seconds per beat for rhythm/progression playback. */
  beat?: number;
}

export function generateEarQuestion(o: EarOptions): EarQuestion {
  const r = rng(o.seed);
  const level = Math.max(1, o.level);
  const id = `${o.kind}-${level}-${o.seed}`;
  const root = 48 + Math.floor(r() * 12); // C3..B3
  const beat = o.beat ?? 0.5;

  switch (o.kind) {
    case 'interval': {
      const set = INTERVAL_SETS[Math.min(5, level)];
      const iv = pick(set, r);
      const mode = level >= 5 ? pick(['ascending', 'descending', 'harmonic'] as const, r) : 'ascending';
      const lo = root;
      const hi = root + iv;
      const play: PlayStep[] = mode === 'harmonic' ? [{ notes: [lo, hi], duration: 1.6 }] : mode === 'descending' ? [{ notes: [hi], duration: 0.8 }, { notes: [lo], duration: 1.0 }] : [{ notes: [lo], duration: 0.8 }, { notes: [hi], duration: 1.0 }];
      const label = SEMITONE_INTERVALS[iv].name;
      const pool = set.map((s) => SEMITONE_INTERVALS[s].name);
      const { options, answer } = optionsWith(label, pool, r, Math.min(4, pool.length));
      return { id, kind: 'interval', prompt: `Which interval do you hear (${mode})?`, play, options, answer, item: String(iv), explain: `${label}: ${iv} semitone${iv === 1 ? '' : 's'}.` };
    }
    case 'major-minor': {
      const ids = level >= 2 ? ['maj7', 'm7'] : ['maj', 'm'];
      const q = pick(ids, r);
      const chord = buildChord('C', q);
      const notes = chord.intervals.map((iv) => root + iv.semitones);
      const options = level >= 2 ? ['Major 7th', 'Minor 7th'] : ['Major', 'Minor'];
      const answer = ids.indexOf(q);
      return { id, kind: 'major-minor', prompt: 'Is this chord major or minor?', play: [{ notes: notes.slice(0, 1), duration: 0.35 }, ...notes.slice(1).map((n) => ({ notes: [n], duration: 0.35 })), { notes, duration: 1.4 }], options, answer, item: q, explain: answer === 0 ? 'Major: the 3rd is four semitones above the root (bright).' : 'Minor: the 3rd is three semitones above the root (darker).' };
    }
    case 'chord': {
      const set = CHORD_SETS[Math.min(3, level)];
      const q = pick(set, r);
      const def = buildChord('C', q).def as ChordDef;
      const notes = buildChord('C', q).intervals.map((iv) => root + iv.semitones);
      const { options, answer } = optionsWith(CHORD_LABEL[q], set.map((s) => CHORD_LABEL[s]), r, Math.min(4, set.length));
      return { id, kind: 'chord', prompt: 'Name the chord quality.', play: [{ notes, duration: 1.6 }, ...notes.map((n) => ({ notes: [n], duration: 0.3 }))], options, answer, item: q, explain: `${def.name}: ${def.formula.join(' – ')}. ${def.description}` };
    }
    case 'scale': {
      const set = SCALE_SETS[Math.min(3, level)];
      const q = pick(set, r);
      const sc = buildScale('C', q);
      const notes = [...sc.intervals.map((iv) => root + iv.semitones), root + 12];
      const play = [...notes, ...notes.slice(0, -1).reverse()].map((n) => ({ notes: [n], duration: 0.28 }));
      const { options, answer } = optionsWith(SCALE_LABEL[q], set.map((s) => SCALE_LABEL[s]), r, Math.min(4, set.length));
      return { id, kind: 'scale', prompt: 'Which scale or mode is this?', reference: [{ notes: [root - 12, root, root + 7], duration: 1.0 }], play, options, answer, item: q, explain: `${SCALE_LABEL[q]}: ${sc.tokens.join(' ')}. ${sc.def.sound}` };
    }
    case 'progression': {
      const set = PROGRESSION_SETS[Math.min(2, level)];
      const q = pick(set, r);
      const minor = q.bars[0].startsWith('i') && !q.bars[0].startsWith('I');
      const key = minor ? 'A' : 'C';
      const chords = resolveProgression(q.bars, key);
      const play: PlayStep[] = chords.map((c) => {
        const base = 48 + mod(c.chord.pcs[0] - 0, 12);
        const tones = c.chord.intervals.slice(0, 3).map((iv) => base + iv.semitones);
        return { notes: [base - 12, ...tones], duration: beat * 4 * 0.5 };
      });
      const { options, answer } = optionsWith(q.label, set.map((s) => s.label), r);
      return { id, kind: 'progression', prompt: 'Which progression is this?', play, options, answer, item: q.label, explain: `${q.label} in ${key}: ${chords.map((c) => c.chord.symbol).join(' – ')}.` };
    }
    case 'rhythm': {
      const set = RHYTHM_SETS[Math.min(3, level)];
      const q = pick(set, r);
      const play: PlayStep[] = [];
      for (let i = 0; i < 4; i++) play.push({ notes: [84], duration: beat, click: true });
      for (const b of q.beats) play.push(b === 'r' ? { notes: [], duration: beat } : { notes: [72], duration: b * beat });
      const { options, answer } = optionsWith(q.label, set.map((s) => s.label), r);
      return { id, kind: 'rhythm', prompt: 'After the four count-in clicks, which rhythm is played?', play, options, answer, item: q.label, explain: `The rhythm was ${q.label}.` };
    }
    case 'melody': {
      const len = level === 1 ? 3 : level === 2 ? 4 : 5;
      const scale = buildScale('C', 'major');
      const maxStep = level === 1 ? 1 : level === 2 ? 3 : 6;
      const degs = [0];
      while (degs.length < len) {
        const prev = degs[degs.length - 1];
        const step = Math.floor(r() * (maxStep * 2 + 1)) - maxStep;
        const next = Math.max(0, Math.min(7, prev + (step === 0 ? 1 : step)));
        degs.push(next);
      }
      const notes = degs.map((d) => root + (d === 7 ? 12 : scale.intervals[d].semitones));
      const label = degs.map((d) => String(d === 7 ? 8 : d + 1)).join(' ');
      const alt = new Set<string>([label]);
      let guard = 0;
      while (alt.size < 4 && guard++ < 50) {
        const copy = [...degs];
        const i = 1 + Math.floor(r() * (copy.length - 1));
        copy[i] = Math.max(0, Math.min(7, copy[i] + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2))));
        alt.add(copy.map((d) => String(d === 7 ? 8 : d + 1)).join(' '));
      }
      const { options, answer } = optionsWith(label, [...alt], r);
      return {
        id, kind: 'melody', prompt: 'The first note is the tonic (1). Which scale degrees make up the melody?',
        reference: [{ notes: [root, root + 4, root + 7], duration: 1.0 }], play: notes.map((n) => ({ notes: [n], duration: 0.6 })),
        options, answer, item: label, explain: `Degrees ${label} of the major scale.`,
      };
    }
    case 'relative-pitch': {
      const iv = 1 + Math.floor(r() * 12);
      const startName = noteName(parseNote(['C', 'D', 'E', 'F', 'G', 'A', 'B'][Math.floor(r() * 7)])!);
      const startPc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[startName as 'C']!;
      const base = 48 + startPc;
      const target = mod(startPc + iv, 12);
      const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const { options, answer } = optionsWith(names[target], names, r);
      return { id, kind: 'relative-pitch', prompt: `The first note is ${startName}. What is the second note?`, play: [{ notes: [base], duration: 0.8 }, { notes: [base + iv], duration: 1.0 }], options, answer, item: String(iv), explain: `${startName} up ${iv} semitone${iv === 1 ? '' : 's'} (${SEMITONE_INTERVALS[iv].name.toLowerCase()}) is ${names[target]}.` };
    }
  }
}

export interface EarStats {
  kind: EarKind;
  attempts: number;
  accuracy: number;
  weakestItems: { item: string; accuracy: number; attempts: number }[];
}

export function earStats(attempts: EarAttempt[]): EarStats[] {
  const kinds = [...new Set(attempts.map((a) => a.kind))];
  return kinds.map((kind) => {
    const of = attempts.filter((a) => a.kind === kind);
    const items = new Map<string, { a: number; c: number }>();
    for (const a of of) {
      const v = items.get(a.item) ?? { a: 0, c: 0 };
      v.a++;
      if (a.correct) v.c++;
      items.set(a.item, v);
    }
    return {
      kind, attempts: of.length, accuracy: of.length ? of.filter((a) => a.correct).length / of.length : 0,
      weakestItems: [...items.entries()].filter(([, v]) => v.a >= 3).map(([item, v]) => ({ item, accuracy: v.c / v.a, attempts: v.a })).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3),
    };
  });
}

/** Suggest the next ear level: move up at ≥ 85% over the last 20 answers. */
export function suggestedEarLevel(attempts: EarAttempt[], kind: EarKind, current: number): number {
  const recent = attempts.filter((a) => a.kind === kind).slice(-20);
  const maxLevel = EAR_KINDS.find((k) => k.id === kind)?.levels.length ?? 1;
  if (recent.length >= 20 && recent.filter((a) => a.correct).length / recent.length >= 0.85) return Math.min(maxLevel, current + 1);
  if (recent.length >= 10 && recent.filter((a) => a.correct).length / recent.length < 0.5) return Math.max(1, current - 1);
  return current;
}
