/** Dark/light theme: a per-device preference applied as a class on <html>. */
import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'gma.theme';
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch { /* storage unavailable */ }
  return 'dark';
}

let current: Theme = typeof window === 'undefined' ? 'dark' : read();

export function applyTheme(t: Theme = current) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('light', t === 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f3f2fb' : '#262046');
}

export function setTheme(t: Theme) {
  current = t;
  try { localStorage.setItem(KEY, t); } catch { /* not persisted */ }
  applyTheme(t);
  listeners.forEach((l) => l());
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const t = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current, () => 'dark' as Theme);
  return [t, setTheme];
}
