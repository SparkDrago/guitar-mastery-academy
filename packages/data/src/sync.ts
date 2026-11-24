/**
 * Local-first sync between the LocalRepository and Supabase.
 *
 *  - Every mutation is saved locally first and queued in an outbox.
 *  - syncNow() pushes the outbox (upserts), then pulls rows changed on the
 *    server since the last cursor (server-set `synced_at`) and merges them
 *    last-write-wins by the client `updated_at` timestamp.
 *  - The database also enforces last-write-wins with a trigger, so a stale
 *    device can never overwrite newer data.
 */
import type { StudentState } from '@gma/learning';
import { COLLECTIONS, COLLECTION_NAMES, itemsOf, mergeCollection, type CollectionName } from './collections';
import type { LocalRepository } from './local';
import type { SupabaseClient } from './supabase';

export interface SyncMeta {
  cursors: Partial<Record<CollectionName, string>>;
  outbox: { collection: CollectionName; id: string }[];
  /** Soft-deleted rows waiting to be pushed (row data with deleted_at set). */
  tombstones?: { collection: CollectionName; row: Record<string, unknown> }[];
  lastSyncAt?: string;
  lastError?: string;
}

export function emptyMeta(): SyncMeta {
  return { cursors: {}, outbox: [] };
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  error?: string;
}

export class SyncEngine {
  private meta: SyncMeta;
  private running: Promise<SyncResult> | null = null;

  constructor(private client: SupabaseClient, private local: LocalRepository, private userId: string) {
    this.meta = local.getMeta<SyncMeta>(userId, emptyMeta());
  }

  get status(): SyncMeta {
    return this.meta;
  }

  markDirty(collection: CollectionName, id: string): void {
    if (!this.meta.outbox.some((o) => o.collection === collection && o.id === id)) this.meta.outbox.push({ collection, id });
    this.local.setMeta(this.userId, this.meta);
  }

  /** Queue a deletion. Only collections whose table has a deleted_at column support this. */
  markDeleted(collection: CollectionName, item: unknown): void {
    const spec = COLLECTIONS[collection];
    const now = new Date().toISOString();
    const row = { ...spec.toRow(item, this.userId), deleted_at: now, updated_at: now };
    this.meta.tombstones = [...(this.meta.tombstones ?? []), { collection, row }];
    this.meta.outbox = this.meta.outbox.filter((o) => !(o.collection === collection && o.id === spec.idOf(item)));
    this.local.setMeta(this.userId, this.meta);
  }

  /** Queue every local item (used when a guest's progress is moved into a new account). */
  markAllDirty(state: StudentState): void {
    for (const name of COLLECTION_NAMES) {
      const spec = COLLECTIONS[name];
      for (const item of itemsOf(state, name)) this.markDirty(name, spec.idOf(item));
    }
  }

  async syncNow(getState: () => StudentState, setState: (s: StudentState) => void): Promise<SyncResult> {
    if (this.running) return this.running;
    this.running = this.run(getState, setState).finally(() => (this.running = null));
    return this.running;
  }

  private async run(getState: () => StudentState, setState: (s: StudentState) => void): Promise<SyncResult> {
    let pushed = 0;
    let pulled = 0;
    try {
      // 1. Push.
      const state = getState();
      const byCollection = new Map<CollectionName, Set<string>>();
      for (const o of this.meta.outbox) {
        if (!byCollection.has(o.collection)) byCollection.set(o.collection, new Set());
        byCollection.get(o.collection)!.add(o.id);
      }
      for (const [name, ids] of byCollection) {
        const spec = COLLECTIONS[name];
        const items = itemsOf(state, name).filter((it) => ids.has(spec.idOf(it)));
        const rows = items.map((it) => spec.toRow(it, this.userId));
        for (let i = 0; i < rows.length; i += 200) await this.client.upsert(spec.table, rows.slice(i, i + 200), spec.conflictColumns);
        pushed += rows.length;
        this.meta.outbox = this.meta.outbox.filter((o) => !(o.collection === name && ids.has(o.id)));
        this.local.setMeta(this.userId, this.meta);
      }
      for (const t of [...(this.meta.tombstones ?? [])]) {
        const spec = COLLECTIONS[t.collection];
        await this.client.upsert(spec.table, [t.row], spec.conflictColumns);
        this.meta.tombstones = (this.meta.tombstones ?? []).filter((x) => x !== t);
        pushed++;
        this.local.setMeta(this.userId, this.meta);
      }
      // 2. Pull.
      let next = getState();
      for (const name of COLLECTION_NAMES) {
        const spec = COLLECTIONS[name];
        const since = this.meta.cursors[name];
        const filter = name === 'profile' ? `id=eq.${this.userId}` : `user_id=eq.${this.userId}`;
        const q = `select=*&${filter}${since ? `&synced_at=gt.${encodeURIComponent(since)}` : ''}&order=synced_at.asc&limit=1000`;
        const rows = await this.client.select(spec.table, q);
        if (!rows.length) continue;
        next = mergeCollection(next, name, rows.map((r: Record<string, unknown>) => ({ item: spec.fromRow(r), deleted: !!r.deleted_at })));
        this.meta.cursors[name] = String(rows[rows.length - 1].synced_at);
        pulled += rows.length;
      }
      if (pulled) {
        setState(next);
        this.local.saveAll(this.userId, next);
      }
      this.meta.lastSyncAt = new Date().toISOString();
      this.meta.lastError = undefined;
      this.local.setMeta(this.userId, this.meta);
      return { pushed, pulled };
    } catch (e) {
      this.meta.lastError = e instanceof Error ? e.message : String(e);
      this.local.setMeta(this.userId, this.meta);
      return { pushed, pulled, error: this.meta.lastError };
    }
  }
}
