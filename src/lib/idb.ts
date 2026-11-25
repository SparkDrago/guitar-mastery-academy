/**
 * Device-local song library (IndexedDB, which can hold large audio blobs).
 * Falls back to memory when IndexedDB is unavailable, e.g. in some
 * private-browsing modes. Imported songs are never synced to the account:
 * they can be large and may contain material licensed to the user only.
 *
 * Schema v2: one record per song in the "library" store, holding every
 * arrangement, the audio reference and the sync settings. Recordings live in
 * the "audio" store under their own key. Version 1 kept one record per
 * arrangement in "songs"; those are migrated on upgrade and left in place.
 */
import type { PlaySong } from '@gma/notation';

export type ArrangementRole = 'lead' | 'rhythm' | 'combo' | 'bass' | 'other';

export interface BestScore { accuracy: number; score: number; at: string }

export interface LibraryArrangement {
  id: string;
  label: string;
  role: ArrangementRole;
  song: PlaySong;
  /** SHA-256 of the source chart, for duplicate detection. */
  hash?: string;
  sourcePath?: string;
  best?: BestScore;
}

export interface LibraryAudio {
  key: string;
  name: string;
  size: number;
  type: string;
  duration?: number;
  fingerprint?: string;
  preview?: boolean;
}

export interface SyncInfo {
  /** Seconds: chartTime = audioTime + offset. */
  offset: number;
  method: 'none' | 'chart' | 'onsets' | 'manual';
  confidence?: number;
  audioDuration?: number;
  songLength?: number;
  note?: string;
}

export interface LibrarySong {
  id: string;
  schema: 2;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  arrangements: LibraryArrangement[];
  audio: LibraryAudio | null;
  sync: SyncInfo;
  source: { kind: 'import' | 'legacy'; files: string[] };
  /** Hash over the arrangement hashes: the same song imported twice has the same fingerprint. */
  fingerprint: string;
  addedAt: string;
  updatedAt: string;
}

/** Version 1 record (one per arrangement), kept for migration. */
interface LegacySong {
  id: string; song: PlaySong; offset: number; addedAt: string; fileName: string; audioName?: string;
  group?: string; audioRef?: string; order?: number; best?: BestScore;
}

const DB = 'gma-local';
const VERSION = 2;
const memory = { library: new Map<string, LibrarySong>(), audio: new Map<string, Blob>() };
let dbPromise: Promise<IDBDatabase | null> | null = null;

const roleOf = (s: string): ArrangementRole => (/bass/i.test(s) ? 'bass' : /rhythm/i.test(s) ? 'rhythm' : /combo/i.test(s) ? 'combo' : /lead|solo/i.test(s) ? 'lead' : 'other');

export function migrateLegacy(records: LegacySong[]): LibrarySong[] {
  const groups = new Map<string, LegacySong[]>();
  for (const r of records) { const g = r.group ?? r.id; groups.set(g, [...(groups.get(g) ?? []), r]); }
  return [...groups.entries()].map(([g, rs]) => {
    rs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const first = rs[0];
    const withAudio = rs.find((r) => r.audioName);
    return {
      id: `song-${g}`,
      schema: 2,
      title: first.song.title,
      artist: first.song.artist,
      album: first.song.album,
      year: first.song.year,
      arrangements: rs.map((r) => ({ id: r.id, label: r.song.arrangement, role: roleOf(r.song.arrangement), song: r.song, best: r.best })),
      audio: withAudio ? { key: withAudio.audioRef ?? withAudio.id, name: withAudio.audioName!, size: 0, type: '' } : null,
      sync: { offset: first.offset ?? 0, method: first.offset ? 'manual' : 'none' },
      source: { kind: 'legacy', files: [...new Set(rs.map((r) => r.fileName))] },
      fingerprint: `legacy:${g}`,
      addedAt: first.addedAt,
      updatedAt: first.addedAt,
    };
  });
}

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        const tx = req.transaction!;
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
        if (!db.objectStoreNames.contains('library')) db.createObjectStore('library', { keyPath: 'id' });
        if (ev.oldVersion >= 1 && db.objectStoreNames.contains('songs')) {
          const all = tx.objectStore('songs').getAll();
          all.onsuccess = () => {
            const lib = tx.objectStore('library');
            for (const s of migrateLegacy(all.result as LegacySong[])) lib.put(s);
          };
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error ?? r.error);
    t.onabort = () => reject(t.error ?? new Error('Storage transaction aborted (the browser may be out of space).'));
  });
}

export const library = {
  async persistent(): Promise<boolean> {
    return (await open()) !== null;
  },
  async list(): Promise<LibrarySong[]> {
    const db = await open();
    const all = db ? await tx<LibrarySong[]>(db, 'library', 'readonly', (s) => s.getAll() as IDBRequest<LibrarySong[]>) : [...memory.library.values()];
    return all.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  },
  async get(id: string): Promise<LibrarySong | null> {
    const db = await open();
    if (db) return (await tx<LibrarySong | undefined>(db, 'library', 'readonly', (s) => s.get(id) as IDBRequest<LibrarySong | undefined>)) ?? null;
    return memory.library.get(id) ?? null;
  },
  async put(song: LibrarySong): Promise<void> {
    const rec = { ...song, updatedAt: new Date().toISOString() };
    const db = await open();
    if (db) await tx(db, 'library', 'readwrite', (s) => s.put(rec));
    else memory.library.set(rec.id, rec);
  },
  /** Removes the song, and its recording unless another song uses it. */
  async remove(id: string): Promise<void> {
    const all = await library.list();
    const song = all.find((s) => s.id === id);
    const key = song?.audio?.key;
    const shared = key ? all.some((s) => s.id !== id && s.audio?.key === key) : true;
    const db = await open();
    if (db) {
      await tx(db, 'library', 'readwrite', (s) => s.delete(id));
      if (!shared && key) await tx(db, 'audio', 'readwrite', (s) => s.delete(key));
    } else {
      memory.library.delete(id);
      if (!shared && key) memory.audio.delete(key);
    }
  },
  async putAudio(key: string, blob: Blob): Promise<void> {
    const db = await open();
    if (db) await tx(db, 'audio', 'readwrite', (s) => s.put(blob, key));
    else memory.audio.set(key, blob);
  },
  async getAudio(key: string): Promise<Blob | null> {
    const db = await open();
    if (db) return (await tx<Blob | undefined>(db, 'audio', 'readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>)) ?? null;
    return memory.audio.get(key) ?? null;
  },
  async removeAudio(key: string): Promise<void> {
    const db = await open();
    if (db) await tx(db, 'audio', 'readwrite', (s) => s.delete(key));
    else memory.audio.delete(key);
  },
  /** A saved song with the same fingerprint, or sharing any arrangement hash. */
  async findDuplicate(fingerprint: string, hashes: string[]): Promise<LibrarySong | null> {
    const all = await library.list();
    return all.find((s) => s.fingerprint === fingerprint) ?? all.find((s) => s.arrangements.some((a) => a.hash && hashes.includes(a.hash))) ?? null;
  },
  async estimate(): Promise<{ usage?: number; quota?: number }> {
    try { return (await navigator.storage?.estimate?.()) ?? {}; } catch { return {}; }
  },
};
