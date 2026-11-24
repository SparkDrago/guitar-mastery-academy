/**
 * Daily recommendations and achievements. Every recommendation names the
 * evidence it is based on.
 */
import { analyse as analyseTrainer } from './fretboard-trainer';
import { earStats } from './ear-training';
import { streak } from './analytics';
import { currentLevel, dueCards, nextLessons, statusAtLeast } from './progress';
import { weaknesses } from './scheduler';
import { STANDARD_TUNING } from '@gma/theory';
import type { Exercise, Lesson, StudentState } from './types';

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  route: string;
  priority: number;
}

export function dailyRecommendations(state: StudentState, lessons: Lesson[], exercises: Exercise[], now: Date): Recommendation[] {
  const out: Recommendation[] = [];
  const next = nextLessons(lessons, state, 1)[0];
  if (next) out.push({ id: `lesson-${next.id}`, title: `Continue: ${next.title}`, detail: state.lessons[next.id]?.status === 'in_progress' ? 'You started this lesson. Finish it to unlock what comes next.' : `Next lesson in Level ${next.level}.`, route: `/lessons/${next.id}`, priority: 10 });
  const due = dueCards(state, now);
  if (due.length) out.push({ id: 'review', title: `Review ${due.length} concept${due.length > 1 ? 's' : ''}`, detail: 'Spaced repetition keeps theory from fading. Quick questions from lessons you completed.', route: '/progress?review=1', priority: 9 });

  // Rule from the brief: struggling with picking synchronisation → targeted exercises before faster patterns.
  const pickingIds = new Set(exercises.filter((e) => ['alternate-picking', 'synchronization'].includes(e.technique)).map((e) => e.id));
  const picking = state.exerciseRecords.filter((r) => pickingIds.has(r.exerciseId)).slice(-6);
  const pickingTrouble = picking.filter((r) => !r.clean || (r.analyzer && r.analyzer.meanAbsErrorMs > 30));
  if (pickingTrouble.length >= 2) {
    const sync = exercises.find((e) => e.technique === 'synchronization');
    out.push({ id: 'sync', title: 'Fix picking synchronisation first', detail: `${pickingTrouble.length} of your last ${picking.length} picking takes were not clean or had timing errors over 30 ms. Work on slow synchronisation drills before faster patterns.`, route: sync ? `/technique-lab?exercise=${sync.id}` : '/technique-lab', priority: 8 });
  }

  // Rule from the brief: knows pentatonic shapes but struggles to improvise → phrasing, chord tones, backing tracks.
  const pentLessons = lessons.filter((l) => l.level === 5 && /pentatonic/i.test(l.title));
  const knowsPent = pentLessons.some((l) => statusAtLeast(state.lessons[l.id], 'completed'));
  const jamDone = state.jams.filter((j) => j.challengeCompleted).length;
  const jamTried = state.jams.filter((j) => j.challengeId).length;
  if (knowsPent && (jamTried === 0 || jamDone / Math.max(1, jamTried) < 0.5))
    out.push({ id: 'phrasing', title: 'Turn shapes into music', detail: jamTried ? `You completed ${jamDone} of ${jamTried} improvisation challenges. Try a phrasing challenge: three notes only, or target the 3rd of each chord.` : 'You know the pentatonic shapes. Now try a guided improvisation challenge over a backing track.', route: '/jam?challenge=next', priority: 7 });

  const tr = analyseTrainer(state.trainer.slice(-300), STANDARD_TUNING);
  if (tr.total >= 20 && tr.weakest[0] && tr.weakest[0].accuracy < 0.8)
    out.push({ id: 'fretboard', title: `Strengthen ${tr.weakest[0].label}`, detail: `${Math.round(tr.weakest[0].accuracy * 100)}% accuracy over ${tr.weakest[0].attempts} questions. The trainer will weight questions toward it.`, route: '/fretboard-trainer', priority: 6 });
  else if (tr.total < 20 && currentLevel(lessons, state) >= 2)
    out.push({ id: 'fretboard-start', title: 'Map the fretboard', detail: 'A 5-minute round of the Fretboard Trainer each day makes note-finding automatic.', route: '/fretboard-trainer', priority: 4 });

  for (const e of earStats(state.ear.slice(-200)))
    if (e.attempts >= 10 && e.accuracy < 0.7) out.push({ id: `ear-${e.kind}`, title: `Ear training: ${e.kind}`, detail: `${Math.round(e.accuracy * 100)}% over ${e.attempts} questions. Stay at this level until you reach 85%.`, route: `/ear-training?kind=${e.kind}`, priority: 5 });

  for (const w of weaknesses(state, exercises, now).slice(0, 2))
    if (!out.some((o) => o.id === `weak-${w.category}`)) out.push({ id: `weak-${w.category}`, title: `Focus: ${w.category}`, detail: w.reason, route: '/practice', priority: 3 + w.score });

  const s = streak(state, now);
  if (s.current > 0) out.push({ id: 'streak', title: `Keep your ${s.current}-day streak`, detail: 'Even 15 focused minutes keeps the habit (and the progress) going.', route: '/practice', priority: 2 });
  else out.push({ id: 'routine', title: "Start today's practice", detail: 'A routine built from your level, goals and weak spots.', route: '/practice', priority: 2 });
  return out.sort((a, b) => b.priority - a.priority).slice(0, 6);
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  test: (s: StudentState, ctx: { lessons: Lesson[]; exercises: Exercise[]; now: Date }) => boolean;
}

