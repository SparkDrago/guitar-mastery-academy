/**
 * Lightweight SVG charts (single series, one accent hue validated against the
 * dark surface). Every chart has a hover tooltip and a text alternative.
 */
import { useState, type ReactNode } from 'react';

/** Data-mark colours (validated per theme; see --color-viz-* in app.css). */
export const VIZ = ['var(--color-viz-1)', 'var(--color-viz-2)', 'var(--color-viz-3)', 'var(--color-viz-4)', 'var(--color-viz-5)'] as const;
const ACCENT = VIZ[0];
const GRID = '#40386f';
const AXIS = '#8780b4';

export interface Point { label: string; value: number; detail?: string }

export function BarChart({ data, height = 160, unit = '', title }: { data: Point[]; height?: number; unit?: string; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const left = 34;
  const bottom = 22;
  const top = 10;
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const bw = (W - left - 8) / Math.max(1, data.length);
  const y = (v: number) => top + (height - top - bottom) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - 4} y1={y(t)} y2={y(t)} className="svg-grid" stroke={GRID} strokeWidth="1" />
            <text x={left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" className="svg-axis" fill={AXIS}>{Math.round(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = y(0) - y(d.value);
          const x = left + i * bw + 1;
          const w = Math.max(2, bw - 2);
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={left + i * bw} y={top} width={bw} height={height - top - bottom} fill="transparent" />
              {d.value > 0 && <path d={roundedTop(x, y(d.value), w, h, Math.min(4, w / 2))} style={{ fill: ACCENT }} opacity={hover === null || hover === i ? 1 : 0.45} />}
              {(data.length <= 14 || i % Math.ceil(data.length / 7) === 0) && <text x={x + w / 2} y={height - 6} textAnchor="middle" fontSize="9.5" className="svg-axis" fill={AXIS}>{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 shadow-lg" style={{ left: `${((left + hover * bw + bw / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          <div className="font-medium">{data[hover].label}</div>
          <div className="tabular-nums text-ink-300">{data[hover].value}{unit}{data[hover].detail ? ` · ${data[hover].detail}` : ''}</div>
        </div>
      )}
    </figure>
  );
}

export function LineChart({ data, height = 160, unit = '', title, min }: { data: Point[]; height?: number; unit?: string; title: string; min?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const left = 38;
  const bottom = 22;
  const top = 12;
  if (!data.length) return null;
  const lo = min ?? Math.min(...data.map((d) => d.value));
  const hiRaw = Math.max(...data.map((d) => d.value));
  const hi = hiRaw === lo ? lo + 1 : hiRaw;
  const x = (i: number) => left + (data.length === 1 ? (W - left - 10) / 2 : (i * (W - left - 10)) / (data.length - 1));
  const y = (v: number) => top + (height - top - bottom) * (1 - (v - lo) / (hi - lo));
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(', ')}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          data.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
          setHover(best);
        }}>
        {[lo, (lo + hi) / 2, hi].map((t, k) => (
          <g key={k}>
            <line x1={left} x2={W - 4} y1={y(t)} y2={y(t)} className="svg-grid" stroke={GRID} strokeWidth="1" />
            <text x={left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" className="svg-axis" fill={AXIS}>{Math.round(t)}</text>
          </g>
        ))}
        <path d={path} fill="none" style={{ stroke: ACCENT }} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? 5 : 3.5} style={{ fill: ACCENT }} className="svg-dot-ring" strokeWidth="2" />)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} className="svg-axis" style={{ stroke: 'var(--color-ink-400)' }} strokeDasharray="3 3" strokeWidth="1" />}
        {data.map((d, i) => (i === 0 || i === data.length - 1 || (data.length <= 8)) && <text key={`l${i}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize="9.5" className="svg-axis" fill={AXIS}>{d.label}</text>)}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 shadow-lg" style={{ left: `${(x(hover) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          <div className="font-medium">{data[hover].label}</div>
          <div className="tabular-nums text-ink-300">{data[hover].value}{unit}{data[hover].detail ? ` · ${data[hover].detail}` : ''}</div>
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars for category breakdowns, labelled directly. */
export function HBars({ data, unit = '', format }: { data: Point[]; unit?: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3 text-sm" title={d.detail}>
          <span className="truncate text-ink-200">{d.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-ink-950">
            <span className="block h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: ACCENT }} />
          </span>
          <span className="tabular-nums text-xs text-ink-300">{format ? format(d.value) : `${d.value}${unit}`}</span>
        </li>
      ))}
    </ul>
  );
}

function niceMax(v: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/** Donut progress ring with the value in the middle (single value; the number is always printed). */
export function Ring({ value, label, color = VIZ[0], size = 112, stroke = 11, children }: { value: number; label: string; color?: string; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(v * 100)}%`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="svg-track" stroke="#1d1839" strokeWidth={stroke} />
        {v > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: color, transition: 'stroke-dashoffset 600ms ease' }} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children ?? <span className="text-2xl font-semibold tabular-nums text-ink-50">{Math.round(v * 100)}%</span>}</div>
    </div>
  );
}

/** Thin vertical bars on full-height tracks (e.g. minutes per weekday), with hover values. */
export function TrackBars({ data, unit = '', title, height = 170 }: { data: Point[]; unit?: string; title: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="relative" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(', ')}`} role="img">
      <div className="flex items-end justify-between gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div key={d.label + i} className="flex h-full flex-1 flex-col items-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="relative w-2.5 flex-1 overflow-hidden rounded-full bg-ink-950">
              <div className="absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500" style={{ height: `${(d.value / max) * 100}%`, background: VIZ[0], opacity: hover === null || hover === i ? 1 : 0.5 }} />
            </div>
            <span className="mt-2 text-[11px] text-ink-400">{d.label}</span>
          </div>
        ))}
      </div>
      {hover !== null && (
        <div className="pointer-events-none absolute -top-2 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 shadow-lg" style={{ left: `${((hover + 0.5) / data.length) * 100}%`, transform: 'translate(-50%, -100%)' }}>
          <span className="font-medium">{data[hover].label}</span> <span className="tabular-nums text-ink-300">{data[hover].value}{unit}{data[hover].detail ? ` · ${data[hover].detail}` : ''}</span>
        </div>
      )}
    </figure>
  );
}

