/**
 * Device-local storage for imported songs and their audio (IndexedDB, which
 * can hold large blobs). Falls back to memory when IndexedDB is unavailable,
 * e.g. in some private-browsing modes. Imported songs are not synced to the
 * account: they can be large and may contain material licensed to the user only.
 */
import type { PlaySong } from '@gma/notation';

export interface StoredSong {
  id: string;
  song: PlaySong;
  /** Seconds added to the audio clock so notes line up with the recording. */
  offset: number;
  addedAt: string;
  fileName: string;
  audioName?: string;
  best?: { accuracy: number; score: number; at: string };
}

const DB = 'gma-local';
const memory = { songs: new Map<string, StoredSong>(), audio: new Map<string, Blob>() };
let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
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
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const songStore = {
  async persistent(): Promise<boolean> {
    return (await open()) !== null;
  },
  async list(): Promise<StoredSong[]> {
    const db = await open();
    const all = db ? await tx<StoredSong[]>(db, 'songs', 'readonly', (s) => s.getAll() as IDBRequest<StoredSong[]>) : [...memory.songs.values()];
    return all.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  },
  async put(rec: StoredSong): Promise<void> {
    const db = await open();
    if (db) await tx(db, 'songs', 'readwrite', (s) => s.put(rec));
    else memory.songs.set(rec.id, rec);
  },
  async remove(id: string): Promise<void> {
    const db = await open();
    if (db) { await tx(db, 'songs', 'readwrite', (s) => s.delete(id)); await tx(db, 'audio', 'readwrite', (s) => s.delete(id)); }
    else { memory.songs.delete(id); memory.audio.delete(id); }
  },
  async putAudio(id: string, blob: Blob): Promise<void> {
    const db = await open();
    if (db) await tx(db, 'audio', 'readwrite', (s) => s.put(blob, id));
    else memory.audio.set(id, blob);
  },
  async getAudio(id: string): Promise<Blob | null> {
    const db = await open();
    if (db) return (await tx<Blob | undefined>(db, 'audio', 'readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)) ?? null;
    return memory.audio.get(id) ?? null;
  },
};
