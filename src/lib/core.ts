/** Configuration, ids, formatting and small shared helpers. */
declare const __GMA_CONFIG__: { supabaseUrl: string; supabaseAnonKey: string; siteUrl: string; version: string };

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  version: string;
}

/** Build-time config, optionally overridden at runtime by window.GMA_CONFIG (for self-hosting). */
export function getConfig(): AppConfig {
  const base = typeof __GMA_CONFIG__ !== 'undefined' ? __GMA_CONFIG__ : { supabaseUrl: '', supabaseAnonKey: '', siteUrl: '', version: 'dev' };
  const override = (globalThis as { GMA_CONFIG?: Partial<AppConfig> }).GMA_CONFIG ?? {};
  return { ...base, ...override };
}

export function uid(prefix = ''): string {
  const rnd = (globalThis.crypto && 'randomUUID' in globalThis.crypto) ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${rnd}` : rnd;
}

export const nowIso = () => new Date().toISOString();

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function fmtMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function relativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function download(filename: string, text: string, type = 'text/plain'): void {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
