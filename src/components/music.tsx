/** Music visualisations: fretboard, chord diagram, tab view, Pillitiere pattern. */
import { useMemo, useState, type ReactNode } from 'react';
import {
  DOUBLE_INLAY_FRETS, INLAY_FRETS, buildPillitierePattern, midiAt, mod, parseNote, pcName, pcOf, type Tuning, type Voicing,
} from '@gma/theory';
import { toAscii, type TabScore } from '@gma/notation';
import { cx } from '@/lib/core';

export type MarkTone = 'root' | 'tone' | 'target' | 'chord' | 'correct' | 'wrong' | 'ghost' | 'focus';

export interface FretMark {
  string: number;
  fret: number;
  label?: string;
  tone?: MarkTone;
  title?: string;
}

const TONE_STYLE: Record<MarkTone, { fill: string; stroke: string; text: string }> = {
  root: { fill: '#8466f5', stroke: '#c4b6ff', text: '#fff' },
  tone: { fill: '#3a3360', stroke: '#6b6396', text: '#efedfb' },
  chord: { fill: '#5cc8ff', stroke: '#a8e2ff', text: '#0b0c0e' },
  target: { fill: '#ffb547', stroke: '#ffd699', text: '#0b0c0e' },
  correct: { fill: '#22c06d', stroke: '#7ce8ad', text: '#0b0c0e' },
  wrong: { fill: '#ff6b6b', stroke: '#ffb0b0', text: '#0b0c0e' },
  ghost: { fill: 'transparent', stroke: '#6b6396', text: '#a7a1cd' },
  focus: { fill: '#e7e4de', stroke: '#ffffff', text: '#0b0c0e' },
};

