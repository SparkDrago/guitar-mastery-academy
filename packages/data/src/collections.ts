/**
 * Collection registry: how each part of StudentState is identified, merged
 * and mapped to its PostgreSQL table. Shared by the local repository, the
 * Supabase adapter and the sync engine.
 */
import type {
  CustomRoutine, CustomTuning, EarAttempt, ExerciseRecord, JamSession, LessonProgress, PracticeSession, Profile,
  QuizAttempt, SavedExercise, SavedItem, SrsCard, StudentState, TrainerAttempt, AchievementRecord,
} from '@gma/learning';

export type CollectionName = keyof StudentState;

export interface SyncRecord {
  collection: CollectionName;
  id: string;
  /** Client logical timestamp used for last-write-wins. */
  updatedAt: string;
  deleted?: boolean;
  data: unknown;
}

type Row = Record<string, unknown>;

export interface CollectionSpec<T> {
  name: CollectionName;
  /** 'map' = keyed by id (Record), 'list' = array, 'single' = one object. */
  shape: 'map' | 'list' | 'single';
  /** Append-only logs never change after creation. */
  appendOnly?: boolean;
  /** Supabase table(s). */
  table: string;
  conflictColumns: string;
  idOf: (item: T) => string;
  updatedOf: (item: T) => string;
  toRow: (item: T, userId: string) => Row;
  fromRow: (row: Row) => T;
  /** Keep at most this many items locally (logs). */
  cap?: number;
}

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : undefined);

