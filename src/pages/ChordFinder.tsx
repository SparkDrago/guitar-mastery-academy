/**
 * Chord Finder: find voicings for any chord (with slash bass and style filters),
 * identify a chord from a shape, typed notes or by listening, and show its
 * arpeggio across the neck in five positions.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LuVolume2, LuMic, LuSquare, LuEraser, LuArrowRight, LuPause, LuPlay } from 'react-icons/lu';
import { chroma, activePitchClasses } from '@gma/audio';
import {
  CHORD_FORMULAS, buildArpeggioPositions, buildFullNeckArpeggio, generateVoicings, intervalLabel, midiAt, mod12, parseNote, pcName, pcOf,
  pitchClassToName, reverseChordLookup, shapePitches, toDiagramVoicing, type ChordCandidate, type ChordFormula, type VoicingFilter,
} from '@gma/theory';
import { useActiveTuning, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx } from '@/lib/core';
import { MicInput, getContext, micErrorMessage, pluck, type MicError } from '@/lib/audio';
import { Link, navigate, useDocumentTitle, useLocation } from '@/lib/router';
import { Badge, Button, Callout, Card, Field, PageHeader, Segmented, Select, Toggle } from '@/components/ui';
import { ChordDiagram, Fretboard, type FretMark } from '@/components/music';
import { TuningPicker } from '@/components/widgets';

type Mode = 'fretboard' | 'notes' | 'listen';
type Tool = 'voicings' | 'identify' | 'arpeggios';

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'voicings', label: 'Find voicings' },
  { value: 'identify', label: 'Identify' },
  { value: 'arpeggios', label: 'Arpeggios' },
];

export function ChordFinderPage() {
  useDocumentTitle('Chord Finder');
  const { query } = useLocation();
  const tool: Tool = TOOLS.some((t) => t.value === query.get('tool')) ? (query.get('tool') as Tool) : 'identify';
  const s = useStudent();
  const flats = s.profile.noteNames === 'flats';
  // Root and chord type are shared by Find voicings and Arpeggios.
  const [rootPc, setRootPc] = useState(() => { const r = query.get('root'); const n = r ? parseNote(r) : null; return n ? pcOf(n) : 0; });
  const [formulaId, setFormulaId] = useState(() => (CHORD_FORMULAS.some((f) => f.id === query.get('type')) ? query.get('type')! : 'maj'));
  const qRoot = query.get('root'), qType = query.get('type');
  useEffect(() => { const n = qRoot ? parseNote(qRoot) : null; if (n) setRootPc(pcOf(n)); }, [qRoot]);
  useEffect(() => { if (qType && CHORD_FORMULAS.some((f) => f.id === qType)) setFormulaId(qType); }, [qType]);
  const formula = CHORD_FORMULAS.find((f) => f.id === formulaId) ?? CHORD_FORMULAS[0];
  const setTool = (t: Tool) => navigate(`/chord-finder?tool=${t}`);
  const chordPicker = (
    <ChordPicker rootPc={rootPc} onRoot={setRootPc} formulaId={formulaId} onFormula={setFormulaId} flats={flats} />
  );
  return (
    <div>
      <PageHeader eyebrow="Tools" title="Chord Finder" subtitle="Find playable voicings for any chord, name a chord from a shape or by ear, and see its arpeggio across the neck."
        actions={<Segmented value={tool} onChange={setTool} aria-label="Tool" options={TOOLS} data-testid="finder-tool" />} />
      {tool === 'identify' && <IdentifyTool />}
      {tool === 'voicings' && <VoicingsTool rootPc={rootPc} formula={formula} flats={flats} picker={chordPicker} onArpeggio={() => setTool('arpeggios')} />}
      {tool === 'arpeggios' && <ArpeggioTool rootPc={rootPc} formula={formula} flats={flats} picker={chordPicker} onVoicings={() => setTool('voicings')} />}
    </div>
  );
}

function ChordPicker({ rootPc, onRoot, formulaId, onFormula, flats }: { rootPc: number; onRoot: (pc: number) => void; formulaId: string; onFormula: (id: string) => void; flats: boolean }) {
  return (
    <>
      <Field label="Root"><Select value={String(rootPc)} onChange={(v) => onRoot(Number(v))} className="w-full min-w-0" aria-label="Root" options={[...Array(12).keys()].map((pc) => ({ value: String(pc), label: pitchClassToName(pc, flats) }))} data-testid="finder-root" /></Field>
      <Field label="Chord"><Select value={formulaId} onChange={onFormula} className="w-full min-w-0" aria-label="Chord type" options={CHORD_FORMULAS.map((f) => ({ value: f.id, label: `${f.symbol || 'maj'} · ${f.name}` }))} data-testid="finder-type" /></Field>
    </>
  );
}

const chordName = (rootPc: number, f: ChordFormula, flats: boolean, bassPc?: number | null) =>
  `${pitchClassToName(rootPc, flats)}${f.symbol}${bassPc !== null && bassPc !== undefined && mod12(bassPc) !== mod12(rootPc) ? `/${pitchClassToName(bassPc, flats)}` : ''}`;

/** Strum (low to high) or play notes one after another. */
function playNotes(midis: number[], mode: 'strum' | 'arpeggio', gap = 0.16) {
  const c = getContext();
  const t = c.currentTime + 0.03;
  midis.forEach((m, i) => pluck(m, t + i * (mode === 'strum' ? 0.03 : gap), mode === 'strum' ? 1.8 : 0.7, 0.6));
}

