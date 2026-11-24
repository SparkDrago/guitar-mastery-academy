/**
 * Mastery assessments: a lesson's authored questions, shuffled, plus freshly
 * generated questions from the theory engine for lessons whose concepts can be
 * tested computationally. Generated questions differ on every attempt, so a
 * pass demonstrates understanding rather than a memorised answer key.
 */
import {
  SEMITONE_INTERVALS, buildChord, buildScale, diatonicChords, keySignature, noteName, pillitiereShapes,
  PILLITIERE_START_SHAPES, MAJOR_MODE_IDS, getScale, preferredRoot, mod,
} from '@gma/theory';
import { rng } from './fretboard-trainer';
import type { Lesson, QuizQuestion } from './types';

type Gen = (r: () => number, i: number) => QuizQuestion;

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mc(id: string, prompt: string, correct: string, wrong: string[], explanation: string, r: () => number): QuizQuestion {
  const opts = shuffle([correct, ...shuffle([...new Set(wrong.filter((w) => w !== correct))], r).slice(0, 3)], r);
  return { id, prompt, options: opts, answer: opts.indexOf(correct), explanation };
}

const ROOTS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'];
const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];

export const GENERATORS: Record<string, Gen> = {
  intervals: (r, i) => {
    const iv = 1 + Math.floor(r() * 12);
    const correct = SEMITONE_INTERVALS[iv].name;
    return mc(`gen-int-${i}`, `Which interval spans ${iv} semitone${iv === 1 ? '' : 's'}?`, correct, SEMITONE_INTERVALS.filter((x) => x.semitones > 0).map((x) => x.name), `${iv} semitones = ${correct}.`, r);
  },
  'scale-spelling': (r, i) => {
    const root = pick(ROOTS, r);
    const sc = buildScale(root, 'major');
    const deg = 1 + Math.floor(r() * 6) + 1;
    const correct = noteName(sc.notes[deg - 1]);
    const wrong = [...sc.notes.map((n) => noteName(n)), noteName({ letter: sc.notes[deg - 1].letter, acc: sc.notes[deg - 1].acc + 1 }), noteName({ letter: sc.notes[deg - 1].letter, acc: sc.notes[deg - 1].acc - 1 })];
    return mc(`gen-scale-${i}`, `What is degree ${deg} of ${root} major?`, correct, wrong, `${root} major: ${sc.notes.map((n) => noteName(n)).join(' ')}.`, r);
  },
  'key-signature': (r, i) => {
    const root = pick(['G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab', 'Db'], r);
    const ks = keySignature(root);
    const n = ks.sharps || ks.flats;
    const kind = ks.sharps ? 'sharp' : 'flat';
    const correct = `${n} ${kind}${n === 1 ? '' : 's'}`;
    const wrong = [1, 2, 3, 4, 5].flatMap((k) => [`${k} sharp${k === 1 ? '' : 's'}`, `${k} flat${k === 1 ? '' : 's'}`]);
    return mc(`gen-key-${i}`, `How many sharps or flats are in ${root} major?`, correct, wrong, `${root} major: ${ks.accidentals.join(' ')}.`, r);
  },
  triads: (r, i) => {
    const root = pick(ROOTS, r);
    const q = pick(['maj', 'm', 'dim', 'aug'], r);
    const ch = buildChord(root, q);
    const correct = ch.notes.map((n) => noteName(n)).join(' ');
    const wrong = ['maj', 'm', 'dim', 'aug', 'sus4'].filter((x) => x !== q).map((x) => buildChord(root, x).notes.map((n) => noteName(n)).join(' '));
    return mc(`gen-triad-${i}`, `Which notes spell ${ch.symbol}?`, correct, wrong, `${ch.def.name}: ${ch.def.formula.join(' ')}.`, r);
  },
  sevenths: (r, i) => {
    const root = pick(ROOTS, r);
    const q = pick(['maj7', '7', 'm7', 'm7b5'], r);
    const ch = buildChord(root, q);
    const correct = ch.notes.map((n) => noteName(n)).join(' ');
    const wrong = ['maj7', '7', 'm7', 'm7b5', 'mMaj7'].filter((x) => x !== q).map((x) => buildChord(root, x).notes.map((n) => noteName(n)).join(' '));
    return mc(`gen-7th-${i}`, `Which notes spell ${ch.symbol}?`, correct, wrong, `${ch.def.name}: ${ch.def.formula.join(' ')}.`, r);
  },
  diatonic: (r, i) => {
    const root = pick(['C', 'G', 'D', 'A', 'F', 'Bb'], r);
    const chords = diatonicChords(root, 'major');
    const d = Math.floor(r() * 6);
    const correct = chords[d].chord.symbol;
    return mc(`gen-dia-${i}`, `In ${root} major, which chord is ${chords[d].numeral}?`, correct, chords.map((c) => c.chord.symbol), `Diatonic chords of ${root}: ${chords.map((c) => `${c.numeral}=${c.chord.symbol}`).join(', ')}.`, r);
  },
  modes: (r, i) => {
    const deg = 1 + Math.floor(r() * 7);
    const parent = pick(['C', 'G', 'F', 'D'], r);
    const sc = buildScale(parent, 'major');
    const modeRoot = noteName(sc.notes[deg - 1]);
    const mode = getScale(MAJOR_MODE_IDS[deg - 1]).name;
    return mc(`gen-mode-${i}`, `${modeRoot} ${mode} contains the same notes as which major scale?`, `${parent} major`, ROOTS.map((x) => `${x} major`), `${mode} is built on degree ${deg}; ${modeRoot} is degree ${deg} of ${parent} major.`, r);
  },
  pillitiere: (r, i) => {
    const deg = 1 + Math.floor(r() * 7);
    const correct = PILLITIERE_START_SHAPES[deg];
    return mc(`gen-pill-${i}`, `In Pillitiere's system, a major-scale pattern starting on degree ${deg} begins with which shapes?`, correct, Object.values(PILLITIERE_START_SHAPES), `The cycle X X X Y Y Z Z read from degree ${deg} gives ${pillitiereShapes(deg, 6).join(' ')}.`, r);
  },
  'relative-minor': (r, i) => {
    const root = pick(ROOTS, r);
    const rel = noteName(buildScale(root, 'major').notes[5]);
    const wrong = buildScale(root, 'major').notes.map((n) => noteName(n) + ' minor');
    return mc(`gen-rel-${i}`, `What is the relative minor of ${root} major?`, `${rel} minor`, wrong, `Degree 6 of ${root} major is ${rel}.`, r);
  },
  'note-names': (r, i) => {
    const s = Math.floor(r() * 6);
    const open = [40, 45, 50, 55, 59, 64][s];
    const fret = Math.floor(r() * 13);
    const pc = mod(open + fret, 12);
    const correct = noteName(preferredRoot(pc));
    const names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const stringNames = ['low E', 'A', 'D', 'G', 'B', 'high E'];
    return mc(`gen-note-${i}`, `In standard tuning, which note is at fret ${fret} of the ${stringNames[s]} string?`, correct, names, `Count ${fret} semitones up from the open string.`, r);
  },
};

