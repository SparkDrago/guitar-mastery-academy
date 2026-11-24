/**
 * Lesson progression, mastery rules and spaced repetition.
 *
 * - Completion means the student worked through the lesson and its exercise.
 * - Mastery needs evidence: a mastery assessment at or above the lesson's pass
 *   mark AND any required practice result (e.g. a clean take at a target bpm).
 * - Students may "test out" of a lesson whose prerequisites are unfinished by
 *   passing its mastery assessment, so the path is never artificially linear.
 * - Completed lessons enter spaced repetition (SM-2 style); failed reviews
 *   flag the lesson for revision.
 */
import type { ExerciseRecord, Lesson, LessonProgress, LessonStatus, QuizAttempt, SrsCard, StudentState } from './types';

export const DAY_MS = 86_400_000;

export function blankProgress(lessonId: string, now: string): LessonProgress {
  return { lessonId, status: 'not_started', quizBest: 0, masteryBest: 0, attempts: 0, updatedAt: now };
}

export function getProgress(state: StudentState, lessonId: string): LessonProgress {
  return state.lessons[lessonId] ?? blankProgress(lessonId, new Date(0).toISOString());
}

const RANK: Record<LessonStatus, number> = { not_started: 0, in_progress: 1, completed: 2, mastered: 3 };

export function statusAtLeast(p: LessonProgress | undefined, s: LessonStatus): boolean {
  return RANK[p?.status ?? 'not_started'] >= RANK[s];
}

export interface Availability {
  available: boolean;
  missing: string[];
  /** Student can still take the mastery assessment to test out. */
  canTestOut: boolean;
}

/**
 * A lesson opens when every prerequisite is at least completed. Prerequisites
 * below the student's placement level count as satisfied.
 */
export function lessonAvailability(lesson: Lesson, state: StudentState, all: Lesson[] = []): Availability {
  const levelOf = new Map(all.map((l) => [l.id, l.level]));
  const missing = lesson.prerequisites.filter((id) => {
    if (statusAtLeast(state.lessons[id], 'completed')) return false;
    const lvl = levelOf.get(id);
    return !(lvl !== undefined && lvl < state.profile.startLevel);
  });
  return { available: missing.length === 0, missing, canTestOut: missing.length > 0 };
}

export function startLesson(p: LessonProgress, now: string): LessonProgress {
  if (p.status !== 'not_started') return p;
  return { ...p, status: 'in_progress', startedAt: now, updatedAt: now };
}

export function completeLesson(p: LessonProgress, now: string): LessonProgress {
  if (statusAtLeast(p, 'completed')) return p;
  return { ...p, status: 'completed', startedAt: p.startedAt ?? now, completedAt: now, updatedAt: now };
}

export function recordQuiz(p: LessonProgress, kind: QuizAttempt['kind'], score: number, total: number, now: string): LessonProgress {
  const ratio = total ? score / total : 0;
  return {
    ...p,
    status: p.status === 'not_started' ? 'in_progress' : p.status,
    startedAt: p.startedAt ?? now,
    attempts: p.attempts + 1,
    quizBest: kind === 'quiz' ? Math.max(p.quizBest, ratio) : p.quizBest,
    masteryBest: kind === 'mastery' ? Math.max(p.masteryBest, ratio) : p.masteryBest,
    updatedAt: now,
  };
}

export interface MasteryCheck {
  mastered: boolean;
  quizMet: boolean;
  practiceMet: boolean;
  practiceRequired: boolean;
  reasons: string[];
}

/** Does the evidence satisfy the lesson's mastery rule? */
export function checkMastery(lesson: Lesson, p: LessonProgress, records: ExerciseRecord[]): MasteryCheck {
  const reasons: string[] = [];
  const quizMet = p.masteryBest >= lesson.mastery.quizPass - 1e-9;
  if (!quizMet) reasons.push(`Score at least ${Math.round(lesson.mastery.quizPass * 100)}% on the mastery assessment (best so far ${Math.round(p.masteryBest * 100)}%).`);
  const rule = lesson.mastery.practice;
  let practiceMet = true;
  if (rule) {
    const relevant = records.filter((r) => r.exerciseId === rule.exerciseId && r.clean);
    const bpmOk = rule.bpm === undefined || relevant.some((r) => r.bpm >= rule.bpm!);
    practiceMet = relevant.length > 0 && bpmOk;
    if (!practiceMet) reasons.push(rule.bpm ? `Log a clean take of the exercise at ${rule.bpm} bpm or faster.` : 'Log at least one clean take of the lesson exercise.');
  }
  return { mastered: quizMet && practiceMet, quizMet, practiceMet, practiceRequired: !!rule, reasons };
}

