/** Shared feature widgets: tuning picker, metronome widget, lesson blocks, quiz. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuPlay, LuSquare, LuHand, LuCheck, LuX, LuVolume2 } from 'react-icons/lu';
import {
  TUNING_CATEGORIES, tuningLabel, findVoicings, parseChordSymbol, parseNote, pcOf, buildScale, buildChord, markTones,
  getScale, type Tuning,
} from '@gma/theory';
import { clampBpm, defaultAccents, tapTempo, type AccentLevel, type MetronomeConfig } from '@gma/audio';
import type { Block, QuizQuestion } from '@gma/learning';
import { BOOKS } from '@content/helpers';
import { MetronomePlayer, getContext } from '@/lib/audio';
import { cx } from '@/lib/core';
import { useActiveTuning, useAllTunings, useStudent } from '@/lib/hooks';
import { Button, Callout, Segmented, Select, Stepper } from './ui';
import { ChordDiagram, Fretboard, PillitierePattern, TabView, type FretMark } from './music';

export function TuningPicker({ value, onChange, className, testId }: { value: string; onChange: (id: string) => void; className?: string; testId?: string }) {
  const all = useAllTunings();
  const options = all.map((t) => ({ value: t.id, label: `${t.name} (${tuningLabel(t)})`, group: TUNING_CATEGORIES.find((c) => c.id === t.category)?.name ?? 'Other' }));
  return <Select value={value} onChange={onChange} options={options} className={className} aria-label="Tuning" data-testid={testId} />;
}

// ── Metronome widget ─────────────────────────────────────────────────────

export function useMetronome(initial: Partial<MetronomeConfig> = {}) {
  const [cfg, setCfg] = useState<MetronomeConfig>({ bpm: 80, beatsPerBar: 4, beatUnit: 4, subdivision: 1, accents: defaultAccents(4), ...initial });
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState<{ beat: number; sub: number; bar: number } | null>(null);
  const player = useRef<MetronomePlayer | null>(null);
  useEffect(() => () => player.current?.stop(), []);
  useEffect(() => { player.current?.setConfig(cfg); }, [cfg]);
  const start = () => {
    getContext();
    if (!player.current) player.current = new MetronomePlayer(cfg);
    player.current.setConfig(cfg);
    player.current.onClick = (e) => setBeat({ beat: e.beat, sub: e.sub, bar: e.bar });
    player.current.begin();
    setRunning(true);
  };
  const stop = () => {
    player.current?.stop();
    setRunning(false);
    setBeat(null);
  };
  return { cfg, setCfg, running, start, stop, toggle: () => (running ? stop() : start()), beat, player };
}

export function MetronomeWidget({ bpm, onBpm, compact, subdivision = 1, testId }: { bpm: number; onBpm?: (b: number) => void; compact?: boolean; subdivision?: number; testId?: string }) {
  const m = useMetronome({ bpm, subdivision });
  const taps = useRef<number[]>([]);
  useEffect(() => { m.setCfg((c) => ({ ...c, bpm })); }, [bpm]);
  useEffect(() => { m.setCfg((c) => ({ ...c, subdivision })); }, [subdivision]);
  const setBpm = (b: number) => { const v = clampBpm(b); m.setCfg((c) => ({ ...c, bpm: v })); onBpm?.(v); };
  return (
    <div className={cx('flex flex-wrap items-center gap-2', compact && 'gap-1.5')} data-testid={testId}>
      <Button variant={m.running ? 'secondary' : 'primary'} size="sm" onClick={m.toggle} aria-label={m.running ? 'Stop metronome' : 'Start metronome'}>
        {m.running ? <LuSquare size={14} /> : <LuPlay size={14} />} {m.running ? 'Stop' : 'Click'}
      </Button>
      <Stepper value={m.cfg.bpm} onChange={setBpm} min={20} max={400} label="BPM" suffix="bpm" />
      <Button size="sm" variant="ghost" onClick={() => { taps.current.push(performance.now()); const t = tapTempo(taps.current); if (t) setBpm(t); }} aria-label="Tap tempo"><LuHand size={14} /> Tap</Button>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: m.cfg.beatsPerBar }, (_, i) => (
          <span key={i} className={cx('h-2.5 w-2.5 rounded-full transition-colors', m.beat && m.beat.beat === i ? (i === 0 ? 'bg-accent-400' : 'bg-ink-100') : 'bg-ink-600')} />
        ))}
      </div>
    </div>
  );
}

// ── Lesson blocks ────────────────────────────────────────────────────────

function FretboardBlock({ b, tuning }: { b: Extract<Block, { type: 'fretboard' }>; tuning: Tuning }) {
  const root = parseNote(b.root)!;
  const rootPc = pcOf(root);
  let formula: string[] = ['1'];
  let names: string[] = [];
  if (b.scale) { const sc = buildScale(root, b.scale); formula = getScale(b.scale).formula; names = sc.notes.map((n) => noteLabel(n)); }
  else if (b.chord) { const ch = buildChord(root, b.chord); formula = ch.def.formula; names = ch.notes.map((n) => noteLabel(n)); }
  const minFret = b.minFret ?? 0;
  const maxFret = b.maxFret ?? 12;
  let marks: FretMark[];
  if (b.notes) {
    const pcs = b.notes.map((n) => pcOf(parseNote(n)!));
    marks = [];
    for (let s = 0; s < tuning.strings.length; s++) for (let f = minFret; f <= maxFret; f++) {
      const pc = (tuning.strings[s] + f) % 12;
      const idx = pcs.indexOf(pc);
      if (idx >= 0) marks.push({ string: s, fret: f, label: b.notes[idx], tone: pc === rootPc ? 'root' : 'tone' });
    }
  } else {
    const sc = b.scale ? buildScale(root, b.scale) : b.chord ? buildChord(root, b.chord) : null;
    marks = markTones(tuning, rootPc, formula, maxFret, minFret).map((m) => ({
      string: m.string, fret: m.fret, tone: m.isRoot ? 'root' : 'tone',
      label: b.labels === 'note' ? (sc ? noteLabel(sc.notes[m.toneIndex]) : '') : b.labels === 'degree' ? String(m.toneIndex + 1) : m.token,
    }));
  }
  return (
    <figure className="my-4">
      <Fretboard tuning={tuning} minFret={minFret} maxFret={maxFret} marks={marks} />
      <figcaption className="mt-1.5 text-xs text-ink-300">{b.caption}{names.length ? ` (${names.join(' ')})` : ''}</figcaption>
    </figure>
  );
}

function noteLabel(n: { letter: number; acc: number }) {
  return 'CDEFGAB'[n.letter] + (n.acc > 0 ? '♯'.repeat(n.acc) : '♭'.repeat(-n.acc));
}

function ChordBlock({ symbols, caption, tuning }: { symbols: string[]; caption?: string; tuning: Tuning }) {
  return (
    <figure className="my-4">
      <div className="flex flex-wrap gap-4 rounded-xl border border-ink-700 bg-ink-950/40 p-4">
        {symbols.map((s) => {
          const ch = parseChordSymbol(s);
          if (!ch) return null;
          const v = findVoicings(ch, tuning, { limit: 30 });
          const pick = v.find((x) => x.baseFret <= 3 && x.frets.filter((f) => f !== null).length >= 4) ?? v[0];
          return pick ? <ChordDiagram key={s} title={ch.symbol} voicing={pick} tuning={tuning} /> : <div key={s} className="text-sm text-ink-400">{s}: no voicing in this tuning</div>;
        })}
      </div>
      {caption && <figcaption className="mt-1.5 text-xs text-ink-300">{caption}</figcaption>}
    </figure>
  );
}

export function LessonBlocks({ blocks }: { blocks: Block[] }) {
  const active = useActiveTuning();
  const standard = useMemo(() => ({ id: 'e-standard', name: 'E Standard', category: 'standard' as const, strings: [40, 45, 50, 55, 59, 64] }), []);
  return (
    <div className="prose-gma">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p': return <p key={i}>{b.text}</p>;
          case 'list': return b.ordered
            ? <ol key={i} className="mb-3 ml-5 list-decimal space-y-1.5 text-ink-200">{b.items.map((x, k) => <li key={k}>{x}</li>)}</ol>
            : <ul key={i} className="mb-3 ml-5 list-disc space-y-1.5 text-ink-200 marker:text-ink-500">{b.items.map((x, k) => <li key={k}>{x}</li>)}</ul>;
          case 'callout': return <Callout key={i} tone={b.tone === 'tip' ? 'ok' : b.tone === 'warning' ? 'warn' : b.tone === 'source' ? 'source' : 'theory'} title={b.tone === 'tip' ? 'Tip' : b.tone === 'warning' ? 'Watch out' : b.tone === 'source' ? 'From the source books' : 'Theory'}>{b.text}</Callout>;
          case 'tab': return <TabView key={i} ascii={b.ascii} caption={b.caption} />;
          case 'chord': return <ChordBlock key={i} symbols={b.symbols} caption={b.caption} tuning={standard} />;
          case 'fretboard': return <FretboardBlock key={i} b={b} tuning={b.tuning ? standard : active.strings.length === 6 ? active : standard} />;
          case 'pillitiere': return <PillitierePattern key={i} tuning={standard} keyName={b.key} degree={b.degree} caption={b.caption} />;
          case 'table': return (
            <figure key={i} className="my-4 overflow-x-auto rounded-xl border border-ink-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-800 text-xs uppercase tracking-wide text-ink-300"><tr>{b.head.map((h, k) => <th key={k} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, k) => <tr key={k} className="border-t border-ink-700">{r.map((c, j) => <td key={j} className={cx('px-3 py-2 text-ink-200', j === 0 && 'font-medium text-ink-100')}>{c}</td>)}</tr>)}</tbody>
              </table>
              {b.caption && <figcaption className="border-t border-ink-700 px-3 py-2 text-xs text-ink-300">{b.caption}</figcaption>}
            </figure>
          );
          case 'check': return <InlineCheck key={i} q={b.question} />;
          default: return null;
        }
      })}
    </div>
  );
}

function InlineCheck({ q }: { q: QuizQuestion }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="my-4 rounded-xl border border-ink-600 bg-ink-800/50 p-4">
      <div className="label mb-2">Quick check</div>
      <QuestionView q={q} picked={picked} onPick={setPicked} />
    </div>
  );
}

export function QuestionView({ q, picked, onPick, index }: { q: QuizQuestion; picked: number | null; onPick: (i: number) => void; index?: number }) {
  const answered = picked !== null;
  return (
    <div>
      <div className="mb-3 font-medium text-ink-50">{index !== undefined && <span className="mr-2 text-ink-400">{index + 1}.</span>}{q.prompt}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => {
          const correct = answered && i === q.answer;
          const wrong = answered && i === picked && i !== q.answer;
          return (
            <button key={i} type="button" disabled={answered} onClick={() => onPick(i)} data-testid="quiz-option"
              className={cx('flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                correct ? 'border-ok-500 bg-ok-500/10 text-ok-400' : wrong ? 'border-bad-400 bg-bad-400/10 text-bad-400' : 'border-ink-600 bg-ink-900 text-ink-100 hover:border-ink-400',
                answered && !correct && !wrong && 'opacity-60')}>
              <span>{o}</span>
              {correct && <LuCheck size={16} />}{wrong && <LuX size={16} />}
            </button>
          );
        })}
      </div>
      {answered && <p className={cx('mt-2 text-sm', picked === q.answer ? 'text-ok-400' : 'text-ink-300')}>{picked === q.answer ? 'Correct. ' : 'Not quite. '}{q.explanation}</p>}
    </div>
  );
}

export function QuizRunner({ questions, onDone, title }: { questions: QuizQuestion[]; onDone: (score: number, missed: string[]) => void; title: string }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [finished, setFinished] = useState(false);
  const q = questions[i];
  const score = answers.filter((a, k) => a === questions[k].answer).length;
  const finish = () => {
    setFinished(true);
    onDone(score, questions.filter((qq, k) => answers[k] !== qq.answer).map((qq) => qq.id));
  };
  if (finished)
    return (
      <div className="text-center" data-testid="quiz-result">
        <div className="text-4xl font-semibold tabular-nums text-ink-50">{score}/{questions.length}</div>
        <p className="mt-1 text-sm text-ink-300">{title} complete.</p>
      </div>
    );
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs text-ink-300">
        <span>{title}</span>
        <span className="tabular-nums">Question {i + 1} of {questions.length}</span>
      </div>
      <QuestionView q={q} index={i} picked={answers[i]} onPick={(p) => setAnswers((a) => a.map((x, k) => (k === i ? p : x)))} />
      <div className="mt-4 flex justify-end">
        {i < questions.length - 1
          ? <Button variant="primary" disabled={answers[i] === null} onClick={() => setI(i + 1)}>Next</Button>
          : <Button variant="primary" disabled={answers[i] === null} onClick={finish} data-testid="quiz-finish">Finish</Button>}
      </div>
    </div>
  );
}

export function SourceLine({ sources }: { sources: { book: string; section?: string; note?: string }[] }) {
  return (
    <ul className="space-y-1 text-xs text-ink-300">
      {sources.map((s, i) => (
        <li key={i}>
          <span className={cx('mr-1.5 inline-block rounded px-1 font-mono text-[10px]', s.book === 'P' ? 'bg-ink-700 text-ink-300' : 'bg-accent-500/15 text-accent-300')}>{s.book === 'P' ? 'Supplementary' : `Book ${s.book}`}</span>
          {BOOKS[s.book as 'A']}{s.section ? `: ${s.section}` : s.note ? `: ${s.note}` : ''}
        </li>
      ))}
    </ul>
  );
}

export function SoundCheck() {
  return <span className="inline-flex items-center gap-1 text-xs text-ink-400"><LuVolume2 size={12} /> Audio starts after you press play.</span>;
}

export function useTuningInfo() {
  const s = useStudent();
  return { tuningId: s.profile.tuningId };
}

export { Segmented };
