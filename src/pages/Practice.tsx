/** Practice Studio (intelligent scheduler + session runner) and Technique Lab. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuPlay, LuPause, LuCheck, LuSkipForward, LuCoffee, LuSave, LuArrowRight, LuSquare, LuAudioLines, LuGamepad2, LuVolume2, LuFlag } from 'react-icons/lu';
import {
  CATEGORIES, DURATION_PRESETS, buildRoutine, bpmProgress, nextBpm, practiceSummary, weaknesses,
  type Category, type ExerciseRecord, type PracticeBlock, type Routine, type TechniqueId,
} from '@gma/learning';
import { LESSONS } from '@content/lessons/index';
import { useAllExercises, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, fmtMinutes, nowIso, relativeDay, uid } from '@/lib/core';
import { Link, navigate, useDocumentTitle, useLocation } from '@/lib/router';
import { playScore } from '@/lib/playback';
import { Badge, Button, Callout, Card, Empty, Field, PageHeader, ProgressBar, Segmented, Select, Stepper } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { TabView } from '@/components/music';
import { MetronomeWidget } from '@/components/widgets';

function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PracticePage() {
  useDocumentTitle('Practice Studio');
  const s = useStudent();
  const exercises = useAllExercises();
  const [minutes, setMinutes] = useState<number>(s.profile.dailyMinutes);
  const [focus, setFocus] = useState<Category[]>([]);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [session, setSession] = useState<{ id: string; startedAt: string; blocks: (PracticeBlock & { route?: string; instructions?: string; reason?: string; targetBpm?: number })[]; idx: number; elapsed: number; blockElapsed: number; paused: boolean; notes: string } | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const now = new Date();
  const summary = practiceSummary(s, now);
  const weak = weaknesses(s, exercises, now);

  const build = () => setRoutine(buildRoutine({ state: s, lessons: LESSONS, exercises, minutes, now: new Date(), focus, seed: Date.now() % 100000 }));
  useEffect(() => { if (!routine) build(); }, []);

  useEffect(() => {
    if (!session || session.paused) { if (tick.current) clearInterval(tick.current); return; }
    tick.current = setInterval(() => setSession((x) => (x ? { ...x, elapsed: x.elapsed + 1, blockElapsed: x.blockElapsed + 1 } : x)), 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [session?.paused, !!session]);

  const start = (r: Routine) => setSession({ id: uid('session'), startedAt: nowIso(), blocks: r.blocks.map((b) => ({ ...b })), idx: 0, elapsed: 0, blockElapsed: 0, paused: false, notes: '' });
  const patchBlock = (i: number, patch: Partial<PracticeBlock>) => setSession((x) => (x ? { ...x, blocks: x.blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)) } : x));
  const nextBlock = (complete: boolean) => setSession((x) => {
    if (!x) return x;
    const blocks = x.blocks.map((b, k) => (k === x.idx ? { ...b, completed: complete || b.completed } : b));
    return { ...x, blocks, idx: Math.min(blocks.length, x.idx + 1), blockElapsed: 0 };
  });
  const finish = () => {
    if (!session) return;
    const actual = Math.max(1, Math.round(session.elapsed / 60));
    store.append('sessions', {
      id: session.id, startedAt: session.startedAt, endedAt: nowIso(), plannedMinutes: routine?.minutes ?? minutes, actualMinutes: actual, routineName: routine?.name ?? 'Practice',
      blocks: session.blocks.map(({ category, activity, title, minutes: m, completed, exerciseId, bpm, reps, rating }) => ({ category, activity, title, minutes: m, completed, exerciseId, bpm, reps, rating })), notes: session.notes || undefined, updatedAt: nowIso(),
    });
    for (const b of session.blocks) {
      if (b.completed && b.exerciseId && b.bpm && b.rating) {
        const rec: ExerciseRecord = { id: uid('rec'), exerciseId: b.exerciseId, at: nowIso(), bpm: b.bpm, clean: b.rating >= 4, rating: b.rating, source: 'manual', updatedAt: nowIso() };
        store.append('exerciseRecords', rec);
      }
    }
    store.toast('Session saved', `${fmtMinutes(actual)} of practice logged.`, 'success');
    setSession(null);
    build();
  };
  const saveRoutine = () => {
    if (!routine) return;
    store.append('routines', { id: uid('routine'), name: `${routine.minutes}-min routine (${new Date().toLocaleDateString()})`, blocks: routine.blocks.map((b) => ({ category: b.category, minutes: b.minutes, activity: b.activity, title: b.title })), updatedAt: nowIso() });
    store.toast('Routine saved', 'Find it under "My routines".', 'success');
  };
  const startCustom = (id: string) => {
    const c = s.routines.find((r) => r.id === id);
    if (!c) return;
    const r: Routine = { name: c.name, minutes: c.blocks.reduce((a, b) => a + b.minutes, 0), level: 0, breaks: [], rationale: ['Your saved routine.'], blocks: c.blocks.map((b) => ({ category: b.category, activity: b.activity ?? `free:${b.category}`, title: b.title ?? b.category, minutes: b.minutes, completed: false, instructions: '', route: b.activity?.startsWith('exercise:') ? `/technique-lab?exercise=${b.activity.slice(9)}` : '/practice', reason: '' })) };
    setRoutine(r);
    start(r);
  };

  if (session) {
    const b = session.blocks[session.idx];
    const done = session.idx >= session.blocks.length;
    const isBreak = routine && routine.breaks.includes(session.idx - 1) && session.blockElapsed < 120 && !done;
    return (
      <div>
        <PageHeader eyebrow="Practice session" title={routine?.name ?? 'Practice'} subtitle={`Elapsed ${mmss(session.elapsed)} · ${session.blocks.filter((x) => x.completed).length}/${session.blocks.length} blocks done`}
          actions={<><Button onClick={() => setSession({ ...session, paused: !session.paused })}>{session.paused ? <><LuPlay size={16} /> Resume</> : <><LuPause size={16} /> Pause</>}</Button><Button variant="primary" onClick={finish} data-testid="finish-session"><LuFlag size={16} /> Finish & save</Button></>} />
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            {isBreak && <Callout tone="info" title="Break reminder"><span className="inline-flex items-center gap-2"><LuCoffee size={16} />You have been practising for a while. Take two minutes: shake out your hands, stretch, drink some water.</span></Callout>}
            {done ? (
              <Card><Empty title="Routine complete" body="Add a note about what went well, then save the session." action={<Button variant="primary" onClick={finish}>Save session</Button>} /></Card>
            ) : (
              <Card title={b.title} subtitle={CATEGORIES.find((c) => c.id === b.category)?.name} action={<Badge tone="accent">{mmss(b.minutes * 60 - session.blockElapsed)} left</Badge>}>
                <ProgressBar value={session.blockElapsed / (b.minutes * 60)} label="Block time" />
                {b.reason && <p className="mt-3 text-sm text-ink-300">{b.reason}</p>}
                {b.instructions && <p className="mt-2 text-sm text-ink-200">{b.instructions}</p>}
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  {b.route && <Button onClick={() => window.open(b.route, '_blank')}>Open tool <LuArrowRight size={14} /></Button>}
                  {b.exerciseId && (
                    <>
                      <Field label="Tempo played"><Stepper value={b.bpm ?? 60} onChange={(v) => patchBlock(session.idx, { bpm: v })} min={20} max={300} label="Tempo played" suffix="bpm" /></Field>
                      <Field label="How clean? (1–5)"><Segmented value={String(b.rating ?? '')} onChange={(v) => patchBlock(session.idx, { rating: Number(v) as 1 })} size="sm" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} /></Field>
                    </>
                  )}
                </div>
                {b.exerciseId && b.bpm && <div className="mt-4"><MetronomeWidget bpm={b.bpm} subdivision={1} /></div>}
                <div className="mt-5 flex gap-2">
                  <Button variant="success" onClick={() => nextBlock(true)} data-testid="block-done"><LuCheck size={16} /> Done</Button>
                  <Button variant="ghost" onClick={() => nextBlock(false)}><LuSkipForward size={16} /> Skip</Button>
                </div>
              </Card>
            )}
            <Card title="Session notes"><textarea className="input min-h-24" value={session.notes} onChange={(e) => setSession({ ...session, notes: (e.target as HTMLTextAreaElement).value })} placeholder="What improved? What felt hard?" /></Card>
          </div>
          <Card title="Blocks">
            <ol className="space-y-1.5">
              {session.blocks.map((x, i) => (
                <li key={i} className={cx('flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm', i === session.idx ? 'bg-accent-500/10 text-ink-50' : 'text-ink-300')}>
                  {x.completed ? <LuCheck size={14} className="text-ok-400" /> : <span className="w-3.5 text-center text-xs">{i + 1}</span>}
                  <span className="min-w-0 flex-1 truncate">{x.title}</span><span className="text-xs text-ink-400">{x.minutes}m</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Practice Studio" subtitle="A daily routine built from your level, goals, measured weak spots and neglected skills." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card title="Build today's routine">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Duration"><Segmented value={String(DURATION_PRESETS.includes(minutes as 15) ? minutes : 'custom')} onChange={(v) => v !== 'custom' && setMinutes(Number(v))} size="sm" options={[...DURATION_PRESETS.map((d) => ({ value: String(d), label: `${d} min` })), { value: 'custom', label: 'Custom' }]} /></Field>
              <Field label="Minutes"><Stepper value={minutes} onChange={setMinutes} min={10} max={180} step={5} label="Routine minutes" /></Field>
              <Button variant="primary" onClick={build} data-testid="build-routine">Build routine</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="label mr-1 self-center">Extra focus</span>
              {CATEGORIES.map((c) => <button key={c.id} type="button" onClick={() => setFocus((f) => (f.includes(c.id) ? f.filter((x) => x !== c.id) : [...f, c.id]))} className={cx('rounded-full border px-2.5 py-0.5 text-xs', focus.includes(c.id) ? 'border-accent-500 bg-accent-500/15 text-accent-300' : 'border-ink-600 text-ink-300')}>{c.name}</button>)}
            </div>
          </Card>
          {routine && (
            <Card title={routine.name} subtitle={`Level ${routine.level} routine`} action={<div className="flex gap-2"><Button size="sm" variant="ghost" onClick={saveRoutine}><LuSave size={14} /> Save</Button><Button size="sm" variant="primary" onClick={() => start(routine)} data-testid="start-session"><LuPlay size={14} /> Start session</Button></div>}>
              <ul className="mb-4 space-y-1 text-xs text-ink-300">{routine.rationale.map((r) => <li key={r}>• {r}</li>)}</ul>
              <ol className="space-y-2" data-testid="routine-blocks">
                {routine.blocks.map((b, i) => (
                  <li key={i}>
                    <div className="flex items-start gap-3 rounded-xl border border-ink-700 px-3 py-2.5">
                      <span className="mt-0.5 w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-accent-300">{b.minutes}′</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-ink-50">{b.title}</span><Badge>{CATEGORIES.find((c) => c.id === b.category)?.name}</Badge>{b.targetBpm && b.bpm && <Badge tone="cyan">{b.bpm} → {b.targetBpm} bpm</Badge>}</div>
                        <p className="mt-0.5 text-xs text-ink-300">{b.reason}</p>
                      </div>
                      <Link to={b.route} className="text-xs text-accent-300 hover:underline">Open</Link>
                    </div>
                    {routine.breaks.includes(i) && <div className="my-1.5 flex items-center gap-2 pl-14 text-xs text-ink-400"><LuCoffee size={12} /> Short break</div>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
        <div className="space-y-5">
          <Card title="This week">
            <div className="text-3xl font-semibold tabular-nums text-ink-50">{fmtMinutes(summary.weekMinutes)}</div>
            <p className="text-xs text-ink-400">Consistency (28 days): {Math.round(summary.consistency * 100)}%</p>
            {summary.neglected.length > 0 && s.sessions.length > 0 && <p className="mt-3 text-xs text-ink-300">Not practised this week: {summary.neglected.slice(0, 4).map((c) => CATEGORIES.find((x) => x.id === c)?.name).join(', ')}</p>}
          </Card>
          {weak.length > 0 && <Card title="Measured weak spots"><ul className="space-y-2 text-sm">{weak.slice(0, 4).map((w) => <li key={w.category + w.reason} className="text-ink-200">{w.reason}</li>)}</ul></Card>}
          <Card title="My routines">
            {s.routines.length === 0 ? <p className="text-sm text-ink-300">Save a generated routine to reuse it.</p> : (
              <ul className="space-y-1.5">{s.routines.map((r) => <li key={r.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate text-ink-200">{r.name}</span><span className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => startCustom(r.id)}><LuPlay size={12} /></Button><Button size="sm" variant="ghost" onClick={() => store.remove('routines', r.id)} aria-label="Delete routine">×</Button></span></li>)}</ul>
            )}
          </Card>
          <Card title="Recent sessions">
            {s.sessions.length === 0 ? <p className="text-sm text-ink-300">No sessions yet.</p> : (
              <ul className="space-y-1.5 text-sm">{[...s.sessions].reverse().slice(0, 6).map((x) => <li key={x.id} className="flex justify-between"><span className="text-ink-200">{relativeDay(x.startedAt)}</span><span className="tabular-nums text-ink-300">{fmtMinutes(x.actualMinutes)} · {x.blocks.filter((b) => b.completed).length}/{x.blocks.length}</span></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Technique Lab ────────────────────────────────────────────────────────

const TECH_LABELS: Partial<Record<TechniqueId, string>> = {
  'alternate-picking': 'Alternate picking', 'economy-picking': 'Economy picking', legato: 'Legato', 'sweep-picking': 'Sweep picking', tapping: 'Tapping',
  'string-skipping': 'String skipping', bending: 'Bending', vibrato: 'Vibrato', 'tremolo-picking': 'Tremolo picking', synchronization: 'Synchronisation',
  'rhythm-accuracy': 'Rhythm accuracy', 'hybrid-picking': 'Hybrid picking', 'chord-changes': 'Chord changes', 'palm-muting': 'Palm muting', harmonics: 'Harmonics',
  fretting: 'Fretting', scales: 'Scales', arpeggios: 'Arpeggios', strumming: 'Strumming',
};

export function TechniqueLabPage() {
  useDocumentTitle('Technique Lab');
  const s = useStudent();
  const all = useAllExercises();
  const { query } = useLocation();
  const [tech, setTech] = useState<string>('all');
  const [sel, setSel] = useState<string>(query.get('exercise') ?? all[0].id);
  useEffect(() => { const q = query.get('exercise'); if (q) setSel(q); }, [query.get('exercise')]);
  const ex = all.find((e) => e.id === sel) ?? all[0];
  const nb = nextBpm(ex, s.exerciseRecords);
  const [bpm, setBpm] = useState(nb.bpm);
  const [clean, setClean] = useState(true);
  const [rating, setRating] = useState(4);
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => { setBpm(nextBpm(ex, s.exerciseRecords).bpm); stopRef.current?.(); }, [ex.id]);
  useEffect(() => () => stopRef.current?.(), []);
  const prog = bpmProgress(s.exerciseRecords, ex.id);
  const techniques = [...new Set(all.map((e) => e.technique))];
  const list = all.filter((e) => tech === 'all' || e.technique === tech);

  const log = () => {
    store.append('exerciseRecords', { id: uid('rec'), exerciseId: ex.id, at: nowIso(), bpm, clean, rating: rating as 1, source: 'manual', updatedAt: nowIso() });
    // Mastery may now be met for lessons that require this exercise.
    for (const l of LESSONS.filter((x) => x.mastery.practice?.exerciseId === ex.id)) {
      const p = store.state.lessons[l.id];
      if (p && p.masteryBest >= l.mastery.quizPass && p.status !== 'mastered' && clean && (!l.mastery.practice!.bpm || bpm >= l.mastery.practice!.bpm)) {
        store.upsert('lessons', l.id, { ...p, status: 'mastered', masteredAt: nowIso(), completedAt: p.completedAt ?? nowIso(), updatedAt: nowIso() });
        store.toast('Lesson mastered', l.title, 'success');
      }
    }
    store.toast('Take logged', `${ex.name} at ${bpm} bpm (${clean ? 'clean' : 'not clean yet'}).`, 'info');
  };
  const play = () => {
    if (playing) { stopRef.current?.(); return; }
    setPlaying(true);
    stopRef.current = playScore(ex.score, bpm, { clickTrack: true, onEnd: () => setPlaying(false) });
  };

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Technique Lab" subtitle="Graded exercises for every lead and rhythm technique, with tempo targets, mastery criteria and progress tracking." />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card title="Exercises">
          <Select value={tech} onChange={setTech} options={[{ value: 'all', label: 'All techniques' }, ...techniques.map((t) => ({ value: t, label: TECH_LABELS[t] ?? t }))]} className="mb-3 w-full" aria-label="Technique filter" />
          <ul className="max-h-[560px] space-y-0.5 overflow-y-auto pr-1" data-testid="exercise-list">
            {list.map((e) => {
              const pr = bpmProgress(s.exerciseRecords, e.id);
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => setSel(e.id)} className={cx('w-full rounded-lg px-2.5 py-2 text-left', e.id === ex.id ? 'bg-accent-500/15' : 'hover:bg-ink-800')}>
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm text-ink-100">{e.name}</span>{e.custom && <Badge tone="cyan">Mine</Badge>}</div>
                    <div className="text-xs text-ink-400">{TECH_LABELS[e.technique]} · {'●'.repeat(e.difficulty)}{'○'.repeat(5 - e.difficulty)}{pr?.bestCleanBpm ? ` · best ${pr.bestCleanBpm}` : ''}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="min-w-0 space-y-5">
          <Card title={ex.name} subtitle={`${TECH_LABELS[ex.technique]} · difficulty ${ex.difficulty}/5 · ${ex.reps} reps · ${ex.minutes} min`}
            action={<div className="flex gap-2"><Button size="sm" onClick={play}>{playing ? <><LuSquare size={14} /> Stop</> : <><LuVolume2 size={14} /> Hear it</>}</Button>{ex.analyzable && <Button size="sm" onClick={() => navigate(`/analyzer?exercise=${ex.id}`)}><LuAudioLines size={14} /> Analyse</Button>}<Button size="sm" onClick={() => navigate(`/play?exercise=${ex.id}`)}><LuGamepad2 size={14} /> Play mode</Button></div>}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-ink-900 p-3"><div className="label">Start</div><div className="text-xl font-semibold tabular-nums">{ex.bpmStart} <span className="text-xs text-ink-400">bpm</span></div></div>
              <div className="rounded-lg bg-ink-900 p-3"><div className="label">Target</div><div className="text-xl font-semibold tabular-nums">{ex.bpmTarget} <span className="text-xs text-ink-400">bpm</span></div></div>
              <div className="rounded-lg bg-ink-900 p-3"><div className="label">Your next tempo</div><div className="text-xl font-semibold tabular-nums text-accent-300">{nb.bpm} <span className="text-xs text-ink-400">bpm</span></div></div>
            </div>
            <p className="mt-2 text-xs text-ink-400">{nb.reason} Tempos are in beats per minute with {ex.notesPerBeat} note{ex.notesPerBeat > 1 ? 's' : ''} per beat.</p>
            <TabView score={ex.score} />
            <div className="grid gap-4 md:grid-cols-3">
              <div><div className="label mb-1">Instructions</div><ul className="ml-4 list-disc space-y-1 text-sm text-ink-200">{ex.instructions.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><div className="label mb-1">Common mistakes</div><ul className="ml-4 list-disc space-y-1 text-sm text-ink-200">{(ex.mistakes.length ? ex.mistakes : ['Speeding up before it is clean.']).map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><div className="label mb-1">Mastery</div><p className="text-sm text-ink-200">{ex.mastery}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">{ex.easier && <button type="button" className="text-accent-300 hover:underline" onClick={() => setSel(ex.easier!)}>← Easier version</button>}{ex.harder && <button type="button" className="text-accent-300 hover:underline" onClick={() => setSel(ex.harder!)}>Harder version →</button>}</div>
              </div>
            </div>
          </Card>
          <Card title="Practise and log a take" subtitle="Manual entry: your own judgement of a take. Use the Playing Analyzer for measured timing.">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Metronome"><MetronomeWidget bpm={bpm} onBpm={setBpm} subdivision={ex.notesPerBeat >= 4 ? 4 : ex.notesPerBeat} /></Field>
              <Field label="Was it clean?"><Segmented value={clean ? 'y' : 'n'} onChange={(v) => setClean(v === 'y')} size="sm" options={[{ value: 'y', label: 'Clean' }, { value: 'n', label: 'Not yet' }]} /></Field>
              <Field label="Feel (1–5)"><Segmented value={String(rating)} onChange={(v) => setRating(Number(v))} size="sm" options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} /></Field>
              <Button variant="primary" onClick={log} data-testid="log-take"><LuCheck size={16} /> Log take at {bpm} bpm</Button>
            </div>
          </Card>
          <Card title="Progress">
            {!prog ? <p className="text-sm text-ink-300">Log takes to see your tempo history.</p> : (
              <>
                <div className="mb-3 flex flex-wrap gap-4 text-sm"><span className="text-ink-300">First: <b className="text-ink-100">{prog.firstBpm}</b></span><span className="text-ink-300">Best clean: <b className="text-ink-100">{prog.bestCleanBpm || '—'}</b></span><span className="text-ink-300">Comfortable: <b className="text-ink-100">{prog.comfortableBpm || '—'}</b></span><span className="text-ink-300">Takes: <b className="text-ink-100">{prog.records}</b></span></div>
                <LineChart title={`${ex.name} tempo history`} unit=" bpm" data={prog.history.map((h, i) => ({ label: `#${i + 1}`, value: h.bpm, detail: h.clean ? 'clean' : 'not clean' }))} />
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