/** Promote to mastered when the rule is satisfied (also completes the lesson). */
export function applyMastery(lesson: Lesson, p: LessonProgress, records: ExerciseRecord[], now: string): LessonProgress {
  const check = checkMastery(lesson, p, records);
  if (!check.mastered || p.status === 'mastered') return p;
  return { ...p, status: 'mastered', startedAt: p.startedAt ?? now, completedAt: p.completedAt ?? now, masteredAt: now, updatedAt: now };
}

/** Downgrade a mastered lesson to completed after a failed review (it needs revision). */
export function demoteAfterLapse(p: LessonProgress, now: string): LessonProgress {
  if (p.status !== 'mastered') return p;
  return { ...p, status: 'completed', masteredAt: undefined, masteryBest: 0, updatedAt: now };
}

// ── Spaced repetition (SM-2 variant) ─────────────────────────────────────

export function newCard(lessonId: string, now: Date): SrsCard {
  return {
    id: `srs-${lessonId}`, lessonId, ease: 2.5, intervalDays: 0, reps: 0, lapses: 0,
    due: new Date(now.getTime() + DAY_MS).toISOString(), updatedAt: now.toISOString(),
  };
}

/**
 * Grade a review 0–5 (≥3 = recalled). Intervals: 1 day, 3 days, then × ease.
 * Ease is adjusted with the SM-2 formula and floored at 1.3.
 */
export function reviewCard(card: SrsCard, grade: number, now: Date): SrsCard {
  const g = Math.max(0, Math.min(5, Math.round(grade)));
  let { ease, intervalDays, reps, lapses } = card;
  if (g < 3) {
    reps = 0;
    lapses += 1;
    intervalDays = 1;
  } else {
    reps += 1;
    intervalDays = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(intervalDays * ease);
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - g) * (0.08 + (5 - g) * 0.02)));
  return {
    ...card, ease, intervalDays, reps, lapses, lastGrade: g,
    due: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function dueCards(state: StudentState, now: Date): SrsCard[] {
  return Object.values(state.srs).filter((c) => new Date(c.due).getTime() <= now.getTime()).sort((a, b) => a.due.localeCompare(b.due));
}

/** Convert a review quiz score into an SM-2 grade. */
export function gradeFromScore(score: number, total: number): number {
  if (!total) return 0;
  const r = score / total;
  if (r >= 1) return 5;
  if (r >= 0.8) return 4;
  if (r >= 0.6) return 3;
  if (r >= 0.4) return 2;
  return 1;
}

// ── Course-level summaries ───────────────────────────────────────────────

export interface LevelSummary {
  level: number;
  total: number;
  completed: number;
  mastered: number;
}

export function levelSummaries(lessons: Lesson[], state: StudentState): LevelSummary[] {
  const map = new Map<number, LevelSummary>();
  for (const l of lessons) {
    const s = map.get(l.level) ?? { level: l.level, total: 0, completed: 0, mastered: 0 };
    s.total++;
    if (statusAtLeast(state.lessons[l.id], 'completed')) s.completed++;
    if (statusAtLeast(state.lessons[l.id], 'mastered')) s.mastered++;
    map.set(l.level, s);
  }
  return [...map.values()].sort((a, b) => a.level - b.level);
}

/** Current level: the lowest level with fewer than 80% of its lessons completed. */
export function currentLevel(lessons: Lesson[], state: StudentState): number {
  const sums = levelSummaries(lessons, state);
  for (const s of sums) if (s.completed / s.total < 0.8 && s.level >= state.profile.startLevel) return s.level;
  return sums.length ? Math.max(state.profile.startLevel, sums[sums.length - 1].level) : 0;
}

/** Next lessons to study: available, not completed, lowest level first. */
export function nextLessons(lessons: Lesson[], state: StudentState, count = 3): Lesson[] {
  const start = state.profile.startLevel;
  return lessons
    .filter((l) => l.level >= start || statusAtLeast(state.lessons[l.id], 'in_progress'))
    .filter((l) => !statusAtLeast(state.lessons[l.id], 'completed'))
    .filter((l) => lessonAvailability(l, state, lessons).available)
    .sort((a, b) => {
      const ip = (x: Lesson) => (state.lessons[x.id]?.status === 'in_progress' ? 0 : 1);
      return ip(a) - ip(b) || a.level - b.level || lessons.indexOf(a) - lessons.indexOf(b);
    })
    .slice(0, count);
}
