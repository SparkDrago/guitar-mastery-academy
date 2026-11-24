/** Minimal History-API router (no dependency), with query-string helpers. */
import { useEffect, useSyncExternalStore, type ReactNode, type MouseEvent } from 'react';

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') window.addEventListener('popstate', notify);

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getLocation = () => (typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search);

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (to === getLocation()) return;
  if (opts.replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  notify();
  window.scrollTo({ top: 0 });
}

export function useLocation(): { path: string; query: URLSearchParams; href: string } {
  const href = useSyncExternalStore(subscribe, getLocation, () => '/');
  const url = new URL(href, 'http://x');
  return { path: url.pathname.replace(/\/+$/, '') || '/', query: url.searchParams, href };
}

/** Match "/lessons/:id" style patterns. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function Link({ to, children, className, title, onClick, ...rest }: { to: string; children?: ReactNode; className?: string; title?: string; onClick?: () => void; 'aria-current'?: 'page' | undefined; 'aria-label'?: string; 'data-testid'?: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onClick?.();
    navigate(to);
  };
  return (
    <a href={to} className={className} title={title} onClick={handle} {...rest}>
      {children}
    </a>
  );
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Guitar Mastery Academy` : 'Guitar Mastery Academy';
  }, [title]);
}
