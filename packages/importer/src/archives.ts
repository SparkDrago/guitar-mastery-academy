/**
 * Archive handlers. Each container format is one handler: a sniffer and an
 * opener that lists entries and reports its structural components. Supporting
 * another archive format later means writing one handler and registering it;
 * the pipeline, grouping and UI do not change.
 */
import { listZip, readZipEntry } from '@gma/notation';
import { readExact, type ByteSource } from './bytes';
import { isPsarc, openPsarc, PsarcFormatError } from './psarc';
import { checkArchivePath } from './paths';
import type { ComponentReport, Fact } from './types';

export interface ArchiveEntry {
  /** Safe path inside the archive, or null when unknown/rejected. */
  path: string | null;
  /** What to show for the entry (its path, or "entry #n"). */
  label: string;
  size: number;
  /** A problem that prevents reading this entry. */
  problem?: string;
  read(signal?: AbortSignal): Promise<Uint8Array>;
}

export interface OpenedArchive {
  format: string;
  components: ComponentReport[];
  facts: Fact[];
  entries: ArchiveEntry[];
  /** False when nothing inside can be listed (e.g. encrypted table of contents). */
  listable: boolean;
}

export interface ArchiveOpenOptions { signal?: AbortSignal; name: string; maxEntryBytes?: number }

export interface ArchiveHandler {
  id: string;
  label: string;
  sniff(head: Uint8Array, name: string): boolean;
  open(src: ByteSource, opts: ArchiveOpenOptions): Promise<OpenedArchive>;
}

/** A structural failure the UI can attribute to one component. */
export class ArchiveError extends Error {
  constructor(public format: string, public component: string, message: string) { super(message); this.name = 'ArchiveError'; }
}

export const psarcHandler: ArchiveHandler = {
  id: 'psarc',
  label: 'PSARC archive',
  sniff: (head) => isPsarc(head),
  async open(src, opts) {
    try {
      const a = await openPsarc(src, { signal: opts.signal, maxEntryBytes: opts.maxEntryBytes });
      return {
        format: `PSARC ${a.header.version}`,
        components: a.components,
        facts: a.facts,
        listable: !a.encrypted && a.files.length > 0,
        entries: a.files.map((f) => ({
          path: f.path,
          label: f.path ?? `entry #${f.index}`,
          size: f.size,
          problem: f.problem ?? (f.path === null ? 'no name in the manifest' : undefined),
          read: (signal?: AbortSignal) => a.read(f, { signal }),
        })),
      };
    } catch (e) {
      if (e instanceof PsarcFormatError) throw new ArchiveError('PSARC', e.component, e.message);
      throw e;
    }
  },
};

const ZIP_MAX = 1024 * 1024 * 1024;

export const zipHandler: ArchiveHandler = {
  id: 'zip',
  label: 'ZIP archive',
  sniff: (head, name) => (head[0] === 0x50 && head[1] === 0x4b && (head[2] === 3 || head[2] === 5)) && !/\.gp$/i.test(name),
  async open(src) {
    if (src.size > ZIP_MAX) throw new ArchiveError('ZIP', 'size', 'ZIP archives over 1 GiB are not opened in the browser.');
    const buf = await readExact(src, 0, src.size, 'The archive');
    let list;
    try { list = listZip(buf); } catch (e) { throw new ArchiveError('ZIP', 'directory', `The central directory is damaged: ${(e as Error).message}`); }
    const files = list.filter((e) => !e.name.endsWith('/'));
    const odd = files.filter((e) => e.method !== 0 && e.method !== 8).length;
    const components: ComponentReport[] = [
      { id: 'directory', label: 'Central directory', state: 'ok', detail: `${files.length} files.` },
      { id: 'compression', label: 'Compression', state: odd ? 'warning' : 'ok', detail: odd ? `${odd} file(s) use a compression method other than stored/deflate and cannot be read.` : 'Stored and deflate (browser-native).' },
    ];
    return {
      format: 'ZIP',
      components,
      facts: [{ label: 'Files', value: String(files.length) }],
      listable: files.length > 0,
      entries: files.map((e) => {
        const chk = checkArchivePath(e.name);
        return {
          path: chk.ok ? chk.path : null,
          label: chk.ok ? chk.path : e.name.slice(0, 120),
          size: e.size,
          problem: !chk.ok ? `unsafe name rejected (${chk.reason})` : e.method !== 0 && e.method !== 8 ? `compression method ${e.method} is not supported` : undefined,
          read: () => readZipEntry(buf, e),
        };
      }),
    };
  },
};

const handlers: ArchiveHandler[] = [psarcHandler, zipHandler];

export function registerArchiveHandler(h: ArchiveHandler): void {
  const i = handlers.findIndex((x) => x.id === h.id);
  if (i >= 0) handlers[i] = h; else handlers.push(h);
}

export function findArchiveHandler(head: Uint8Array, name: string): ArchiveHandler | null {
  return handlers.find((h) => h.sniff(head, name)) ?? null;
}

export const archiveHandlers = (): readonly ArchiveHandler[] => handlers;
