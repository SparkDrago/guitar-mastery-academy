/**
 * Local persistence behind a small key-value interface. The browser adapter
 * wraps localStorage (with try/catch and an in-memory fallback), but nothing
 * depends on localStorage directly: tests use MemoryStorage, and an IndexedDB
 * or native adapter can be dropped in later.
 */
import { emptyState, type StudentState } from '@gma/learning';
import { COLLECTIONS, COLLECTION_NAMES, type CollectionName } from './collections';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export class MemoryStorage implements KeyValueStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  keys() { return [...this.m.keys()]; }
}

/** localStorage when available and writable; otherwise an in-memory store. */
export function browserStorage(): KeyValueStorage & { persistent: boolean } {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (ls) {
      const probe = '__gma_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return {
        persistent: true,
        getItem: (k) => { try { return ls.getItem(k); } catch { return null; } },
        setItem: (k, v) => { try { ls.setItem(k, v); } catch { /* quota or privacy mode */ } },
        removeItem: (k) => { try { ls.removeItem(k); } catch { /* ignore */ } },
        keys: () => { try { return Object.keys(ls); } catch { return []; } },
      };
    }
  } catch { /* storage blocked */ }
  const mem = new MemoryStorage();
  return Object.assign(mem, { persistent: false });
}

export const SCHEMA_VERSION = 1;

/** Persists StudentState per owner ("guest" or a user id), one key per collection. */
export class LocalRepository {
  constructor(private storage: KeyValueStorage, private prefix = 'gma') {}

  private key(owner: string, name: CollectionName | 'meta') {
    return `${this.prefix}.v${SCHEMA_VERSION}.${owner}.${name}`;
  }

  load(owner: string): StudentState {
    const base = emptyState();
    const state: StudentState = { ...base };
    for (const name of COLLECTION_NAMES) {
      const raw = this.storage.getItem(this.key(owner, name));
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const spec = COLLECTIONS[name];
        const okShape = spec.shape === 'list' ? Array.isArray(parsed) : parsed && typeof parsed === 'object' && !Array.isArray(parsed);
        if (okShape) (state as unknown as Record<string, unknown>)[name] = spec.shape === 'single' ? { ...(base[name] as object), ...parsed } : parsed;
      } catch {
        // Corrupt entry: keep the default rather than crashing.
      }
    }
    return state;
  }

  saveCollection(owner: string, state: StudentState, name: CollectionName): void {
    const spec = COLLECTIONS[name];
    let value = state[name] as unknown;
    if (spec.shape === 'list' && spec.cap && Array.isArray(value) && value.length > spec.cap) value = value.slice(-spec.cap);
    this.storage.setItem(this.key(owner, name), JSON.stringify(value));
  }

  saveAll(owner: string, state: StudentState): void {
    for (const name of COLLECTION_NAMES) this.saveCollection(owner, state, name);
  }

  getMeta<T>(owner: string, fallback: T): T {
    const raw = this.storage.getItem(this.key(owner, 'meta'));
    const fresh = JSON.parse(JSON.stringify(fallback)) as T;
    if (!raw) return fresh;
    try { return { ...fresh, ...JSON.parse(raw) }; } catch { return fresh; }
  }

  setMeta(owner: string, meta: unknown): void {
    this.storage.setItem(this.key(owner, 'meta'), JSON.stringify(meta));
  }

  clear(owner: string): void {
    for (const name of COLLECTION_NAMES) this.storage.removeItem(this.key(owner, name));
    this.storage.removeItem(this.key(owner, 'meta'));
  }

  hasData(owner: string): boolean {
    return COLLECTION_NAMES.some((n) => n !== 'profile' && this.storage.getItem(this.key(owner, n)) !== null);
  }

  /** Export everything as a portable JSON backup. */
  exportJson(owner: string): string {
    return JSON.stringify({ format: 'gma-backup', version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), state: this.load(owner) }, null, 2);
  }

  importJson(owner: string, json: string): { ok: boolean; error?: string } {
    try {
      const parsed = JSON.parse(json);
      if (parsed?.format !== 'gma-backup' || !parsed.state) return { ok: false, error: 'Not a Guitar Mastery Academy backup file.' };
      const state = { ...emptyState(), ...parsed.state } as StudentState;
      this.saveAll(owner, state);
      return { ok: true };
    } catch {
      return { ok: false, error: 'The file is not valid JSON.' };
    }
  }
}
