/**
 * Shared domain types for the learning system. These are plain data shapes
 * with no framework or storage dependency; the data layer persists them and
 * the UI renders them.
 */
import type { Tuning } from '@gma/theory';
import type { TabScore } from '@gma/notation';

export type Category =
  | 'technique' | 'theory' | 'fretboard' | 'scales' | 'chords'
  | 'rhythm' | 'ear' | 'repertoire' | 'improvisation' | 'jamming';

export const CATEGORIES: { id: Category; name: string; description: string }[] = [
  { id: 'technique', name: 'Technique', description: 'Picking, legato, bending, vibrato and advanced lead techniques.' },
  { id: 'theory', name: 'Music theory', description: 'Intervals, scales, chords, keys and harmony.' },
  { id: 'fretboard', name: 'Fretboard knowledge', description: 'Knowing every note, interval and octave on the neck.' },
  { id: 'scales', name: 'Scales & modes', description: 'Playing and connecting scale patterns across the neck.' },
  { id: 'chords', name: 'Chords & arpeggios', description: 'Chord shapes, changes, voicings and arpeggios.' },
  { id: 'rhythm', name: 'Rhythm', description: 'Timing, subdivisions, strumming and rhythm-guitar feel.' },
  { id: 'ear', name: 'Ear training', description: 'Recognising intervals, chords, scales and rhythms by ear.' },
  { id: 'repertoire', name: 'Repertoire', description: 'Songs, riffs and pieces played start to finish.' },
  { id: 'improvisation', name: 'Improvisation', description: 'Making up meaningful phrases and solos.' },
  { id: 'jamming', name: 'Jamming', description: 'Playing along with backing tracks and other musicians.' },
];

// ── Curriculum ───────────────────────────────────────────────────────────

/** Provenance: a supplied book (A–D, see docs/01-book-analysis.md) or supplementary pedagogy (P). */
export type SourceRef =
  | { book: 'A' | 'B' | 'C' | 'D'; section: string }
  | { book: 'P'; note?: string };

export type Block =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'callout'; tone: 'tip' | 'warning' | 'theory' | 'source'; text: string }
  | { type: 'fretboard'; root: string; scale?: string; chord?: string; notes?: string[]; minFret?: number; maxFret?: number; labels?: 'note' | 'interval' | 'degree'; caption?: string; tuning?: string }
  | { type: 'tab'; ascii: string; caption?: string }
  | { type: 'chord'; symbols: string[]; caption?: string }
  | { type: 'pillitiere'; key: string; degree: number; caption?: string }
  | { type: 'table'; head: string[]; rows: string[][]; caption?: string }
  | { type: 'check'; question: QuizQuestion };

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface MasteryRule {
  /** Minimum share of mastery-assessment questions correct (0..1). */
  quizPass: number;
  /** Optional practice evidence required in addition to understanding. */
  practice?: { exerciseId: string; bpm?: number; minutes?: number };
  /** Human-readable criteria shown to the student. */
  criteria: string[];
}

export interface Lesson {
  id: string;
  level: number;
  module: string;
  title: string;
  minutes: number;
  objectives: string[];
  prerequisites: string[];
  categories: Category[];
  sources: SourceRef[];
  why: string;
  explanation: Block[];
  guitar: Block[];
  exercise: { title: string; steps: string[]; tab?: string; exerciseId?: string };
  metronome?: { bpmStart: number; bpmTarget: number; subdivision: 1 | 2 | 3 | 4; instructions: string };
  mistakes: string[];
  selfCheck: string[];
  quiz: QuizQuestion[];
  realWorld: string;
  summary: string[];
  next?: string;
  mastery: MasteryRule;
  /** Content that becomes available in tools once this lesson is completed. */
  unlocks?: { scales?: string[]; chords?: string[]; challenges?: string[]; trainerModes?: TrainerMode[] };
}

export interface Module {
  id: string;
  level: number;
  title: string;
  summary: string;
}

export interface Level {
  level: number;
  title: string;
  summary: string;
  outcome: string;
}

// ── Exercises ────────────────────────────────────────────────────────────

export type TechniqueId =
  | 'alternate-picking' | 'economy-picking' | 'legato' | 'sweep-picking' | 'tapping' | 'string-skipping'
  | 'bending' | 'vibrato' | 'tremolo-picking' | 'synchronization' | 'rhythm-accuracy' | 'hybrid-picking'
  | 'chord-changes' | 'palm-muting' | 'harmonics' | 'fretting' | 'scales' | 'arpeggios' | 'strumming';

export interface Exercise {
  id: string;
  name: string;
  technique: TechniqueId;
  category: Category;
  level: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  bpmStart: number;
  bpmTarget: number;
  /** Notes per beat at the given bpm (2 = eighths, 4 = sixteenths, 3 = triplets). */
  notesPerBeat: number;
  reps: number;
  minutes: number;
  score: TabScore;
  instructions: string[];
  mistakes: string[];
  mastery: string;
  easier?: string;
  harder?: string;
  /** Whether the Playing Analyzer can meaningfully measure this exercise. */
  analyzable: boolean;
  /** User-created exercises carry an owner. */
  custom?: boolean;
  description?: string;
}

// ── Student state ────────────────────────────────────────────────────────

