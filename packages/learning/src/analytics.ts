/**
 * Practice analytics: totals, streaks, consistency, per-category time,
 * neglected skills and BPM progress.
 */
import type { Category, Exercise, ExerciseRecord, PracticeSession, StudentState } from './types';
import { CATEGORIES } from './types';
import { DAY_MS } from './progress';

export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Days on which the student practised, including trainer and ear-training activity. */
export function activeDays(state: StudentState): Set<string> {
  const days = new Set<string>();
  for (const s of state.sessions) if (s.actualMinutes > 0) days.add(dayKey(s.startedAt));
  for (const t of state.trainer) days.add(dayKey(t.at));
  for (const e of state.ear) days.add(dayKey(e.at));
  for (const j of state.jams) days.add(dayKey(j.at));
  for (const r of state.exerciseRecords) days.add(dayKey(r.at));
  return days;
}

export function streak(state: StudentState, now: Date): { current: number; best: number } {
  const days = activeDays(state);
  let current = 0;
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1); // today not yet practised: count from yesterday
  while (days.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = new Date(d + 'T12:00:00').getTime();
    run = prev !== null && Math.round((t - prev) / DAY_MS) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return { current, best: Math.max(best, current) };
}

export function minutesBetween(sessions: PracticeSession[], from: Date, to: Date): number {
  return sessions.filter((s) => {
    const t = new Date(s.startedAt).getTime();
    return t >= from.getTime() && t <= to.getTime();
  }).reduce((a, s) => a + s.actualMinutes, 0);
}

export interface PracticeSummary {
  totalMinutes: number;
  weekMinutes: number;
  monthMinutes: number;
  /** Share of the last 28 days with any practice. */
  consistency: number;
  byCategory: { category: Category; minutes: number }[];
  neglected: Category[];
  daily: { day: string; minutes: number }[];
  sessions: number;
}

export function practiceSummary(state: StudentState, now: Date): PracticeSummary {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const totals = new Map<Category, number>(CATEGORIES.map((c) => [c.id, 0]));
  const lastPractised = new Map<Category, number>();
  for (const s of state.sessions)
    for (const b of s.blocks)
      if (b.completed) {
        totals.set(b.category, (totals.get(b.category) ?? 0) + b.minutes);
        lastPractised.set(b.category, Math.max(lastPractised.get(b.category) ?? 0, new Date(s.startedAt).getTime()));
      }
  // Tool usage also counts as practice for its category.
  for (const t of state.trainer) lastPractised.set('fretboard', Math.max(lastPractised.get('fretboard') ?? 0, new Date(t.at).getTime()));
  for (const e of state.ear) lastPractised.set('ear', Math.max(lastPractised.get('ear') ?? 0, new Date(e.at).getTime()));
  for (const j of state.jams) {
    const t = new Date(j.at).getTime();
    lastPractised.set('jamming', Math.max(lastPractised.get('jamming') ?? 0, t));
    totals.set('jamming', (totals.get('jamming') ?? 0) + j.minutes);
  }
  const days = activeDays(state);
  let active28 = 0;
  for (let i = 0; i < 28; i++) if (days.has(dayKey(new Date(now.getTime() - i * DAY_MS)))) active28++;
  const daily: { day: string; minutes: number }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const key = dayKey(d);
    daily.push({ day: key, minutes: state.sessions.filter((s) => dayKey(s.startedAt) === key).reduce((a, s) => a + s.actualMinutes, 0) });
  }
  const neglected = CATEGORIES.map((c) => c.id).filter((c) => {
    const last = lastPractised.get(c);
    return !last || now.getTime() - last > 7 * DAY_MS;
  });
  return {
    totalMinutes: state.sessions.reduce((a, s) => a + s.actualMinutes, 0),
    weekMinutes: minutesBetween(state.sessions, weekAgo, now),
    monthMinutes: minutesBetween(state.sessions, monthAgo, now),
    consistency: active28 / 28,
    byCategory: [...totals.entries()].map(([category, minutes]) => ({ category, minutes })).sort((a, b) => b.minutes - a.minutes),
    neglected,
    daily,
    sessions: state.sessions.length,
  };
}

export interface BpmProgress {
  exerciseId: string;
  firstBpm: number;
  bestCleanBpm: number;
  /** Highest bpm with a clean take among the last 3 records. */
  comfortableBpm: number;
  records: number;
  history: { at: string; bpm: number; clean: boolean }[];
}

export function bpmProgress(records: ExerciseRecord[], exerciseId: string): BpmProgress | null {
  const of = records.filter((r) => r.exerciseId === exerciseId).sort((a, b) => a.at.localeCompare(b.at));
  if (!of.length) return null;
  const clean = of.filter((r) => r.clean);
  const recentClean = of.slice(-3).filter((r) => r.clean);
  return {
    exerciseId,
    firstBpm: of[0].bpm,
    bestCleanBpm: clean.length ? Math.max(...clean.map((r) => r.bpm)) : 0,
    comfortableBpm: recentClean.length ? Math.max(...recentClean.map((r) => r.bpm)) : 0,
    records: of.length,
    history: of.map((r) => ({ at: r.at, bpm: r.bpm, clean: r.clean })),
  };
}

/**
 * Next target bpm for an exercise:
 *  - no history: the exercise's starting bpm
 *  - last two takes clean: +4 bpm (capped at target + 20)
 *  - last take not clean or rated ≤ 2: back off 8 bpm (not below 40)
 */
export function nextBpm(exercise: Exercise, records: ExerciseRecord[]): { bpm: number; reason: string } {
  const of = records.filter((r) => r.exerciseId === exercise.id).sort((a, b) => a.at.localeCompare(b.at));
  if (!of.length) return { bpm: exercise.bpmStart, reason: 'Starting tempo for this exercise.' };
  const last = of[of.length - 1];
  const prev = of[of.length - 2];
  const struggled = !last.clean || (last.rating !== undefined && last.rating <= 2) || (last.analyzer && last.analyzer.meanAbsErrorMs > 30);
  if (struggled) return { bpm: Math.max(40, last.bpm - 8), reason: `Last take at ${last.bpm} bpm was not clean, so back off and rebuild accuracy.` };
  if (prev && prev.clean && last.clean) return { bpm: Math.min(exercise.bpmTarget + 20, last.bpm + 4), reason: `Two clean takes in a row (latest ${last.bpm} bpm), so nudge the tempo up.` };
  return { bpm: last.bpm, reason: `Consolidate at ${last.bpm} bpm with another clean take before speeding up.` };
}

export interface WeeklyGoal {
  id: string;
  label: string;
  progress: number;
  target: number;
}

export function weeklyGoals(state: StudentState, now: Date): WeeklyGoal[] {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const inWeek = (iso: string) => new Date(iso).getTime() >= weekAgo.getTime();
  const minutes = minutesBetween(state.sessions, weekAgo, now);
  const days = [...activeDays(state)].filter((d) => new Date(d + 'T12:00:00').getTime() >= weekAgo.getTime()).length;
  const lessonsDone = Object.values(state.lessons).filter((l) => l.completedAt && inWeek(l.completedAt)).length;
  const trainer = state.trainer.filter((t) => inWeek(t.at)).length;
  return [
    { id: 'minutes', label: 'Practice minutes', progress: minutes, target: state.profile.dailyMinutes * 5 },
    { id: 'days', label: 'Practice days', progress: days, target: 5 },
    { id: 'lessons', label: 'Lessons completed', progress: lessonsDone, target: 3 },
    { id: 'fretboard', label: 'Fretboard questions', progress: trainer, target: 100 },
  ];
}
