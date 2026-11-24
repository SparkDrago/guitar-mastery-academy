/**
 * Intelligent Practice Scheduler.
 * Builds a daily routine for a duration preset by weighting categories by the
 * student's level, goals, measured weaknesses and neglected skills, then filling
 * each block with a concrete activity (exercise, trainer mode, ear drill, jam
 * challenge or lesson review).
 */
import { analyse as analyseTrainer } from './fretboard-trainer';
import { earStats } from './ear-training';
import { nextBpm, practiceSummary } from './analytics';
import { currentLevel, dueCards } from './progress';
import { rng } from './fretboard-trainer';
import { STANDARD_TUNING } from '@gma/theory';
import type { Category, Exercise, Lesson, PracticeBlock, StudentState } from './types';

export const DURATION_PRESETS = [15, 30, 60, 90] as const;

/** Base share of practice time per category by level band. */
export function baseWeights(level: number): Record<Category, number> {
  if (level <= 2)
    return { technique: 0.24, chords: 0.2, rhythm: 0.18, fretboard: 0.14, theory: 0.08, ear: 0.06, repertoire: 0.06, scales: 0.04, improvisation: 0, jamming: 0 };
  if (level <= 6)
    return { technique: 0.2, scales: 0.14, fretboard: 0.1, improvisation: 0.12, rhythm: 0.1, chords: 0.08, theory: 0.08, ear: 0.08, jamming: 0.06, repertoire: 0.04 };
  return { technique: 0.2, improvisation: 0.16, scales: 0.1, theory: 0.1, ear: 0.1, jamming: 0.1, chords: 0.08, fretboard: 0.06, rhythm: 0.06, repertoire: 0.04 };
}

export interface WeaknessReport {
  category: Category;
  score: number;
  reason: string;
}

/** Measured weaknesses (0 = fine, 1 = urgent) with the evidence behind each. */
export function weaknesses(state: StudentState, exercises: Exercise[], now: Date): WeaknessReport[] {
  const out: WeaknessReport[] = [];
  const tuning = STANDARD_TUNING;
  const tr = analyseTrainer(state.trainer.slice(-300), tuning);
  if (tr.total >= 20 && tr.accuracy < 0.85) out.push({ category: 'fretboard', score: Math.min(1, (0.85 - tr.accuracy) * 3), reason: `Fretboard trainer accuracy is ${Math.round(tr.accuracy * 100)}%.` });
  for (const e of earStats(state.ear.slice(-200)))
    if (e.attempts >= 10 && e.accuracy < 0.75) out.push({ category: 'ear', score: Math.min(1, (0.75 - e.accuracy) * 3), reason: `Ear training (${e.kind}) accuracy is ${Math.round(e.accuracy * 100)}%.` });
  const recent = state.exerciseRecords.slice(-30);
  const shaky = recent.filter((r) => !r.clean || (r.analyzer && r.analyzer.meanAbsErrorMs > 30));
  const byCat = new Map<Category, number>();
  for (const r of shaky) {
    const ex = exercises.find((x) => x.id === r.exerciseId);
    if (ex) byCat.set(ex.category, (byCat.get(ex.category) ?? 0) + 1);
  }
  for (const [cat, n] of byCat) if (n >= 2) out.push({ category: cat, score: Math.min(1, n / 5), reason: `${n} recent ${cat} takes were not clean or had timing errors over 30 ms.` });
  const timing = recent.filter((r) => r.analyzer && (r.analyzer.stdDevMs > 20 || Math.abs(r.analyzer.driftMsPerBar) > 8));
  if (timing.length >= 2) out.push({ category: 'rhythm', score: Math.min(1, timing.length / 4), reason: `The Playing Analyzer measured uneven timing or tempo drift in ${timing.length} recent takes.` });
  const quizMisses = state.quizAttempts.slice(-20).filter((q) => q.total && q.score / q.total < 0.7).length;
  if (quizMisses >= 2) out.push({ category: 'theory', score: Math.min(1, quizMisses / 5), reason: `${quizMisses} recent quizzes scored under 70%.` });
  const due = dueCards(state, now).length;
  if (due >= 3) out.push({ category: 'theory', score: Math.min(1, due / 10), reason: `${due} concepts are due for spaced review.` });
  return out.sort((a, b) => b.score - a.score);
}

export interface RoutineBlock extends PracticeBlock {
  instructions: string;
  /** In-app route that opens the right tool. */
  route: string;
  reason: string;
  targetBpm?: number;
}

export interface Routine {
  name: string;
  minutes: number;
  level: number;
  blocks: RoutineBlock[];
  breaks: number[];
  rationale: string[];
}

interface Activity {
  category: Category;
  title: string;
  activity: string;
  route: string;
  instructions: string;
  minLevel: number;
  exerciseId?: string;
}

