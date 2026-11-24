import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalRepository, MemoryStorage, SupabaseClient, SyncEngine, mergeCollection, COLLECTIONS, isConfigured, type FetchLike } from '@gma/data';
import { emptyState, type StudentState, type LessonProgress } from '@gma/learning';

const CFG = { url: 'https://abc.supabase.co', anonKey: 'public-anon-key-0123456789abcdef' };
const USER = '11111111-1111-1111-1111-111111111111';

interface Call { url: string; method: string; headers: Record<string, string>; body?: any }

/** Tiny in-memory imitation of GoTrue + PostgREST for one user. */
function fakeServer() {
  const calls: Call[] = [];
  const tables = new Map<string, any[]>();
  let clock = 1;
  const fetchFn: FetchLike = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body });
    const u = new URL(url);
    const reply = (status: number, data: unknown) => ({ ok: status < 400, status, json: async () => data, text: async () => JSON.stringify(data) });
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password') {
      if (body.password !== 'correct-horse') return reply(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return reply(200, { access_token: 'AT1', refresh_token: 'RT1', expires_in: 3600, user: { id: USER, email: body.email, user_metadata: { display_name: 'Ana' } } });
    }
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'refresh_token')
      return reply(200, { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600, user: { id: USER, email: 'a@x.io' } });
    if (u.pathname === '/auth/v1/signup') return reply(200, { id: USER, email: body.email });
    if (u.pathname === '/auth/v1/recover') return reply(200, {});
    if (u.pathname === '/auth/v1/user' && init.method === 'PUT') return reply(200, { id: USER });
    if (u.pathname === '/auth/v1/user') return reply(200, { id: USER, email: 'a@x.io', user_metadata: {} });
    if (u.pathname === '/auth/v1/logout') return reply(204, {});
    if (u.pathname.startsWith('/rest/v1/')) {
      const table = u.pathname.slice('/rest/v1/'.length);
      const rows = tables.get(table) ?? [];
      if (init.method === 'POST') {
        const keys = (u.searchParams.get('on_conflict') ?? 'id').split(',');
        for (const r of body) {
          const i = rows.findIndex((x) => keys.every((k) => x[k] === r[k]));
          const row = { ...r, synced_at: new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString() };
          if (i < 0) rows.push(row);
          else if (!rows[i].updated_at || r.updated_at >= rows[i].updated_at) rows[i] = row;
        }
        tables.set(table, rows);
        return reply(201, null);
      }
      const gt = [...u.searchParams.entries()].find(([k]) => k === 'synced_at')?.[1]?.replace(/^gt\./, '');
      return reply(200, rows.filter((r) => !gt || r.synced_at > gt));
    }
    return reply(404, { message: 'not found' });
  };
  return { fetchFn, calls, tables };
}

test('config detection', () => {
  assert.equal(isConfigured(CFG), true);
  assert.equal(isConfigured({ url: '', anonKey: '' }), false);
  assert.equal(isConfigured({ url: 'http://insecure', anonKey: 'x'.repeat(30) }), false);
});

test('auth: sign in, persisted session, friendly errors, refresh and sign out', async () => {
  const srv = fakeServer();
  const storage = new MemoryStorage();
  let now = 1_000_000;
  const client = new SupabaseClient(CFG, srv.fetchFn, storage, () => now);
  await assert.rejects(client.signIn('a@x.io', 'wrong'), /Email or password is incorrect/);
  const changes: (string | null)[] = [];
  client.onAuthChange((s) => changes.push(s?.user.id ?? null));
  const s = await client.signIn('a@x.io', 'correct-horse');
  assert.equal(s.user.id, USER);
  assert.equal(s.user.displayName, 'Ana');
  const login = srv.calls.find((c) => c.url.includes('grant_type=password') && c.body.password === 'correct-horse')!;
  assert.equal(login.headers.apikey, CFG.anonKey, 'anon key used as apikey');
  // Session survives a reload.
  const reloaded = new SupabaseClient(CFG, srv.fetchFn, storage, () => now);
  assert.equal(reloaded.getSession()?.accessToken, 'AT1');
  // Near expiry the token is refreshed transparently.
  now += 3600_000 - 30_000;
  assert.equal(await reloaded.accessToken(), 'AT2');
  await client.signOut();
  assert.equal(client.getSession(), null);
  assert.deepEqual(changes, [USER, null]);
});