export const COLLECTIONS: { [K in CollectionName]: CollectionSpec<any> } = {
  profile: {
    name: 'profile', shape: 'single', table: 'profiles', conflictColumns: 'id',
    idOf: () => 'profile', updatedOf: (p: Profile) => p.updatedAt,
    toRow: (p: Profile, userId) => ({
      id: userId, display_name: p.displayName, start_level: p.startLevel, goals: p.goals, daily_minutes: p.dailyMinutes,
      onboarded: p.onboarded, preferences: { tuningId: p.tuningId, strings: p.strings, leftHanded: p.leftHanded, a4: p.a4, noteNames: p.noteNames },
      updated_at: p.updatedAt,
    }),
    fromRow: (r): Profile => {
      const prefs = (r.preferences ?? {}) as Record<string, unknown>;
      return {
        displayName: String(r.display_name ?? 'Guitarist'), startLevel: Number(r.start_level ?? 0), goals: (r.goals as Profile['goals']) ?? [],
        dailyMinutes: Number(r.daily_minutes ?? 30), onboarded: !!r.onboarded,
        tuningId: String(prefs.tuningId ?? 'e-standard'), strings: (Number(prefs.strings ?? 6) as 6 | 7 | 8), leftHanded: !!prefs.leftHanded,
        a4: Number(prefs.a4 ?? 440), noteNames: (prefs.noteNames as 'sharps' | 'flats') ?? 'sharps', updatedAt: iso(r.updated_at)!,
      };
    },
  },
  lessons: {
    name: 'lessons', shape: 'map', table: 'lesson_progress', conflictColumns: 'user_id,lesson_id',
    idOf: (l: LessonProgress) => l.lessonId, updatedOf: (l: LessonProgress) => l.updatedAt,
    toRow: (l: LessonProgress, userId) => ({
      user_id: userId, lesson_id: l.lessonId, status: l.status, started_at: l.startedAt ?? null, completed_at: l.completedAt ?? null,
      mastered_at: l.masteredAt ?? null, quiz_best: l.quizBest, mastery_best: l.masteryBest, attempts: l.attempts, checked: l.checked ?? [],
      notes: l.notes ?? null, updated_at: l.updatedAt,
    }),
    fromRow: (r): LessonProgress => ({
      lessonId: String(r.lesson_id), status: r.status as LessonProgress['status'], startedAt: iso(r.started_at), completedAt: iso(r.completed_at),
      masteredAt: iso(r.mastered_at), quizBest: Number(r.quiz_best ?? 0), masteryBest: Number(r.mastery_best ?? 0), attempts: Number(r.attempts ?? 0),
      checked: (r.checked as string[]) ?? [], notes: (r.notes as string) ?? undefined, updatedAt: iso(r.updated_at)!,
    }),
  },
  quizAttempts: {
    name: 'quizAttempts', shape: 'list', appendOnly: true, table: 'quiz_attempts', conflictColumns: 'user_id,id', cap: 500,
    idOf: (q: QuizAttempt) => q.id, updatedOf: (q: QuizAttempt) => q.at,
    toRow: (q: QuizAttempt, userId) => ({ id: q.id, user_id: userId, lesson_id: q.lessonId, kind: q.kind, score: q.score, total: q.total, missed: q.missed, attempted_at: q.at, updated_at: q.at }),
    fromRow: (r): QuizAttempt => ({ id: String(r.id), lessonId: String(r.lesson_id), kind: r.kind as QuizAttempt['kind'], score: Number(r.score), total: Number(r.total), missed: (r.missed as string[]) ?? [], at: iso(r.attempted_at)! }),
  },
  srs: {
    name: 'srs', shape: 'map', table: 'srs_cards', conflictColumns: 'user_id,id',
    idOf: (c: SrsCard) => c.id, updatedOf: (c: SrsCard) => c.updatedAt,
    toRow: (c: SrsCard, userId) => ({ id: c.id, user_id: userId, lesson_id: c.lessonId, ease: c.ease, interval_days: c.intervalDays, reps: c.reps, lapses: c.lapses, due_at: c.due, last_grade: c.lastGrade ?? null, updated_at: c.updatedAt }),
    fromRow: (r): SrsCard => ({ id: String(r.id), lessonId: String(r.lesson_id), ease: Number(r.ease), intervalDays: Number(r.interval_days), reps: Number(r.reps), lapses: Number(r.lapses), due: iso(r.due_at)!, lastGrade: r.last_grade == null ? undefined : Number(r.last_grade), updatedAt: iso(r.updated_at)! }),
  },
  sessions: {
    name: 'sessions', shape: 'list', table: 'practice_sessions', conflictColumns: 'user_id,id', cap: 1000,
    idOf: (s: PracticeSession) => s.id, updatedOf: (s: PracticeSession) => s.updatedAt,
    toRow: (s: PracticeSession, userId) => ({ id: s.id, user_id: userId, started_at: s.startedAt, ended_at: s.endedAt ?? null, planned_minutes: s.plannedMinutes, actual_minutes: s.actualMinutes, routine_name: s.routineName, blocks: s.blocks, notes: s.notes ?? null, updated_at: s.updatedAt }),
    fromRow: (r): PracticeSession => ({ id: String(r.id), startedAt: iso(r.started_at)!, endedAt: iso(r.ended_at), plannedMinutes: Number(r.planned_minutes), actualMinutes: Number(r.actual_minutes), routineName: String(r.routine_name ?? ''), blocks: (r.blocks as PracticeSession['blocks']) ?? [], notes: (r.notes as string) ?? undefined, updatedAt: iso(r.updated_at)! }),
  },
  exerciseRecords: {
    name: 'exerciseRecords', shape: 'list', appendOnly: true, table: 'exercise_records', conflictColumns: 'user_id,id', cap: 3000,
    idOf: (e: ExerciseRecord) => e.id, updatedOf: (e: ExerciseRecord) => e.updatedAt,
    toRow: (e: ExerciseRecord, userId) => ({ id: e.id, user_id: userId, exercise_id: e.exerciseId, recorded_at: e.at, bpm: e.bpm, clean: e.clean, rating: e.rating ?? null, source: e.source, analyzer: e.analyzer ?? null, play: e.play ?? null, updated_at: e.updatedAt }),
    fromRow: (r): ExerciseRecord => ({ id: String(r.id), exerciseId: String(r.exercise_id), at: iso(r.recorded_at)!, bpm: Number(r.bpm), clean: !!r.clean, rating: r.rating == null ? undefined : (Number(r.rating) as 1), source: r.source as ExerciseRecord['source'], analyzer: (r.analyzer as ExerciseRecord['analyzer']) ?? undefined, play: (r.play as ExerciseRecord['play']) ?? undefined, updatedAt: iso(r.updated_at)! }),
  },
  trainer: {
    name: 'trainer', shape: 'list', appendOnly: true, table: 'trainer_attempts', conflictColumns: 'user_id,id', cap: 5000,
    idOf: (t: TrainerAttempt) => t.id, updatedOf: (t: TrainerAttempt) => t.at,
    toRow: (t: TrainerAttempt, userId) => ({ id: t.id, user_id: userId, mode: t.mode, tuning_id: t.tuningId, string_index: t.string, fret: t.fret, pc: t.pc, interval: t.interval ?? null, correct: t.correct, ms: Math.round(t.ms), attempted_at: t.at, updated_at: t.at }),
    fromRow: (r): TrainerAttempt => ({ id: String(r.id), mode: r.mode as TrainerAttempt['mode'], tuningId: String(r.tuning_id), string: Number(r.string_index), fret: Number(r.fret), pc: Number(r.pc), interval: r.interval == null ? undefined : Number(r.interval), correct: !!r.correct, ms: Number(r.ms), at: iso(r.attempted_at)! }),
  },
  ear: {
    name: 'ear', shape: 'list', appendOnly: true, table: 'ear_attempts', conflictColumns: 'user_id,id', cap: 5000,
    idOf: (e: EarAttempt) => e.id, updatedOf: (e: EarAttempt) => e.at,
    toRow: (e: EarAttempt, userId) => ({ id: e.id, user_id: userId, kind: e.kind, item: e.item, correct: e.correct, attempted_at: e.at, updated_at: e.at }),
    fromRow: (r): EarAttempt => ({ id: String(r.id), kind: r.kind as EarAttempt['kind'], item: String(r.item), correct: !!r.correct, at: iso(r.attempted_at)! }),
  },
  jams: {
    name: 'jams', shape: 'list', table: 'jam_sessions', conflictColumns: 'user_id,id', cap: 1000,
    idOf: (j: JamSession) => j.id, updatedOf: (j: JamSession) => j.updatedAt,
    toRow: (j: JamSession, userId) => ({ id: j.id, user_id: userId, played_at: j.at, minutes: j.minutes, key: j.key, mode: j.mode, progression_id: j.progressionId, style_id: j.styleId, bpm: j.bpm, challenge_id: j.challengeId ?? null, challenge_completed: j.challengeCompleted ?? false, reflection: j.reflection ?? null, updated_at: j.updatedAt }),
    fromRow: (r): JamSession => ({ id: String(r.id), at: iso(r.played_at)!, minutes: Number(r.minutes), key: String(r.key), mode: r.mode as 'major', progressionId: String(r.progression_id), styleId: String(r.style_id), bpm: Number(r.bpm), challengeId: (r.challenge_id as string) ?? undefined, challengeCompleted: !!r.challenge_completed, reflection: (r.reflection as string) ?? undefined, updatedAt: iso(r.updated_at)! }),
  },
  tunings: {
    name: 'tunings', shape: 'list', table: 'custom_tunings', conflictColumns: 'user_id,id',
    idOf: (t: CustomTuning) => t.id, updatedOf: (t: CustomTuning) => t.updatedAt,
    toRow: (t: CustomTuning, userId) => ({ id: t.id, user_id: userId, name: t.name, strings: t.strings, description: t.description ?? null, updated_at: t.updatedAt }),
    fromRow: (r): CustomTuning => ({ id: String(r.id), name: String(r.name), category: 'custom', strings: (r.strings as number[]) ?? [], description: (r.description as string) ?? undefined, custom: true, updatedAt: iso(r.updated_at)! }),
  },
  exercises: {
    name: 'exercises', shape: 'list', table: 'saved_exercises', conflictColumns: 'user_id,id',
    idOf: (e: SavedExercise) => e.id, updatedOf: (e: SavedExercise) => e.updatedAt,
    toRow: (e: SavedExercise, userId) => ({ id: e.id, user_id: userId, title: e.title, category: e.category, technique: e.technique, difficulty: e.difficulty, target_bpm: e.targetBpm, notes_per_beat: e.notesPerBeat, description: e.description, tags: e.tags, score: e.score, created_at: e.createdAt, updated_at: e.updatedAt }),
    fromRow: (r): SavedExercise => ({ id: String(r.id), title: String(r.title), category: r.category as SavedExercise['category'], technique: r.technique as SavedExercise['technique'], difficulty: Number(r.difficulty) as 1, targetBpm: Number(r.target_bpm), notesPerBeat: Number(r.notes_per_beat ?? 2), description: String(r.description ?? ''), tags: (r.tags as string[]) ?? [], score: r.score as SavedExercise['score'], createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)! }),
  },
  saved: {
    name: 'saved', shape: 'list', table: 'saved_items', conflictColumns: 'user_id,id',
    idOf: (s: SavedItem) => s.id, updatedOf: (s: SavedItem) => s.updatedAt,
    toRow: (s: SavedItem, userId) => ({ id: s.id, user_id: userId, kind: s.kind, root: s.root, type: s.type, tuning_id: s.tuningId, label: s.label, updated_at: s.updatedAt }),
    fromRow: (r): SavedItem => ({ id: String(r.id), kind: r.kind as 'scale', root: String(r.root), type: String(r.type), tuningId: String(r.tuning_id), label: String(r.label), updatedAt: iso(r.updated_at)! }),
  },
  routines: {
    name: 'routines', shape: 'list', table: 'practice_plans', conflictColumns: 'user_id,id',
    idOf: (r: CustomRoutine) => r.id, updatedOf: (r: CustomRoutine) => r.updatedAt,
    toRow: (r: CustomRoutine, userId) => ({ id: r.id, user_id: userId, name: r.name, blocks: r.blocks, updated_at: r.updatedAt }),
    fromRow: (r): CustomRoutine => ({ id: String(r.id), name: String(r.name), blocks: (r.blocks as CustomRoutine['blocks']) ?? [], updatedAt: iso(r.updated_at)! }),
  },
  achievements: {
    name: 'achievements', shape: 'map', appendOnly: true, table: 'user_achievements', conflictColumns: 'user_id,achievement_id',
    idOf: (a: AchievementRecord) => a.id, updatedOf: (a: AchievementRecord) => a.updatedAt,
    toRow: (a: AchievementRecord, userId) => ({ user_id: userId, achievement_id: a.id, unlocked_at: a.unlockedAt, updated_at: a.updatedAt }),
    fromRow: (r): AchievementRecord => ({ id: String(r.achievement_id), unlockedAt: iso(r.unlocked_at)!, updatedAt: iso(r.updated_at)! }),
  },
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];

