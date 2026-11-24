/** Metronome, Fretboard and Chord Explorer pages. */
import { useMemo, useRef, useState } from 'react';
import { LuPlay, LuSquare, LuHand, LuVolume2, LuStar } from 'react-icons/lu';
import { METRONOME_PRESETS, clampBpm, defaultAccents, tapTempo, type AccentLevel } from '@gma/audio';
import {
  CHORDS, SCALES, buildChord, buildScale, findVoicings, getChord, getScale, markTones, noteName, octavesOf, parseNote, pcOf,
  positionsOfPc, intervalLongName, inversions, type BuiltChord,
} from '@gma/theory';
import { useActiveTuning, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, nowIso, uid } from '@/lib/core';
import { getContext, pluck } from '@/lib/audio';
import { useDocumentTitle } from '@/lib/router';
import { Badge, Button, Card, Field, PageHeader, Segmented, Select, Stepper, Toggle } from '@/components/ui';
import { ChordDiagram, Fretboard, type FretMark } from '@/components/music';
import { TuningPicker, useMetronome } from '@/components/widgets';

const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const rootOptions = ROOTS.map((r) => ({ value: r, label: r.replace('#', '♯').replace(/([A-G])b/, '$1♭') }));

// ── Metronome ────────────────────────────────────────────────────────────

