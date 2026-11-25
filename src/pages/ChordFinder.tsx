/** Reverse chord lookup: name a chord from a fretboard shape, typed notes, or by listening. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuVolume2, LuMic, LuSquare, LuEraser, LuArrowRight, LuPause, LuPlay } from 'react-icons/lu';
import { chroma, activePitchClasses } from '@gma/audio';
import { midiAt, parseNote, pcName, pcOf, reverseChordLookup, shapePitches, type ChordCandidate } from '@gma/theory';
import { useActiveTuning, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx } from '@/lib/core';
import { MicInput, getContext, micErrorMessage, pluck, type MicError } from '@/lib/audio';
import { Link, useDocumentTitle } from '@/lib/router';
import { Badge, Button, Callout, Card, Field, PageHeader, Segmented, Toggle } from '@/components/ui';
import { Fretboard, type FretMark } from '@/components/music';
import { TuningPicker } from '@/components/widgets';

type Mode = 'fretboard' | 'notes' | 'listen';

export function ChordFinderPage() {
  useDocumentTitle('Chord Finder');
  const s = useStudent();
  const tuning = useActiveTuning();
  const flats = s.profile.noteNames === 'flats';
  const [mode, setMode] = useState<Mode>('fretboard');
  const [frets, setFrets] = useState<(number | null)[]>(() => tuning.strings.map(() => null));
  const [text, setText] = useState('');
  const [rootless, setRootless] = useState(false);
  useEffect(() => setFrets(tuning.strings.map(() => null)), [tuning.id]);

  // Listening state
  const [listening, setListening] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [micError, setMicError] = useState<MicError | null>(null);
  const [chromaV, setChromaV] = useState<number[]>(Array(12).fill(0));
  const mic = useRef<MicInput | null>(null);
  const smooth = useRef<Float32Array>(new Float32Array(12));
  useEffect(() => () => mic.current?.stop(), []);
  useEffect(() => {
    if (!listening || frozen) return;
    const id = setInterval(() => {
      const f = mic.current?.read();
      if (!f) return;
      const c = chroma(f, mic.current!.sampleRate, { a4: s.profile.a4 });
      const sm = smooth.current;
      const silent = c.every((v) => v === 0);
      for (let i = 0; i < 12; i++) sm[i] = silent ? sm[i] * 0.85 : sm[i] * 0.55 + c[i] * 0.45;
      setChromaV([...sm]);
    }, 120);
    return () => clearInterval(id);
  }, [listening, frozen, s.profile.a4]);

  const startListening = async () => {
    setMicError(null);
    const m = new MicInput();
    const r = await m.start(8192);
    if (!r.ok) { setMicError(r.error); return; }
    mic.current = m;
    setListening(true);
    setFrozen(false);
  };
  const stopListening = () => { mic.current?.stop(); mic.current = null; setListening(false); };

  // Input → pitch classes + bass
  const input = useMemo((): { pcs: number[]; bassPc?: number; label: string; midis?: number[] } => {
    if (mode === 'fretboard') {
      const sp = shapePitches(tuning, frets);
      return { pcs: sp.pcs, bassPc: sp.bassPc, midis: sp.midis, label: frets.map((f) => (f === null ? 'x' : f)).join(' ') };
    }
    if (mode === 'notes') {
      const notes = text.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean).map((t) => parseNote(t.replace('♯', '#').replace('♭', 'b'))).filter((n): n is NonNullable<typeof n> => !!n);
      const pcs = [...new Set(notes.map(pcOf))];
      return { pcs, bassPc: notes.length ? pcOf(notes[0]) : undefined, label: text };
    }
    const pcs = activePitchClasses(Float32Array.from(chromaV), 0.55);
    return { pcs, label: pcs.map((p) => pcName(p, flats)).join(' ') };
  }, [mode, frets, text, chromaV, tuning, flats]);

  const results = useMemo(() => reverseChordLookup(input.pcs, { bassPc: input.bassPc, preferFlats: flats, allowRootless: rootless, max: 10 }), [input, flats, rootless]);
  const invalidNotes = mode === 'notes' && text.trim() && text.split(/[\s,]+/).filter(Boolean).some((t) => !parseNote(t.replace('♯', '#').replace('♭', 'b')));

  const pick = (p: { string: number; fret: number }) => {
    setFrets((cur) => cur.map((f, i) => (i === p.string ? (f === p.fret ? null : p.fret) : f)));
    pluck(midiAt(tuning, p.string, p.fret), getContext().currentTime + 0.01, 0.8, 0.6);
  };
  const strumShape = () => {
    const c = getContext();
    const t = c.currentTime + 0.03;
    if (mode === 'fretboard') frets.forEach((f, st) => { if (f !== null) pluck(midiAt(tuning, st, f), t + st * 0.035, 1.8, 0.6); });
    else input.pcs.forEach((pc, i) => pluck(48 + ((pc - (input.bassPc ?? input.pcs[0]) + 12) % 12) + (input.bassPc ?? input.pcs[0]), t + i * 0.04, 1.8, 0.55));
  };

  const marks: FretMark[] = frets.flatMap((f, st) => (f === null ? [] : [{ string: st, fret: f, tone: (results[0] && ((midiAt(tuning, st, f) % 12) === results[0].root) ? 'root' : 'chord') as FretMark['tone'], label: results[0]?.tokens.find((t) => t.pc === midiAt(tuning, st, f) % 12)?.token }]));

  return (
    <div>
      <PageHeader eyebrow="Tools" title="Chord Finder" subtitle="Reverse chord lookup: put a shape on the fretboard, type the notes, or play it and let the app listen. It names the chord, explains every note, and lists alternative names."
        actions={<Segmented value={mode} onChange={(m) => { setMode(m); if (m !== 'listen') stopListening(); }} aria-label="Input method" options={[{ value: 'fretboard', label: 'Fretboard' }, { value: 'notes', label: 'Type notes' }, { value: 'listen', label: 'Listen' }]} />} />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          {mode === 'fretboard' && (
            <Card title="Build the shape" subtitle="Click a fret on each string; click it again to clear. Unmarked strings are muted (x).">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <Field label="Tuning"><TuningPicker value={tuning.id} onChange={(id) => store.setProfile({ tuningId: id })} /></Field>
                <Button onClick={() => setFrets(tuning.strings.map(() => null))}><LuEraser size={14} /> Clear</Button>
                <Button onClick={() => setFrets(tuning.strings.map(() => 0))}>All open</Button>
                <Button onClick={strumShape} disabled={!input.pcs.length}><LuVolume2 size={14} /> Strum</Button>
              </div>
              <Fretboard tuning={tuning} maxFret={15} marks={marks} onPick={pick} leftHanded={s.profile.leftHanded} noteNames="naturals" flats={flats} testId="finder-fretboard" />
              <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Shape per string">
                {[...tuning.strings.keys()].reverse().map((st) => (
                  <button key={st} type="button" onClick={() => setFrets((cur) => cur.map((f, i) => (i === st ? (f === null ? 0 : null) : f)))}
                    className={cx('min-w-14 rounded-lg px-2 py-1 font-mono text-xs', frets[st] === null ? 'bg-ink-800 text-ink-400' : 'bg-accent-500/15 text-accent-300')} title="Toggle muted / open">
                    {pcName(tuning.strings[st] % 12, flats)}: {frets[st] === null ? 'x' : frets[st]}
                  </button>
                ))}
              </div>
            </Card>
          )}
          {mode === 'notes' && (
            <Card title="Type the notes" subtitle="Separate notes with spaces or commas. The first note is treated as the bass.">
              <input className="input font-mono text-base" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. E G B D   or   Bb D F A" aria-label="Notes" data-testid="finder-notes" />
              {invalidNotes && <p className="mt-2 text-xs text-warn-400">Some entries are not note names (use A–G with # or b).</p>}
              <div className="mt-3"><Button onClick={strumShape} disabled={!input.pcs.length}><LuVolume2 size={14} /> Play notes</Button></div>
            </Card>
          )}
          {mode === 'listen' && (
            <Card title="Listen" subtitle="Strum the chord and let it ring. The bars show how strongly each pitch class sounds.">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {!listening ? <Button variant="primary" onClick={() => void startListening()} data-testid="finder-listen"><LuMic size={16} /> Start listening</Button>
                  : <><Button variant="danger" onClick={stopListening}><LuSquare size={14} /> Stop</Button><Button onClick={() => setFrozen((f) => !f)}>{frozen ? <><LuPlay size={14} /> Resume</> : <><LuPause size={14} /> Hold result</>}</Button></>}
              </div>
              {micError && <Callout tone="warn" title="Microphone unavailable">{micErrorMessage(micError)}</Callout>}
              <div className="grid grid-cols-12 items-end gap-1.5" style={{ height: 140 }} role="img" aria-label={`Pitch-class energy: ${chromaV.map((v, i) => `${pcName(i, flats)} ${Math.round(v * 100)}%`).join(', ')}`}>
                {chromaV.map((v, i) => (
                  <div key={i} className="flex h-full flex-col items-center justify-end gap-1">
                    <div className="w-full rounded-t-md transition-[height] duration-150" style={{ height: `${Math.max(2, v * 100)}%`, background: v >= 0.55 ? 'var(--color-viz-1)' : 'var(--color-ink-600)' }} />
                    <span className={cx('text-[11px]', v >= 0.55 ? 'font-semibold text-ink-50' : 'text-ink-400')}>{pcName(i, flats)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-ink-400">Listening cannot tell which note is lowest, so slash-chord bass notes are not shown. Single notes, heavy distortion and open strings ringing from earlier chords reduce accuracy.</p>
            </Card>
          )}
        </div>

        <Card title="Result" subtitle={input.pcs.length ? `Notes: ${input.pcs.map((p) => pcName(p, flats)).join(' ')}${input.bassPc !== undefined ? ` · bass ${pcName(input.bassPc, flats)}` : ''}` : 'Add at least two different notes.'} data-testid="finder-result"
          action={<Toggle checked={rootless} onChange={setRootless} label="Rootless" />}>
          {results.length === 0 ? <p className="text-sm text-ink-300">{input.pcs.length < 2 ? 'Waiting for notes…' : 'No chord type in the library contains exactly these notes. Try removing a note, or allow rootless voicings.'}</p> : (
            <>
              <BestMatch c={results[0]} flats={flats} />
              {results.length > 1 && (
                <div className="mt-5">
                  <div className="label mb-2">Also possible</div>
                  <ul className="space-y-1.5">
                    {results.slice(1).map((c) => (
                      <li key={c.symbol + c.def.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-800 px-3 py-2 text-sm">
                        <span><b className="text-ink-50">{c.symbol}</b> <span className="text-xs text-ink-400">{c.def.name}{c.rootless ? ' · rootless' : ''}{c.missing.length ? ` · no ${c.missing.join(', ')}` : ''}</span></span>
                        <span className="text-[11px] text-ink-400">{c.inversion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function BestMatch({ c, flats }: { c: ChordCandidate; flats: boolean }) {
  const params = new URLSearchParams({ root: pcName(c.root, flats), type: c.def.id });
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-4xl font-semibold text-ink-50" data-testid="finder-best">{c.symbol}</span>
        {c.rootless && <Badge tone="warn">rootless</Badge>}
      </div>
      <div className="mt-1 text-sm text-ink-300">{pcName(c.root, flats)} {c.def.name.toLowerCase()} · {c.inversion}</div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.tokens.map((t) => <Badge key={t.pc} tone={t.token === '1' ? 'accent' : 'neutral'}>{pcName(t.pc, flats)} <span className="text-ink-400">{t.token}</span></Badge>)}
      </div>
      <p className="mt-3 text-xs text-ink-400">Formula {c.def.formula.join(' ')}{c.missing.length ? `; not played: ${c.missing.join(', ')} (optional in guitar voicings)` : ''}.</p>
      <Link to={`/chords?${params.toString()}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-300 hover:underline">More voicings in the Chord Explorer <LuArrowRight size={14} /></Link>
    </div>
  );
}
