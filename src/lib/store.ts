/**
 * App store: holds the StudentState for the current owner (guest or signed-in
 * user), persists every change locally first, queues it for Supabase sync,
 * evaluates achievements, and exposes auth actions. React reads it through
 * useSyncExternalStore (see hooks.ts).
 */
import {
  COLLECTIONS, LocalRepository, SupabaseClient, SyncEngine, browserStorage, isConfigured,
  type AuthSession, type CollectionName, type KeyValueStorage,
} from '@gma/data';
import { emptyState, newAchievements, type StudentState } from '@gma/learning';
import { LESSONS } from '@content/lessons/index';
import { EXERCISES } from '@content/exercises';
import { getConfig, nowIso } from './core';

export interface AuthState {
  configured: boolean;
  session: AuthSession | null;
  syncing: boolean;
  lastSyncAt?: string;
  error?: string;
  pending: number;
}

export interface Snapshot {
  state: StudentState;
  owner: string;
  auth: AuthState;
  persistent: boolean;
  toasts: Toast[];
}

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: 'info' | 'success' | 'warning';
}

type Updater<K extends CollectionName> = (current: StudentState[K]) => StudentState[K];

export class AppStore {
  private storage: KeyValueStorage & { persistent: boolean };
  private local: LocalRepository;
  readonly client: SupabaseClient | null;
  private sync: SyncEngine | null = null;
  private listeners = new Set<() => void>();
  private snap: Snapshot;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private toastId = 0;

  constructor(storage?: KeyValueStorage & { persistent: boolean }) {
    this.storage = storage ?? browserStorage();
    this.local = new LocalRepository(this.storage);
    const cfg = getConfig();
    const sb = { url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey };
    this.client = isConfigured(sb) && typeof fetch !== 'undefined' ? new SupabaseClient(sb, (u, i) => fetch(u, i), this.storage) : null;
    const session = this.client?.getSession() ?? null;
    const owner = session ? session.user.id : 'guest';
    this.snap = {
      state: this.local.load(owner), owner, persistent: this.storage.persistent, toasts: [],
      auth: { configured: !!this.client, session, syncing: false, pending: 0 },
    };
    if (session && this.client) this.attachSync(session.user.id);
    this.client?.onAuthChange((s) => this.onAuthChange(s));
  }

  // ── subscription ──
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;
  private emit(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }
  get state() {
    return this.snap.state;
  }

  // ── toasts ──
  toast(title: string, body?: string, tone: Toast['tone'] = 'info') {
    const t = { id: ++this.toastId, title, body, tone };
    this.emit({ toasts: [...this.snap.toasts, t] });
    setTimeout(() => this.dismissToast(t.id), 5000);
  }
  dismissToast(id: number) {
    this.emit({ toasts: this.snap.toasts.filter((t) => t.id !== id) });
  }

  // ── mutations ──
  /** Replace a collection and persist; `changed` lists item ids for sync. */
  update<K extends CollectionName>(name: K, fn: Updater<K>, changed: string[]): void {
    const next = { ...this.snap.state, [name]: fn(this.snap.state[name]) } as StudentState;
    this.commit(next, [name], changed.map((id) => ({ name, id })));
  }

  private commit(next: StudentState, names: CollectionName[], changes: { name: CollectionName; id: string }[]) {
    // Achievements are evaluated on every change; newly met ones are recorded and announced.
    const earned = newAchievements(next, LESSONS, EXERCISES, new Date());
    if (earned.length) {
      const at = nowIso();
      next = { ...next, achievements: { ...next.achievements } };
      for (const a of earned) {
        next.achievements[a.id] = { id: a.id, unlockedAt: at, updatedAt: at };
        changes.push({ name: 'achievements', id: a.id });
        setTimeout(() => this.toast(`Achievement unlocked: ${a.title}`, a.description, 'success'), 50);
      }
      if (!names.includes('achievements')) names = [...names, 'achievements'];
    }
    for (const n of names) this.local.saveCollection(this.snap.owner, next, n);
    if (this.sync) for (const c of changes) this.sync.markDirty(c.name, c.id);
    this.emit({ state: next, auth: { ...this.snap.auth, pending: this.sync?.status.outbox.length ?? 0 } });
    this.scheduleSync();
  }

  upsert<K extends 'lessons' | 'srs' | 'achievements'>(name: K, id: string, item: StudentState[K][string]): void {
    this.update(name, (cur) => ({ ...(cur as Record<string, unknown>), [id]: item }) as StudentState[K], [id]);
  }

  append<K extends 'quizAttempts' | 'sessions' | 'exerciseRecords' | 'trainer' | 'ear' | 'jams' | 'tunings' | 'exercises' | 'saved' | 'routines'>(name: K, item: StudentState[K][number]): void {
    const spec = COLLECTIONS[name];
    const id = spec.idOf(item);
    this.update(name, (cur) => {
      const list = cur as unknown[];
      const i = list.findIndex((x) => spec.idOf(x) === id);
      const out = i >= 0 ? list.map((x, k) => (k === i ? item : x)) : [...list, item];
      return (spec.cap && out.length > spec.cap ? out.slice(-spec.cap) : out) as StudentState[K];
    }, [id]);
  }

