/** React bindings for the store and common derived data. */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CUSTOM_TEMPLATES, TUNINGS, findTuning, type Tuning } from '@gma/theory';
import type { Exercise, SavedExercise } from '@gma/learning';
import { EXERCISES } from '@content/exercises';
import { store, type Snapshot } from './store';

export function useStore(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export function useStudent() {
  return useStore().state;
}

/** All tunings available to the student: presets + their custom tunings. */
export function useAllTunings(): Tuning[] {
  const s = useStudent();
  return useMemo(() => [...TUNINGS, ...s.tunings.map((t) => ({ ...t, category: 'custom' as const, custom: true }))], [s.tunings]);
}

/** The student's selected tuning (shared by Tuner, Fretboard, Scales, Tab Editor and Trainer). */
export function useActiveTuning(): Tuning {
  const s = useStudent();
  return useMemo(() => findTuning(s.profile.tuningId, s.tunings) ?? TUNINGS[0], [s.profile.tuningId, s.tunings]);
}

export function customTemplates(): Tuning[] {
  return CUSTOM_TEMPLATES;
}

/** Convert a saved tab-editor exercise into the shared Exercise shape. */
export function savedToExercise(e: SavedExercise): Exercise {
  return {
    id: e.id, name: e.title, technique: e.technique, category: e.category, level: 0, difficulty: e.difficulty,
    bpmStart: Math.max(40, Math.round(e.targetBpm * 0.6)), bpmTarget: e.targetBpm, notesPerBeat: e.notesPerBeat,
    reps: 4, minutes: 5, score: e.score, instructions: e.description ? [e.description] : ['Play the exercise evenly with the metronome.'],
    mistakes: [], mastery: `Clean at ${e.targetBpm} bpm.`, analyzable: true, custom: true, description: e.description,
  };
}

/** Built-in exercises plus the student's own (from the Tab Editor). */
export function useAllExercises(): Exercise[] {
  const s = useStudent();
  return useMemo(() => [...EXERCISES, ...s.exercises.map(savedToExercise)], [s.exercises]);
}

export function useInterval(cb: () => void, ms: number | null) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), ms);
  return now;
}

export function useMediaQuery(q: string): boolean {
  const get = () => typeof window !== 'undefined' && window.matchMedia(q).matches;
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}
