/**
 * The import pipeline: classify each input, open archives through their
 * handlers, parse charts, collect audio and song details, then group
 * everything into song drafts. Pure TypeScript with no DOM: it runs in a Web
 * Worker in the app and directly under Node in tests.
 *
 * Every input and every archive entry ends up in the report with a status;
 * nothing is skipped without saying so.
 */
import { gpTracks, gpifFromGpFile, songFromGpif, songFromRocksmithXml, validateSong, type PlaySong } from '@gma/notation';
import { ArchiveError, findArchiveHandler, type OpenedArchive } from './archives';
import { blobFingerprint, ImportAborted, readExact, sha256Hex, throwIfAborted, type ByteSource } from './bytes';
import { classify, roleSummary, SNIFF_BYTES, type Classification } from './classify';
import { groupSongs, type ArrangementItem, type AudioItem, type MetaHint, type SongDraft } from './grouping';
import { guessFromFileName, metaFromArrangementXml, metaFromManifest } from './metadata';
import { checkArchivePath } from './paths';
import type { ComponentReport, EntryReport, EntryStatus, Fact } from './types';

export interface ImportInput {
  id: string;
  name: string;
  /** Relative path for folder selections (webkitRelativePath), else the name. */
  path: string;
  size: number;
  source: ByteSource;
  /** The file itself, when available, so audio is not copied. */
  blob?: Blob;
}

export type FileStatus = 'imported' | 'partial' | 'unsupported' | 'error' | 'skipped';

export interface FileReport {
  id: string;
  name: string;
  path: string;
  size: number;
  kind: string;
  role: string;
  status: FileStatus;
  detail: string;
  components?: ComponentReport[];
  facts?: Fact[];
  entries?: EntryReport[];
}

export interface ImportProgress {
  fileIndex: number;
  fileCount: number;
  file: string;
  step: string;
  /** 0..1 over the whole import. */
  fraction: number;
}

export interface ImportResult {
  songs: SongDraft[];
  files: FileReport[];
  audio: AudioItem[];
  unmatchedAudio: string[];
}

export interface ImportOptions {
  signal?: AbortSignal;
  onProgress?: (p: ImportProgress) => void;
  maxEntryBytes?: number;
}

const TEXT_LIMIT = 64 * 1024 * 1024;
const decode = (b: Uint8Array) => new TextDecoder('utf-8', { fatal: false }).decode(b).replace(/^﻿/, '');

/** Item being handled: a loose file or an archive entry. */
interface Item {
  path: string;
  name: string;
  size: number;
  scope: string;
  origin: string;
  head: Uint8Array;
  bytes(): Promise<Uint8Array>;
  blob?: Blob;
}

interface Collect {
  arrangements: ArrangementItem[];
  audio: AudioItem[];
  hints: MetaHint[];
  hashes: Map<string, string>;
  seq: number;
}

