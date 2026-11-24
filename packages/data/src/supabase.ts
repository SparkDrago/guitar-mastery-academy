/**
 * Minimal Supabase client built on fetch (GoTrue auth + PostgREST), so the app
 * needs no SDK dependency. Only the public anon/publishable key is ever used
 * here; row-level security on every table restricts each user to their rows.
 * NEVER pass the service-role key to this module.
 */
import type { KeyValueStorage } from './local';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text(): Promise<string>;
}>;

export class SupabaseError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

/** Translate GoTrue/PostgREST error payloads into readable messages. */
function readableError(status: number, body: any): SupabaseError {
  const raw = body?.error_description || body?.msg || body?.message || body?.error || `Request failed (${status})`;
  const code = body?.error_code || body?.code;
  const friendly: Record<string, string> = {
    invalid_credentials: 'Email or password is incorrect.',
    email_not_confirmed: 'Please confirm your email address first: check your inbox for the confirmation link.',
    user_already_exists: 'An account with this email already exists. Try signing in instead.',
    weak_password: 'Choose a stronger password (at least 8 characters).',
    over_email_send_rate_limit: 'Too many emails sent. Please wait a minute and try again.',
  };
  return new SupabaseError(friendly[code] ?? String(raw), status, code);
}

export function isConfigured(cfg: Partial<SupabaseConfig> | null | undefined): cfg is SupabaseConfig {
  return !!cfg && typeof cfg.url === 'string' && /^https:\/\/.+/.test(cfg.url) && typeof cfg.anonKey === 'string' && cfg.anonKey.length > 20;
}

export class SupabaseClient {
  private session: AuthSession | null = null;
  private listeners = new Set<(s: AuthSession | null) => void>();
  private refreshing: Promise<AuthSession | null> | null = null;
  private readonly storageKey = 'gma.auth.session';

  constructor(public readonly config: SupabaseConfig, private fetchFn: FetchLike, private storage: KeyValueStorage, private now: () => number = () => Date.now()) {
    const raw = storage.getItem(this.storageKey);
    if (raw) {
      try { this.session = JSON.parse(raw); } catch { this.session = null; }
    }
  }

  private base(path: string) {
    return this.config.url.replace(/\/+$/, '') + path;
  }

  private headers(token?: string): Record<string, string> {
    return { apikey: this.config.anonKey, Authorization: `Bearer ${token ?? this.config.anonKey}`, 'Content-Type': 'application/json' };
  }

  private async request(path: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<any> {
    const res = await this.fetchFn(this.base(path), {
      method: init.method ?? 'GET',
      headers: init.headers ?? this.headers(),
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
    if (!res.ok) throw readableError(res.status, body);
    return body;
  }

  // ── Session handling ──

  getSession(): AuthSession | null {
    return this.session;
  }

  onAuthChange(cb: (s: AuthSession | null) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private setSession(s: AuthSession | null) {
    this.session = s;
    if (s) this.storage.setItem(this.storageKey, JSON.stringify(s));
    else this.storage.removeItem(this.storageKey);
    this.listeners.forEach((l) => l(s));
  }

  private fromTokenResponse(body: any): AuthSession {
    const u = body.user ?? {};
    return {
      user: { id: u.id, email: u.email, displayName: u.user_metadata?.display_name },
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: this.now() + (Number(body.expires_in ?? 3600) * 1000),
    };
  }

  /** Access token, refreshed when within 60 s of expiry. */
  async accessToken(): Promise<string | null> {
    if (!this.session) return null;
    if (this.session.expiresAt - this.now() > 60_000) return this.session.accessToken;
    const s = await this.refresh();
    return s?.accessToken ?? null;
  }

  async refresh(): Promise<AuthSession | null> {
    if (!this.session) return null;
    if (this.refreshing) return this.refreshing;
    const token = this.session.refreshToken;
    this.refreshing = (async () => {
      try {
        const body = await this.request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: token } });
        const s = this.fromTokenResponse(body);
        this.setSession(s);
        return s;
      } catch (e) {
        if (e instanceof SupabaseError && (e.status === 400 || e.status === 401)) this.setSession(null);
        throw e;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  // ── Auth flows ──

  async signUp(email: string, password: string, displayName: string, redirectTo?: string): Promise<{ needsConfirmation: boolean }> {
    const q = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
    const body = await this.request(`/auth/v1/signup${q}`, { method: 'POST', body: { email, password, data: { display_name: displayName } } });
    if (body?.access_token) {
      this.setSession(this.fromTokenResponse(body));
      return { needsConfirmation: false };
    }
    return { needsConfirmation: true };
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    const body = await this.request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    const s = this.fromTokenResponse(body);
    this.setSession(s);
    return s;
  }

  async signOut(): Promise<void> {
    const token = this.session?.accessToken;
    this.setSession(null);
    if (token) {
      try { await this.request('/auth/v1/logout', { method: 'POST', headers: this.headers(token) }); } catch { /* local sign-out already done */ }
    }
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    await this.request(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: 'POST', body: { email } });
  }

  async updatePassword(password: string): Promise<void> {
    const token = await this.accessToken();
    if (!token) throw new SupabaseError('Your reset link has expired. Request a new one.', 401);
    await this.request('/auth/v1/user', { method: 'PUT', headers: this.headers(token), body: { password } });
  }

  /**
   * Handle the URL fragment that Supabase appends to email links
   * (#access_token=…&refresh_token=…&type=recovery|signup).
   */
  async handleRedirect(hash: string): Promise<{ type: string; session: AuthSession } | { error: string } | null> {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    if (params.get('error')) return { error: params.get('error_description') ?? params.get('error')! };
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    if (!access || !refresh) return null;
    const user = await this.request('/auth/v1/user', { headers: this.headers(access) });
    const s: AuthSession = {
      user: { id: user.id, email: user.email, displayName: user.user_metadata?.display_name },
      accessToken: access, refreshToken: refresh, expiresAt: this.now() + Number(params.get('expires_in') ?? 3600) * 1000,
    };
    this.setSession(s);
    return { type: params.get('type') ?? 'unknown', session: s };
  }

  // ── PostgREST ──

  async select(table: string, query: string): Promise<any[]> {
    const token = await this.accessToken();
    if (!token) throw new SupabaseError('Not signed in.', 401);
    return this.request(`/rest/v1/${table}?${query}`, { headers: this.headers(token) });
  }

  async upsert(table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void> {
    if (!rows.length) return;
    const token = await this.accessToken();
    if (!token) throw new SupabaseError('Not signed in.', 401);
    await this.request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: 'POST',
      headers: { ...this.headers(token), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: rows,
    });
  }

  /** Connectivity check against a public table (used by the settings page). */
  async ping(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.request('/rest/v1/achievements?select=id&limit=1');
      return { ok: true, message: 'Connected to Supabase.' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Connection failed.' };
    }
  }
}