export function MetronomePage() {
  useDocumentTitle('Metronome');
  const m = useMetronome({ bpm: 90 });
  const taps = useRef<number[]>([]);
  const [sound, setSound] = useState<'beep' | 'wood' | 'hat'>('beep');
  const cfg = m.cfg;
  const set = (patch: Partial<typeof cfg>) => m.setCfg((c) => ({ ...c, ...patch }));
  const setBeats = (n: number) => set({ beatsPerBar: n, accents: defaultAccents(n) });
  const cycleAccent = (i: number) => set({ accents: cfg.accents.map((a, k) => (k === i ? (((a + 1) % 4) as AccentLevel) : a)) });
  if (m.player.current) m.player.current.sound = sound;
  return (
    <div>
      <PageHeader title="Metronome" eyebrow="Tools" subtitle="Sample-accurate timing from the Web Audio clock, with subdivisions, accents, swing and tap tempo." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex flex-col items-center py-4">
            <div className="text-7xl font-semibold tabular-nums text-ink-50" data-testid="metro-bpm">{cfg.bpm}</div>
            <div className="text-sm text-ink-400">BPM · {cfg.beatsPerBar}/{cfg.beatUnit}{cfg.subdivision > 1 ? ` · ${['', '', 'eighths', 'triplets', 'sixteenths'][cfg.subdivision]}` : ''}{cfg.swing ? ' · swing' : ''}</div>
            <input type="range" min={20} max={300} value={cfg.bpm} onChange={(e) => set({ bpm: Number((e.target as HTMLInputElement).value) })} className="mt-5 w-full max-w-md" aria-label="Tempo" />
            <div className="mt-6 flex gap-2" aria-label="Beat indicator">
              {cfg.accents.map((a, i) => (
                <button key={i} type="button" onClick={() => cycleAccent(i)} title="Click to change accent (accent → beat → soft → silent)"
                  className={cx('flex h-12 w-12 items-end justify-center rounded-xl border pb-1 text-xs transition-all', m.beat?.beat === i && m.beat.sub === 0 ? 'scale-105 border-accent-400 bg-accent-500/30' : 'border-ink-600 bg-ink-800')}>
                  <span className="w-6 rounded-sm bg-accent-400" style={{ height: `${[2, 10, 22, 34][a]}px`, opacity: a === 0 ? 0.2 : 1 }} />
                </button>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button size="lg" variant={m.running ? 'secondary' : 'primary'} onClick={m.toggle} data-testid="metro-toggle">{m.running ? <><LuSquare size={18} /> Stop</> : <><LuPlay size={18} /> Start</>}</Button>
              <Button size="lg" onClick={() => { taps.current.push(performance.now()); taps.current = taps.current.filter((t) => performance.now() - t < 4000); const b = tapTempo(taps.current); if (b) set({ bpm: b }); }} data-testid="metro-tap"><LuHand size={18} /> Tap tempo</Button>
            </div>
            <div className="mt-4 flex gap-2">{[-5, -1, 1, 5].map((d) => <Button key={d} size="sm" variant="ghost" onClick={() => set({ bpm: clampBpm(cfg.bpm + d) })}>{d > 0 ? `+${d}` : d}</Button>)}</div>
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Settings">
            <div className="space-y-4">
              <Field label="Beats per bar"><Stepper value={cfg.beatsPerBar} onChange={setBeats} min={1} max={15} label="Beats per bar" /></Field>
              <Field label="Beat unit"><Segmented value={String(cfg.beatUnit)} onChange={(v) => set({ beatUnit: Number(v) })} size="sm" options={[{ value: '4', label: 'Quarter' }, { value: '8', label: 'Eighth' }]} /></Field>
              <Field label="Subdivision"><Segmented value={String(cfg.subdivision)} onChange={(v) => set({ subdivision: Number(v), swing: undefined })} size="sm" options={[{ value: '1', label: '♩' }, { value: '2', label: '♫' }, { value: '3', label: '3' }, { value: '4', label: '♬' }]} /></Field>
              {cfg.subdivision === 2 && <Toggle checked={!!cfg.swing} onChange={(v) => set({ swing: v ? 2 / 3 : undefined })} label="Swing / shuffle" />}
              <Field label="Sound"><Segmented value={sound} onChange={setSound} size="sm" options={[{ value: 'beep', label: 'Beep' }, { value: 'wood', label: 'Wood' }, { value: 'hat', label: 'Hi-hat' }]} /></Field>
            </div>
          </Card>
          <Card title="Practice presets">
            <ul className="space-y-1">
              {METRONOME_PRESETS.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => m.setCfg({ ...p.config, accents: p.config.accents ?? defaultAccents(p.config.beatsPerBar) })} className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-ink-800">
                    <div className="text-sm text-ink-100">{p.name}</div>
                    <div className="text-xs text-ink-400">{p.note}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Fretboard ────────────────────────────────────────────────────────────

type FbMode = 'notes' | 'scale' | 'chord' | 'arpeggio' | 'octaves' | 'intervals';

export function FretboardPage() {
  useDocumentTitle('Fretboard');
  const s = useStudent();
  const tuning = useActiveTuning();
  const [mode, setMode] = useState<FbMode>('scale');
  const [root, setRoot] = useState('A');
  const [scale, setScale] = useState('minor-pentatonic');
  const [chord, setChord] = useState('m7');
  const [labels, setLabels] = useState<'interval' | 'note' | 'degree'>('interval');
  const [range, setRange] = useState<[number, number]>([0, 15]);
  const [picked, setPicked] = useState<{ string: number; fret: number } | null>(null);
  const flats = s.profile.noteNames === 'flats';

  const marks: FretMark[] = useMemo(() => {
    const r = parseNote(root)!;
    const rpc = pcOf(r);
    if (mode === 'notes') return [];
    if (mode === 'octaves' || mode === 'intervals') {
      const p = picked ?? positionsOfPc(tuning, rpc, range[1], range[0])[0];
      if (!p) return [];
      const base = tuning.strings[p.string] + p.fret;
      if (mode === 'octaves') return [{ ...p, tone: 'root', label: '1' }, ...octavesOf(tuning, p, range[1]).filter((o) => o.fret >= range[0]).map((o) => ({ string: o.string, fret: o.fret, tone: 'target' as const, label: `${o.octaves > 0 ? '+' : ''}${o.octaves}` }))];
      const out: FretMark[] = [];
      for (let st = 0; st < tuning.strings.length; st++) for (let f = Math.max(range[0], p.fret - 4); f <= Math.min(range[1], p.fret + 4); f++) {
        const d = tuning.strings[st] + f - base;
        if (d >= 0 && d <= 12) out.push({ string: st, fret: f, tone: d === 0 ? 'root' : 'tone', label: ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7', '8'][d], title: intervalLongName({ degree: [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7, 8][d], semitones: d }) });
      }
      return out;
    }
    const built = mode === 'scale' ? buildScale(r, scale) : buildChord(r, chord);
    const formula = mode === 'scale' ? getScale(scale).formula : getChord(chord).formula;
    return markTones(tuning, rpc, formula, range[1], range[0]).map((m) => ({
      string: m.string, fret: m.fret, tone: m.isRoot ? 'root' : mode === 'scale' ? 'tone' : 'chord',
      label: labels === 'note' ? noteName(built.notes[m.toneIndex]) : labels === 'degree' ? String(m.toneIndex + 1) : m.token,
    }));
  }, [mode, root, scale, chord, labels, range, tuning, picked]);

  return (
    <div>
      <PageHeader title="Fretboard" eyebrow="Tools" subtitle="Every note, interval, scale, chord and arpeggio on any tuning, for 6, 7 and 8 strings." />
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="Show"><Segmented value={mode} onChange={(v) => { setMode(v); setPicked(null); }} size="sm" options={[{ value: 'notes', label: 'All notes' }, { value: 'scale', label: 'Scale/mode' }, { value: 'chord', label: 'Chord' }, { value: 'arpeggio', label: 'Arpeggio' }, { value: 'octaves', label: 'Octaves' }, { value: 'intervals', label: 'Intervals' }]} /></Field>
          <Field label="Root"><Select value={root} onChange={setRoot} options={rootOptions} aria-label="Root" /></Field>
          {mode === 'scale' && <Field label="Scale"><Select value={scale} onChange={setScale} options={SCALES.map((x) => ({ value: x.id, label: x.name, group: x.category }))} aria-label="Scale" /></Field>}
          {(mode === 'chord' || mode === 'arpeggio') && <Field label="Chord"><Select value={chord} onChange={setChord} options={CHORDS.map((c) => ({ value: c.id, label: `${c.name} (${c.symbols[0] || 'maj'})` }))} aria-label="Chord" /></Field>}
          {(mode === 'scale' || mode === 'chord' || mode === 'arpeggio') && <Field label="Labels"><Segmented value={labels} onChange={setLabels} size="sm" options={[{ value: 'interval', label: 'Intervals' }, { value: 'note', label: 'Notes' }, { value: 'degree', label: 'Degrees' }]} /></Field>}
          <Field label="Tuning"><TuningPicker value={tuning.id} onChange={(id) => store.setProfile({ tuningId: id })} testId="fb-tuning" /></Field>
          <Field label="Frets"><div className="flex items-center gap-1"><Stepper value={range[0]} onChange={(v) => setRange([Math.min(v, range[1] - 3), range[1]])} min={0} max={20} label="From fret" /><span className="text-ink-400">–</span><Stepper value={range[1]} onChange={(v) => setRange([range[0], Math.max(v, range[0] + 3)])} min={4} max={24} label="To fret" /></div></Field>
        </div>
        <Fretboard tuning={tuning} minFret={range[0]} maxFret={range[1]} marks={marks} leftHanded={s.profile.leftHanded} noteNames={mode === 'notes' ? 'all' : 'none'} flats={flats}
          onPick={(p) => { if (mode === 'octaves' || mode === 'intervals') setPicked(p); else { getContext(); pluck(tuning.strings[p.string] + p.fret, getContext().currentTime + 0.02, 0.8); } }} testId="fretboard-main" />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-300">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-accent-500" /> Root</span>
          {(mode === 'octaves' || mode === 'intervals') ? <span>Click any position to set the reference note.</span> : <span>Click a note to hear it.</span>}
          {s.profile.leftHanded && <Badge>Left-handed view</Badge>}
        </div>
      </Card>
    </div>
  );
}

// ── Chord Explorer ───────────────────────────────────────────────────────

export function ChordsPage() {
  useDocumentTitle('Chords');
  const tuning = useActiveTuning();
  const s = useStudent();
  const [root, setRoot] = useState('C');
  const [type, setType] = useState('maj');
  const [cat, setCat] = useState<string>('all');
  const [labels, setLabels] = useState<'finger' | 'interval' | 'note'>('finger');
  const [inv, setInv] = useState<'root' | 'any'>('root');
  const chord: BuiltChord = useMemo(() => buildChord(root, type), [root, type]);
  const voicings = useMemo(() => findVoicings(chord, tuning, { limit: 18, bassPc: inv === 'any' ? 'any' : undefined, maxFret: 17 }), [chord, tuning, inv]);
  const [sel, setSel] = useState(0);
  const v = voicings[Math.min(sel, voicings.length - 1)];
  const categories = ['all', 'power', 'triad', 'suspended', 'sixth', 'seventh', 'add', 'extended', 'altered'];
  const strum = () => {
    if (!v) return;
    const c = getContext();
    v.frets.forEach((f, st) => { if (f !== null) pluck(tuning.strings[st] + f, c.currentTime + 0.03 + st * 0.03, 1.6, 0.6); });
  };
  const save = () => {
    store.append('saved', { id: uid('saved'), kind: 'chord', root, type, tuningId: tuning.id, label: chord.symbol, updatedAt: nowIso() });
    store.toast('Chord saved', `${chord.symbol} added to your saved chords.`, 'success');
  };
  return (
    <div>
      <PageHeader title="Chord Explorer" eyebrow="Tools" subtitle="Formulas, notes and playable voicings for every chord type, calculated for your tuning." actions={<Button onClick={save}><LuStar size={16} /> Save chord</Button>} />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card title="Chord">
          <div className="space-y-3">
            <Field label="Root"><Select value={root} onChange={(r) => { setRoot(r); setSel(0); }} options={rootOptions} aria-label="Chord root" /></Field>
            <Field label="Category"><Select value={cat} onChange={setCat} options={categories.map((c) => ({ value: c, label: c === 'all' ? 'All types' : c[0].toUpperCase() + c.slice(1) }))} aria-label="Chord category" /></Field>
            <ul className="max-h-[340px] space-y-0.5 overflow-y-auto pr-1">
              {CHORDS.filter((c) => cat === 'all' || c.category === cat).map((c) => (
                <li key={c.id}><button type="button" onClick={() => { setType(c.id); setSel(0); }} className={cx('w-full rounded-md px-2 py-1.5 text-left text-sm', type === c.id ? 'bg-accent-500/15 text-accent-300' : 'text-ink-200 hover:bg-ink-800')}>{c.name} <span className="font-mono text-xs text-ink-400">{root}{c.symbols[0]}</span></button></li>
              ))}
            </ul>
            <Field label="Tuning"><TuningPicker value={tuning.id} onChange={(id) => store.setProfile({ tuningId: id })} /></Field>
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-semibold text-ink-50" data-testid="chord-symbol">{chord.symbol}</div>
                <div className="text-sm text-ink-300">{chord.def.name}</div>
                <p className="mt-2 max-w-md text-sm text-ink-300">{chord.def.description}</p>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="label pt-0.5">Formula</dt><dd className="font-mono text-ink-100">{chord.tokens.join(' ')}</dd>
                <dt className="label pt-0.5">Notes</dt><dd className="font-mono text-ink-100" data-testid="chord-notes">{chord.notes.map((n) => noteName(n)).join(' ')}</dd>
                <dt className="label pt-0.5">Inversions</dt><dd className="text-ink-300">{inversions(chord).slice(1).map((i) => `${i.name}: ${i.notes.map((n) => noteName(n)).join('-')}`).join(' · ')}</dd>
              </dl>
            </div>
          </Card>
          <Card title={`Voicings (${voicings.length})`} subtitle="Calculated for the selected tuning: playable within a 4-fret span, at most one muted string inside the shape." action={
            <div className="flex flex-wrap gap-2">
              <Segmented value={inv} onChange={(x) => { setInv(x); setSel(0); }} size="sm" options={[{ value: 'root', label: 'Root bass' }, { value: 'any', label: 'Any inversion' }]} />
              <Segmented value={labels} onChange={setLabels} size="sm" options={[{ value: 'finger', label: 'Fingers' }, { value: 'interval', label: 'Intervals' }, { value: 'note', label: 'Notes' }]} />
            </div>}>
            {voicings.length === 0 ? <p className="text-sm text-ink-300">No playable voicing was found for this chord in this tuning.</p> : (
              <>
                <div className="flex flex-wrap gap-3">
                  {voicings.map((vv, i) => (
                    <button key={i} type="button" onClick={() => setSel(i)} className={cx('rounded-xl border p-2', i === sel ? 'border-accent-500 bg-accent-500/10' : 'border-ink-700 hover:border-ink-500')} aria-label={`Voicing ${i + 1}`}>
                      <ChordDiagram voicing={vv} tuning={tuning} labels={labels} size={0.85} />
                      <div className="mt-0.5 text-center text-[10px] text-ink-400">{vv.inversion}</div>
                    </button>
                  ))}
                </div>
                {v && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center gap-2"><Button size="sm" onClick={strum}><LuVolume2 size={14} /> Strum</Button><span className="font-mono text-xs text-ink-300">{v.frets.map((f) => (f === null ? 'x' : f)).join(' ')}</span></div>
                    <Fretboard tuning={tuning} minFret={Math.max(0, v.baseFret - 1)} maxFret={Math.max(v.baseFret + 4, 5)} leftHanded={s.profile.leftHanded}
                      marks={v.frets.flatMap((f, st) => (f === null ? [] : [{ string: st, fret: f, tone: v.tokens[st] === '1' ? 'root' as const : 'chord' as const, label: labels === 'finger' ? String(v.fingers[st] || 'o') : labels === 'interval' ? v.tokens[st] ?? '' : undefined }]))} />
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
