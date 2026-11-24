import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  LuGauge, LuMenu, LuX, LuCloud, LuCloudOff, LuRefreshCw, LuLayoutDashboard, LuRoute, LuCalendar, LuUser, LuSearch, LuBell, LuBookOpen, LuSlidersHorizontal,
} from 'react-icons/lu';
import { dueCards } from '@gma/learning';
import { LESSONS } from '@content/lessons/index';
import { GLOSSARY } from '@content/glossary';
import { NAV } from '@/lib/nav';
import { Link, navigate, useLocation } from '@/lib/router';
import { cx } from '@/lib/core';
import { useStore, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { useTheme } from '@/lib/theme';

function isActive(path: string, to: string) {
  return to === '/' ? path === '/' : path === to || path.startsWith(to + '/');
}

/** Brand mark: three strings crossing a fret, drawn for this app. */
function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#ff7a59] to-[#e0567f] text-white shadow-[0_8px_18px_-10px_rgb(224_86_127/0.9)]">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M5 19 L15 5 M8.5 19 L18.5 5 M12 19 L21 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" /><path d="M3 12.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" /></svg>
      </span>
      {!compact && <span className="text-[19px] font-bold italic leading-none tracking-tight text-ink-50">Guitar<span className="text-accent-300">Mastery</span></span>}
    </span>
  );
}

function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" role="switch" aria-checked={dark} onClick={() => setTheme(dark ? 'light' : 'dark')} className="flex items-center gap-3 rounded-lg px-1 py-1 text-xs text-ink-400 hover:text-ink-100" data-testid="theme-switch">
      <span className={cx('relative inline-block h-7 w-12 shrink-0 rounded-full transition-colors', dark ? 'bg-accent-500' : 'bg-ink-600')}>
        <span className={cx('absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform', dark ? 'translate-x-6' : 'translate-x-1')} />
      </span>
      Dark theme
    </button>
  );
}

