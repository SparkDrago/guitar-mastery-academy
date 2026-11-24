/** Fretboard Intelligence Trainer and Ear Training. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuPlay, LuRepeat, LuArrowRight, LuKeyboard, LuFlame } from 'react-icons/lu';
import {
  TRAINER_MODES, TRAINER_STAGES, adapt, analyse, checkClicks, generateQuestion, trainerRecommendations, weightsFromAttempts,
  EAR_KINDS, earStats, generateEarQuestion, suggestedEarLevel,
  type AdaptiveState, type EarKind, type EarQuestion, type TrainerMode, type TrainerQuestion,
} from '@gma/learning';
import { midiAt } from '@gma/theory';
import { useActiveTuning, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, nowIso, pct, uid } from '@/lib/core';
import { getContext, pluck, playSteps } from '@/lib/audio';
import { useDocumentTitle, useLocation } from '@/lib/router';
import { Badge, Button, Callout, Card, Field, Kbd, PageHeader, Segmented, Select, Toggle } from '@/components/ui';
import { Fretboard, type FretMark } from '@/components/music';
import { HBars, LineChart } from '@/components/charts';
import { TuningPicker } from '@/components/widgets';

type Pos = { string: number; fret: number };

export function FretboardTrainerPage() {
  useDocumentTitle('Fretboard Trainer');
  const s = useStudent();
  const tuning = useActiveTuning();
  const { query } = useLocation();
  const [mode, setMode] = useState<TrainerMode>((query.get('mode') as TrainerMode) ?? 'note-id');
  const [auto, setAuto] = useState(true);
  const [adaptive, setAdaptive] = useState<AdaptiveState>({ stage: 1, streak: 0, recent: [] });
  const [strings, setStrings] = useState<number[]>([]);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [clicks, setClicks] = useState<Pos[]>([]);
  const [answer, setAnswer] = useState<{ correct: boolean; picked?: number } | null>(null);
  const [session, setSession] = useState({ n: 0, correct: 0, best: 0, ms: [] as number[] });
  const shownAt = useRef(performance.now());
  const flats = s.profile.noteNames === 'flats';
  const attemptsForTuning = useMemo(() => s.trainer.filter((t) => t.tuningId === tuning.id), [s.trainer, tuning.id]);
  const weights = useMemo(() => weightsFromAttempts(tuning, attemptsForTuning), [attemptsForTuning, tuning]);
  const stage = TRAINER_STAGES[adaptive.stage - 1];
  const modeInfo = TRAINER_MODES.find((m) => m.id === mode)!;
  const effectiveStage = TRAINER_STAGES[Math.max(adaptive.stage, modeInfo.minStage) - 1];

  const q: TrainerQuestion = useMemo(() => generateQuestion({ tuning, stage: effectiveStage, mode, seed, flats, weights, strings }), [tuning, effectiveStage, mode, seed, strings, flats]);

  useEffect(() => { shownAt.current = performance.now(); setClicks([]); setAnswer(null); }, [q.id]);
  useEffect(() => { setSeed(Math.floor(Math.random() * 1e6)); }, [mode, tuning.id]);

  const record = useCallback((correct: boolean) => {
    const ms = performance.now() - shownAt.current;
    store.append('trainer', { id: uid('tr'), mode, tuningId: tuning.id, string: q.meta.string, fret: q.meta.fret, pc: q.meta.pc, interval: q.meta.interval, correct, ms: Math.round(ms), at: nowIso() });
    setSession((x) => ({ n: x.n + 1, correct: x.correct + (correct ? 1 : 0), best: correct ? Math.max(x.best, adaptive.streak + 1) : x.best, ms: [...x.ms.slice(-9), ms] }));
    if (auto) {
      const nextA = adapt(adaptive, correct, ms, session.ms);
      if (nextA.stage !== adaptive.stage) store.toast(nextA.stage > adaptive.stage ? 'Stage up!' : 'Stepping back a stage', TRAINER_STAGES[nextA.stage - 1].name, nextA.stage > adaptive.stage ? 'success' : 'info');
      setAdaptive(nextA);
    } else setAdaptive((a) => ({ ...a, streak: correct ? a.streak + 1 : 0 }));
  }, [mode, tuning.id, q, auto, adaptive, session.ms]);

  const next = () => setSeed((x) => x + 7919);

  const pickOption = (i: number) => {
    if (answer || q.answerOption === undefined) return;
    const correct = i === q.answerOption;
    setAnswer({ correct, picked: i });
    record(correct);
    if (correct) setTimeout(next, 650);
  };

  const pickPos = (p: Pos) => {
    if (answer || !q.accept) return;
    const all = [...clicks.filter((c) => !(c.string === p.string && c.fret === p.fret)), p];
    const res = checkClicks(q, all);
    setClicks(all);
    pluck(midiAt(tuning, p.string, p.fret), getContext().currentTime + 0.01, 0.5, 0.6);
    if (res.wrong.length > 0) { setAnswer({ correct: false }); record(false); return; }
    if (res.complete && res.correct) { setAnswer({ correct: true }); record(true); setTimeout(next, 650); }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      if (e.key === 'Enter' || e.key === ' ') { if (answer) { e.preventDefault(); next(); } return; }
      if (!q.options || answer) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) pickOption(n - 1);
      const letter = e.key.toUpperCase();
      if (/^[A-G]$/.test(letter)) {
        const idx = q.options.findIndex((o) => o === letter || (e.shiftKey && o.startsWith(letter) && o.length > 1));
        if (idx >= 0) pickOption(idx);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const marks: FretMark[] = [
    ...q.highlight.map((h) => ({ string: h.string, fret: h.fret, tone: (h.role === 'root' ? 'root' : 'target') as FretMark['tone'], label: h.role === 'root' ? 'R' : '?' })),
    ...clicks.map((c) => ({ ...c, tone: (q.accept?.some((a) => a.string === c.string && a.fret === c.fret) ? 'correct' : 'wrong') as FretMark['tone'] })),
    ...(answer && !answer.correct && q.accept ? q.accept.filter((a) => !clicks.some((c) => c.string === a.string && c.fret === a.fret)).map((a) => ({ ...a, tone: 'ghost' as const, label: '✓' })) : []),
  ];

  const an = useMemo(() => analyse(attemptsForTuning, tuning), [attemptsForTuning, tuning]);
  const recs = trainerRecommendations(an);

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Fretboard Intelligence Trainer" subtitle="Make fretboard knowledge automatic: notes, octaves, intervals, degrees and chord tones, with adaptive difficulty and weak-spot targeting." />
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Mode"><Select value={mode} onChange={setMode} options={TRAINER_MODES.map((m) => ({ value: m.id, label: m.name }))} aria-label="Trainer mode" data-testid="trainer-mode" /></Field>
          <Field label="Tuning"><TuningPicker value={tuning.id} onChange={(id) => store.setProfile({ tuningId: id })} /></Field>
          <Field label="Difficulty"><div className="flex items-center gap-3"><Toggle checked={auto} onChange={setAuto} label="Adaptive" />{!auto && <Select value={String(adaptive.stage)} onChange={(v) => setAdaptive({ stage: Number(v), streak: 0, recent: [] })} options={TRAINER_STAGES.map((st) => ({ value: String(st.stage), label: `Stage ${st.stage}` }))} aria-label="Stage" />}</div></Field>
          <Field label="Strings">
            <div className="flex flex-wrap gap-1">
              {[...tuning.strings.keys()].reverse().map((i) => (
                <button key={i} type="button" onClick={() => setStrings((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))} className={cx('h-8 w-8 rounded-md border text-xs', strings.includes(i) ? 'border-accent-500 bg-accent-500/15 text-accent-300' : 'border-ink-600 text-ink-300')} aria-pressed={strings.includes(i)} aria-label={`Only string ${tuning.strings.length - i}`}>{tuning.strings.length - i}</button>
              ))}
            </div>
          </Field>
        </div>
      </Card>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge tone="accent">Stage {effectiveStage.stage}: {effectiveStage.name}</Badge>
            <Badge tone={adaptive.streak >= 5 ? 'warn' : 'neutral'}><LuFlame size={12} /> Streak {adaptive.streak}</Badge>
          </div>
          <div className="mb-4 text-lg font-medium text-ink-50" data-testid="trainer-prompt" aria-live="polite">{q.prompt}</div>
          <Fretboard tuning={tuning} minFret={q.range.minFret} maxFret={Math.max(q.range.maxFret, q.range.minFret + 5)} marks={marks} onPick={q.accept && !answer ? pickPos : undefined} onlyString={q.onlyString} leftHanded={s.profile.leftHanded} testId="trainer-fretboard" />
          {q.options && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="trainer-options">
              {q.options.map((o, i) => (
                <button key={o} type="button" onClick={() => pickOption(i)} disabled={!!answer}
                  className={cx('rounded-lg border px-3 py-3 text-base font-semibold transition-colors', answer && i === q.answerOption ? 'border-ok-500 bg-ok-500/10 text-ok-400' : answer && i === answer.picked ? 'border-bad-400 bg-bad-400/10 text-bad-400' : 'border-ink-600 bg-ink-900 text-ink-100 hover:border-ink-400')}>
                  <span className="mr-2 text-xs text-ink-500">{i + 1}</span>{o}
                </button>
              ))}
            </div>
          )}
          {q.requireAll && !answer && <p className="mt-3 text-xs text-ink-400">Found {clicks.length} of {q.accept!.length}.</p>}
          {answer && (
            <div className={cx('mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3', answer.correct ? 'border-ok-500/40 bg-ok-500/5' : 'border-bad-400/40 bg-bad-400/5')} data-testid="trainer-feedback">
              <p className="text-sm text-ink-200"><b className={answer.correct ? 'text-ok-400' : 'text-bad-400'}>{answer.correct ? 'Correct.' : 'Not quite.'}</b> {q.explain}</p>
              {!answer.correct && <Button size="sm" variant="primary" onClick={next}>Next <LuArrowRight size={14} /></Button>}
            </div>
          )}
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-400"><LuKeyboard size={12} /> Keys: <Kbd>1</Kbd>–<Kbd>4</Kbd> choose, <Kbd>A</Kbd>–<Kbd>G</Kbd> note names, <Kbd>Enter</Kbd> next.</p>
        </Card>
        <div className="space-y-5">
          <Card title="This session">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><div className="text-xl font-semibold tabular-nums">{session.n}</div><div className="text-xs text-ink-400">answered</div></div>
              <div><div className="text-xl font-semibold tabular-nums">{session.n ? pct(session.correct / session.n) : '—'}</div><div className="text-xs text-ink-400">accuracy</div></div>
              <div><div className="text-xl font-semibold tabular-nums">{session.ms.length ? `${(session.ms.reduce((a, b) => a + b, 0) / session.ms.length / 1000).toFixed(1)}s` : '—'}</div><div className="text-xs text-ink-400">avg time</div></div>
            </div>
          </Card>
          <Card title="Recommendations"><ul className="space-y-2 text-sm text-ink-200">{recs.map((r) => <li key={r}>{r}</li>)}</ul></Card>
        </div>
      </div>
      {an.total > 0 && (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card title="Accuracy by string" subtitle={`${an.total} answers in ${tuning.name}`}><HBars data={an.byString.map((b) => ({ label: b.label, value: Math.round(b.accuracy * 100), detail: `${b.attempts} answers, ${(b.avgMs / 1000).toFixed(1)} s` }))} unit="%" /></Card>
          <Card title="Accuracy by fret range"><HBars data={an.byRange.map((b) => ({ label: b.label, value: Math.round(b.accuracy * 100), detail: `${b.attempts} answers` }))} unit="%" /></Card>
          <Card title="Accuracy by note"><HBars data={an.byNote.map((b) => ({ label: b.label, value: Math.round(b.accuracy * 100), detail: `${b.attempts} answers` }))} unit="%" /></Card>
          {an.byInterval.length > 0 && <Card title="Accuracy by interval"><HBars data={an.byInterval.map((b) => ({ label: b.label, value: Math.round(b.accuracy * 100) }))} unit="%" /></Card>}
          {an.daily.length > 1 && <Card title="Long-term accuracy" className="lg:col-span-2"><LineChart title="Daily fretboard accuracy" unit="%" min={0} data={an.daily.map((d) => ({ label: d.day.slice(5), value: Math.round(d.accuracy * 100), detail: `${d.attempts} answers` }))} /></Card>}
        </div>
      )}
    </div>
  );
}

// ── Ear training ─────────────────────────────────────────────────────────

export function EarTrainingPage() {
  useDocumentTitle('Ear Training');
  const s = useStudent();
  const { query } = useLocation();
  const [kind, setKind] = useState<EarKind>((query.get('kind') as EarKind) ?? 'interval');
  const [level, setLevel] = useState(1);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [picked, setPicked] = useState<number | null>(null);
  const [played, setPlayed] = useState(false);
  const info = EAR_KINDS.find((k) => k.id === kind)!;
  const q: EarQuestion = useMemo(() => generateEarQuestion({ kind, level, seed }), [kind, level, seed]);
  useEffect(() => { setPicked(null); setPlayed(false); }, [q.id]);
  useEffect(() => { setLevel(suggestedEarLevel(s.ear, kind, 1)); }, [kind]);
  const play = () => {
    getContext();
    const ref = q.reference ? playSteps(q.reference) : 0;
    setTimeout(() => playSteps(q.play), ref * 1000 + (q.reference ? 250 : 0));
    setPlayed(true);
  };
  const answer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === q.answer;
    store.append('ear', { id: uid('ear'), kind, item: q.item, correct, at: nowIso() });
    const suggestion = suggestedEarLevel([...s.ear, { id: 'x', kind, item: q.item, correct, at: nowIso() }], kind, level);
    if (suggestion > level) store.toast('Ready for the next level', `${info.name}: ${info.levels[suggestion - 1].name}`, 'success');
  };
  const stats = earStats(s.ear).find((x) => x.kind === kind);
  return (
    <div>
      <PageHeader eyebrow="Practice" title="Ear Training" subtitle="Progressive drills with instant feedback. Everything is synthesised in your browser." />
      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <Card title="Drills">
          <ul className="space-y-0.5">
            {EAR_KINDS.map((k) => {
              const st = earStats(s.ear).find((x) => x.kind === k.id);
              return <li key={k.id}><button type="button" onClick={() => { setKind(k.id); setSeed((x) => x + 1); }} className={cx('w-full rounded-lg px-2.5 py-2 text-left', kind === k.id ? 'bg-accent-500/15' : 'hover:bg-ink-800')}><div className="text-sm text-ink-100">{k.name}</div><div className="text-xs text-ink-400">{st ? `${pct(st.accuracy)} of ${st.attempts}` : k.description}</div></button></li>;
            })}
          </ul>
        </Card>
        <div className="space-y-5">
          <Card title={info.name} subtitle={info.description} action={<Segmented value={String(level)} onChange={(v) => setLevel(Number(v))} size="sm" options={info.levels.map((l) => ({ value: String(l.level), label: `L${l.level}` }))} />}>
            <p className="mb-1 text-xs text-ink-400">Level {level}: {info.levels[level - 1]?.name}</p>
            <div className="text-lg font-medium text-ink-50" data-testid="ear-prompt">{q.prompt}</div>
            <div className="mt-4 flex gap-2">
              <Button variant="primary" size="lg" onClick={play} data-testid="ear-play">{played ? <><LuRepeat size={18} /> Replay</> : <><LuPlay size={18} /> Play</>}</Button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2" data-testid="ear-options">
              {q.options.map((o, i) => (
                <button key={o} type="button" disabled={picked !== null || !played} onClick={() => answer(i)}
                  className={cx('rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed', picked !== null && i === q.answer ? 'border-ok-500 bg-ok-500/10 text-ok-400' : picked === i ? 'border-bad-400 bg-bad-400/10 text-bad-400' : 'border-ink-600 bg-ink-900 text-ink-100 hover:border-ink-400', !played && 'opacity-50')}>{o}</button>
              ))}
            </div>
            {!played && <p className="mt-2 text-xs text-ink-400">Press Play first.</p>}
            {picked !== null && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-200"><b className={picked === q.answer ? 'text-ok-400' : 'text-bad-400'}>{picked === q.answer ? 'Correct.' : 'Not quite.'}</b> {q.explain}</p>
                <div className="flex gap-2"><Button size="sm" onClick={play}><LuRepeat size={14} /> Hear again</Button><Button size="sm" variant="primary" onClick={() => setSeed((x) => x + 7919)} data-testid="ear-next">Next <LuArrowRight size={14} /></Button></div>
              </div>
            )}
          </Card>
          {stats && (
            <Card title="Your results">
              <p className="text-sm text-ink-200">{stats.attempts} answers, {pct(stats.accuracy)} correct. Move up at 85% over 20 answers.</p>
              {stats.weakestItems.length > 0 && <p className="mt-1 text-xs text-ink-400">Hardest so far: {stats.weakestItems.map((w) => `${kind === 'interval' ? ['', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'][Number(w.item)] ?? w.item : w.item} (${pct(w.accuracy)})`).join(', ')}</p>}
            </Card>
          )}
          <Callout tone="info" title="Pitch matching">To practise matching pitches, play a note on your guitar with the Tuner open: it shows exactly which note you produced.</Callout>
        </div>
      </div>
    </div>
  );
}
