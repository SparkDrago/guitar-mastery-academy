/** Design-system primitives. Small, accessible, dark-first. */
import { Component, useEffect, useId, type ReactNode } from 'react';
import { LuX, LuCircleCheck, LuInfo, LuTriangleAlert } from 'react-icons/lu';
import { cx } from '@/lib/core';
import { store } from '@/lib/store';
import { useStore } from '@/lib/hooks';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

export function Button({ children, onClick, variant = 'secondary', size = 'md', disabled, type = 'button', className, title, active, ...rest }: {
  children?: ReactNode; onClick?: () => void; variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; disabled?: boolean; type?: 'button' | 'submit';
  className?: string; title?: string; active?: boolean; 'aria-label'?: string; 'aria-pressed'?: boolean; 'data-testid'?: string;
}) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-accent-500 text-white hover:bg-accent-600 border-transparent shadow-[0_8px_20px_-10px_rgb(122_92_242/0.9)]',
    secondary: 'bg-ink-800 text-ink-100 hover:bg-ink-700 border-ink-700',
    ghost: 'bg-transparent text-ink-200 hover:bg-ink-800 border-transparent',
    danger: 'bg-transparent text-bad-400 hover:bg-bad-400/10 border-bad-400/40',
    success: 'bg-ok-500 text-white hover:brightness-110 border-transparent',
  };
  const s = { sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg', md: 'h-10 px-4 text-sm gap-2 rounded-xl', lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl' }[size];
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      className={cx('inline-flex items-center justify-center border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40', v[variant], s, active && 'ring-2 ring-accent-500/60', className)} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, className, title, action, subtitle, ...rest }: { children?: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; 'data-testid'?: string }) {
  return (
    <section className={cx('card', className)} {...rest}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-[17px] font-semibold leading-snug text-ink-50">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx('card-pad', !!(title || action) && '!pt-4')}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium text-accent-300">{eyebrow}</div>}
        <h1 className="text-[26px] font-semibold leading-tight text-ink-50 sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', solid, className }: { children?: ReactNode; tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'cyan'; solid?: boolean; className?: string }) {
  const t = solid ? {
    neutral: 'bg-ink-600 text-ink-50', accent: 'bg-accent-500 text-white', ok: 'bg-ok-500 text-white',
    warn: 'bg-warn-500 text-white', bad: 'bg-bad-400 text-white', cyan: 'bg-cyan-400 text-white',
  }[tone] : {
    neutral: 'bg-ink-700 text-ink-200', accent: 'bg-accent-500/15 text-accent-300',
    ok: 'bg-ok-500/15 text-ok-400', warn: 'bg-warn-500/15 text-warn-400',
    bad: 'bg-bad-400/15 text-bad-400', cyan: 'bg-cyan-400/15 text-cyan-400',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', t, className)}>{children}</span>;
}

export function Field({ label, children, hint, className }: { label: string; children?: ReactNode; hint?: string; className?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex flex-col gap-1.5', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

export function Select<T extends string>({ value, onChange, options, className, ...rest }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; group?: string }[]; className?: string; 'aria-label'?: string; 'data-testid'?: string;
}) {
  const groups = [...new Set(options.map((o) => o.group ?? ''))];
  return (
    <select className={cx('select', className)} value={value} onChange={(e) => onChange((e.target as HTMLSelectElement).value as T)} {...rest}>
      {groups.map((g) =>
        g ? (
          <optgroup key={g} label={g}>
            {options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        ) : (
          options.filter((o) => !o.group).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
        ),
      )}
    </select>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', ...rest }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'md'; 'aria-label'?: string; 'data-testid'?: string }) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap gap-0.5 rounded-xl bg-ink-900 p-1" {...rest}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-lg font-medium transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm', value === o.value ? 'bg-accent-500 text-white shadow-[0_6px_14px_-8px_rgb(122_92_242/0.9)]' : 'text-ink-300 hover:text-ink-50')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm text-ink-200">
      <span className={cx('relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent-500' : 'bg-ink-600')}>
        <span className={cx('absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
      {label}
    </button>
  );
}

export function Stepper({ value, onChange, min, max, step = 1, label, suffix }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; label?: string; suffix?: string }) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)));
  return (
    <div className="inline-flex items-center rounded-xl border border-ink-700 bg-ink-800" aria-label={label}>
      <button type="button" className="h-9 w-9 text-lg text-ink-200 hover:text-ink-50" onClick={() => set(value - step)} aria-label={`Decrease ${label ?? ''}`}>−</button>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => set(Number((e.target as HTMLInputElement).value))}
        className="h-9 w-14 bg-transparent text-center text-sm tabular-nums text-ink-50 outline-none [appearance:textfield]" aria-label={label} />
      {suffix && <span className="pr-1 text-xs text-ink-400">{suffix}</span>}
      <button type="button" className="h-9 w-9 text-lg text-ink-200 hover:text-ink-50" onClick={() => set(value + step)} aria-label={`Increase ${label ?? ''}`}>+</button>
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent', className, label }: { value: number; tone?: 'accent' | 'ok' | 'warn'; className?: string; label?: string }) {
  const c = { accent: 'bg-accent-500', ok: 'bg-ok-500', warn: 'bg-warn-500' }[tone];
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-ink-950', className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-label={label}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', c)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        {icon && <span className="text-ink-400">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-ink-50">{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-300">{hint}</div>}
    </div>
  );
}