function useNavCounts(): Record<string, number> {
  const s = useStudent();
  return useMemo(() => ({
    '/lessons': Object.values(s.lessons).filter((l) => l.status === 'in_progress').length,
    '/progress': dueCards(s, new Date()).length,
    '/tab-editor': s.exercises.length,
  }), [s.lessons, s.srs, s.exercises]);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { path } = useLocation();
  const counts = useNavCounts();
  return (
    <nav aria-label="Main" className="flex flex-col gap-3.5 pb-4">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="mb-1 px-7 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-400">{g.group}</div>
          <ul>
            {g.items.map((it) => {
              const Icon = it.icon;
              const active = isActive(path, it.to);
              const n = counts[it.to] ?? 0;
              return (
                <li key={it.to}>
                  <Link to={it.to} onClick={onNavigate} aria-current={active ? 'page' : undefined}
                    className={cx('relative flex items-center gap-3 px-7 py-2 text-[14px] transition-colors',
                      active ? 'bg-ink-850 font-medium text-ink-50 after:absolute after:inset-y-0 after:right-0 after:w-[3px] after:rounded-l after:bg-ok-400' : 'text-ink-300 hover:bg-ink-850/50 hover:text-ink-50')}>
                    <Icon size={17} className={active ? 'text-ink-50' : 'text-ink-400'} aria-hidden />
                    <span className="flex-1">{it.label}</span>
                    {n > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ok-500 px-1.5 text-[10px] font-semibold text-white">{n}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SyncBadge() {
  const { auth } = useStore();
  if (!auth.configured) return <span className="hidden items-center gap-1.5 text-xs text-ink-400 xl:inline-flex" title="Progress is saved in this browser. Accounts are available once Supabase is configured."><LuCloudOff size={14} /> Saved on this device</span>;
  if (!auth.session) return <Link to="/settings" className="hidden items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-300 hover:bg-ink-850 hover:text-ink-50 sm:inline-flex"><LuUser size={14} /> Sign in to sync</Link>;
  return (
    <button type="button" onClick={() => void store.syncNow()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-300 hover:bg-ink-850" title={auth.error ? `Sync error: ${auth.error}` : auth.lastSyncAt ? `Last synced ${new Date(auth.lastSyncAt).toLocaleTimeString()}` : 'Not yet synced'}>
      {auth.syncing ? <LuRefreshCw size={14} className="animate-spin" /> : <LuCloud size={14} className={auth.error ? 'text-warn-400' : 'text-ok-400'} />}
      <span className="hidden sm:inline">{auth.syncing ? 'Syncing…' : auth.error ? 'Sync paused' : auth.pending ? `${auth.pending} to sync` : 'Synced'}</span>
    </button>
  );
}

interface Hit { label: string; detail: string; to: string; kind: 'Page' | 'Lesson' | 'Term' }

const SEARCH_INDEX: Hit[] = [
  ...NAV.flatMap((g) => g.items.map((it) => ({ label: it.label, detail: it.description, to: it.to, kind: 'Page' as const }))),
  ...LESSONS.map((l) => ({ label: l.title, detail: `Level ${l.level} lesson`, to: `/lessons/${l.id}`, kind: 'Lesson' as const })),
  ...GLOSSARY.map((g) => ({ label: g.term, detail: g.definition, to: `/theory?tab=glossary&q=${encodeURIComponent(g.term)}`, kind: 'Term' as const })),
];

/** Site search over pages, lessons and glossary terms. */
function Search({ className }: { className?: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const box = useRef<HTMLDivElement | null>(null);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const score = (h: Hit) => (h.label.toLowerCase().startsWith(t) ? 0 : h.label.toLowerCase().includes(t) ? 1 : 2) + (h.kind === 'Page' ? 0 : h.kind === 'Lesson' ? 0.1 : 0.2);
    return SEARCH_INDEX.filter((h) => h.label.toLowerCase().includes(t) || (h.kind !== 'Term' && h.detail.toLowerCase().includes(t))).sort((a, b) => score(a) - score(b)).slice(0, 8);
  }, [q]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    const h = (e: globalThis.MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const go = (h: Hit) => { navigate(h.to); setQ(''); setOpen(false); };
  return (
    <div ref={box} className={cx('relative', className)}>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search lessons, tools, terms…" aria-label="Search"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(hits.length - 1, x + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)); }
          else if (e.key === 'Enter' && hits[sel]) go(hits[sel]);
          else if (e.key === 'Escape') setOpen(false);
        }}
        className="h-11 w-full rounded-xl border border-transparent bg-ink-850 pl-4 pr-10 text-sm text-ink-100 placeholder:text-ink-400 focus:border-accent-500 focus:outline-none" data-testid="site-search" />
      <LuSearch size={16} className="pointer-events-none absolute right-3.5 top-3.5 text-ink-400" />
      {open && hits.length > 0 && (
        <ul className="card absolute inset-x-0 top-12 z-40 overflow-hidden border border-ink-700 py-1" role="listbox">
          {hits.map((h, i) => (
            <li key={h.kind + h.to + h.label} role="option" aria-selected={i === sel}>
              <button type="button" onMouseEnter={() => setSel(i)} onClick={() => go(h)} className={cx('flex w-full items-center gap-3 px-4 py-2 text-left', i === sel && 'bg-ink-800')}>
                <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-ink-400">{h.kind}</span>
                <span className="min-w-0"><span className="block truncate text-sm text-ink-50">{h.label}</span><span className="block truncate text-xs text-ink-400">{h.detail}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HeaderIcons() {
  const s = useStudent();
  const due = dueCards(s, new Date()).length;
  const initials = s.profile.displayName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'G';
  return (
    <div className="flex items-center gap-2">
      <SyncBadge />
      <Link to="/tuner" className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink-850 px-3.5 text-sm font-medium text-ink-100 hover:text-ink-50 hover:bg-ink-800" aria-label="Open tuner" data-testid="header-tuner">
        <LuGauge size={18} className="text-accent-300" /> <span className="hidden sm:inline">Tuner</span>
      </Link>
      <Link to="/settings" className="hidden h-11 w-11 place-items-center rounded-xl bg-ink-850 text-ink-300 hover:text-ink-50 sm:grid" aria-label="Settings"><LuSlidersHorizontal size={18} /></Link>
      <Link to={due ? '/progress?review=1' : '/progress'} className="relative grid h-11 w-11 place-items-center rounded-xl bg-ink-850 text-ink-300 hover:text-ink-50" aria-label={due ? `${due} reviews due` : 'No reviews due'} title={due ? `${due} lesson review${due > 1 ? 's' : ''} due` : 'No reviews due'}>
        <LuBell size={18} />
        {due > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ok-500 px-1 text-[10px] font-semibold text-white ring-2 ring-ink-900">{due}</span>}
      </Link>
      <Link to="/settings" className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-accent-500 to-[#e0567f] text-sm font-semibold text-white" aria-label="Profile and settings" title={s.profile.displayName}>{initials}</Link>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { path } = useLocation();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-sidebar lg:flex">
        <Link to="/" className="px-7 pb-5 pt-6" aria-label="Guitar Mastery Academy home"><Logo /></Link>
        <div className="min-h-0 flex-1 overflow-y-auto"><Sidebar /></div>
        <div className="border-t border-ink-700/60 px-6 py-4"><ThemeSwitch /></div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 bg-ink-900/90 backdrop-blur">
          <div className="mx-auto flex h-[76px] max-w-[1280px] items-center gap-3 px-4 sm:px-8">
            <button type="button" className="rounded-xl p-2 text-ink-200 hover:bg-ink-850 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><LuMenu size={22} /></button>
            <Link to="/" className="lg:hidden" aria-label="Home"><Logo compact /></Link>
            <Search className="hidden max-w-md flex-1 md:block" />
            <div className="flex-1" />
            <HeaderIcons />
          </div>
          <div className="mx-auto max-w-[1280px] px-4 sm:px-8"><div className="h-px bg-ink-700/60" /></div>
        </header>
        <main id="main" className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-8 lg:pb-14">{children}</main>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[80%] max-w-[300px] flex-col bg-sidebar">
            <div className="flex items-center justify-between px-6 pb-4 pt-5"><Logo /><button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-ink-300 hover:bg-ink-850"><LuX size={18} /></button></div>
            <div className="px-5 pb-3"><Search /></div>
            <div className="min-h-0 flex-1 overflow-y-auto"><Sidebar onNavigate={() => setOpen(false)} /></div>
            <div className="border-t border-ink-700/60 px-6 py-4"><ThemeSwitch /></div>
          </div>
        </div>
      )}

      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-700/60 bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {[
          { to: '/', label: 'Home', icon: LuLayoutDashboard },
          { to: '/path', label: 'Path', icon: LuRoute },
          { to: '/tuner', label: 'Tuner', icon: LuGauge },
          { to: '/practice', label: 'Practice', icon: LuCalendar },
          { to: '/lessons', label: 'Lessons', icon: LuBookOpen },
        ].map((it) => {
          const Icon = it.icon;
          const active = isActive(path, it.to);
          return (
            <Link key={it.to} to={it.to} className={cx('flex flex-col items-center gap-0.5 py-2.5 text-[11px]', active ? 'text-accent-300' : 'text-ink-400')}>
              <Icon size={20} aria-hidden />{it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