  remove<K extends 'tunings' | 'exercises' | 'saved' | 'routines'>(name: K, id: string): void {
    const spec = COLLECTIONS[name];
    const item = (this.snap.state[name] as unknown[]).find((x) => spec.idOf(x) === id);
    if (!item) return;
    const next = { ...this.snap.state, [name]: (this.snap.state[name] as unknown[]).filter((x) => spec.idOf(x) !== id) } as StudentState;
    this.local.saveCollection(this.snap.owner, next, name);
    this.sync?.markDeleted(name, item);
    this.emit({ state: next });
    this.scheduleSync();
  }

  setProfile(patch: Partial<StudentState['profile']>): void {
    this.update('profile', (p) => ({ ...p, ...patch, updatedAt: nowIso() }), ['profile']);
  }

  resetLocalData(): void {
    this.local.clear(this.snap.owner);
    this.emit({ state: emptyState() });
  }

  exportBackup(): string {
    return this.local.exportJson(this.snap.owner);
  }

  importBackup(json: string): { ok: boolean; error?: string } {
    const r = this.local.importJson(this.snap.owner, json);
    if (r.ok) {
      const state = this.local.load(this.snap.owner);
      this.emit({ state });
      this.sync?.markAllDirty(state);
      this.scheduleSync();
    }
    return r;
  }

  // ── auth & sync ──
  private attachSync(userId: string) {
    if (!this.client) return;
    this.sync = new SyncEngine(this.client, this.local, userId);
    this.emit({ auth: { ...this.snap.auth, lastSyncAt: this.sync.status.lastSyncAt, pending: this.sync.status.outbox.length } });
  }

  private onAuthChange(session: AuthSession | null) {
    if (session && session.user.id !== this.snap.owner) {
      const guestHasData = this.local.hasData('guest');
      const accountHasData = this.local.hasData(session.user.id);
      let state = this.local.load(session.user.id);
      this.attachSync(session.user.id);
      if (guestHasData && !accountHasData) {
        // First sign-in on this device: carry the guest's progress into the account.
        state = this.local.load('guest');
        if (session.user.displayName) state = { ...state, profile: { ...state.profile, displayName: session.user.displayName, updatedAt: nowIso() } };
        this.local.saveAll(session.user.id, state);
        this.sync!.markAllDirty(state);
        this.local.clear('guest');
        setTimeout(() => this.toast('Progress moved to your account', 'Your practice history from this device is now synced to your account.', 'success'), 50);
      }
      this.emit({ owner: session.user.id, state, auth: { ...this.snap.auth, session } });
      void this.syncNow();
    } else if (!session && this.snap.owner !== 'guest') {
      this.sync = null;
      this.emit({ owner: 'guest', state: this.local.load('guest'), auth: { ...this.snap.auth, session: null, pending: 0, lastSyncAt: undefined } });
    } else {
      this.emit({ auth: { ...this.snap.auth, session } });
    }
  }

  private scheduleSync() {
    if (!this.sync) return;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => void this.syncNow(), 2500);
  }

  async syncNow(): Promise<void> {
    if (!this.sync) return;
    this.emit({ auth: { ...this.snap.auth, syncing: true } });
    const res = await this.sync.syncNow(() => this.snap.state, (s) => this.emit({ state: s }));
    this.emit({ auth: { ...this.snap.auth, syncing: false, error: res.error, lastSyncAt: this.sync.status.lastSyncAt, pending: this.sync.status.outbox.length } });
  }

  async signIn(email: string, password: string) {
    if (!this.client) throw new Error('Accounts are not configured for this deployment.');
    await this.client.signIn(email, password);
  }

  async signUp(email: string, password: string, displayName: string) {
    if (!this.client) throw new Error('Accounts are not configured for this deployment.');
    const site = getConfig().siteUrl || window.location.origin;
    return this.client.signUp(email, password, displayName, `${site}/account`);
  }

  async signOut() {
    await this.client?.signOut();
  }

  async requestReset(email: string) {
    if (!this.client) throw new Error('Accounts are not configured for this deployment.');
    const site = getConfig().siteUrl || window.location.origin;
    await this.client.requestPasswordReset(email, `${site}/account?reset=1`);
  }

  async updatePassword(password: string) {
    if (!this.client) throw new Error('Accounts are not configured.');
    await this.client.updatePassword(password);
  }

  /** Process Supabase email-link fragments (#access_token=…). */
  async handleAuthRedirect(): Promise<string | null> {
    if (!this.client || !window.location.hash.includes('access_token') && !window.location.hash.includes('error')) return null;
    const res = await this.client.handleRedirect(window.location.hash);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (!res) return null;
    if ('error' in res) return `error:${res.error}`;
    return res.type;
  }
}

export const store = new AppStore();