function ChordFacts({ rootPc, formula, flats }: { rootPc: number; formula: ChordFormula; flats: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {formula.intervals.map((iv) => (
        <Badge key={iv} tone={iv === 0 ? 'accent' : 'neutral'}>
          {pitchClassToName(rootPc + iv, flats)} <span className="text-ink-400">{intervalLabel(iv, iv >= 12)}{formula.optional?.includes(iv) ? ' (opt.)' : ''}</span>
        </Badge>
      ))}
    </div>
  );
}

// ── Find voicings ────────────────────────────────────────────────────────

const FILTERS: { value: VoicingFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'barre', label: 'Barre' },
  { value: 'shell', label: 'Shell (3–4)' }, { value: 'triad', label: 'Triads' },
];

function VoicingsTool({ rootPc, formula, flats, picker, onArpeggio }: { rootPc: number; formula: ChordFormula; flats: boolean; picker: ReactNode; onArpeggio: () => void }) {
  const s = useStudent();
  const tuning = useActiveTuning();
  const [bassPc, setBassPc] = useState<number | null>(null);
  const [filter, setFilter] = useState<VoicingFilter>('all');
  const [labels, setLabels] = useState<'finger' | 'interval' | 'note'>('finger');
  const [sel, setSel] = useState(0);
  const voicings = useMemo(() => generateVoicings(rootPc, formula, { tuning: tuning.strings, bassPc, filter, limit: 24 }), [rootPc, formula, bassPc, filter, tuning.strings]);
  useEffect(() => setSel(0), [rootPc, formula.id, bassPc, filter, tuning.id]);
  const active = voicings[sel] ?? voicings[0];
  const name = chordName(rootPc, formula, flats, bassPc);
  const marks: FretMark[] = active ? active.frets.flatMap((f, st) => (f === null ? [] : [{
    string: st, fret: f, tone: (mod12(tuning.strings[st] + f) === mod12(rootPc) ? 'root' : 'chord') as FretMark['tone'],
    label: toDiagramVoicing(active, rootPc, formula).tokens[st] ?? undefined,
  }])) : [];
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <Card title="Chord" className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {picker}
          <Field label="Bass note" hint="Pick a note to get slash-chord voicings (e.g. C/E).">
            <Select value={bassPc === null ? '' : String(bassPc)} onChange={(v) => setBassPc(v === '' ? null : Number(v))} className="w-full min-w-0" aria-label="Bass note"
              options={[{ value: '', label: 'Root in the bass' }, ...[...Array(12).keys()].map((pc) => ({ value: String(pc), label: `/${pitchClassToName(pc, flats)}` }))]} data-testid="finder-bass" />
          </Field>
          <Field label="Tuning"><TuningPicker className="w-full min-w-0" value={tuning.id} onChange={(id) => store.setProfile({ tuningId: id })} /></Field>
          <div>
            <div className="text-3xl font-semibold text-ink-50" data-testid="finder-voicing-name">{name}</div>
            <div className="mt-1 text-sm text-ink-300">{formula.name}</div>
          </div>
          <ChordFacts rootPc={rootPc} formula={formula} flats={flats} />
          <Button variant="ghost" onClick={onArpeggio}>Arpeggio of {name.split('/')[0]} <LuArrowRight size={14} /></Button>
        </div>
      </Card>
      <div className="min-w-0 space-y-5">
        <Card title={`Voicings (${voicings.length})`} subtitle="Playable within one hand position: every required chord tone, the right bass note, at most one muted string inside the shape. Click a diagram to hear it."
>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Segmented size="sm" value={filter} onChange={setFilter} aria-label="Voicing style" options={FILTERS} data-testid="finder-filter" />
            <Segmented size="sm" value={labels} onChange={setLabels} aria-label="Diagram labels" options={[{ value: 'finger', label: 'Fingers' }, { value: 'interval', label: 'Intervals' }, { value: 'note', label: 'Notes' }]} />
          </div>
          {voicings.length === 0 ? <p className="text-sm text-ink-300">No playable voicing of {name} matches this style in this tuning. Try “All”, or another bass note.</p> : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-3" data-testid="finder-voicings">
              {voicings.map((v, i) => (
                <button key={v.frets.join(',')} type="button" onClick={() => { setSel(i); playNotes(v.midiNotes, 'strum'); }}
                  className={cx('rounded-xl border p-2 text-center transition-colors', i === sel ? 'border-accent-400 bg-accent-500/10' : 'border-ink-700 bg-ink-800/60 hover:bg-ink-800')}
                  aria-pressed={i === sel} aria-label={`${name} voicing ${v.frets.map((f) => (f === null ? 'x' : f)).join(' ')}`}>
                  <ChordDiagram voicing={toDiagramVoicing(v, rootPc, formula)} tuning={tuning} labels={labels} size={0.9} />
                  <div className="mt-1 font-mono text-[11px] text-ink-300">{v.frets.map((f) => (f === null ? 'x' : f)).join(' ')}</div>
                  <div className="text-[10px] text-ink-400">{v.isOpen ? 'open' : `fret ${v.baseFret}`}{v.barreFret ? ` · barre ${v.barreFret}` : ''}</div>
                </button>
              ))}
            </div>
          )}
        </Card>
        {active && (
          <Card title="On the neck" subtitle={`${name}: ${active.frets.map((f) => (f === null ? 'x' : f)).join(' ')}`} action={<Button size="sm" onClick={() => playNotes(active.midiNotes, 'strum')}><LuVolume2 size={14} /> Strum</Button>}>
            <Fretboard tuning={tuning} maxFret={Math.max(12, (active.maxFret ?? 0) + 2)} marks={marks} leftHanded={s.profile.leftHanded} flats={flats} testId="finder-voicing-board" />
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Arpeggios ────────────────────────────────────────────────────────────

/** String name for tab-style labels; a higher string that repeats a lower string's name is written in lower case (E … e). */
function stringName(strings: number[], i: number, flats: boolean): string {
  const name = pitchClassToName(strings[i], flats);
  return strings.slice(0, i).some((m) => mod12(m) === mod12(strings[i])) ? name.toLowerCase() : name;
}

function ArpeggioTool({ rootPc, formula, flats, picker, onVoicings }: { rootPc: number; formula: ChordFormula; flats: boolean; picker: ReactNode; onVoicings: () => void }) {
  const s = useStudent();
  const tuning = useActiveTuning();
  const [pos, setPos] = useState<string>('full');
  const [labels, setLabels] = useState<'interval' | 'note'>('interval');
  const [speed, setSpeed] = useState<'slow' | 'medium' | 'fast'>('medium');
  const positions = useMemo(() => buildArpeggioPositions(rootPc, formula, tuning.strings, flats), [rootPc, formula, tuning.strings, flats]);
  const full = useMemo(() => buildFullNeckArpeggio(rootPc, formula, tuning.strings, 15, flats), [rootPc, formula, tuning.strings, flats]);
  useEffect(() => setPos('full'), [rootPc, formula.id, tuning.id]);
  const current = positions.find((p) => p.id === pos);
  const inPos = (n: { stringIndex: number; fret: number }) => !current || (n.fret >= current.minFret && n.fret <= current.maxFret);
  const marks: FretMark[] = full.map((n) => ({
    string: n.stringIndex, fret: n.fret,
    tone: (!inPos(n) ? 'ghost' : n.isRoot ? 'root' : n.isGuideTone ? 'chord' : 'tone') as FretMark['tone'],
    label: labels === 'interval' ? n.interval : n.noteName,
  }));
  const gap = speed === 'slow' ? 0.3 : speed === 'medium' ? 0.18 : 0.1;
  const play = () => {
    const path = current ? current.sweep.map((n) => n.midi) : [...new Set(full.map((n) => n.midi))].sort((a, b) => a - b);
    playNotes([...path, ...path.slice(0, -1).reverse()], 'arpeggio', gap);
  };
  const name = chordName(rootPc, formula, flats);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <Card title="Chord" className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {picker}
          <Field label="Tuning"><TuningPicker className="w-full min-w-0" value={tuning.id} onChange={(id) => store.setProfile({ tuningId: id })} /></Field>
          <div className="text-3xl font-semibold text-ink-50">{name} <span className="text-base font-normal text-ink-300">arpeggio</span></div>
          <ChordFacts rootPc={rootPc} formula={formula} flats={flats} />
          <div className="grid gap-1.5 text-xs text-ink-300">
            <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-full" style={{ background: '#8466f5' }} /> Root</span>
            <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-full" style={{ background: '#5cc8ff' }} /> Guide tones (3rd, 7th): they define the chord's quality</span>
            <span className="flex items-center gap-2"><span className="inline-block size-3 rounded-full" style={{ background: '#3a3360' }} /> Other chord tones</span>
          </div>
          <Button variant="ghost" onClick={onVoicings}>Voicings of {name} <LuArrowRight size={14} /></Button>
        </div>
      </Card>
      <Card title={current ? current.label.replace(/^\d+\. /, '') : 'Full neck'}
        subtitle={current ? (current.shape ? `Built around the ${current.shape}-shape chord. Play it string by string, one or two notes per string (the sweep path).` : 'One hand position.') : 'Every chord tone up to the 15th fret.'}
        className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={play} data-testid="arp-play"><LuPlay size={14} /> Play up &amp; down</Button>
          <Segmented size="sm" value={speed} onChange={setSpeed} aria-label="Playback speed" options={[{ value: 'slow', label: 'Slow' }, { value: 'medium', label: 'Medium' }, { value: 'fast', label: 'Fast' }]} />
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Segmented size="sm" value={pos} onChange={setPos} aria-label="Position" options={[{ value: 'full', label: 'Full neck' }, ...positions.map((p, i) => ({ value: p.id, label: p.shape ? `${p.shape} shape` : `Pos. ${i + 1}` }))]} data-testid="arp-position" />
          <Segmented size="sm" value={labels} onChange={setLabels} aria-label="Labels" options={[{ value: 'interval', label: 'Intervals' }, { value: 'note', label: 'Notes' }]} />
        </div>
        <Fretboard tuning={tuning} maxFret={15} marks={marks} leftHanded={s.profile.leftHanded} flats={flats} testId="arp-board" />
        {current && (
          <p className="mt-3 font-mono text-xs text-ink-300" data-testid="arp-sweep">
            Sweep: {current.sweep.map((n) => `${stringName(tuning.strings, n.stringIndex, flats)}${n.fret}`).join(' → ')}
          </p>
        )}
      </Card>
    </div>
  );
}

function IdentifyTool() {
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-300">Put a shape on the fretboard, type the notes, or play it and let the app listen. It names the chord, explains every note, and lists alternative names.</p>
        <Segmented value={mode} onChange={(m) => { setMode(m); if (m !== 'listen') stopListening(); }} aria-label="Input method" options={[{ value: 'fretboard', label: 'Fretboard' }, { value: 'notes', label: 'Type notes' }, { value: 'listen', label: 'Listen' }]} />
      </div>
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
  const params = new URLSearchParams({ tool: 'voicings', root: pcName(c.root, flats), type: c.def.id });
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
      <Link to={`/chord-finder?${params.toString()}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-300 hover:underline">More voicings of {pcName(c.root, flats)}{c.def.symbols[0]} <LuArrowRight size={14} /></Link>
    </div>
  );
}
