/**
 * Import worker: archive parsing, decompression, chart parsing, grouping and
 * sync estimation all run here, off the UI thread. One worker serves one
 * import; the page terminates it afterwards (or on cancel), which releases
 * everything it held.
 */
import { blobSource, ImportAborted, runImport, type ImportInput } from '@gma/importer';
import { estimateOffset, onsetEnvelope } from '@gma/audio';
import type { WorkerRequest, WorkerResponse } from '@/lib/import-protocol';

const ctx = self as unknown as { postMessage(m: WorkerResponse, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null };
let ctrl: AbortController | null = null;

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'cancel') { ctrl?.abort(); return; }
  if (m.type === 'import') { void doImport(m.files, m.paths); return; }
  if (m.type === 'sync') {
    try {
      const hop = 0.01;
      const env = onsetEnvelope(m.samples, m.sampleRate, hop);
      ctx.postMessage({ type: 'sync-result', id: m.id, estimate: estimateOffset(env, hop, m.noteTimes, { maxShift: m.maxShift }) });
    } catch (err) {
      ctx.postMessage({ type: 'sync-result', id: m.id, error: (err as Error).message });
    }
  }
};

async function doImport(files: File[], paths: string[]) {
  ctrl = new AbortController();
  const inputs: ImportInput[] = files.map((f, i) => ({ id: `f${i}`, name: f.name, path: paths[i] || f.name, size: f.size, source: blobSource(f), blob: f }));
  let last = 0;
  try {
    const result = await runImport(inputs, {
      signal: ctrl.signal,
      onProgress: (p) => {
        const now = Date.now();
        if (now - last < 50 && p.fraction < 1) return; // ~20 updates per second is plenty
        last = now;
        ctx.postMessage({ type: 'progress', progress: p });
      },
    });
    ctx.postMessage({ type: 'result', result });
  } catch (err) {
    ctx.postMessage({ type: 'error', message: (err as Error).message, aborted: err instanceof ImportAborted });
  } finally {
    ctrl = null;
  }
}
