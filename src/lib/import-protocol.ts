/** Messages between the import page and the import worker. */
import type { ImportProgress, ImportResult } from '@gma/importer';
import type { OffsetEstimate } from '@gma/audio';

export type WorkerRequest =
  | { type: 'import'; files: File[]; paths: string[] }
  | { type: 'cancel' }
  | { type: 'sync'; id: number; samples: Float32Array; sampleRate: number; noteTimes: number[]; maxShift?: number };

export type WorkerResponse =
  | { type: 'progress'; progress: ImportProgress }
  | { type: 'result'; result: ImportResult }
  | { type: 'error'; message: string; aborted: boolean }
  | { type: 'sync-result'; id: number; estimate?: OffsetEstimate; error?: string };
