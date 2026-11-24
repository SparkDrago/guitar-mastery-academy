/**
 * Technique exercise library. Scores are generated with the theory engine
 * where possible (scales, arpeggios, chords), so every note is correct by
 * construction. All exercises are original.
 */
import type { Exercise, TechniqueId, Category } from '@gma/learning';
import type { Duration, TabBeat, TabNote, TabScore, Technique } from '@gma/notation';
import { STANDARD_TUNING, buildScale, findVoicings, notesPerStringPattern, parseChordSymbol, scaleIntervals } from '@gma/theory';

type N = [number, number, Technique[]?];
type Beat = N | N[] | null;

function durationFor(npb: number): { duration: Duration; triplet?: boolean } {
  switch (npb) {
    case 1: return { duration: 4 };
    case 2: return { duration: 8 };
    case 3: return { duration: 8, triplet: true };
    case 4: return { duration: 16 };
    case 6: return { duration: 16, triplet: true };
    default: return { duration: 8 };
  }
}

/** Build a 4/4 score from beats, all of one rhythmic value. */
export function seqScore(title: string, beats: Beat[], npb: number, tempo = 80, palmMuteAll = false): TabScore {
  const d = durationFor(npb);
  const perBar = npb * 4;
  const measures: { beats: TabBeat[] }[] = [];
  beats.forEach((b, i) => {
    if (i % perBar === 0) measures.push({ beats: [] });
    const notes: TabNote[] = b === null ? [] : (Array.isArray(b[0]) ? (b as N[]) : [b as N]).map(([s, f, t]) => {
      const tech = [...(t ?? []), ...(palmMuteAll ? (['palmMute'] as Technique[]) : [])];
      return tech.length ? { string: s, fret: f, techniques: tech } : { string: s, fret: f };
    });
    measures[measures.length - 1].beats.push({ ...d, notes, rest: b === null || undefined });
  });
  return { format: 'gma-tab', version: 1, title, tuning: { name: 'E Standard', strings: [...STANDARD_TUNING.strings] }, tempo, timeSignature: [4, 4], measures };
}

function scaleRun(root: string, scale: string, startIndex: number, nps: number, minFret: number, upDown = true): N[] {
  const pcs = buildScale(root, scale).pcs;
  const notes = notesPerStringPattern(STANDARD_TUNING, pcs[0], scaleIntervals(scale), startIndex, nps, { minFret })!;
  const up: N[] = notes.map((n) => [n.string, n.fret]);
  return upDown ? [...up, ...up.slice(0, -1).reverse().slice(0, up.length - 2)] : up;
}

function chordBeat(symbol: string, pick?: (frets: (number | null)[]) => boolean): N[] {
  const v = findVoicings(parseChordSymbol(symbol)!, STANDARD_TUNING, { limit: 40 });
  const chosen = (pick ? v.find((x) => pick(x.frets)) : undefined) ?? v[0];
  return chosen.frets.map((f, s) => (f === null ? null : ([s, f] as N))).filter((x): x is N => x !== null);
}

const rep = <T,>(arr: T[], times: number): T[] => Array.from({ length: times }, () => arr).flat();

interface Def {
  id: string; name: string; technique: TechniqueId; category: Category; level: number; difficulty: 1 | 2 | 3 | 4 | 5;
  bpmStart: number; bpmTarget: number; npb: number; reps: number; minutes: number; beats: Beat[];
  instructions: string[]; mistakes: string[]; mastery: string; easier?: string; harder?: string; analyzable?: boolean; palmMute?: boolean;
}

function make(d: Def): Exercise {
  return {
    id: d.id, name: d.name, technique: d.technique, category: d.category, level: d.level, difficulty: d.difficulty,
    bpmStart: d.bpmStart, bpmTarget: d.bpmTarget, notesPerBeat: d.npb, reps: d.reps, minutes: d.minutes,
    score: seqScore(d.name, d.beats, d.npb, d.bpmStart, d.palmMute), instructions: d.instructions, mistakes: d.mistakes, mastery: d.mastery,
    easier: d.easier, harder: d.harder, analyzable: d.analyzable ?? true,
  };
}