/** Items of a collection as an array (regardless of shape). */
export function itemsOf(state: StudentState, name: CollectionName): unknown[] {
  const v = state[name] as unknown;
  const spec = COLLECTIONS[name];
  if (spec.shape === 'single') return [v];
  if (spec.shape === 'map') return Object.values(v as Record<string, unknown>);
  return v as unknown[];
}

/**
 * Merge remote items into local state, last-write-wins per item by updatedAt.
 * Deleted remote items remove local copies.
 */
export function mergeCollection(state: StudentState, name: CollectionName, incoming: { item: unknown; deleted?: boolean }[]): StudentState {
  const spec = COLLECTIONS[name];
  if (!incoming.length) return state;
  if (spec.shape === 'single') {
    const remote = incoming[incoming.length - 1];
    const local = state[name] as unknown;
    if (remote.deleted) return state;
    return spec.updatedOf(remote.item) >= spec.updatedOf(local) ? { ...state, [name]: remote.item } : state;
  }
  if (spec.shape === 'map') {
    const map = { ...(state[name] as Record<string, unknown>) };
    for (const { item, deleted } of incoming) {
      const id = spec.idOf(item);
      if (deleted) { delete map[id]; continue; }
      const cur = map[id];
      if (!cur || spec.updatedOf(item) >= spec.updatedOf(cur)) map[id] = item;
    }
    return { ...state, [name]: map };
  }
  const list = [...(state[name] as unknown[])];
  const index = new Map(list.map((x, i) => [spec.idOf(x), i]));
  const removed = new Set<string>();
  for (const { item, deleted } of incoming) {
    const id = spec.idOf(item);
    if (deleted) { removed.add(id); continue; }
    const i = index.get(id);
    if (i === undefined) { index.set(id, list.length); list.push(item); }
    else if (spec.updatedOf(item) >= spec.updatedOf(list[i])) list[i] = item;
  }
  let out = list.filter((x) => !removed.has(spec.idOf(x)));
  out.sort((a, b) => spec.updatedOf(a).localeCompare(spec.updatedOf(b)));
  if (spec.cap && out.length > spec.cap) out = out.slice(-spec.cap);
  return { ...state, [name]: out };
}