test('auth: sign-up, password recovery and redirect handling', async () => {
  const srv = fakeServer();
  const client = new SupabaseClient(CFG, srv.fetchFn, new MemoryStorage());
  const r = await client.signUp('n@x.io', 'pw-123456', 'New', 'https://app.example/auth');
  assert.equal(r.needsConfirmation, true);
  assert.ok(srv.calls.at(-1)!.url.includes('redirect_to=https%3A%2F%2Fapp.example%2Fauth'));
  assert.deepEqual(srv.calls.at(-1)!.body.data, { display_name: 'New' });
  await client.requestPasswordReset('n@x.io', 'https://app.example/reset');
  assert.ok(srv.calls.at(-1)!.url.includes('/auth/v1/recover?redirect_to='));
  const res = await client.handleRedirect('#access_token=ATX&refresh_token=RTX&expires_in=3600&type=recovery');
  assert.ok(res && 'type' in res && res.type === 'recovery');
  await client.updatePassword('new-password-1');
  assert.equal(srv.calls.at(-1)!.method, 'PUT');
  assert.equal(srv.calls.at(-1)!.headers.Authorization, 'Bearer ATX');
  const err = await client.handleRedirect('#error=access_denied&error_description=Link+expired');
  assert.deepEqual(err, { error: 'Link expired' });
});

test('local repository: per-owner storage, corruption tolerance, backup round trip', () => {
  const storage = new MemoryStorage();
  const repo = new LocalRepository(storage);
  const s = emptyState('2026-01-01T00:00:00.000Z');
  s.profile.displayName = 'Kim';
  s.lessons['l0-tuning'] = { lessonId: 'l0-tuning', status: 'completed', quizBest: 1, masteryBest: 0, attempts: 1, updatedAt: '2026-01-01T00:00:00.000Z' };
  repo.saveAll('guest', s);
  assert.equal(repo.load('guest').profile.displayName, 'Kim');
  assert.equal(repo.load('someone-else').profile.displayName, 'Guitarist');
  storage.setItem('gma.v1.guest.trainer', '{not json');
  assert.deepEqual(repo.load('guest').trainer, []);
  const backup = repo.exportJson('guest');
  const other = new LocalRepository(new MemoryStorage());
  assert.deepEqual(other.importJson('x', backup), { ok: true });
  assert.equal(other.load('x').lessons['l0-tuning'].status, 'completed');
  assert.equal(other.importJson('x', '{"format":"nope"}').ok, false);
});

test('merge: last-write-wins per item, union for logs, deletions', () => {
  const s = emptyState();
  const a: LessonProgress = { lessonId: 'a', status: 'completed', quizBest: 1, masteryBest: 0, attempts: 1, updatedAt: '2026-01-02T00:00:00.000Z' };
  s.lessons.a = a;
  const older = { ...a, status: 'in_progress' as const, updatedAt: '2026-01-01T00:00:00.000Z' };
  assert.equal(mergeCollection(s, 'lessons', [{ item: older }]).lessons.a.status, 'completed');
  const newer = { ...a, status: 'mastered' as const, updatedAt: '2026-01-03T00:00:00.000Z' };
  assert.equal(mergeCollection(s, 'lessons', [{ item: newer }]).lessons.a.status, 'mastered');
  s.trainer = [{ id: 't1', mode: 'note-id', tuningId: 'e', string: 0, fret: 1, pc: 5, correct: true, ms: 900, at: '2026-01-01T00:00:00.000Z' }];
  const merged = mergeCollection(s, 'trainer', [{ item: { ...s.trainer[0], id: 't2', at: '2026-01-02T00:00:00.000Z' } }]);
  assert.deepEqual(merged.trainer.map((t) => t.id), ['t1', 't2']);
  s.tunings = [{ id: 'c1', name: 'X', category: 'custom', strings: [40, 45, 50, 55], updatedAt: '2026-01-01T00:00:00.000Z' }];
  assert.equal(mergeCollection(s, 'tunings', [{ item: s.tunings[0], deleted: true }]).tunings.length, 0);
});