export function Empty({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-600 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-ink-400">{icon}</div>}
      <div className="font-medium text-ink-100">{title}</div>
      {body && <p className="mt-1 max-w-md text-sm text-ink-300">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Callout({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'ok' | 'theory' | 'source'; children?: ReactNode; title?: string }) {
  const map = {
    info: ['border-cyan-400/30 bg-cyan-400/5', 'text-cyan-400', LuInfo],
    warn: ['border-warn-500/30 bg-warn-500/5', 'text-warn-400', LuTriangleAlert],
    ok: ['border-ok-500/30 bg-ok-500/5', 'text-ok-400', LuCircleCheck],
    theory: ['border-accent-500/30 bg-accent-500/5', 'text-accent-300', LuInfo],
    source: ['border-ink-500 bg-ink-800/60', 'text-ink-300', LuInfo],
  } as const;
  const [box, ic, Icon] = map[tone];
  return (
    <div className={cx('my-3 flex gap-3 rounded-xl border px-4 py-3 text-sm', box)}>
      <Icon className={cx('mt-0.5 shrink-0', ic)} size={16} aria-hidden />
      <div className="text-ink-200">
        {title && <div className="mb-0.5 font-medium text-ink-50">{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('card max-h-[92vh] w-full overflow-y-auto rounded-b-none sm:rounded-b-[var(--radius-card)]', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pb-1 pt-5">
          <h2 className="text-lg font-semibold text-ink-50">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-300 hover:bg-ink-700 hover:text-ink-50" aria-label="Close"><LuX size={18} /></button>
        </div>
        <div className="p-6 pt-4">{children}</div>
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2 lg:bottom-4" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cx('card pointer-events-auto flex items-start gap-3 px-4 py-3', 'border border-ink-700', t.tone === 'success' && '!border-ok-500/40', t.tone === 'warning' && '!border-warn-500/40')}>
          {t.tone === 'success' ? <LuCircleCheck className="mt-0.5 shrink-0 text-ok-400" size={18} /> : t.tone === 'warning' ? <LuTriangleAlert className="mt-0.5 shrink-0 text-warn-400" size={18} /> : <LuInfo className="mt-0.5 shrink-0 text-accent-300" size={18} />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink-50">{t.title}</div>
            {t.body && <div className="mt-0.5 text-xs text-ink-300">{t.body}</div>}
          </div>
          <button type="button" onClick={() => store.dismissToast(t.id)} className="text-ink-400 hover:text-ink-50" aria-label="Dismiss"><LuX size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export class ErrorBoundary extends Component<{ children?: ReactNode; label?: string }, { error: Error | null }> {
  constructor(props: { children?: ReactNode; label?: string }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    if (this.state.error)
      return (
        <div className="card card-pad m-4 border-bad-400/40" role="alert">
          <div className="font-semibold text-bad-400">Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}.</div>
          <p className="mt-1 text-sm text-ink-300">{this.state.error.message}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => this.setState({ error: null })}>Try again</Button>
            <Button size="sm" variant="ghost" onClick={() => window.location.assign('/')}>Go to dashboard</Button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

export function Kbd({ children }: { children?: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
