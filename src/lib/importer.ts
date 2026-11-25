/**
 * Main-thread side of the song importer: starts a worker per import,
 * relays progress, supports cancellation, and runs the audio part of sync
 * analysis (decoding needs the Web Audio API, which workers lack; the number
 * crunching then happens in a worker).
 */
import type { ImportProgress, ImportResult } from '@gma/importer';
import type { OffsetEstimate } from '@gma/audio';
import type { WorkerRequest, WorkerResponse } from './import-protocol';

declare const __GMA_IMPORT_WORKER__: string;

function createWorker(): Worker {
  if (typeof Worker === 'undefined') throw new Error('This browser does not support Web Workers, which the importer needs.');
  const url = typeof __GMA_IMPORT_WORKER__ !== 'undefined' ? __GMA_IMPORT_WORKER__ : '/assets/import-worker.js';
  return new Worker(url);
}

export interface ImportJob {
  promise: Promise<ImportResult>;
  cancel(): void;
}

export class ImportCancelled extends Error {
  constructor() { super('Import cancelled.'); this.name = 'ImportCancelled'; }
}

/** Selected files plus their folder-relative paths (for folder picks and dropped folders). */
export interface PickedFile { file: File; path: string }

export function startImport(files: PickedFile[], onProgress: (p: ImportProgress) => void): ImportJob {
  const worker = createWorker();
  let settle: { resolve: (r: ImportResult) => void; reject: (e: Error) => void } | null = null;
  const done = () => { worker.terminate(); settle = null; };
  const promise = new Promise<ImportResult>((resolve, reject) => {
    settle = { resolve, reject };
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.progress);
      else if (m.type === 'result') { resolve(m.result); done(); }
      else if (m.type === 'error') { reject(m.aborted ? new ImportCancelled() : new Error(m.message)); done(); }
    };
    worker.onerror = (e) => { reject(new Error(e.message || 'The import worker failed.')); done(); };
    const msg: WorkerRequest = { type: 'import', files: files.map((f) => f.file), paths: files.map((f) => f.path) };
    worker.postMessage(msg);
  });
  return {
    promise,
    cancel() {
      // Ask politely, then stop the worker outright so memory is released at once.
      try { worker.postMessage({ type: 'cancel' } satisfies WorkerRequest); } catch { /* already gone */ }
      settle?.reject(new ImportCancelled());
      done();
    },
  };
}

export interface AudioAnalysis {
  duration?: number;
  estimate?: OffsetEstimate;
  /** Why the recording could not be decoded or analysed. */
  error?: string;
}

const ANALYSIS_RATE = 11025;
const MAX_ANALYSIS_SECONDS = 15 * 60;

/** Decodes a recording, then estimates its offset against the chart's note times in a worker. */
export async function analyseAudio(blob: Blob, noteTimes: number[], signal?: AbortSignal): Promise<AudioAnalysis> {
  const Offline = (globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Offline) return { error: 'This browser has no Web Audio decoder.' };
  let decoded: AudioBuffer;
  try {
    decoded = await new Offline(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
  } catch {
    return { error: `This browser cannot decode this ${blob.type || 'audio'} file${/ogg/.test(blob.type) ? ' (some browsers, older Safari in particular, cannot play OGG Vorbis; WAV always works)' : ''}.` };
  }
  const duration = decoded.duration;
  if (signal?.aborted) return { duration };
  // Mono, 11 kHz, at most 15 minutes: plenty for onset timing and light on memory.
  const seconds = Math.min(duration, MAX_ANALYSIS_SECONDS);
  const ctx = new Offline(1, Math.max(1, Math.ceil(seconds * ANALYSIS_RATE)), ANALYSIS_RATE);
  const src = ctx.createBufferSource();
  src.buffer = decoded;
  src.connect(ctx.destination);
  src.start();
  const mono = (await ctx.startRendering()).getChannelData(0);
  if (signal?.aborted) return { duration };
  const samples = new Float32Array(mono); // own copy, transferred to the worker
  const worker = createWorker();
  try {
    const estimate = await new Promise<OffsetEstimate>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const m = e.data;
        if (m.type === 'sync-result') { if (m.estimate) resolve(m.estimate); else reject(new Error(m.error ?? 'analysis failed')); }
      };
      worker.onerror = (e) => reject(new Error(e.message || 'analysis failed'));
      signal?.addEventListener('abort', () => reject(new Error('cancelled')));
      const msg: WorkerRequest = { type: 'sync', id: 1, samples, sampleRate: ANALYSIS_RATE, noteTimes, maxShift: 8 };
      worker.postMessage(msg, [samples.buffer]);
    });
    return { duration, estimate };
  } catch (e) {
    return { duration, error: `Automatic sync failed: ${(e as Error).message}` };
  } finally {
    worker.terminate();
  }
}

/** Reads every file under dropped folders (DataTransferItem.webkitGetAsEntry). */
export async function filesFromDrop(dt: DataTransfer): Promise<PickedFile[]> {
  type Entry = { isFile: boolean; isDirectory: boolean; name: string; fullPath: string; file?: (ok: (f: File) => void, err: (e: unknown) => void) => void; createReader?: () => { readEntries: (ok: (e: Entry[]) => void, err: (e: unknown) => void) => void } };
  const items = [...(dt.items ?? [])].filter((i) => i.kind === 'file');
  const entries = items.map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.() ?? null);
  if (!entries.length || entries.some((e) => !e)) return [...dt.files].map((f) => ({ file: f, path: f.name }));
  const out: PickedFile[] = [];
  const walk = async (e: Entry): Promise<void> => {
    if (out.length > 5000) return; // a dropped home folder should not hang the tab
    if (e.isFile && e.file) {
      const f = await new Promise<File>((ok, err) => e.file!(ok, err));
      out.push({ file: f, path: e.fullPath.replace(/^\//, '') || f.name });
    } else if (e.isDirectory && e.createReader) {
      const reader = e.createReader();
      for (;;) {
        const batch = await new Promise<Entry[]>((ok, err) => reader.readEntries(ok, err));
        if (!batch.length) break;
        for (const b of batch) await walk(b);
      }
    }
  };
  for (const e of entries) await walk(e as Entry);
  return out;
}
