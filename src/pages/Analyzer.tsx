/**
 * Real-Time Playing Analyzer (Module B). Records the student over a click,
 * detects note attacks and pitches on the device, and reports only measured
 * results with their confidence. Manual self-assessment is always available.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuMic, LuSquare, LuGauge, LuSave, LuInfo, LuCircleCheck, LuTriangleAlert, LuStar } from 'react-icons/lu';
import { analyseTimingGrid, checkPitches, detectOnsets, timingFeedback, type Feedback, type NotePitchCheck, type TimingResult, type GridMatch } from '@gma/audio';
import { onsetBeats, monophonicPitches, toPlayback, type TabScore } from '@gma/notation';
import type { Exercise } from '@gma/learning';
import { useAllExercises, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, nowIso, uid } from '@/lib/core';
import { Recorder, click, getContext, micErrorMessage, type MicError } from '@/lib/audio';
import { useDocumentTitle, useLocation, Link } from '@/lib/router';
import { Badge, Button, Callout, Card, Field, PageHeader, ProgressBar, Select, Stepper } from '@/components/ui';
import { TabView } from '@/components/music';

const LATENCY_KEY = 'gma.latencyMs';

function readLatency(): number | null {
  try { const v = localStorage.getItem(LATENCY_KEY); return v === null ? null : Number(v); } catch { return null; }
}
function writeLatency(ms: number) {
  try { localStorage.setItem(LATENCY_KEY, String(Math.round(ms))); } catch { /* storage unavailable: value lives for this visit only */ }
}

type Phase = 'idle' | 'countin' | 'recording' | 'analysing' | 'done';

interface Analysis {
  timing: TimingResult & { matches: GridMatch[] };
  pitch?: NotePitchCheck[];
  feedback: Feedback[];
  bpm: number;
  exercise: Exercise;
  monophonic: boolean;
  latencyMs: number;
  peak: number;
}

/** Is every beat of the score a single note (so pitches can be checked)? */
function isMonophonic(score: TabScore) {
  return score.measures.every((m) => m.beats.every((b) => b.notes.length <= 1));
}