export async function runImport(inputs: ImportInput[], opts: ImportOptions = {}): Promise<ImportResult> {
  const { signal } = opts;
  const total = Math.max(1, inputs.reduce((s, f) => s + Math.max(1, f.size), 0));
  let done = 0;
  const files: FileReport[] = [];
  const c: Collect = { arrangements: [], audio: [], hints: [], hashes: new Map(), seq: 0 };
  const seen = new Map<string, string>();

  for (let i = 0; i < inputs.length; i++) {
    throwIfAborted(signal);
    const f = inputs[i];
    const progress = (step: string, within = 0) => opts.onProgress?.({ fileIndex: i, fileCount: inputs.length, file: f.name, step, fraction: Math.min(1, (done + within * Math.max(1, f.size)) / total) });
    progress('Reading');
    const chk = checkArchivePath(f.path || f.name);
    const path = chk.ok ? chk.path : f.name;
    const base: Omit<FileReport, 'kind' | 'role' | 'status' | 'detail'> = { id: f.id, name: f.name, path, size: f.size };
    try {
      if (!chk.ok) { files.push({ ...base, kind: 'File', role: 'unknown', status: 'error', detail: `Rejected: ${chk.reason}.` }); continue; }
      if (f.size === 0) { files.push({ ...base, kind: 'Empty file', role: 'unknown', status: 'error', detail: 'The file is empty.' }); continue; }
      const head = await f.source.read(0, Math.min(SNIFF_BYTES, f.size));
      const cls = classify(f.name, head);
      // Same file selected twice (e.g. on its own and inside a chosen folder).
      const sig = `${f.name}|${f.size}|${(await sha256Hex(head)).slice(0, 16)}`;
      if (seen.has(sig)) {
        files.push({ ...base, kind: cls.kind, role: cls.role, status: 'skipped', detail: `Same file as ${seen.get(sig)}; read once.` });
        continue;
      }
      seen.set(sig, path);
      const topDir = path.includes('/') ? path.split('/')[0] : '';
      const scope = topDir ? `dir:${topDir}` : '';

      if (cls.role === 'psarc' || cls.role === 'zip') {
        files.push(await importArchive(f, base, head, cls, c, { signal, maxEntryBytes: opts.maxEntryBytes, progress }));
        continue;
      }
      const item: Item = {
        path, name: f.name, size: f.size, scope, origin: f.name, head, blob: f.blob,
        bytes: () => readExact(f.source, 0, f.size, f.name),
      };
      const r = await handleItem(item, cls, c, signal);
      files.push({ ...base, kind: cls.kind, role: cls.role, status: fileStatusOf(r.status), detail: r.detail });
    } catch (e) {
      if (e instanceof ImportAborted) throw e;
      files.push({ ...base, kind: 'File', role: 'unknown', status: 'error', detail: `Could not be read: ${(e as Error).message}` });
    } finally {
      done += Math.max(1, f.size);
      progress('Done');
    }
  }

  throwIfAborted(signal);
  opts.onProgress?.({ fileIndex: inputs.length, fileCount: inputs.length, file: '', step: 'Grouping songs', fraction: 1 });
  const { songs, unmatchedAudio } = groupSongs(c.arrangements, c.audio, c.hints);
  return { songs, files, audio: c.audio, unmatchedAudio };
}

const fileStatusOf = (s: EntryStatus): FileStatus =>
  s === 'imported' || s === 'metadata' ? 'imported' : s === 'unsupported' ? 'unsupported' : s === 'duplicate' || s === 'not-used' ? 'skipped' : 'error';

