export * from './collections';
export * from './local';
export * from './supabase';
export * from './sync';

/**
 * Content repository interface. The app ships its curriculum bundled
 * (BundledContent in src/lib/content.ts); a database-backed implementation can
 * read the same shapes from the `lessons`, `questions` and `exercises` tables.
 */
export interface ContentRepository<TLesson, TExercise> {
  lessons(): TLesson[];
  lesson(id: string): TLesson | undefined;
  exercises(): TExercise[];
  exercise(id: string): TExercise | undefined;
}