/** Smooth area chart (single series) with crosshair and tooltip. */
export function AreaChart({ data, height = 200, unit = '', title }: { data: Point[]; height?: number; unit?: string; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 680, left = 34, bottom = 24, top = 12, right = 8;
  if (data.length < 2) return null;
  const hi = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const x = (i: number) => left + (i * (W - left - right)) / (data.length - 1);
  const y = (v: number) => top + (height - top - bottom) * (1 - v / hi);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  // Monotone cubic interpolation keeps the curve from overshooting below zero.
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const m = pts.map((_, i) => (i === 0 ? slope[0] : i === n - 1 ? slope[n - 2] : slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2));
  let line = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    line += ` C${pts[i][0] + h},${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  const area = `${line} L${pts[n - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`;
  const gid = 'area-' + title.replace(/[^a-z]/gi, '').slice(0, 12);
  const step = Math.ceil(data.length / 12);
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(', ')}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          setHover(Math.max(0, Math.min(n - 1, Math.round(((px - left) / (W - left - right)) * (n - 1)))));
        }}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: ACCENT, stopOpacity: 0.35 }} />
            <stop offset="1" style={{ stopColor: ACCENT, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {[0, hi / 2, hi].map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} className="svg-grid" stroke={GRID} strokeWidth="1" />
            <text x={left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" className="svg-axis" fill={AXIS}>{Math.round(t)}</text>
          </g>
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" style={{ stroke: ACCENT }} strokeWidth="2.2" strokeLinecap="round" />
        {hover !== null && <>
          <line x1={x(hover)} x2={x(hover)} y1={top} y2={height - bottom} style={{ stroke: 'var(--color-ink-400)' }} strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(data[hover].value)} r="5" style={{ fill: ACCENT }} className="svg-dot-ring" strokeWidth="2" />
        </>}
        {data.map((d, i) => (i % step === 0 || i === n - 1) && <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" className="svg-axis" fill={AXIS}>{d.label}</text>)}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 shadow-lg" style={{ left: `${(x(hover) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          <div className="font-medium">{data[hover].label}</div>
          <div className="tabular-nums text-ink-300">{data[hover].value}{unit}{data[hover].detail ? ` · ${data[hover].detail}` : ''}</div>
        </div>
      )}
    </figure>
  );
}