// ── Building blocks ──────────────────────────────────────────────────────

const chromatic1234: N[] = [0, 1, 2, 3, 4, 5].flatMap((s) => [1, 2, 3, 4].map((f) => [s, f] as N));
const spider1324: N[] = [0, 1, 2, 3, 4, 5].flatMap((s) => [1, 3, 2, 4].map((f) => [s, f] as N));
const cMajorFirstPos: N[] = [[1, 3], [2, 0], [2, 2], [2, 3], [3, 0], [3, 2], [4, 0], [4, 1], [4, 3], [5, 0], [5, 1], [5, 3], [5, 1], [5, 0], [4, 3], [4, 1]];
const aMinPent1 = scaleRun('A', 'minor-pentatonic', 0, 2, 5);
const cMajorPos8 = scaleRun('C', 'major', 0, 3, 8);
const gMajor3nps = scaleRun('G', 'major', 0, 3, 3);
const aMinor3nps = scaleRun('A', 'aeolian', 0, 3, 5, false);

const pentGroups3: N[] = (() => {
  const up = scaleRun('A', 'minor-pentatonic', 0, 2, 5, false);
  const out: N[] = [];
  for (let i = 0; i + 2 < up.length; i++) out.push(up[i], up[i + 1], up[i + 2]);
  return out.slice(0, 24);
})();