async function importArchive(
  f: ImportInput, base: Omit<FileReport, 'kind' | 'role' | 'status' | 'detail'>, head: Uint8Array, cls: Classification, c: Collect,
  o: { signal?: AbortSignal; maxEntryBytes?: number; progress: (step: string, within?: number) => void },
): Promise<FileReport> {
  const handler = findArchiveHandler(head, f.name);
  if (!handler) return { ...base, kind: cls.kind, role: cls.role, status: 'unsupported', detail: 'No reader is registered for this archive format.' };
  o.progress(`Opening ${handler.label}`);
  let arc: OpenedArchive;
  try {
    arc = await handler.open(f.source, { signal: o.signal, name: f.name, maxEntryBytes: o.maxEntryBytes });
  } catch (e) {
    if (e instanceof ImportAborted) throw e;
    const comp = e instanceof ArchiveError ? e.component : 'archive';
    return {
      ...base, kind: cls.kind, role: cls.role, status: 'error',
      detail: `The ${handler.label} could not be opened: the ${componentName(comp)} is damaged or invalid.`,
      components: [{ id: comp, label: componentName(comp, true), state: 'error', detail: (e as Error).message }],
    };
  }
  const scope = `arc:${f.id}`;
  const entries: EntryReport[] = [];
  const guess = guessFromFileName(f.name);
  const facts = [...arc.facts];
  if (!arc.listable) {
    if (guess.title) facts.push({ label: 'Name suggests', value: [guess.artist, guess.title].filter(Boolean).join(' — ') });
    const blocked = arc.components.filter((x) => x.state === 'unsupported' || x.state === 'error');
    return {
      ...base, kind: `${arc.format} archive`, role: cls.role, status: blocked.some((x) => x.state === 'error') ? 'error' : 'unsupported',
      detail: blocked.length
        ? `Read: ${arc.components.filter((x) => x.state === 'ok').map((x) => x.label.toLowerCase()).join(', ') || 'nothing'}. Blocked by: ${blocked.map((x) => x.label.toLowerCase()).join(', ')}. Without it the files inside (charts, audio, song details) cannot be reached.`
        : 'The archive is empty.',
      components: arc.components, facts, entries,
    };
  }
  let k = 0;
  for (const e of arc.entries) {
    throwIfAborted(o.signal);
    o.progress(`Reading ${e.label}`, k++ / arc.entries.length);
    if (e.problem || !e.path) {
      entries.push({ path: e.label, size: e.size, role: 'unknown', status: /unsafe|limit/.test(e.problem ?? '') ? 'rejected' : 'error', detail: cap(e.problem ?? 'unreadable') });
      continue;
    }
    // Classify by name first; only open entries that might be useful (and sniff unknown small ones).
    let ecls = classify(e.path, new Uint8Array(0));
    const cache: { bytes: Uint8Array | null } = { bytes: null };
    const getBytes = async () => (cache.bytes ??= await e.read(o.signal));
    const wanted = (r: string) => ['arrangement-xml', 'rs-manifest', 'rs-hsan', 'gma-song', 'json', 'other-xml', 'audio', 'guitar-pro', 'unknown'].includes(r);
    try {
      if (wanted(ecls.role) && !(ecls.role === 'unknown' && e.size > 1024 * 1024)) {
        const b = await getBytes();
        ecls = classify(e.path, b.subarray(0, SNIFF_BYTES));
      }
      if (ecls.role === 'psarc' || ecls.role === 'zip') {
        entries.push({ path: e.path, size: e.size, role: ecls.kind, status: 'not-used', detail: 'Nested archive: import it on its own to open it.' });
        continue;
      }
      const item: Item = {
        path: e.path, name: e.path.split('/').pop() ?? e.path, size: e.size, scope, origin: f.name,
        head: cache.bytes ? cache.bytes.subarray(0, SNIFF_BYTES) : new Uint8Array(0), bytes: getBytes,
      };
      const r = await handleItem(item, ecls, c, o.signal);
      entries.push({ path: e.path, size: e.size, role: ecls.kind, status: r.status, detail: r.detail });
    } catch (err) {
      if (err instanceof ImportAborted) throw err;
      entries.push({ path: e.path, size: e.size, role: ecls.kind, status: 'error', detail: `Damaged: ${(err as Error).message}` });
    } finally {
      cache.bytes = null; // release decompressed bytes as soon as the entry is handled
    }
  }
  const used = entries.filter((x) => x.status === 'imported').length;
  const unsupported = entries.filter((x) => x.status === 'unsupported');
  const errors = entries.filter((x) => x.status === 'error' || x.status === 'rejected').length;
  const parts = [`${entries.length} files inside`, `${used} imported`];
  const meta = entries.filter((x) => x.status === 'metadata').length;
  if (meta) parts.push(`${meta} read for song details`);
  if (unsupported.length) parts.push(`${unsupported.length} unsupported (${[...new Set(unsupported.map((u) => u.role))].join(', ')})`);
  if (errors) parts.push(`${errors} damaged or rejected`);
  const notUsed = entries.filter((x) => x.status === 'not-used').length;
  if (notUsed) parts.push(`${notUsed} not needed by Play mode`);
  return {
    ...base, kind: `${arc.format} archive`, role: cls.role,
    status: used ? (unsupported.length || errors ? 'partial' : 'imported') : errors && !unsupported.length ? 'error' : 'unsupported',
    detail: parts.join(' · ') + '.',
    components: arc.components, facts, entries,
  };
}