/** Which generators apply to which lesson. */
export const LESSON_GENERATORS: Record<string, string[]> = {
  'l2-musical-alphabet': ['note-names'], 'l2-root-strings': ['note-names'], 'l2-sharps-flats': ['note-names'],
  'l3-intervals': ['intervals'], 'l3-major-scale': ['scale-spelling'], 'l3-keys': ['key-signature'], 'l3-relative-minor': ['relative-minor'],
  'l3-triads': ['triads'], 'l3-diatonic-chords': ['diatonic'], 'l6-pillitiere-shapes': ['pillitiere'], 'l6-pillitiere-patterns': ['pillitiere'],
  'l7-modes-intro': ['modes'], 'l7-aeolian-locrian': ['modes'], 'l8-sevenths': ['sevenths'], 'l8-functional': ['diatonic'],
};

/** Build a mastery assessment: shuffled authored questions plus up to 3 generated ones. */
export function buildAssessment(lesson: Lesson, seed: number): QuizQuestion[] {
  const r = rng(seed);
  const authored = shuffle(lesson.quiz, r).map((q) => {
    const order = shuffle(q.options.map((_, i) => i), r);
    return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
  });
  const gens = LESSON_GENERATORS[lesson.id] ?? [];
  const generated = gens.length ? Array.from({ length: 3 }, (_, i) => GENERATORS[gens[i % gens.length]](r, i)) : [];
  return [...authored, ...generated];
}
