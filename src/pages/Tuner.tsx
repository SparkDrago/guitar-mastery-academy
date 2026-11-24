import { useEffect, useRef, useState } from 'react';
import { LuMic, LuMicOff, LuVolume2, LuPlus, LuCheck } from 'react-icons/lu';
import { TunerEngine, type TunerReading } from '@gma/audio';
import { midiName, midiToFreq, tuningLabel } from '@gma/theory';
import { MicInput, decimate, getContext, micErrorMessage, referenceTone, type MicError } from '@/lib/audio';
import { useActiveTuning, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx } from '@/lib/core';
import { useDocumentTitle } from '@/lib/router';
import { Button, Callout, Card, PageHeader, Segmented, Stepper } from '@/components/ui';
import { TuningPicker } from '@/components/widgets';
import { TuningEditorModal } from '@/components/TuningEditor';

function Needle({ cents, status, active }: { cents: number; status: TunerReading['status'] | null; active: boolean }) {
  const c = Math.max(-50, Math.min(50, cents));
  const angle = (c / 50) * 60;
  const color = !active ? 'var(--color-ink-500)' : status === 'in-tune' ? 'var(--color-ok-400)' : Math.abs(c) < 15 ? 'var(--color-warn-400)' : 'var(--color-bad-400)';
  const ticks = Array.from({ length: 21 }, (_, i) => -50 + i * 5);
  return (
    <svg viewBox="0 0 300 170" className="mx-auto w-full max-w-[420px]" role="img" aria-label={active ? `${c > 0 ? '+' : ''}${c.toFixed(0)} cents` : 'No pitch'}>
      <path d="M 40 150 A 110 110 0 0 1 260 150" fill="none" className="svg-track" stroke="#1d1839" strokeWidth="18" strokeLinecap="round" />
      <path d="M 143.6 40.2 A 110 110 0 0 1 156.4 40.2" fill="none" style={{ stroke: 'var(--color-ok-500)' }} strokeWidth="18" opacity="0.55" />
      {ticks.map((t) => {
        const a = ((t / 50) * 60 - 90) * (Math.PI / 180);
        const r1 = t % 25 === 0 ? 86 : 92;
        return <line key={t} x1={150 + Math.cos(a) * r1} y1={150 + Math.sin(a) * r1} x2={150 + Math.cos(a) * 100} y2={150 + Math.sin(a) * 100} style={{ stroke: t === 0 ? 'var(--color-ok-400)' : 'var(--color-ink-500)' }} strokeWidth={t % 25 === 0 ? 2 : 1} />;
      })}
      <text x="40" y="168" fontSize="11" className="svg-axis" textAnchor="middle">−50</text>
      <text x="260" y="168" fontSize="11" className="svg-axis" textAnchor="middle">+50</text>
      <g style={{ transform: `rotate(${active ? angle : 0}deg)`, transformOrigin: '150px 150px', transition: 'transform 90ms linear' }}>
        <line x1="150" y1="150" x2="150" y2="52" style={{ stroke: color }} strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <circle cx="150" cy="150" r="8" style={{ fill: color }} />
    </svg>
  );
}