const TOOL_ACTIVITIES: Activity[] = [
  { category: 'fretboard', title: 'Fretboard trainer: name the note', activity: 'trainer:note-id', route: '/fretboard-trainer?mode=note-id', instructions: 'Answer as quickly as you can. Say the note name aloud before clicking.', minLevel: 0 },
  { category: 'fretboard', title: 'Fretboard trainer: find every occurrence', activity: 'trainer:find-all', route: '/fretboard-trainer?mode=find-all', instructions: 'Use octave shapes to jump between occurrences instead of counting frets.', minLevel: 2 },
  { category: 'fretboard', title: 'Fretboard trainer: intervals', activity: 'trainer:interval-find', route: '/fretboard-trainer?mode=interval-find', instructions: 'Visualise the interval shape, then click. Sing the interval as you find it.', minLevel: 3 },
  { category: 'fretboard', title: 'Fretboard trainer: chord tones', activity: 'trainer:chord-tones', route: '/fretboard-trainer?mode=chord-tones', instructions: 'Find every root, 3rd and 5th in the window. These are your improvisation targets.', minLevel: 5 },
  { category: 'ear', title: 'Ear training: intervals', activity: 'ear:interval', route: '/ear-training?kind=interval', instructions: 'Hum both notes before answering. Link each interval to a song you know.', minLevel: 0 },
  { category: 'ear', title: 'Ear training: chord quality', activity: 'ear:chord', route: '/ear-training?kind=chord', instructions: 'Listen for the 3rd first: bright or dark?', minLevel: 1 },
  { category: 'ear', title: 'Ear training: progressions', activity: 'ear:progression', route: '/ear-training?kind=progression', instructions: 'Follow the bass note: does it rise or fall, and by how much?', minLevel: 3 },
  { category: 'ear', title: 'Ear training: rhythm', activity: 'ear:rhythm', route: '/ear-training?kind=rhythm', instructions: 'Tap the rhythm back before choosing.', minLevel: 1 },
  { category: 'improvisation', title: 'Jam lab: guided improvisation challenge', activity: 'jam:challenge', route: '/jam?challenge=next', instructions: 'Follow the challenge constraint strictly; limits force creativity.', minLevel: 5 },
  { category: 'jamming', title: 'Jam lab: free jam over a backing track', activity: 'jam:free', route: '/jam', instructions: 'Pick a key and style, then alternate one chorus of rhythm with one of lead.', minLevel: 4 },
  { category: 'theory', title: 'Spaced review of past lessons', activity: 'review:srs', route: '/progress?review=1', instructions: 'Answer the review questions without looking anything up.', minLevel: 0 },
  { category: 'scales', title: 'Scale explorer: connect positions', activity: 'scales:connect', route: '/scales', instructions: 'Play the scale in one position, then slide into the next position without stopping.', minLevel: 4 },
  { category: 'chords', title: 'Chord changes: one-minute drill', activity: 'chords:changes', route: '/chords', instructions: 'Pick two chords and count clean changes in 60 seconds. Log your count.', minLevel: 1 },
  { category: 'repertoire', title: 'Repertoire: play a full song or riff', activity: 'repertoire:song', route: '/tab-editor', instructions: 'Play a song you know from start to finish without stopping, even through mistakes.', minLevel: 1 },
];

function allocate(minutes: number, weights: Record<Category, number>): { category: Category; minutes: number }[] {
  const blockCount = minutes <= 15 ? 3 : minutes <= 30 ? 4 : minutes <= 60 ? 6 : 8;
  const chosen = (Object.entries(weights) as [Category, number][])
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, blockCount);
  const total = chosen.reduce((a, [, w]) => a + w, 0);
  const raw = chosen.map(([c, w]) => ({ category: c, minutes: Math.max(5, Math.round(((w / total) * minutes) / 5) * 5) }));
  // Fix rounding so the routine sums exactly to the requested minutes.
  let diff = minutes - raw.reduce((a, b) => a + b.minutes, 0);
  let i = 0;
  while (diff !== 0 && i < 100) {
    const idx = i % raw.length;
    const step = diff > 0 ? 5 : -5;
    if (raw[idx].minutes + step >= 5) {
      raw[idx].minutes += step;
      diff -= step;
    }
    i++;
  }
  return raw.filter((b) => b.minutes > 0);
}

export interface ScheduleInput {
  state: StudentState;
  lessons: Lesson[];
  exercises: Exercise[];
  minutes: number;
  now: Date;
  /** Extra focus categories chosen for today. */
  focus?: Category[];
  seed?: number;
}