export const EXERCISES: Exercise[] = [
  make({ id: 'ex-chromatic-1234', name: 'Chromatic 1-2-3-4 warm-up', technique: 'synchronization', category: 'technique', level: 0, difficulty: 1, bpmStart: 60, bpmTarget: 120, npb: 2, reps: 4, minutes: 5,
    beats: [...chromatic1234, ...[...chromatic1234].reverse()], instructions: ['One finger per fret, frets 1–4, every string, up and back.', 'Alternate-pick every note; keep fingers close to the strings.'], mistakes: ['Lifting fingers high between notes.', 'Picking and fretting not landing together.'], mastery: 'Clean and relaxed at 120 bpm eighth notes.', harder: 'ex-sync-spider' }),
  make({ id: 'ex-sync-spider', name: 'Spider 1-3-2-4 synchronisation', technique: 'synchronization', category: 'technique', level: 1, difficulty: 2, bpmStart: 60, bpmTarget: 110, npb: 4, reps: 4, minutes: 5,
    beats: [...spider1324, ...spider1324.slice(0, 8)], instructions: ['Fingers 1-3-2-4 on frets 1-3-2-4 of each string.', 'Strict alternate picking; aim for pick and finger to land at the same instant.'], mistakes: ['Collapsing finger 4.', 'Sloppy string changes.'], mastery: 'Clean sixteenths at 110 bpm.', easier: 'ex-chromatic-1234', harder: 'ex-sync-burst' }),
  make({ id: 'ex-sync-burst', name: 'Four-note speed bursts', technique: 'synchronization', category: 'technique', level: 9, difficulty: 3, bpmStart: 80, bpmTarget: 160, npb: 4, reps: 10, minutes: 6,
    beats: rep([[0, 5], [0, 6], [0, 7], [0, 8], null, null, null, null] as Beat[], 4), instructions: ['Play the four-note group as one fast burst, then rest for a beat.', 'Increase tempo by 5 bpm after two clean takes.'], mistakes: ['Tension in the forearm.', 'Rushing the first note of the burst.'], mastery: 'Clean bursts at 160 bpm sixteenths.', easier: 'ex-sync-spider' }),
  make({ id: 'ex-melody-first5', name: 'First-position line (C major)', technique: 'fretting', category: 'technique', level: 1, difficulty: 1, bpmStart: 50, bpmTarget: 90, npb: 1, reps: 4, minutes: 5,
    beats: cMajorFirstPos, instructions: ['One finger per fret in first position.', 'Every note must ring clearly; mute unused strings.'], mistakes: ['Buzzing notes.', 'Open strings ringing under gain.'], mastery: 'Every note clean at 90 bpm quarter notes.', harder: 'ex-string-cross' }),
  make({ id: 'ex-alt-single', name: 'One-string alternate picking (subdivision ladder)', technique: 'alternate-picking', category: 'technique', level: 1, difficulty: 2, bpmStart: 60, bpmTarget: 120, npb: 4, reps: 4, minutes: 5,
    beats: rep([[0, 5], [0, 5], [0, 7], [0, 7], [0, 8], [0, 8], [0, 7], [0, 7]] as Beat[], 4), instructions: ['Strict alternate picking, sixteenth notes.', 'Down on the beat; keep the motion small.'], mistakes: ['Uneven down/up volume.', 'Speeding up.'], mastery: 'Even sixteenths at 120 bpm.', harder: 'ex-string-cross' }),
  make({ id: 'ex-string-cross', name: 'String-crossing alternate picking', technique: 'alternate-picking', category: 'technique', level: 1, difficulty: 2, bpmStart: 60, bpmTarget: 120, npb: 2, reps: 4, minutes: 5,
    beats: rep([[0, 5], [1, 7], [0, 7], [1, 5], [0, 8], [1, 7], [0, 7], [1, 5]] as Beat[], 4), instructions: ['Alternate strictly while crossing between the E and A strings every note.', 'Mute the string you left with the picking-hand palm.'], mistakes: ['Two downstrokes in a row at string changes.', 'Hitting the wrong string.'], mastery: 'Clean eighths at 120 bpm.', easier: 'ex-alt-single', harder: 'ex-alt-3nps' }),
  make({ id: 'ex-alt-3nps', name: '3NPS major scale run (G major)', technique: 'alternate-picking', category: 'technique', level: 6, difficulty: 3, bpmStart: 60, bpmTarget: 130, npb: 3, reps: 4, minutes: 6,
    beats: gMajor3nps, instructions: ['Three notes per string; one string per beat (triplets).', 'Strict alternate or economy picking, your choice; stay consistent.'], mistakes: ['Finger 3 instead of 4 on X shapes.', 'Rushing string changes.'], mastery: 'Clean at 130 bpm triplets.', easier: 'ex-string-cross', harder: 'ex-alt-inside-outside' }),
  make({ id: 'ex-alt-inside-outside', name: 'Inside / outside picking (two strings)', technique: 'alternate-picking', category: 'technique', level: 9, difficulty: 4, bpmStart: 70, bpmTarget: 140, npb: 4, reps: 6, minutes: 6,
    beats: rep([[3, 7], [3, 9], [4, 7], [4, 8], [3, 9], [3, 7], [4, 8], [4, 7]] as Beat[], 4), instructions: ['Two notes per string, crossing every two notes: an even number gives the same string change every time.', 'Start with a downstroke (outside picking), then start with an upstroke (inside picking). Log each.'], mistakes: ['Big motions at the crossing.', 'Pick getting trapped between strings.'], mastery: 'Clean at 140 bpm sixteenths with both start strokes.', easier: 'ex-alt-3nps' }),
  make({ id: 'ex-economy-3nps', name: 'Economy-picked A minor 3NPS', technique: 'economy-picking', category: 'technique', level: 9, difficulty: 3, bpmStart: 70, bpmTarget: 140, npb: 3, reps: 4, minutes: 6,
    beats: aMinor3nps, instructions: ['Ascending: D-U-D on each string, then continue down onto the next string (mini sweep).', 'Keep the rhythm even through the sweep.'], mistakes: ['Sweep rushing ahead of the beat.'], mastery: 'Even triplets at 140 bpm.', easier: 'ex-alt-3nps' }),
  make({ id: 'ex-legato-trills', name: 'Finger-pair trills', technique: 'legato', category: 'technique', level: 5, difficulty: 2, bpmStart: 60, bpmTarget: 120, npb: 4, reps: 6, minutes: 5,
    beats: [...rep([[3, 5], [3, 7, ['hammer']], [3, 5, ['pull']], [3, 7, ['hammer']]] as Beat[], 4), ...rep([[3, 5], [3, 8, ['hammer']], [3, 5, ['pull']], [3, 8, ['hammer']]] as Beat[], 4)], instructions: ['Pick once, then trill with hammer-ons and pull-offs.', 'Keep every note the same volume.'], mistakes: ['Weak pull-offs.', 'Pressing too hard.'], mastery: 'Even sixteenth-note trills at 120 bpm.', harder: 'ex-legato-hp' }),
  make({ id: 'ex-legato-hp', name: 'Pentatonic hammer-pull phrase', technique: 'legato', category: 'technique', level: 5, difficulty: 2, bpmStart: 60, bpmTarget: 110, npb: 3, reps: 4, minutes: 5,
    beats: rep([[4, 5], [4, 8, ['hammer']], [4, 5, ['pull']], [3, 7], [3, 5, ['pull']], [3, 7, ['hammer']]] as Beat[], 4), instructions: ['A minor pentatonic, position 1.', 'Pick only the first note on each string.'], mistakes: ['Unwanted strings ringing during pull-offs.'], mastery: 'Clean triplets at 110 bpm.', easier: 'ex-legato-trills', harder: 'ex-legato-3nps' }),
  make({ id: 'ex-legato-3nps', name: '3NPS legato run (A minor)', technique: 'legato', category: 'technique', level: 9, difficulty: 3, bpmStart: 60, bpmTarget: 130, npb: 3, reps: 4, minutes: 6,
    beats: aMinor3nps.map((n, i) => (i % 3 === 0 ? n : ([n[0], n[1], ['hammer']] as N))), instructions: ['Pick the first note of each string, hammer the next two.', 'Mute idle strings with both hands.'], mistakes: ['Volume drop on the third note.'], mastery: 'Even at 130 bpm triplets.', easier: 'ex-legato-hp' }),
  make({ id: 'ex-sweep-3string', name: 'Three-string triad sweep', technique: 'sweep-picking', category: 'technique', level: 9, difficulty: 3, bpmStart: 50, bpmTarget: 120, npb: 3, reps: 8, minutes: 6,
    beats: rep([[3, 9], [4, 8], [5, 8], [4, 8], [3, 9], [4, 8]] as Beat[], 4), instructions: ['C major triad on G-B-e. Down-sweep up, up-sweep down.', 'Mute each note as the next sounds; no strummed chord.'], mistakes: ['Notes ringing together.', 'Uneven rhythm.'], mastery: 'Separated notes at 120 bpm triplets.', harder: 'ex-sweep-5string' }),
  make({ id: 'ex-sweep-5string', name: 'Five-string A minor arpeggio', technique: 'sweep-picking', category: 'technique', level: 9, difficulty: 5, bpmStart: 50, bpmTarget: 110, npb: 4, reps: 6, minutes: 8,
    beats: rep([[1, 12], [2, 10], [3, 9], [4, 10], [5, 12], [4, 10], [3, 9], [2, 10]] as Beat[], 4), instructions: ['A minor arpeggio from the A string. Continuous sweeps in each direction.', 'Roll the finger on the D–G–B notes.'], mistakes: ['Blurred notes on the rolled strings.'], mastery: 'Clean at 110 bpm sixteenths.', easier: 'ex-sweep-3string' }),
  make({ id: 'ex-tap-triplet', name: 'One-string tapping triplets', technique: 'tapping', category: 'technique', level: 9, difficulty: 3, bpmStart: 60, bpmTarget: 140, npb: 3, reps: 8, minutes: 5,
    beats: rep([[4, 12, ['tap']], [4, 5, ['pull']], [4, 8, ['hammer']]] as Beat[], 8), instructions: ['Tap 12, pull off to 5, hammer to 8.', 'Mute the other strings with both hands.'], mistakes: ['Tapped note weaker than the others.'], mastery: 'Even triplets at 140 bpm.', harder: 'ex-tap-skip' }),
  make({ id: 'ex-tap-skip', name: 'Tapping with string changes', technique: 'tapping', category: 'technique', level: 9, difficulty: 4, bpmStart: 60, bpmTarget: 120, npb: 3, reps: 6, minutes: 6,
    beats: [...rep([[4, 13, ['tap']], [4, 5, ['pull']], [4, 8, ['hammer']]] as Beat[], 4), ...rep([[5, 12, ['tap']], [5, 5, ['pull']], [5, 8, ['hammer']]] as Beat[], 4)], instructions: ['Move the tapping pattern between the B and high E strings.', 'Keep muting consistent as you change strings.'], mistakes: ['Noise on the string change.'], mastery: 'Clean at 120 bpm triplets.', easier: 'ex-tap-triplet' }),
  make({ id: 'ex-skip-octaves', name: 'Octave string skipping', technique: 'string-skipping', category: 'technique', level: 9, difficulty: 3, bpmStart: 60, bpmTarget: 130, npb: 2, reps: 4, minutes: 5,
    beats: rep([[0, 5], [2, 7], [0, 7], [2, 9], [0, 8], [2, 10], [0, 7], [2, 9]] as Beat[], 4), instructions: ['Alternate between the low E and D strings, skipping the A string.', 'Mute the A string with the palm.'], mistakes: ['Clipping the skipped string.'], mastery: 'Clean at 130 bpm eighths.', harder: 'ex-skip-arpeggio' }),
  make({ id: 'ex-skip-arpeggio', name: 'String-skipping arpeggio', technique: 'string-skipping', category: 'technique', level: 9, difficulty: 4, bpmStart: 60, bpmTarget: 120, npb: 4, reps: 6, minutes: 6,
    beats: rep([[2, 7], [2, 10], [4, 10], [4, 13], [4, 10], [2, 10], [2, 7], [4, 10]] as Beat[], 4), instructions: ['A minor arpeggio fragments on the D and B strings.', 'Alternate picking; aim precisely across the skipped G string.'], mistakes: ['Hitting the G string.'], mastery: 'Clean at 120 bpm sixteenths.', easier: 'ex-skip-octaves' }),
  make({ id: 'ex-bend-pitch', name: 'In-tune bends to target', technique: 'bending', category: 'technique', level: 5, difficulty: 2, bpmStart: 60, bpmTarget: 80, npb: 1, reps: 10, minutes: 5,
    beats: rep([[4, 10], [4, 8, ['bend']], [3, 9], [3, 7, ['bend']]] as Beat[], 4), instructions: ['Play the target note, then bend the lower note up to match it (a full bend).', 'Check pitch with the tuner; support with extra fingers.'], mistakes: ['Under-bending (flat).'], mastery: 'Bends within 10 cents of target.', analyzable: false }),
  make({ id: 'ex-vibrato-rhythmic', name: 'Rhythmic vibrato', technique: 'vibrato', category: 'technique', level: 5, difficulty: 2, bpmStart: 60, bpmTarget: 100, npb: 1, reps: 6, minutes: 5,
    beats: rep([[3, 7, ['vibrato']], [3, 7, ['vibrato']], [4, 8, ['vibrato']], [4, 8, ['vibrato']]] as Beat[], 4), instructions: ['Hold each note for a beat with exactly one vibrato cycle per beat, then two.', 'Keep the width consistent.'], mistakes: ['Nervous, uneven vibrato.'], mastery: 'Even vibrato locked to 100 bpm.', analyzable: false }),
  make({ id: 'ex-tremolo', name: 'Tremolo picking', technique: 'tremolo-picking', category: 'technique', level: 9, difficulty: 3, bpmStart: 80, bpmTarget: 170, npb: 4, reps: 4, minutes: 5,
    beats: rep([[4, 10], [4, 10], [4, 10], [4, 10]] as Beat[], 8).map((b, i) => (i >= 16 ? ([4, i < 24 ? 8 : 12] as N) : b)), instructions: ['Even sixteenth notes on one pitch, then change notes without breaking the motion.', 'Relax the wrist; small motion.'], mistakes: ['Forearm tension.', 'Uneven sixteenths.'], mastery: 'Even at 170 bpm sixteenths.' }),
  make({ id: 'ex-hybrid', name: 'Hybrid-picking pattern', technique: 'hybrid-picking', category: 'technique', level: 9, difficulty: 3, bpmStart: 60, bpmTarget: 120, npb: 2, reps: 4, minutes: 5,
    beats: rep([[3, 0], [5, 3], [2, 0], [5, 3], [3, 2], [5, 3], [2, 2], [5, 2]] as Beat[], 4), instructions: ['Pick the lower notes, pluck the high E notes with the middle finger.', 'Match volumes.'], mistakes: ['Finger notes much louder than picked notes.'], mastery: 'Clean at 120 bpm eighths.' }),
  make({ id: 'ex-harmonics', name: 'Natural harmonics map', technique: 'harmonics', category: 'technique', level: 9, difficulty: 2, bpmStart: 60, bpmTarget: 90, npb: 1, reps: 2, minutes: 5,
    beats: [12, 7, 5].flatMap((f) => [0, 1, 2, 3, 4, 5].map((s) => [s, f, ['harmonic']] as N)).slice(0, 16), instructions: ['Lightly touch the string directly above the fret wire; pick; lift.', 'Frets 12, 7 and 5 on every string.'], mistakes: ['Pressing the string down.'], mastery: 'Every harmonic rings clearly.', analyzable: false }),
  make({ id: 'ex-palm-mute-8ths', name: 'Palm-muted eighths', technique: 'palm-muting', category: 'rhythm', level: 1, difficulty: 1, bpmStart: 80, bpmTarget: 140, npb: 2, reps: 4, minutes: 5,
    beats: rep([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 3], [0, 5]] as Beat[], 4), palmMute: true, instructions: ['Downstrokes; palm at the bridge saddles.', 'Keep the pitch audible.'], mistakes: ['Palm too far forward.'], mastery: 'Even downpicked eighths at 140 bpm.', harder: 'ex-gallop' }),
  make({ id: 'ex-gallop', name: 'Gallop rhythm', technique: 'rhythm-accuracy', category: 'rhythm', level: 4, difficulty: 3, bpmStart: 90, bpmTarget: 160, npb: 4, reps: 6, minutes: 5,
    beats: rep([[0, 0], null, [0, 0], [0, 0]] as Beat[], 8), palmMute: true, instructions: ['Eighth + two sixteenths on the open low E, palm-muted.', 'Pick D-D-U or D-U-D, keeping the rhythm crisp.'], mistakes: ['Sixteenths blurring together.'], mastery: 'Crisp gallops at 160 bpm.', easier: 'ex-palm-mute-8ths', harder: 'ex-downpick-endurance' }),
  make({ id: 'ex-downpick-endurance', name: 'Downpicking endurance', technique: 'rhythm-accuracy', category: 'rhythm', level: 4, difficulty: 4, bpmStart: 120, bpmTarget: 190, npb: 2, reps: 3, minutes: 6,
    beats: rep([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [[0, 5], [1, 7]], [[0, 3], [1, 5]]] as Beat[], 6), palmMute: true, instructions: ['All downstrokes for one minute.', 'Stop and shake out at any burning; return relaxed.'], mistakes: ['Forcing through tension.'], mastery: 'One minute at 190 bpm eighths, even.', easier: 'ex-gallop' }),
  make({ id: 'ex-power-chords', name: 'Moving power chords', technique: 'chord-changes', category: 'chords', level: 1, difficulty: 2, bpmStart: 70, bpmTarget: 130, npb: 2, reps: 4, minutes: 5,
    beats: rep([[[0, 3], [1, 5]], [[0, 3], [1, 5]], [[0, 3], [1, 5]], [[0, 3], [1, 5]], [[0, 5], [1, 7]], [[0, 5], [1, 7]], [[1, 3], [2, 5]], [[1, 3], [2, 5]]] as Beat[], 4), palmMute: true, instructions: ['G5–A5–C5 with downstrokes and palm muting.', 'Keep the shape locked while moving.'], mistakes: ['Shape collapsing on the move.'], mastery: 'Clean at 130 bpm eighths.' }),
  make({ id: 'ex-open-changes', name: 'Open-chord changes (Em–C–G–D)', technique: 'chord-changes', category: 'chords', level: 1, difficulty: 2, bpmStart: 60, bpmTarget: 110, npb: 1, reps: 4, minutes: 5,
    beats: ['Em', 'C', 'G', 'D'].flatMap((c) => rep([chordBeat(c, (f) => f.filter((x) => x !== null).every((x) => (x as number) <= 3))] as Beat[], 2)).concat(['Em', 'C', 'G', 'D'].flatMap((c) => rep([chordBeat(c, (f) => f.filter((x) => x !== null).every((x) => (x as number) <= 3))] as Beat[], 2))), instructions: ['Two strums per chord; changes land on time.', 'Release on the last beat if needed.'], mistakes: ['Stopping the rhythm to change.'], mastery: 'Clean changes at 110 bpm, two beats per chord.', analyzable: false }),
  make({ id: 'ex-strum-basic', name: 'Pop strumming pattern', technique: 'strumming', category: 'rhythm', level: 1, difficulty: 1, bpmStart: 70, bpmTarget: 120, npb: 2, reps: 4, minutes: 5,
    beats: ['G', 'C', 'D', 'G'].flatMap((c) => { const ch = chordBeat(c, (f) => f.filter((x) => x !== null).every((x) => (x as number) <= 3)); return [ch, null, ch, ch, null, ch, ch, ch] as Beat[]; }), instructions: ['D – D U – U D U with constant motion.', 'Hand keeps moving on silent strokes.'], mistakes: ['Hand stopping on air strokes.'], mastery: 'Steady at 120 bpm.', analyzable: false, harder: 'ex-strum-syncopated' }),
  make({ id: 'ex-strum-syncopated', name: 'Syncopated sixteenth strumming', technique: 'strumming', category: 'rhythm', level: 4, difficulty: 3, bpmStart: 70, bpmTarget: 110, npb: 4, reps: 4, minutes: 5,
    beats: ['Em', 'C'].flatMap((c) => { const ch = chordBeat(c, (f) => f.filter((x) => x !== null).every((x) => (x as number) <= 3)); return rep([ch, null, ch, ch, null, ch, ch, null] as Beat[], 4); }), instructions: ['Constant sixteenth motion; strike only the written strokes.', 'Accent the off-beats.'], mistakes: ['Falling back to downbeat accents.'], mastery: 'Locked in at 110 bpm.', analyzable: false, easier: 'ex-strum-basic' }),
  make({ id: 'ex-blues-shuffle', name: 'Boogie shuffle in A', technique: 'rhythm-accuracy', category: 'rhythm', level: 1, difficulty: 2, bpmStart: 70, bpmTarget: 120, npb: 2, reps: 4, minutes: 5,
    beats: rep([[[1, 0], [2, 2]], [[1, 0], [2, 2]], [[1, 0], [2, 4]], [[1, 0], [2, 4]]] as Beat[], 8), instructions: ['Open A string as the root with D-string notes at frets 2 and 4: root–5th, then root–6th (A5 → A6).', 'Swing the eighths: long–short (use the Shuffle preset).'], mistakes: ['Straight eighths instead of shuffle.'], mastery: 'Strong shuffle feel at 120 bpm.' }),
  make({ id: 'ex-12bar-comp', name: '12-bar blues comping in A', technique: 'chord-changes', category: 'chords', level: 5, difficulty: 2, bpmStart: 70, bpmTarget: 120, npb: 1, reps: 2, minutes: 6,
    beats: ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7'].flatMap((c) => rep([chordBeat(c)] as Beat[], 4)), instructions: ['One strum per beat through the 12-bar form.', 'Count the bars aloud.'], mistakes: ['Losing your place in the form.'], mastery: 'Whole form without errors at 120 bpm.', analyzable: false }),
  make({ id: 'ex-pent-pos1', name: 'A minor pentatonic, position 1', technique: 'scales', category: 'scales', level: 5, difficulty: 1, bpmStart: 60, bpmTarget: 130, npb: 2, reps: 4, minutes: 5,
    beats: aMinPent1, instructions: ['Up and down without pausing at the top.', 'Fingers 1 and 4 on the wide strings, 1 and 3 on the narrow.'], mistakes: ['Stopping at the turnaround.'], mastery: 'Clean eighths at 130 bpm.', harder: 'ex-pent-sequence' }),
  make({ id: 'ex-pent-sequence', name: 'Pentatonic in groups of three', technique: 'scales', category: 'scales', level: 5, difficulty: 3, bpmStart: 60, bpmTarget: 120, npb: 3, reps: 4, minutes: 5,
    beats: pentGroups3, instructions: ['Play 1-2-3, 2-3-4, 3-4-5 … through position 1.', 'Alternate picking; feel the triplet grouping.'], mistakes: ['Losing the sequence position.'], mastery: 'Clean triplets at 120 bpm.', easier: 'ex-pent-pos1' }),
  make({ id: 'ex-major-scale-pos', name: 'C major, one position (8th fret)', technique: 'scales', category: 'scales', level: 3, difficulty: 2, bpmStart: 60, bpmTarget: 120, npb: 2, reps: 4, minutes: 5,
    beats: cMajorPos8, instructions: ['Three notes per string from the 8th-fret root.', 'Say the degree numbers as you play.'], mistakes: ['Wrong finger on stretches.'], mastery: 'Clean eighths at 120 bpm.' }),
  make({ id: 'ex-arp-triads', name: 'Diatonic triad arpeggios (C major)', technique: 'arpeggios', category: 'chords', level: 8, difficulty: 3, bpmStart: 60, bpmTarget: 110, npb: 3, reps: 4, minutes: 6,
    beats: ([['C', [[1, 3], [2, 2], [3, 0]]], ['Dm', [[1, 5], [2, 3], [3, 2]]], ['Em', [[1, 7], [2, 5], [3, 4]]], ['F', [[1, 8], [2, 7], [3, 5]]], ['G', [[1, 10], [2, 9], [3, 7]]], ['Am', [[1, 12], [2, 10], [3, 9]]]] as [string, N[]][]).flatMap(([, ns]) => [...ns, ...[...ns].reverse()]).slice(0, 36), instructions: ['Root–3rd–5th up, 5th–3rd–root down, for each diatonic chord.', 'Name each chord as you play it.'], mistakes: ['Losing the chord quality pattern (I ii iii IV V vi).'], mastery: 'Clean at 110 bpm triplets.' }),
  make({ id: 'ex-barre-changes', name: 'Barre-chord changes (F–Dm–B♭–C)', technique: 'chord-changes', category: 'chords', level: 8, difficulty: 3, bpmStart: 60, bpmTarget: 110, npb: 1, reps: 4, minutes: 6,
    beats: [['F', '133211'], ['Dm', 'x57765'], ['Bb', 'x13331'], ['C', 'x35553']].flatMap(([, shape]) => {
      const frets = shape.split('').map((ch) => (ch === 'x' ? null : Number(ch)));
      const beat = frets.map((f, s) => (f === null ? null : ([s, f] as N))).filter((x): x is N => x !== null);
      return rep([beat] as Beat[], 4);
    }), instructions: ['E- and A-shape barres, four strums each.', 'Arm weight, not thumb squeeze.'], mistakes: ['Muted strings under the barre.'], mastery: 'All strings ring, changes on time at 110 bpm.', analyzable: false }),
];

export function findExercise(id: string, custom: Exercise[] = []): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id) ?? custom.find((e) => e.id === id);
}