export function TunerPage() {
  useDocumentTitle('Tuner');
  const s = useStudent();
  const tuning = useActiveTuning();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<MicError | null>(null);
  const [reading, setReading] = useState<TunerReading | null>(null);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manual, setManual] = useState(0);
  const [tuned, setTuned] = useState<Record<number, number>>({});
  const [editor, setEditor] = useState(false);
  const mic = useRef<MicInput | null>(null);
  const engine = useRef(new TunerEngine({ a4: s.profile.a4 }));
  const raf = useRef(0);
  const stopTone = useRef<(() => void) | null>(null);

  useEffect(() => { engine.current.setA4(s.profile.a4); }, [s.profile.a4]);
  useEffect(() => { setTuned({}); setManual(0); engine.current.reset(); }, [tuning.id]);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    mic.current?.stop();
    mic.current = null;
    setRunning(false);
    setReading(null);
  };
  useEffect(() => () => { cancelAnimationFrame(raf.current); mic.current?.stop(); stopTone.current?.(); }, []);

  const start = async () => {
    setError(null);
    getContext();
    const m = new MicInput();
    const r = await m.start(4096);
    if (!r.ok) { setError(r.error); return; }
    mic.current = m;
    engine.current.reset();
    setRunning(true);
    const lowest = Math.min(...tuning.strings);
    const minFreq = Math.max(25, midiToFreq(lowest, s.profile.a4) * 0.6);
    engine.current.setMinFreq(minFreq);
    const factor = m.sampleRate > 60000 ? 4 : m.sampleRate > 30000 ? 2 : 1;
    let frame = 0;
    const loop = () => {
      raf.current = requestAnimationFrame(loop);
      if (frame++ % 2) return; // ~30 analyses per second
      const buf = m.read();
      if (!buf) return;
      const small = decimate(buf, factor);
      const res = engine.current.process(small, m.sampleRate / factor, tuning.strings, modeRef.current === 'manual' ? manualRef.current : undefined);
      setReading(res);
      if (res?.locked && res.target) setTuned((t) => ({ ...t, [res.target!.index]: Date.now() }));
    };
    loop();
  };

  const modeRef = useRef(mode);
  const manualRef = useRef(manual);
  modeRef.current = mode;
  manualRef.current = manual;

  const playRef = (i: number) => {
    stopTone.current?.();
    stopTone.current = referenceTone(midiToFreq(tuning.strings[i], s.profile.a4), 2.5);
    if (mode === 'manual') setManual(i);
  };

  const active = !!reading;
  const targetCents = reading ? (reading.target && !reading.target.octaveHint ? reading.target.cents : reading.cents) : 0;
  const flats = tuning.name.includes('♭');

  return (
    <div>
      <PageHeader title="Tuner" eyebrow="Tools" subtitle="Chromatic tuner: detects all 12 notes, with presets for standard, drop, open, alternate and extended-range tunings plus your own." />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <div className="flex flex-col items-center py-2">
            <div className="flex items-baseline gap-1" aria-live="polite" data-testid="tuner-note">
              <span className={cx('text-7xl font-semibold tabular-nums sm:text-8xl', active ? (reading!.status === 'in-tune' ? 'text-ok-400' : 'text-ink-50') : 'text-ink-600')}>{active ? reading!.note : '–'}</span>
              <span className="text-2xl text-ink-400">{active ? reading!.octave : ''}</span>
            </div>
            <Needle cents={targetCents} status={reading?.status ?? null} active={active} />
            <div className="mt-1 grid w-full max-w-md grid-cols-3 text-center">
              <div><div className="label">Frequency</div><div className="mt-1 font-mono text-lg tabular-nums text-ink-100" data-testid="tuner-hz">{active ? reading!.freq.toFixed(1) : '—'} <span className="text-xs text-ink-400">Hz</span></div></div>
              <div><div className="label">Cents</div><div className="mt-1 font-mono text-lg tabular-nums text-ink-100">{active ? `${targetCents > 0 ? '+' : ''}${targetCents.toFixed(0)}` : '—'}</div></div>
              <div><div className="label">Status</div><div className={cx('mt-1 text-lg font-medium', !active ? 'text-ink-500' : reading!.status === 'in-tune' ? 'text-ok-400' : 'text-warn-400')}>{!active ? '—' : reading!.status === 'in-tune' ? (reading!.locked ? 'In tune ✓' : 'In tune') : reading!.status === 'flat' ? 'Flat ↑' : 'Sharp ↓'}</div></div>
            </div>
            {reading?.target && (
              <p className="mt-3 text-sm text-ink-300">
                {mode === 'auto' ? 'Closest string: ' : 'Tuning string: '}<b className="text-ink-100">{tuning.strings.length - reading.target.index} ({midiName(reading.target.midi, flats)}, {reading.target.freq.toFixed(2)} Hz)</b>
                {reading.target.octaveHint && <span className="ml-1 text-warn-400">· You are an octave {reading.target.octaveHint === 'down' ? 'too high' : 'too low'}; check the string.</span>}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {running ? <Button size="lg" onClick={stop}><LuMicOff size={18} /> Stop</Button> : <Button size="lg" variant="primary" onClick={start} data-testid="tuner-start"><LuMic size={18} /> Start tuner</Button>}
            </div>
            {error && <div className="mt-4 w-full max-w-lg"><Callout tone="warn" title="Microphone unavailable">{micErrorMessage(error)}</Callout></div>}
            {running && !active && <p className="mt-3 text-sm text-ink-400">Listening… pick a single string and let it ring.</p>}
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Tuning" action={<Button size="sm" variant="ghost" onClick={() => setEditor(true)}><LuPlus size={14} /> Custom</Button>}>
            <TuningPicker value={tuning.id} onChange={(id) => store.setProfile({ tuningId: id })} className="w-full" testId="tuner-tuning" />
            <p className="mt-2 font-mono text-xs text-ink-300">{tuning.strings.length} strings · {tuningLabel(tuning)}</p>
            <div className="mt-3"><Segmented value={mode} onChange={setMode} size="sm" options={[{ value: 'auto', label: 'Auto-detect string' }, { value: 'manual', label: 'Select string' }]} /></div>
            <ul className="mt-3 space-y-1.5" data-testid="tuner-strings">
              {[...tuning.strings.keys()].reverse().map((i) => {
                const isTarget = reading?.target?.index === i;
                const done = tuned[i];
                return (
                  <li key={i}>
                    <div className={cx('flex items-center gap-2 rounded-lg border px-2.5 py-1.5', mode === 'manual' && manual === i ? 'border-accent-500 bg-accent-500/10' : isTarget ? 'border-ink-400 bg-ink-800' : 'border-ink-700')}>
                      <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => { setMode('manual'); setManual(i); }} aria-label={`Select string ${tuning.strings.length - i}`}>
                        <span className="w-5 text-center text-xs text-ink-400">{tuning.strings.length - i}</span>
                        <span className="w-10 font-mono text-sm font-semibold text-ink-50">{midiName(tuning.strings[i], flats)}</span>
                        <span className="font-mono text-xs text-ink-300">{midiToFreq(tuning.strings[i], s.profile.a4).toFixed(2)} Hz</span>
                        {isTarget && reading && <span className={cx('ml-auto font-mono text-xs', reading.status === 'in-tune' ? 'text-ok-400' : 'text-warn-400')}>{targetCents > 0 ? '+' : ''}{targetCents.toFixed(0)}¢</span>}
                        {done && !isTarget && <LuCheck size={14} className="ml-auto text-ok-400" aria-label="In tune" />}
                      </button>
                      <button type="button" onClick={() => playRef(i)} className="rounded-md p-1 text-ink-300 hover:bg-ink-700 hover:text-ink-50" aria-label={`Play reference tone for string ${tuning.strings.length - i}`}><LuVolume2 size={15} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title="Reference pitch">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-300">A4 =</span>
              <Stepper value={s.profile.a4} onChange={(v) => store.setProfile({ a4: v })} min={415} max={466} label="A4 reference" suffix="Hz" />
            </div>
          </Card>
          <Callout tone="info" title="Privacy">
            Microphone audio is analysed on this device in real time. Nothing is recorded or uploaded. The microphone needs HTTPS and your permission.
          </Callout>
        </div>
      </div>
      {editor && <TuningEditorModal open onClose={() => setEditor(false)} />}
    </div>
  );
}