export function AnalyzerPage() {
  useDocumentTitle('Playing Analyzer');
  const s = useStudent();
  const all = useAllExercises();
  const { query } = useLocation();
  const analyzable = all.filter((e) => e.analyzable);
  const [exId, setExId] = useState(query.get('exercise') ?? analyzable[0]?.id ?? '');
  const ex = all.find((e) => e.id === exId) ?? analyzable[0];
  const [bpm, setBpm] = useState(ex?.bpmStart ?? 80);
  const [reps, setReps] = useState(2);
  const [countIn, setCountIn] = useState(1);
  const [latency, setLatency] = useState<number | null>(readLatency);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<MicError | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Analysis | null>(null);
  const [calib, setCalib] = useState<{ running: boolean; message?: string }>({ running: false });
  const [manual, setManual] = useState<{ rating: 1 | 2 | 3 | 4 | 5; clean: boolean }>({ rating: 3, clean: false });
  const recRef = useRef<Recorder | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => { const q = query.get('exercise'); if (q) setExId(q); }, [query.get('exercise')]);
  useEffect(() => { if (ex) setBpm(ex.bpmStart); setResult(null); }, [ex?.id]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); recRef.current?.stop(); }, []);

  const beatsPerBar = ex?.score.timeSignature[0] ?? 4;
  const onsets = useMemo(() => (ex ? onsetBeats(ex.score) : []), [ex]);
  const scoreBeats = useMemo(() => (ex ? Math.max(beatsPerBar, Math.ceil(toPlayback(ex.score).reduce((a, n) => Math.max(a, n.time + n.duration), 0) / beatsPerBar) * beatsPerBar) : 0), [ex, beatsPerBar]);
  const takeSeconds = ((countIn * beatsPerBar + scoreBeats * reps) * 60) / bpm;

  const stopAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    recRef.current?.stop();
    recRef.current = null;
    setPhase('idle');
    setProgress(0);
  };

  const record = async () => {
    if (!ex) return;
    setError(null);
    setResult(null);
    const rec = new Recorder();
    const r = await rec.start();
    if (!r.ok) { setError(r.error); return; }
    recRef.current = rec;
    const c = getContext();
    const spb = 60 / bpm;
    const t0 = c.currentTime + 0.35;
    const startNotes = t0 + countIn * beatsPerBar * spb;
    const totalBeats = countIn * beatsPerBar + scoreBeats * reps;
    for (let b = 0; b < totalBeats; b++) click(t0 + b * spb, b % beatsPerBar === 0 ? 3 : 2, b < countIn * beatsPerBar ? 'beep' : 'wood');
    setPhase('countin');
    const startMs = performance.now();
    const totalMs = (t0 - c.currentTime + totalBeats * spb + 0.6) * 1000;
    const tick = () => {
      const el = performance.now() - startMs;
      setProgress(Math.min(1, el / totalMs));
      if (el / 1000 > t0 - c.currentTime + countIn * beatsPerBar * spb) setPhase((p) => (p === 'countin' ? 'recording' : p));
      if (el < totalMs) timers.current.push(setTimeout(tick, 100));
    };
    tick();
    timers.current.push(setTimeout(() => finish(startNotes), totalMs));
  };

  const finish = (startNotes: number) => {
    const rec = recRef.current;
    if (!rec || !ex) return;
    setPhase('analysing');
    const { samples, sampleRate, startTime } = rec.stop();
    recRef.current = null;
    setTimeout(() => {
      const lat = (latency ?? 0) / 1000;
      const spb = 60 / bpm;
      const grid: number[] = [];
      for (let k = 0; k < reps; k++) for (const ob of onsets) grid.push(startNotes - startTime + lat + (k * scoreBeats + ob) * spb);
      let peak = 0;
      for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
      const found = detectOnsets(samples, sampleRate, { minInterval: Math.min(0.06, (spb / Math.max(1, ex.notesPerBeat)) * 0.5) });
      const timing = analyseTimingGrid(found, grid, bpm, { beatsPerBar });
      const mono = isMonophonic(ex.score);
      let pitch: NotePitchCheck[] | undefined;
      if (mono && timing.matches.length) {
        const expected = monophonicPitches(ex.score);
        const perRep = onsets.length;
        pitch = checkPitches(samples, sampleRate, timing.matches.map((m) => m.onsetTime), timing.matches.map((m) => expected[m.index % perRep] ?? expected[0]), s.profile.a4);
      }
      setResult({ timing, pitch, feedback: timingFeedback(timing, bpm, pitch), bpm, exercise: ex, monophonic: mono, latencyMs: latency ?? 0, peak });
      setPhase('done');
      setProgress(1);
    }, 30);
  };

  /** Acoustic loopback calibration: the microphone hears the speaker clicks (or the student taps along). */
  const calibrate = async () => {
    setError(null);
    const rec = new Recorder();
    const r = await rec.start();
    if (!r.ok) { setError(r.error); return; }
    setCalib({ running: true, message: 'Listening… keep the room quiet.' });
    const c = getContext();
    const spb = 0.8;
    const t0 = c.currentTime + 0.5;
    const n = 8;
    for (let i = 0; i < n; i++) click(t0 + i * spb, 3, 'wood');
    setTimeout(() => {
      const { samples, sampleRate, startTime } = rec.stop();
      const found = detectOnsets(samples, sampleRate, { minInterval: 0.2 });
      const offsets: number[] = [];
      for (let i = 0; i < n; i++) {
        const g = t0 - startTime + i * spb;
        const hit = found.find((o) => o.time >= g - 0.02 && o.time <= g + 0.45);
        if (hit) offsets.push((hit.time - g) * 1000);
      }
      if (offsets.length < 5) {
        setCalib({ running: false, message: `Only ${offsets.length} of ${n} clicks were heard. Turn the speaker volume up (not headphones), or tap a muted string exactly on each click, and try again.` });
        return;
      }
      offsets.sort((a, b) => a - b);
      const med = offsets[Math.floor(offsets.length / 2)];
      const spread = offsets[offsets.length - 1] - offsets[0];
      writeLatency(med);
      setLatency(Math.round(med));
      setCalib({ running: false, message: `Measured ${Math.round(med)} ms from ${offsets.length} clicks (spread ${Math.round(spread)} ms).${spread > 40 ? ' The spread is large; consider running it again.' : ''}` });
    }, (0.5 + n * spb + 0.6) * 1000);
  };

  const clean = result ? measuredClean(result) : null;

  const saveMeasured = () => {
    if (!result) return;
    const t = result.timing;
    const measured = result.pitch?.filter((p) => p.detectedMidi !== null) ?? [];
    store.append('exerciseRecords', {
      id: uid('rec'), exerciseId: result.exercise.id, at: nowIso(), bpm: result.bpm, clean: !!clean?.clean, source: 'analyzer',
      analyzer: {
        meanAbsErrorMs: Math.round(t.meanAbsErrorMs * 10) / 10, stdDevMs: Math.round(t.stdDevMs * 10) / 10, driftMsPerBar: Math.round(t.driftMsPerBar * 10) / 10,
        matched: t.matched, expected: t.expectedCount, pitchAccuracy: measured.length >= 4 ? measured.filter((p) => p.correct).length / measured.length : undefined, confidence: t.confidence,
      },
      updatedAt: nowIso(),
    });
    store.toast('Result saved', `${result.exercise.name} at ${result.bpm} bpm${clean?.clean ? ' — counted as a clean take' : ''}.`, 'success');
  };

  const saveManual = () => {
    if (!ex) return;
    store.append('exerciseRecords', { id: uid('rec'), exerciseId: ex.id, at: nowIso(), bpm, clean: manual.clean, rating: manual.rating, source: 'manual', updatedAt: nowIso() });
    store.toast('Self-assessment saved', `${ex.name} at ${bpm} bpm.`, 'success');
  };

  const history = useMemo(() => s.exerciseRecords.filter((r) => r.exerciseId === ex?.id && r.source === 'analyzer').slice(-8).reverse(), [s.exerciseRecords, ex?.id]);
  const busy = phase === 'countin' || phase === 'recording' || phase === 'analysing';

  if (!ex) return <div><PageHeader title="Playing Analyzer" /><Callout tone="warn">No analyzable exercises are available.</Callout></div>;

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Playing Analyzer" subtitle="Play an exercise against the click. The analyzer measures your note timing (and pitch, for single-note lines) from the microphone, on this device." />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Exercise" className="sm:col-span-2">
                <Select value={ex.id} onChange={setExId} aria-label="Exercise" data-testid="analyzer-exercise"
                  options={all.map((e) => ({ value: e.id, label: `${e.name}${e.analyzable ? '' : ' (not measurable)'}`, group: e.custom ? 'My exercises' : `Level ${e.level}` }))} />
              </Field>
              <Field label="Tempo"><Stepper value={bpm} onChange={setBpm} min={30} max={260} step={2} suffix="bpm" label="Tempo" /></Field>
              <Field label="Repeats / count-in">
                <div className="flex gap-2">
                  <Select value={String(reps)} onChange={(v) => setReps(Number(v))} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}×` }))} aria-label="Repeats" />
                  <Select value={String(countIn)} onChange={(v) => setCountIn(Number(v))} options={[1, 2].map((n) => ({ value: String(n), label: `${n} bar${n > 1 ? 's' : ''}` }))} aria-label="Count-in" />
                </div>
              </Field>
            </div>
            <TabView score={ex.score} className="mt-4" caption={`${onsets.length} note attacks per repeat · ${ex.notesPerBeat} per beat · target ${ex.bpmTarget} bpm`} />
            {!ex.analyzable && <Callout tone="warn" title="Limited measurement">This exercise relies on legato, bends or chords, which do not produce clear, separate attacks. Timing results may be unreliable; use the self-assessment instead.</Callout>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!busy ? (
                <Button variant="primary" size="lg" onClick={() => void record()} data-testid="analyzer-record"><LuMic size={18} /> Record take ({Math.round(takeSeconds)} s)</Button>
              ) : (
                <Button variant="danger" size="lg" onClick={stopAll} data-testid="analyzer-stop"><LuSquare size={18} /> Cancel</Button>
              )}
              <div className="min-w-48 flex-1">
                <div className="mb-1 text-xs text-ink-400" aria-live="polite" data-testid="analyzer-phase">
                  {phase === 'idle' && (latency === null ? 'Tip: calibrate latency first for accurate timing.' : `Latency compensation: ${latency} ms`)}
                  {phase === 'countin' && 'Count-in… start on the first wood-block click.'}
                  {phase === 'recording' && 'Recording — play now.'}
                  {phase === 'analysing' && 'Analysing…'}
                  {phase === 'done' && 'Take analysed.'}
                </div>
                <ProgressBar value={progress} label="Take progress" />
              </div>
            </div>
            {error && <Callout tone="warn" title="Microphone unavailable">{micErrorMessage(error)} You can still log a self-assessment below.</Callout>}
          </Card>

          {result && <ResultView r={result} clean={clean!} onSave={saveMeasured} />}

          <Card title="Self-assessment" subtitle="Use this when measurement is not possible or not reliable (noisy room, chords, legato, no microphone).">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="How did it feel?">
                <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={manual.rating === n} onClick={() => setManual({ ...manual, rating: n as 1 })} className={cx('rounded-md p-1.5', n <= manual.rating ? 'text-warn-400' : 'text-ink-500')} aria-label={`${n} of 5`}><LuStar size={20} /></button>
                  ))}
                </div>
              </Field>
              <label className="inline-flex items-center gap-2 text-sm text-ink-200"><input type="checkbox" checked={manual.clean} onChange={(e) => setManual({ ...manual, clean: e.target.checked })} /> Clean take at {bpm} bpm (no mistakes, even timing, relaxed)</label>
              <Button onClick={saveManual} data-testid="analyzer-manual-save"><LuSave size={14} /> Save self-assessment</Button>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Latency calibration" subtitle="Audio output and microphone input each add delay. Measuring it once per device makes timing results accurate.">
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-ink-300">
              <li>Use speakers, not headphones, at a moderate volume.</li>
              <li>Press Calibrate and stay quiet for about 7 seconds while 8 clicks play.</li>
              <li>No speakers? Tap a muted string exactly on each click instead.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void calibrate()} disabled={calib.running || busy} data-testid="analyzer-calibrate"><LuGauge size={14} /> {calib.running ? 'Calibrating…' : 'Calibrate'}</Button>
              <Stepper value={latency ?? 0} onChange={(v) => { setLatency(v); writeLatency(v); }} min={0} max={500} step={5} suffix="ms" label="Latency" />
            </div>
            {calib.message && <p className="mt-2 text-xs text-ink-300" data-testid="analyzer-calib-message">{calib.message}</p>}
          </Card>
          <Card title="How it works">
            <ul className="space-y-2 text-sm text-ink-300">
              <li><b className="text-ink-100">Timing</b>: note attacks are found with spectral-flux onset detection and matched to the expected beat positions.</li>
              <li><b className="text-ink-100">Pitch</b>: for single-note exercises, each matched note is checked with the same YIN pitch detector the tuner uses.</li>
              <li><b className="text-ink-100">Confidence</b> depends on how many notes were matched: high (12+), medium (6+), low.</li>
              <li>Nothing is estimated or invented: if a value could not be measured it is not shown. Audio never leaves your device.</li>
            </ul>
          </Card>
          {history.length > 0 && (
            <Card title="Recent measured takes">
              <ul className="space-y-1.5 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <span className="tabular-nums text-ink-200">{h.bpm} bpm</span>
                    <span className="tabular-nums text-ink-400">±{h.analyzer?.meanAbsErrorMs.toFixed(0)} ms · {h.analyzer?.matched}/{h.analyzer?.expected}</span>
                    {h.clean ? <Badge tone="ok">clean</Badge> : <Badge>not clean</Badge>}
                  </li>
                ))}
              </ul>
              <Link to={`/technique-lab?exercise=${ex.id}`} className="mt-3 inline-block text-xs text-accent-300 hover:underline">Open in Technique Lab →</Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** The measured definition of a clean take; every criterion is shown to the student. */
function measuredClean(r: Analysis) {
  const t = r.timing;
  const measured = r.pitch?.filter((p) => p.detectedMidi !== null) ?? [];
  const pitchAcc = measured.length >= 4 ? measured.filter((p) => p.correct).length / measured.length : null;
  const criteria = [
    { label: 'Confidence at least medium', ok: t.confidence !== 'low' },
    { label: 'At least 90% of notes matched to the beat', ok: t.matched / Math.max(1, t.expectedCount) >= 0.9 },
    { label: 'Average timing error 20 ms or less', ok: t.meanAbsErrorMs <= 20 },
    ...(pitchAcc !== null ? [{ label: 'At least 90% of measured pitches correct', ok: pitchAcc >= 0.9 }] : []),
  ];
  return { clean: criteria.every((c) => c.ok), criteria, pitchAcc };
}

function ResultView({ r, clean, onSave }: { r: Analysis; clean: ReturnType<typeof measuredClean>; onSave: () => void }) {
  const t = r.timing;
  const lowSignal = r.peak < 0.02;
  // With fewer than 4 matched notes, averages would describe noise: show only the counts.
  const ok = t.matched >= 4;
  return (
    <Card title="Results" subtitle={`${r.exercise.name} at ${r.bpm} bpm`} action={<Badge tone={t.confidence === 'high' ? 'ok' : t.confidence === 'medium' ? 'warn' : 'bad'}>Confidence: {t.confidence}</Badge>} data-testid="analyzer-result">
      {lowSignal && <Callout tone="warn" title="Very quiet recording">The loudest sound recorded was very soft. Move the guitar or amp closer to the microphone, or raise the input level.</Callout>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Notes matched" value={`${t.matched} / ${t.expectedCount}`} />
        <Metric label="Average error" value={ok ? `${t.meanAbsErrorMs.toFixed(0)} ms` : '—'} />
        <Metric label="Rushing / dragging" value={ok ? `${t.meanErrorMs > 0 ? '+' : ''}${t.meanErrorMs.toFixed(0)} ms` : '—'} hint={ok ? (t.meanErrorMs < -5 ? 'ahead of the beat' : t.meanErrorMs > 5 ? 'behind the beat' : 'centred') : undefined} />
        <Metric label="Consistency (spread)" value={ok ? `${t.stdDevMs.toFixed(0)} ms` : '—'} />
        <Metric label="Tempo drift" value={ok ? `${t.driftMsPerBar.toFixed(1)} ms/bar` : '—'} />
        <Metric label="Within ±25 ms" value={ok ? `${Math.round(t.tightRatio * 100)}%` : '—'} />
        <Metric label="Extra attacks" value={String(t.extra)} hint="sounds between expected notes" />
        <Metric label="Pitch accuracy" value={clean.pitchAcc !== null ? `${Math.round(clean.pitchAcc * 100)}%` : r.monophonic ? 'not measured' : 'n/a (chords)'} />
      </div>
      {ok && <TimingStrip matches={t.matches} expected={t.expectedCount} />}
      <ul className="mt-4 space-y-2">
        {r.feedback.map((f, i) => (
          <li key={i} className="flex gap-2.5 text-sm">
            <span className={cx('mt-0.5 shrink-0', f.severity === 'good' ? 'text-ok-400' : f.severity === 'warn' ? 'text-warn-400' : 'text-cyan-400')}>{f.severity === 'good' ? <LuCircleCheck size={16} /> : f.severity === 'warn' ? <LuTriangleAlert size={16} /> : <LuInfo size={16} />}</span>
            <span className="text-ink-200">{f.message} <span className="text-xs text-ink-400">({f.evidence})</span></span>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl border border-ink-700 p-3">
        <div className="mb-2 text-sm font-medium text-ink-100">{clean.clean ? 'This take counts as clean.' : 'This take does not meet the clean-take criteria yet.'}</div>
        <ul className="grid gap-1 text-xs sm:grid-cols-2">
          {clean.criteria.map((c) => <li key={c.label} className={c.ok ? 'text-ok-400' : 'text-ink-400'}>{c.ok ? '✓' : '○'} {c.label}</li>)}
        </ul>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onSave} data-testid="analyzer-save"><LuSave size={14} /> Save result</Button>
        <span className="self-center text-xs text-ink-400">Latency compensation used: {r.latencyMs} ms</span>
      </div>
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2">
      <div className="text-xs text-ink-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-ink-50">{value}</div>
      {hint && <div className="text-[11px] text-ink-500">{hint}</div>}
    </div>
  );
}

/** Per-note timing errors: dots above the line are late, below are early; the band is ±25 ms. */
function TimingStrip({ matches, expected }: { matches: GridMatch[]; expected: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 150, left = 40, top = 10, bottom = 20;
  const lim = Math.max(50, Math.ceil(Math.max(...matches.map((m) => Math.abs(m.errorMs))) / 25) * 25);
  const x = (i: number) => left + ((i + 0.5) / Math.max(1, expected)) * (W - left - 8);
  const y = (ms: number) => top + ((lim - ms) / (2 * lim)) * (H - top - bottom);
  const hm = hover !== null ? matches[hover] : null;
  return (
    <figure className="relative mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Timing error per note: ${matches.map((m) => `note ${m.index + 1} ${m.errorMs.toFixed(0)} ms`).join(', ')}`}>
        <rect x={left} y={y(25)} width={W - left - 8} height={y(-25) - y(25)} style={{ fill: 'var(--color-ok-500)' }} opacity="0.1" />
        {[lim, 0, -lim].map((v) => (
          <g key={v}>
            <line x1={left} x2={W - 8} y1={y(v)} y2={y(v)} style={{ stroke: v === 0 ? 'var(--color-ink-500)' : 'var(--color-ink-700)' }} strokeWidth="1" />
            <text x={left - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" className="svg-axis">{v > 0 ? `+${v}` : v}</text>
          </g>
        ))}
        <text x={left + 4} y={top + 9} fontSize="9.5" className="svg-axis">late</text>
        <text x={left + 4} y={H - bottom - 3} fontSize="9.5" className="svg-axis">early</text>
        {matches.map((m, i) => (
          <g key={m.index} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={x(m.index) - 8} y={top} width={16} height={H - top - bottom} fill="transparent" />
            <circle cx={x(m.index)} cy={y(m.errorMs)} r={hover === i ? 5.5 : 4} style={{ fill: 'var(--color-viz-1)' }} className="svg-dot-ring" strokeWidth="2" />
          </g>
        ))}
        <text x={(W + left) / 2} y={H - 4} textAnchor="middle" fontSize="9.5" className="svg-axis">note</text>
      </svg>
      {hm && (
        <div className="pointer-events-none absolute top-0 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-xs text-ink-100 shadow-lg" style={{ left: `${(x(hm.index) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          Note {hm.index + 1}: <span className="tabular-nums">{hm.errorMs > 0 ? '+' : ''}{hm.errorMs.toFixed(0)} ms</span> {Math.abs(hm.errorMs) <= 25 ? '(tight)' : hm.errorMs > 0 ? '(late)' : '(early)'}
        </div>
      )}
      <figcaption className="mt-1 text-xs text-ink-400">Each dot is one matched note. The green band is ±25 ms. Unmatched notes are not drawn.</figcaption>
    </figure>
  );
}