export function buildRoutine(input: ScheduleInput): Routine {
  const { state, exercises, lessons, now } = input;
  const level = currentLevel(lessons, state);
  const weights = baseWeights(level);
  const rationale: string[] = [`Level ${level} balance.`];
  for (const g of state.profile.goals) weights[g] = (weights[g] ?? 0) + 0.06;
  if (state.profile.goals.length) rationale.push(`Extra time for your goals: ${state.profile.goals.join(', ')}.`);
  for (const f of input.focus ?? []) weights[f] = (weights[f] ?? 0) + 0.15;
  const weak = weaknesses(state, exercises, now);
  for (const w of weak.slice(0, 3)) {
    weights[w.category] = (weights[w.category] ?? 0) + 0.12 * w.score + 0.04;
    rationale.push(w.reason);
  }
  const summary = practiceSummary(state, now);
  const neglected = summary.neglected.filter((c) => weights[c] > 0 && (level > 2 || !['improvisation', 'jamming'].includes(c)));
  if (state.sessions.length > 0) for (const c of neglected.slice(0, 2)) {
    weights[c] += 0.05;
    rationale.push(`${c} has not been practised for over a week.`);
  }
  if (level <= 2) { weights.improvisation = 0; weights.jamming = 0; }

  const alloc = allocate(input.minutes, weights);
  const r = rng(input.seed ?? Number(now.toISOString().slice(0, 10).replace(/-/g, '')));
  const usedActivities = new Set<string>();

  const blocks: RoutineBlock[] = alloc.map(({ category, minutes }, idx) => {
    // Warm-up: the first block of a technique-led routine is always a gentle picking or chromatic drill.
    const candidates = exercises
      .filter((e) => e.category === category && e.level <= Math.max(level, 1) + 1 && !usedActivities.has(e.id))
      .sort((a, b) => b.level - a.level || a.difficulty - b.difficulty);
    const struggling = candidates.find((e) => {
      const rec = state.exerciseRecords.filter((x) => x.exerciseId === e.id).slice(-3);
      return rec.length >= 2 && rec.filter((x) => !x.clean).length >= 2;
    });
    let ex: Exercise | undefined;
    let reason = `Balances your ${category} practice.`;
    if (struggling) {
      const easier = exercises.find((e) => e.id === struggling.easier);
      ex = easier ?? struggling;
      reason = easier ? `You struggled with "${struggling.name}" recently, so this simpler variation rebuilds it.` : `You struggled with "${struggling.name}" recently; slow it down.`;
    } else if (candidates.length) {
      const mastered = (e: Exercise) => state.exerciseRecords.some((x) => x.exerciseId === e.id && x.clean && x.bpm >= e.bpmTarget);
      const fresh = candidates.filter((e) => !mastered(e));
      const pool = fresh.length ? fresh : candidates;
      const top = pool.slice(0, Math.min(3, pool.length));
      ex = top[Math.floor(r() * top.length)];
      if (!fresh.length) {
        const harder = exercises.find((e) => e.id === ex!.harder);
        if (harder) { ex = harder; reason = 'You have mastered the previous version, so the difficulty steps up.'; }
      }
    }
    const toolOptions = TOOL_ACTIVITIES.filter((a) => a.category === category && a.minLevel <= level && !usedActivities.has(a.activity));
    const preferTool = !ex || (['fretboard', 'ear', 'improvisation', 'jamming'].includes(category) && toolOptions.length > 0) || (category === 'theory' && dueCards(state, now).length > 0);
    if (preferTool && toolOptions.length) {
      const tool = category === 'theory' ? toolOptions[0] : toolOptions[Math.floor(r() * toolOptions.length)];
      usedActivities.add(tool.activity);
      const weakReason = weak.find((w) => w.category === category)?.reason;
      return { category, activity: tool.activity, title: tool.title, minutes, completed: false, instructions: tool.instructions, route: tool.route, reason: weakReason ?? reason };
    }
    if (ex) {
      usedActivities.add(ex.id);
      const nb = nextBpm(ex, state.exerciseRecords);
      return {
        category, activity: `exercise:${ex.id}`, title: ex.name, minutes, completed: false, exerciseId: ex.id, bpm: nb.bpm, targetBpm: ex.bpmTarget, reps: ex.reps,
        instructions: ex.instructions[0] ?? '', route: `/technique-lab?exercise=${ex.id}`, reason: `${idx === 0 && category === 'technique' ? 'Warm-up. ' : ''}${reason} ${nb.reason}`,
      };
    }
    const nextLesson = lessons.find((l) => l.categories.includes(category) && state.lessons[l.id]?.status !== 'completed' && state.lessons[l.id]?.status !== 'mastered');
    return {
      category, activity: nextLesson ? `lesson:${nextLesson.id}` : `free:${category}`, title: nextLesson ? `Lesson: ${nextLesson.title}` : `Free ${category} practice`, minutes, completed: false,
      instructions: nextLesson ? 'Work through the lesson and its exercise.' : 'Practise material of your choice in this category.', route: nextLesson ? `/lessons/${nextLesson.id}` : '/lessons', reason,
    };
  });

  // Technique warm-up first, improvisation/jamming last.
  const orderOf = (c: Category) => ({ technique: 0, rhythm: 1, chords: 2, fretboard: 3, scales: 4, theory: 5, ear: 6, repertoire: 7, improvisation: 8, jamming: 9 })[c];
  blocks.sort((a, b) => orderOf(a.category) - orderOf(b.category));
  const breaks: number[] = [];
  let elapsed = 0;
  blocks.forEach((b, i) => {
    elapsed += b.minutes;
    if (input.minutes >= 60 && elapsed >= 25 * (breaks.length + 1) && i < blocks.length - 1) breaks.push(i);
  });
  return { name: `${input.minutes}-minute routine`, minutes: input.minutes, level, blocks, breaks, rationale };
}