export function Fretboard({
  tuning, minFret = 0, maxFret = 15, marks = [], onPick, leftHanded = false, noteNames = 'none', flats = false,
  onlyString, className, ariaLabel, testId,
}: {
  tuning: Tuning; minFret?: number; maxFret?: number; marks?: FretMark[]; onPick?: (p: { string: number; fret: number }) => void;
  leftHanded?: boolean; noteNames?: 'none' | 'all' | 'naturals'; flats?: boolean; onlyString?: number; className?: string; ariaLabel?: string; testId?: string;
}) {
  const n = tuning.strings.length;
  const showOpen = minFret === 0;
  const first = Math.max(1, minFret);
  const frets = Math.max(0, maxFret - first + 1);
  const openW = showOpen ? 40 : 14;
  const fretW = frets > 15 ? 50 : 58;
  const gap = n > 6 ? 24 : 27;
  const top = 22;
  const W = openW + frets * fretW + 16;
  const H = top + (n - 1) * gap + 30;
  const yOf = (s: number) => top + (n - 1 - s) * gap; // high string on top
  const xRaw = (f: number) => (f === 0 ? openW / 2 : openW + (f - first) * fretW + fretW / 2);
  const x = (f: number) => (leftHanded ? W - xRaw(f) : xRaw(f));
  const lineX = (i: number) => { const v = openW + i * fretW; return leftHanded ? W - v : v; };

  const markMap = new Map(marks.map((m) => [`${m.string}:${m.fret}`, m]));
  const cells: { s: number; f: number }[] = [];
  for (let s = 0; s < n; s++) for (let f = showOpen ? 0 : first; f <= maxFret; f++) cells.push({ s, f });

  return (
    <div className={cx('overflow-x-auto rounded-xl border border-ink-700 bg-[#1a1533]', className)} data-testid={testId}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: Math.min(W, 640), width: '100%', maxWidth: Math.max(W * 1.25, 720), margin: '0 auto', display: 'block' }} role="img" aria-label={ariaLabel ?? `Fretboard, ${n} strings, frets ${minFret} to ${maxFret}`}>
        <defs>
          <linearGradient id="fbwood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1d1a17" />
            <stop offset="1" stopColor="#161412" />
          </linearGradient>
        </defs>
        <rect x={leftHanded ? 16 : openW} y={top - 10} width={frets * fretW} height={(n - 1) * gap + 20} fill="url(#fbwood)" rx="3" />
        {Array.from({ length: frets }, (_, i) => first + i).map((f) => {
          const cx0 = x(f);
          const cy = top + ((n - 1) * gap) / 2;
          if (DOUBLE_INLAY_FRETS.includes(f)) return <g key={`in${f}`}><circle cx={cx0} cy={cy - gap} r="4" fill="#2a2724" /><circle cx={cx0} cy={cy + gap} r="4" fill="#2a2724" /></g>;
          if (INLAY_FRETS.includes(f)) return <circle key={`in${f}`} cx={cx0} cy={cy} r="4.5" fill="#2a2724" />;
          return null;
        })}
        {Array.from({ length: frets + 1 }, (_, i) => (
          <line key={`f${i}`} x1={lineX(i)} x2={lineX(i)} y1={top - 10} y2={top + (n - 1) * gap + 10} stroke={i === 0 && showOpen ? '#d9d2c3' : '#4a4640'} strokeWidth={i === 0 && showOpen ? 5 : 1.6} />
        ))}
        {tuning.strings.map((_, s) => (
          <line key={`s${s}`} x1={leftHanded ? 6 : openW - (showOpen ? 6 : 0)} x2={leftHanded ? W - openW + (showOpen ? 6 : 0) : W - 6} y1={yOf(s)} y2={yOf(s)}
            stroke={onlyString === s ? '#9d90ff' : '#9a958c'} strokeOpacity={onlyString !== undefined && onlyString !== s ? 0.35 : 0.9} strokeWidth={0.9 + Math.max(0, 3 - s) * 0.35} />
        ))}
        {Array.from({ length: frets }, (_, i) => first + i).filter((f) => f % 2 === 1 || f === 12).map((f) => (
          <text key={`fn${f}`} x={x(f)} y={H - 6} textAnchor="middle" fontSize="10" fill="#7e76ad" fontFamily="var(--font-mono)">{f}</text>
        ))}
        {cells.map(({ s, f }) => {
          const m = markMap.get(`${s}:${f}`);
          const midi = midiAt(tuning, s, f);
          const pc = mod(midi, 12);
          const showName = !m && (noteNames === 'all' || (noteNames === 'naturals' && [0, 2, 4, 5, 7, 9, 11].includes(pc)));
          const disabled = onlyString !== undefined && onlyString !== s;
          return (
            <g key={`${s}:${f}`}>
              {onPick && !disabled && (
                <rect x={x(f) - (f === 0 ? openW / 2 : fretW / 2)} y={yOf(s) - gap / 2} width={f === 0 ? openW : fretW} height={gap}
                  fill="transparent" className="cursor-pointer hover:fill-white/5" role="button" aria-label={`String ${n - s}, fret ${f}`}
                  data-pos={`${s}-${f}`} onClick={() => onPick({ string: s, fret: f })} />
              )}
              {showName && <text x={x(f)} y={yOf(s) + 3.5} textAnchor="middle" fontSize="9.5" fill="#8780b4" pointerEvents="none">{pcName(pc, flats)}</text>}
              {m && (() => {
                const st = TONE_STYLE[m.tone ?? 'tone'];
                return (
                  <g pointerEvents="none">
                    <title>{m.title ?? `${pcName(pc, flats)} (string ${n - s}, fret ${f})`}</title>
                    <circle cx={x(f)} cy={yOf(s)} r={10.5} fill={st.fill} stroke={st.stroke} strokeWidth="1.5" />
                    {m.label && <text x={x(f)} y={yOf(s) + 3.8} textAnchor="middle" fontSize={m.label.length > 2 ? 8.5 : 10.5} fontWeight="600" fill={st.text}>{m.label}</text>}
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Vertical chord diagram (low string on the left). */
export function ChordDiagram({ voicing, tuning, title, labels = 'finger', size = 1 }: { voicing: Voicing; tuning: Tuning; title?: string; labels?: 'finger' | 'interval' | 'note'; size?: number }) {
  const n = voicing.frets.length;
  const fretted = voicing.frets.filter((f): f is number => f !== null && f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const base = maxF <= 4 ? 1 : Math.min(...fretted);
  const rows = Math.max(4, (fretted.length ? maxF - base + 1 : 4));
  const sw = 18;
  const fh = 22;
  const left = 22;
  const top = 26;
  const W = left + (n - 1) * sw + 22;
  const H = top + rows * fh + 16;
  const xs = (s: number) => left + s * sw;
  return (
    <figure className="flex flex-col items-center">
      {title && <figcaption className="mb-1 text-sm font-semibold text-ink-50">{title}</figcaption>}
      <svg viewBox={`0 0 ${W} ${H}`} width={W * size} height={H * size} role="img" aria-label={`${title ?? 'Chord'} diagram: ${voicing.frets.map((f) => (f === null ? 'x' : f)).join(' ')}`}>
        {base === 1 ? <rect x={xs(0) - 1} y={top - 4} width={(n - 1) * sw + 2} height={4} style={{ fill: 'var(--color-ink-200)' }} rx="1" /> : <text x={4} y={top + fh * 0.65} fontSize="10" className="svg-axis">{base}fr</text>}
        {Array.from({ length: rows + 1 }, (_, i) => <line key={`r${i}`} x1={xs(0)} x2={xs(n - 1)} y1={top + i * fh} y2={top + i * fh} style={{ stroke: 'var(--color-ink-500)' }} strokeWidth="1.2" />)}
        {Array.from({ length: n }, (_, s) => <line key={`c${s}`} x1={xs(s)} x2={xs(s)} y1={top} y2={top + rows * fh} style={{ stroke: 'var(--color-ink-300)' }} strokeWidth={s < 2 ? 1.6 : 1.1} />)}
        {voicing.barre && (
          <rect x={xs(voicing.barre.fromString) - 7} y={top + (voicing.barre.fret - base) * fh + fh / 2 - 7} width={(voicing.barre.toString - voicing.barre.fromString) * sw + 14} height={14} rx="7" fill="#8466f5" opacity="0.9" />
        )}
        {voicing.frets.map((f, s) => {
          if (f === null) return <text key={s} x={xs(s)} y={top - 9} textAnchor="middle" fontSize="11" className="svg-axis">×</text>;
          if (f === 0) return <circle key={s} cx={xs(s)} cy={top - 13} r="4.5" fill="none" style={{ stroke: 'var(--color-ink-200)' }} strokeWidth="1.3" />;
          const cy = top + (f - base) * fh + fh / 2;
          const midi = tuning.strings[s] + f;
          const lab = labels === 'finger' ? String(voicing.fingers[s] ?? '') : labels === 'interval' ? (voicing.tokens[s] ?? '') : pcName(mod(midi, 12));
          const isRoot = voicing.tokens[s] === '1';
          return (
            <g key={s}>
              <circle cx={xs(s)} cy={cy} r="7.5" style={{ fill: isRoot ? 'var(--color-accent-500)' : 'var(--color-ink-100)' }} />
              <text x={xs(s)} y={cy + 3.3} textAnchor="middle" fontSize={lab.length > 1 ? 7.5 : 9} fontWeight="600" style={{ fill: isRoot ? '#fff' : 'var(--color-ink-900)' }}>{lab}</text>
            </g>
          );
        })}
        {labels !== 'finger' && voicing.frets.map((f, s) => f === 0 ? <text key={`o${s}`} x={xs(s)} y={H - 3} textAnchor="middle" fontSize="8" className="svg-axis">{labels === 'interval' ? voicing.tokens[s] : pcName(mod(tuning.strings[s], 12))}</text> : null)}
      </svg>
    </figure>
  );
}

export function TabView({ score, ascii, caption, className }: { score?: TabScore; ascii?: string; caption?: ReactNode; className?: string }) {
  const text = useMemo(() => ascii ?? (score ? toAscii(score) : ''), [ascii, score]);
  return (
    <figure className={cx('my-3', className)}>
      <div className="overflow-x-auto rounded-xl border border-ink-700 bg-ink-950/60 px-4 py-3">
        <pre className="tab-text">{text}</pre>
      </div>
      {caption && <figcaption className="mt-1.5 text-xs text-ink-300">{caption}</figcaption>}
    </figure>
  );
}

/** Interactive Pillitiere pattern: shows shapes per string and the shift rules applied. */
export function PillitierePattern({ tuning, keyName, degree, startString = 0, minFret = 0, caption, compact }: { tuning: Tuning; keyName: string; degree: number; startString?: number; minFret?: number; caption?: ReactNode; compact?: boolean }) {
  const key = parseNote(keyName);
  const [step, setStep] = useState<number | null>(null);
  if (!key) return null;
  const pat = buildPillitierePattern(tuning, pcOf(key), degree, { startString, minFret });
  const shown = step === null ? pat.notes : pat.notes.filter((n) => n.string - startString <= step);
  const marks: FretMark[] = shown.map((n) => ({ string: n.string, fret: n.fret, label: compact ? String(n.finger) : String(n.degreeIndex + 1), tone: n.isRoot ? 'root' : 'tone', title: `Degree ${n.degreeIndex + 1}, finger ${n.finger}` }));
  return (
    <figure className="my-3">
      <Fretboard tuning={tuning} minFret={Math.max(0, pat.minFret - 1)} maxFret={Math.min(24, pat.maxFret + 1)} marks={marks} ariaLabel={`Pillitiere pattern from degree ${degree} in ${keyName} major`} />
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="label mr-1">Shapes</span>
        {pat.steps.map((s, i) => (
          <button key={i} type="button" onClick={() => setStep(step === i ? null : i)}
            className={cx('rounded-md border px-2 py-1 font-mono', step !== null && i <= step ? 'border-accent-500 bg-accent-500/15 text-accent-300' : 'border-ink-600 text-ink-200')}
            title={s.reasons.join('; ') || 'First finger stays at the same fret'}>
            {tuning.strings.length - s.string}:{s.shape}{s.shift ? ` +${s.shift}` : ''}
          </button>
        ))}
        <span className="text-ink-400">click a string to build step by step</span>
      </div>
      {step !== null && (
        <div className="mt-1.5 text-xs text-ink-300">
          String {tuning.strings.length - pat.steps[step].string}: shape <b className="text-ink-100">{pat.steps[step].shape}</b>, first finger at fret {pat.steps[step].firstFret}. {pat.steps[step].reasons.join(' · ') || (step === 0 ? 'Starting note.' : 'No shift: first finger stays at the same fret.')}
        </div>
      )}
      {caption && <figcaption className="mt-1.5 text-xs text-ink-300">{caption}</figcaption>}
    </figure>
  );
}