const componentName = (id: string, title = false) => {
  const n: Record<string, string> = { header: 'header', toc: 'table of contents', blocks: 'block-size table', manifest: 'file manifest', data: 'file data', compression: 'compression', directory: 'central directory', size: 'archive size', archive: 'archive' };
  const s = n[id] ?? id;
  return title ? s[0].toUpperCase() + s.slice(1) : s;
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

async function handleItem(it: Item, cls: Classification, c: Collect, signal?: AbortSignal): Promise<{ status: EntryStatus; detail: string }> {
  throwIfAborted(signal);
  const textOf = async () => {
    if (it.size > TEXT_LIMIT) throw new Error('text file is over 64 MiB');
    return decode(await it.bytes());
  };
  const dup = async (text: string): Promise<{ hash: string; dupOf?: string }> => {
    const hash = await sha256Hex(text);
    return { hash, dupOf: c.hashes.get(hash) };
  };
  switch (cls.role) {
    case 'arrangement-xml': {
      const text = await textOf();
      const { hash, dupOf } = await dup(text);
      if (dupOf) return { status: 'duplicate', detail: `Identical to ${dupOf}; imported once.` };
      const r = songFromRocksmithXml(text, `arr-${++c.seq}`);
      if (!r.song) return { status: 'error', detail: r.errors.join(' ') || 'No playable notes.' };
      const errs = validateSong(r.song);
      if (errs.length) return { status: 'error', detail: errs.join(' ') };
      c.hashes.set(hash, it.path);
      const meta = metaFromArrangementXml(text, it.path);
      c.arrangements.push({ key: `a${c.seq}`, song: r.song, path: it.path, origin: it.origin, scope: it.scope, hash, meta, warnings: r.warnings });
      return { status: 'imported', detail: `${r.song.arrangement} arrangement: ${r.song.events.length} events, ${r.song.tuning.name}${r.warnings.length ? `. ${r.warnings.join(' ')}` : ''}.` };
    }
    case 'gma-song': {
      const text = await textOf();
      const { hash, dupOf } = await dup(text);
      if (dupOf) return { status: 'duplicate', detail: `Identical to ${dupOf}; imported once.` };
      let song: PlaySong;
      try { song = JSON.parse(text) as PlaySong; } catch (e) { return { status: 'error', detail: `Invalid JSON: ${(e as Error).message}` }; }
      const errs = validateSong(song);
      if (errs.length) return { status: 'error', detail: errs.join(' ') };
      c.hashes.set(hash, it.path);
      c.arrangements.push({ key: `a${++c.seq}`, song: { ...song, id: `arr-${c.seq}` }, path: it.path, origin: it.origin, scope: it.scope, hash, meta: { title: song.title, artist: song.artist, album: song.album, year: song.year }, warnings: [] });
      return { status: 'imported', detail: `${song.arrangement || 'Song'}: ${song.events.length} events.` };
    }
    case 'guitar-pro': {
      const bytes = await it.bytes();
      const gpif = await gpifFromGpFile(bytes);
      const { hash, dupOf } = await dup(gpif);
      if (dupOf) return { status: 'duplicate', detail: `Identical to ${dupOf}; imported once.` };
      c.hashes.set(hash, it.path);
      const tracks = gpTracks(gpif);
      const made: string[] = [];
      const failed: string[] = [];
      const scope = it.scope || `gp:${it.path}`;
      for (const t of tracks) {
        const r = songFromGpif(gpif, `arr-${++c.seq}`, t.index);
        if (!r.song) { failed.push(`${t.name} (${r.errors.join(' ') || 'no notes'})`); continue; }
        const song = { ...r.song, arrangement: t.name || r.song.arrangement };
        c.arrangements.push({ key: `a${c.seq}`, song, path: `${it.path}#${t.name}`, origin: it.origin, scope, hash: `${hash}:${t.index}`, meta: { title: song.title, artist: song.artist, songKey: `gp-${hash.slice(0, 12)}` }, warnings: r.warnings });
        made.push(t.name);
      }
      if (!made.length) return { status: 'error', detail: `No playable tracks${failed.length ? `: ${failed.join('; ')}` : ''}.` };
      return { status: 'imported', detail: `${made.length} track(s): ${made.join(', ')}${failed.length ? `. Skipped: ${failed.join('; ')}` : ''}.` };
    }
    case 'rs-manifest': case 'rs-hsan': case 'json': {
      const text = await textOf();
      const metas = metaFromManifest(text, it.path);
      if (!metas.length) return { status: 'not-used', detail: cls.role === 'json' ? 'JSON that is neither a song nor a Rocksmith manifest.' : 'Manifest has no song entries.' };
      for (const m of metas) c.hints.push({ ...m, scope: it.scope, path: it.path });
      const m = metas[0];
      return { status: 'metadata', detail: `Song details: ${[m.artist, m.title].filter(Boolean).join(' — ') || 'untitled'}${m.arrangement ? ` (${m.arrangement})` : ''}${metas.length > 1 ? ` and ${metas.length - 1} more entr${metas.length === 2 ? 'y' : 'ies'}` : ''}.` };
    }
    case 'audio': {
      const a = cls.audio!;
      const blob = it.blob ?? new Blob([(await it.bytes()) as BlobPart], { type: a.mime });
      const typed = blob.type ? blob : new Blob([blob], { type: a.mime });
      c.audio.push({
        key: `au${++c.seq}`, name: it.name, path: it.path, origin: it.origin, scope: it.scope, size: blob.size,
        container: a.container, mime: a.mime, preview: a.preview, blob: typed, fingerprint: await blobFingerprint(typed),
      });
      return { status: 'imported', detail: `${cls.kind}${a.preview ? ' (preview clip)' : ''}, ${(blob.size / 1024 / 1024).toFixed(1)} MiB.` };
    }
    default: {
      const s = roleSummary(cls.role);
      return { status: s.status === 'unsupported' ? 'unsupported' : 'not-used', detail: s.detail };
    }
  }
}