export type LessonStatus = 'not_started' | 'in_progress' | 'completed' | 'mastered';

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  startedAt?: string;
  completedAt?: string;
  masteredAt?: string;
  quizBest: number;
  masteryBest: number;
  attempts: number;
  /** Sections the student has checked off. */
  checked?: string[];
  notes?: string;
  updatedAt: string;
}

export interface QuizAttempt {
  id: string;
  lessonId: string;
  kind: 'quiz' | 'mastery' | 'review';
  score: number;
  total: number;
  /** Ids of questions answered wrongly. */
  missed: string[];
  at: string;
}

export interface SrsCard {
  id: string;
  /** Lesson or concept this card revises. */
  lessonId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  due: string;
  lastGrade?: number;
  updatedAt: string;
}

export interface PracticeBlock {
  category: Category;
  activity: string;
  title: string;
  minutes: number;
  completed: boolean;
  exerciseId?: string;
  bpm?: number;
  reps?: number;
  rating?: 1 | 2 | 3 | 4 | 5;
}

export interface PracticeSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  plannedMinutes: number;
  actualMinutes: number;
  routineName: string;
  blocks: PracticeBlock[];
  notes?: string;
  updatedAt: string;
}

export interface ExerciseRecord {
  id: string;
  exerciseId: string;
  at: string;
  bpm: number;
  /** Student judged (or analyzer measured) the take as clean. */
  clean: boolean;
  rating?: 1 | 2 | 3 | 4 | 5;
  source: 'manual' | 'analyzer';
  analyzer?: { meanAbsErrorMs: number; stdDevMs: number; driftMsPerBar: number; matched: number; expected: number; pitchAccuracy?: number; confidence: 'high' | 'medium' | 'low' };
  updatedAt: string;
}

export type TrainerMode =
  | 'note-id' | 'find-note' | 'find-all' | 'octaves' | 'interval-find' | 'interval-id'
  | 'degree-id' | 'chord-tones' | 'string-nav';

export interface TrainerAttempt {
  id: string;
  mode: TrainerMode;
  tuningId: string;
  string: number;
  fret: number;
  pc: number;
  /** Interval in semitones, for interval modes. */
  interval?: number;
  correct: boolean;
  ms: number;
  at: string;
}

export type EarKind = 'interval' | 'chord' | 'scale' | 'rhythm' | 'progression' | 'melody' | 'relative-pitch' | 'major-minor';

export interface EarAttempt {
  id: string;
  kind: EarKind;
  item: string;
  correct: boolean;
  at: string;
}

export interface JamSession {
  id: string;
  at: string;
  minutes: number;
  key: string;
  mode: 'major' | 'minor';
  progressionId: string;
  styleId: string;
  bpm: number;
  challengeId?: string;
  challengeCompleted?: boolean;
  reflection?: string;
  updatedAt: string;
}

export interface SavedExercise {
  id: string;
  title: string;
  category: Category;
  technique: TechniqueId;
  difficulty: 1 | 2 | 3 | 4 | 5;
  targetBpm: number;
  notesPerBeat: number;
  description: string;
  tags: string[];
  score: TabScore;
  createdAt: string;
  updatedAt: string;
}

export interface SavedItem {
  id: string;
  kind: 'scale' | 'chord';
  root: string;
  type: string;
  tuningId: string;
  label: string;
  updatedAt: string;
}

export interface CustomTuning extends Tuning {
  updatedAt: string;
}

export interface Profile {
  displayName: string;
  /** Self-assessed or placement-tested starting level. */
  startLevel: number;
  goals: Category[];
  dailyMinutes: number;
  tuningId: string;
  strings: 6 | 7 | 8;
  leftHanded: boolean;
  a4: number;
  noteNames: 'sharps' | 'flats';
  onboarded: boolean;
  updatedAt: string;
}

export interface CustomRoutine {
  id: string;
  name: string;
  blocks: { category: Category; minutes: number; activity?: string; title?: string }[];
  updatedAt: string;
}

export interface AchievementRecord {
  id: string;
  unlockedAt: string;
  updatedAt: string;
}

/** Everything persisted for one student. Each collection syncs independently. */
export interface StudentState {
  profile: Profile;
  lessons: Record<string, LessonProgress>;
  quizAttempts: QuizAttempt[];
  srs: Record<string, SrsCard>;
  sessions: PracticeSession[];
  exerciseRecords: ExerciseRecord[];
  trainer: TrainerAttempt[];
  ear: EarAttempt[];
  jams: JamSession[];
  tunings: CustomTuning[];
  exercises: SavedExercise[];
  saved: SavedItem[];
  routines: CustomRoutine[];
  achievements: Record<string, AchievementRecord>;
}

export function defaultProfile(now = new Date().toISOString()): Profile {
  return {
    displayName: 'Guitarist', startLevel: 0, goals: ['technique', 'improvisation'], dailyMinutes: 30,
    tuningId: 'e-standard', strings: 6, leftHanded: false, a4: 440, noteNames: 'sharps', onboarded: false, updatedAt: now,
  };
}

export function emptyState(now = new Date().toISOString()): StudentState {
  return {
    profile: defaultProfile(now), lessons: {}, quizAttempts: [], srs: {}, sessions: [], exerciseRecords: [],
    trainer: [], ear: [], jams: [], tunings: [], exercises: [], saved: [], routines: [], achievements: {},
  };
}