test('sync: pushes the outbox, pulls other devices\' changes, and converges', async () => {
  const srv = fakeServer();
  // Device 1 signs in, records progress and syncs.
  const st1 = new MemoryStorage();
  const c1 = new SupabaseClient(CFG, srv.fetchFn, st1);
  await c1.signIn('a@x.io', 'correct-horse');
  const repo1 = new LocalRepository(st1);
  let state1: StudentState = emptyState('2026-01-01T00:00:00.000Z');
  state1.lessons['l1'] = { lessonId: 'l1', status: 'completed', quizBest: 0.8, masteryBest: 0, attempts: 1, updatedAt: '2026-01-05T00:00:00.000Z' };
  state1.trainer.push({ id: 'tA', mode: 'find-note', tuningId: 'e-standard', string: 2, fret: 7, pc: 9, correct: false, ms: 3000, at: '2026-01-05T00:00:00.000Z' });
  const sync1 = new SyncEngine(c1, repo1, USER);
  sync1.markAllDirty(state1);
  const r1 = await sync1.syncNow(() => state1, (s) => (state1 = s));
  assert.equal(r1.error, undefined);
  assert.ok(r1.pushed >= 3, 'profile, lesson and trainer pushed');
  assert.equal(sync1.status.outbox.length, 0);
  const lpRow = srv.tables.get('lesson_progress')![0];
  assert.equal(lpRow.user_id, USER);
  assert.equal(lpRow.lesson_id, 'l1');
  const upsert = srv.calls.find((c) => c.url.includes('/rest/v1/lesson_progress?on_conflict='))!;
  assert.match(upsert.headers.Prefer, /merge-duplicates/);
  assert.equal(upsert.headers.Authorization, 'Bearer AT1');

  // Device 2 starts empty and pulls everything.
  const st2 = new MemoryStorage();
  const c2 = new SupabaseClient(CFG, srv.fetchFn, st2);
  await c2.signIn('a@x.io', 'correct-horse');
  let state2: StudentState = emptyState('2025-01-01T00:00:00.000Z');
  const sync2 = new SyncEngine(c2, new LocalRepository(st2), USER);
  const r2 = await sync2.syncNow(() => state2, (s) => (state2 = s));
  assert.equal(r2.error, undefined, String(r2.error) + JSON.stringify(srv.calls.slice(-3).map((c) => c.url)) + [...srv.tables.keys()].join());
  assert.ok(r2.pulled >= 3, `pulled ${r2.pulled} ` + JSON.stringify(srv.calls.slice(-2).map((c) => c.url)) + [...srv.tables.keys()].join());
  assert.equal(state2.lessons['l1'].status, 'completed');
  assert.equal(state2.trainer[0].id, 'tA');
  assert.equal(new LocalRepository(st2).load(USER).lessons['l1'].status, 'completed', 'pulled data persisted locally');

  // Device 2 masters the lesson; device 1 pulls the newer version.
  state2 = { ...state2, lessons: { ...state2.lessons, l1: { ...state2.lessons['l1'], status: 'mastered', updatedAt: '2026-01-06T00:00:00.000Z' } } };
  sync2.markDirty('lessons', 'l1');
  await sync2.syncNow(() => state2, (s) => (state2 = s));
  const r3 = await sync1.syncNow(() => state1, (s) => (state1 = s));
  assert.equal(r3.error, undefined);
  assert.equal(state1.lessons['l1'].status, 'mastered');
  // Incremental pull: the second pull on device 1 only fetched changed rows.
  const pulls = srv.calls.filter((c) => c.url.includes('/rest/v1/lesson_progress?select='));
  assert.ok(pulls.at(-1)!.url.includes('synced_at=gt.'));
});

test('sync: failures are reported and the outbox is kept for retry', async () => {
  const failing: FetchLike = async (url) => {
    if (url.includes('grant_type=password')) return { ok: true, status: 200, json: async () => ({}), text: async () => JSON.stringify({ access_token: 'A', refresh_token: 'R', expires_in: 3600, user: { id: USER, email: 'a' } }) };
    return { ok: false, status: 503, json: async () => ({}), text: async () => JSON.stringify({ message: 'Service unavailable' }) };
  };
  const st = new MemoryStorage();
  const c = new SupabaseClient(CFG, failing, st);
  await c.signIn('a', 'b');
  let state = emptyState();
  const sync = new SyncEngine(c, new LocalRepository(st), USER);
  sync.markDirty('profile', 'profile');
  const r = await sync.syncNow(() => state, (s) => (state = s));
  assert.match(r.error!, /Service unavailable/);
  assert.equal(sync.status.outbox.length, 1, 'outbox preserved');
  assert.ok(COLLECTIONS.profile.table === 'profiles');
});