const mastered = (s: StudentState, id: string) => statusAtLeast(s.lessons[id], 'mastered');
const completed = (s: StudentState, id: string) => statusAtLeast(s.lessons[id], 'completed');

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-lesson', title: 'First steps', description: 'Complete your first lesson.', icon: 'footprints', test: (s) => Object.values(s.lessons).some((l) => statusAtLeast(l, 'completed')) },
  { id: 'in-tune', title: 'In tune', description: 'Complete the tuning lesson.', icon: 'gauge', test: (s) => completed(s, 'l0-tuning') },
  { id: 'power-chord', title: 'First clean power chord', description: 'Master the power-chord lesson.', icon: 'zap', test: (s) => mastered(s, 'l1-power-chords') },
  { id: 'pentatonic-position', title: 'First complete pentatonic position', description: 'Master the minor-pentatonic position 1 lesson.', icon: 'grid', test: (s) => mastered(s, 'l5-minor-pentatonic') },
  { id: 'major-scale', title: 'First full major scale', description: 'Master the major-scale construction lesson.', icon: 'music', test: (s) => mastered(s, 'l3-major-scale') },
  { id: 'first-solo', title: 'First improvised solo', description: 'Complete an improvisation challenge in the Jam Lab.', icon: 'mic', test: (s) => s.jams.some((j) => j.challengeCompleted) },
  { id: 'picking-100', title: 'Clean alternate picking at 100 bpm', description: 'Log a clean alternate-picking take at 100 bpm sixteenths or faster.', icon: 'gauge', test: (s, c) => s.exerciseRecords.some((r) => r.clean && r.bpm >= 100 && c.exercises.find((e) => e.id === r.exerciseId)?.technique === 'alternate-picking' && (c.exercises.find((e) => e.id === r.exerciseId)?.notesPerBeat ?? 0) >= 4) },
  { id: 'first-sweep', title: 'First sweep-picked arpeggio', description: 'Log a clean take of any sweep-picking exercise.', icon: 'waves', test: (s, c) => s.exerciseRecords.some((r) => r.clean && c.exercises.find((e) => e.id === r.exerciseId)?.technique === 'sweep-picking') },
  { id: 'first-song', title: 'First complete song', description: 'Log a repertoire block as completed in a practice session.', icon: 'disc', test: (s) => s.sessions.some((x) => x.blocks.some((b) => b.category === 'repertoire' && b.completed)) },
  { id: 'first-jam', title: 'First successful jam session', description: 'Jam over a backing track for at least 5 minutes.', icon: 'radio', test: (s) => s.jams.some((j) => j.minutes >= 5) },
  { id: 'streak-7', title: 'One-week streak', description: 'Practise seven days in a row.', icon: 'flame', test: (s, c) => streak(s, c.now).best >= 7 },
  { id: 'streak-30', title: 'Thirty-day streak', description: 'Practise thirty days in a row.', icon: 'flame', test: (s, c) => streak(s, c.now).best >= 30 },
  { id: 'fretboard-90', title: 'Fretboard navigator', description: '90% accuracy over your last 100 fretboard questions.', icon: 'map', test: (s) => s.trainer.length >= 100 && s.trainer.slice(-100).filter((t) => t.correct).length >= 90 },
  { id: 'ear-intervals', title: 'Golden ears', description: '85% accuracy over 40 interval questions.', icon: 'ear', test: (s) => { const iv = s.ear.filter((e) => e.kind === 'interval').slice(-40); return iv.length >= 40 && iv.filter((e) => e.correct).length / iv.length >= 0.85; } },
  { id: 'theory-foundations', title: 'Theory foundations', description: 'Complete every Level 3 lesson.', icon: 'book', test: (s, c) => { const l3 = c.lessons.filter((l) => l.level === 3); return l3.length > 0 && l3.every((l) => completed(s, l.id)); } },
  { id: 'composer', title: 'Composer', description: 'Create your own exercise in the tab editor.', icon: 'pen', test: (s) => s.exercises.length > 0 },
  { id: 'hour-one', title: 'First hour', description: 'Log 60 minutes of practice.', icon: 'clock', test: (s) => s.sessions.reduce((a, x) => a + x.actualMinutes, 0) >= 60 },
];

/** Achievements newly satisfied by the current state. */
export function newAchievements(state: StudentState, lessons: Lesson[], exercises: Exercise[], now: Date): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !state.achievements[a.id] && a.test(state, { lessons, exercises, now }));
}
