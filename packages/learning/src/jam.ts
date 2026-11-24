/**
 * Jam Laboratory: guided improvisation challenges whose concrete targets are
 * computed from the actual progression and key, plus per-chord theory views.
 */
import {
  PROGRESSIONS, buildScale, chordScales, noteName, parseNote, resolveProgression, type ResolvedChord,
} from '@gma/theory';
import { statusAtLeast } from './progress';
import type { StudentState } from './types';

export interface JamContext {
  key: string;
  mode: 'major' | 'minor';
  progressionId: string;
}

export interface ChallengeTemplate {
  id: string;
  title: string;
  minLevel: number;
  /** Lesson ids that must be completed to unlock this challenge. */
  requires: string[];
  /** Progressions that suit the challenge (first is the default). */
  progressions: string[];
  build: (ctx: JamContext, chords: ResolvedChord[]) => { instructions: string[]; targets: string[]; checklist: string[] };
}

const names = (notes: { letter: number; acc: number }[]) => notes.map((n) => noteName(n));

export const CHALLENGES: ChallengeTemplate[] = [
  {
    id: 'three-notes', title: 'Improvise with only three notes', minLevel: 4, requires: ['l5-minor-pentatonic'], progressions: ['minor-rock', '12-bar-blues'],
    build: (ctx) => {
      const sc = buildScale(ctx.key, ctx.mode === 'minor' ? 'minor-pentatonic' : 'major-pentatonic');
      const three = [sc.notes[0], sc.notes[1], sc.notes[2]];
      return {
        instructions: [`Use only ${names(three).join(', ')} (in any octave).`, 'Make it musical with rhythm, repetition, space and dynamics instead of more notes.', 'Play for at least two full times through the progression.'],
        targets: names(three),
        checklist: ['I repeated at least one rhythmic idea', 'I left silence between phrases', 'I varied loud and soft'],
      };
    },
  },
  {
    id: 'pentatonic-melody', title: 'Compose a melody with minor pentatonic', minLevel: 4, requires: ['l5-minor-pentatonic'], progressions: ['minor-rock', 'minor-blues'],
    build: (ctx) => {
      const sc = buildScale(ctx.key, 'minor-pentatonic');
      return {
        instructions: [`Use ${noteName(sc.root)} minor pentatonic: ${names(sc.notes).join(' ')}.`, 'Write a 4-bar melody you could sing, then play it twice in a row identically.', 'End the melody on the root.'],
        targets: names(sc.notes),
        checklist: ['My melody is singable', 'I played it the same way twice', 'It ends on the root'],
      };
    },
  },
  {
    id: 'target-thirds', title: 'Target the 3rd of every chord', minLevel: 6, requires: ['l8-chord-tones'], progressions: ['12-bar-blues', 'pop-axis', 'jazz-ii-v-i'],
    build: (_ctx, chords) => {
      const thirds = chords.filter((c, i, a) => a.findIndex((x) => x.chord.symbol === c.chord.symbol) === i).map((c) => {
        const idx = c.chord.tokens.findIndex((t) => t === '3' || t === 'b3');
        return `${c.chord.symbol}: ${idx >= 0 ? noteName(c.chord.notes[idx]) : noteName(c.chord.notes[0])}`;
      });
      return {
        instructions: ['On the first beat of every chord change, land on that chord\'s 3rd.', 'Approach it from a scale step above or below.', 'Fill the space between targets with notes of your choice.'],
        targets: thirds,
        checklist: ['I hit the 3rd on most chord changes', 'The changes are audible in my line even without the backing'],
      };
    },
  },
  {
    id: 'connect-positions', title: 'Connect two pentatonic positions', minLevel: 5, requires: ['l5-pentatonic-positions'], progressions: ['minor-rock', '12-bar-blues'],
    build: (ctx) => {
      const sc = buildScale(ctx.key, ctx.mode === 'minor' ? 'minor-pentatonic' : 'major-pentatonic');
      return {
        instructions: ['Start a phrase in position 1 and finish it in position 2.', 'Use a slide on one string to move between positions.', 'Repeat in the other direction (position 2 back to 1).'],
        targets: names(sc.notes),
        checklist: ['I moved between positions mid-phrase', 'The shift was smooth and in time'],
      };
    },
  },
  {
    id: 'dorian-minor', title: 'Use Dorian over a minor progression', minLevel: 7, requires: ['l7-dorian'], progressions: ['dorian-vamp'],
    build: (ctx) => {
      const sc = buildScale(ctx.key, 'dorian');
      return {
        instructions: [`Play ${noteName(sc.root)} Dorian: ${names(sc.notes).join(' ')}.`, `Feature the natural 6th (${noteName(sc.notes[5])}), the note that makes Dorian brighter than natural minor.`, 'Resolve phrases to the root or the minor 3rd.'],
        targets: [noteName(sc.notes[5]) + ' (characteristic 6th)', noteName(sc.notes[0]), noteName(sc.notes[2])],
        checklist: ['I emphasised the natural 6th', 'The Dorian colour is audible'],
      };
    },
  },
  {
    id: 'resolve-chord-tones', title: 'Resolve every phrase to a chord tone', minLevel: 6, requires: ['l8-chord-tones'], progressions: ['jazz-ii-v-i', 'pop-axis'],
    build: (_ctx, chords) => ({
      instructions: ['Play short phrases (one or two bars).', 'End each phrase on a root, 3rd or 5th of the chord sounding at that moment.', 'Hold the final note and listen to how it settles.'],
      targets: chords.filter((c, i, a) => a.findIndex((x) => x.chord.symbol === c.chord.symbol) === i).map((c) => `${c.chord.symbol}: ${names(c.chord.notes.slice(0, 3)).join(' ')}`),
      checklist: ['Every phrase ended on a chord tone', 'I could hear the difference when I ended elsewhere'],
    }),
  },
  {
    id: 'four-bar-phrase', title: 'Build a four-bar question-and-answer phrase', minLevel: 5, requires: ['l5-blues-phrasing'], progressions: ['12-bar-blues', 'minor-blues'],
    build: (ctx) => ({
      instructions: ['Bars 1–2: play a "question" that ends on an unstable note (2nd, 4th or 6th).', 'Bars 3–4: answer it with a similar rhythm that ends on the root.', `Key centre: ${ctx.key} ${ctx.mode}.`],
      targets: [`Root: ${ctx.key}`],
      checklist: ['My question sounded unfinished', 'My answer resolved'],
    }),
  },
  {
    id: 'motif', title: 'Develop a motif through repetition and variation', minLevel: 6, requires: ['l10-motifs'], progressions: ['minor-rock', 'rock-mixo'],
    build: () => ({
      instructions: ['Invent a 3–5 note motif.', 'Play it, then repeat it exactly.', 'Vary it: change one note, then its rhythm, then start it on a different beat, then move it up a scale step.', 'Finish with the original motif.'],
      targets: [],
      checklist: ['The motif is recognisable throughout', 'I used at least three different variations'],
    }),
  },
  {
    id: 'chord-scale-tour', title: 'Follow the chord-scale map', minLevel: 8, requires: ['l8-chord-scale'], progressions: ['jazz-turnaround', 'jazz-ii-v-i'],
    build: (ctx, chords) => ({
      instructions: ['For each chord, play its recommended scale (shown in the theory panel).', 'Start each new chord on a chord tone close to where the last phrase ended.', 'Listen for the notes that change between chords.'],
      targets: chords.filter((c, i, a) => a.findIndex((x) => x.chord.symbol === c.chord.symbol) === i).map((c) => {
        const s = chordScales(c.chord, ctx.key, ctx.mode).suggestions[0];
        return `${c.chord.symbol}: ${s ? `${noteName(s.root)} ${s.scale.name}` : 'chord tones'}`;
      }),
      checklist: ['I changed scales with the chords', 'My lines connected smoothly across changes'],
    }),
  },
];

export function unlockedChallenges(state: StudentState): ChallengeTemplate[] {
  return CHALLENGES.filter((c) => c.requires.every((id) => statusAtLeast(state.lessons[id], 'completed')));
}

export function buildChallenge(template: ChallengeTemplate, ctx: JamContext) {
  const prog = PROGRESSIONS.find((p) => p.id === ctx.progressionId) ?? PROGRESSIONS[0];
  const chords = resolveProgression(prog.bars, ctx.key);
  return { template, ...template.build(ctx, chords), chords };
}

/** Theory panel data for one chord of a progression. */
export function chordView(chord: ResolvedChord, key: string, mode: 'major' | 'minor') {
  const analysis = chordScales(chord.chord, key, mode, 3);
  return {
    symbol: chord.chord.symbol,
    numeral: chord.numeral,
    chordTones: analysis.chordTones,
    guideTones: analysis.guideTones,
    suggestions: analysis.suggestions.map((s) => ({ name: `${noteName(s.root)} ${s.scale.name}`, scaleId: s.scale.id, root: noteName(s.root), reason: s.reason })),
    tension: analysis.tensionNotes,
    inKey: analysis.inKey,
  };
}

export function keyRoot(key: string) {
  return parseNote(key);
}
