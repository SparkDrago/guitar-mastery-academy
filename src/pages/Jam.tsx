/**
 * Interactive Jam Laboratory (Module D) and the Improvisation Lab.
 * Backing tracks are generated procedurally from the chosen progression; the
 * theory panel and fretboard follow the chord that is actually sounding.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LuPlay, LuSquare, LuLock, LuTarget, LuMusic, LuCircleCheck, LuShuffle, LuVolume2 } from 'react-icons/lu';
import {
  KEY_ROOTS_MAJOR, KEY_ROOTS_MINOR, PROGRESSIONS, buildScale, diatonicChords, markTones, midiAt, noteName, noteOverChord, numeralToChord, pcOf, resolveProgression,
  type ResolvedChord,
} from '@gma/theory';
import { JAM_STYLES, arrange, getStyle, type ChordSlot } from '@gma/audio';
import { CHALLENGES, buildChallenge, chordView, unlockedChallenges } from '@gma/learning';
import { useActiveTuning, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, fmtMinutes, nowIso, uid } from '@/lib/core';
import { BackingPlayer, getContext, pluck, type Tone } from '@/lib/audio';
import { useDocumentTitle, useLocation, Link } from '@/lib/router';
import { Badge, Button, Callout, Card, Field, PageHeader, Segmented, Select, Stepper, Toggle } from '@/components/ui';
import { Fretboard, type FretMark } from '@/components/music';

type Viz = 'chord' | 'scale' | 'both' | 'guide' | 'next';

/** Parse a custom progression: bars separated by "|" (several chords per bar allowed) or one chord per space. */
export function parseCustomProgression(text: string, key: string): { bars: string[]; error?: string } {
  const t = text.trim();
  if (!t) return { bars: [], error: 'Enter some Roman numerals, e.g. I V vi IV.' };
  const bars = t.includes('|') ? t.split('|').map((b) => b.trim()).filter(Boolean) : t.split(/\s+/);
  for (const bar of bars) for (const n of bar.split(/\s+/)) {
    try { numeralToChord(n, key); } catch { return { bars: [], error: `"${n}" is not a Roman numeral this app understands (try I, ii7, bVII, V7/V).` }; }
  }
  if (bars.length > 32) return { bars: [], error: 'Use at most 32 bars.' };
  return { bars };
}

function toSlots(chords: ResolvedChord[], beatsPerBar: number): ChordSlot[] {
  let start = 0;
  return chords.map((c) => {
    const slot = { start, beats: c.beats, rootPc: pcOf(c.chord.root), pcs: c.chord.pcs, symbol: c.chord.symbol };
    start += c.beats;
    return slot;
  }).map((s) => ({ ...s, beats: s.beats || beatsPerBar }));
}

export function JamPage() {
  useDocumentTitle('Jam Room');
  const s = useStudent();
  const tuning = useActiveTuning();
  const { query } = useLocation();
  const [key, setKey] = useState('A');
  const [mode, setMode] = useState<'major' | 'minor'>('minor');
  const [progId, setProgId] = useState('minor-rock');
  const [custom, setCustom] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [styleId, setStyleId] = useState('classic-rock');
  const style = getStyle(styleId);
  const [bpm, setBpm] = useState(style.defaultBpm);
  const [density, setDensity] = useState<1 | 2 | 3>(2);
  const [maxMin, setMaxMin] = useState(0);
  const [mutes, setMutes] = useState({ drums: false, bass: false, chords: false });
  const [viz, setViz] = useState<Viz>('both');
  const [scaleChoice, setScaleChoice] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [reflection, setReflection] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const player = useRef<BackingPlayer | null>(null);

  const unlocked = useMemo(() => unlockedChallenges(s), [s]);
  useEffect(() => {
    if (query.get('challenge') === 'next') {
      const done = new Set(s.jams.filter((j) => j.challengeCompleted).map((j) => j.challengeId));
      const pick = unlocked.find((c) => !done.has(c.id)) ?? unlocked[0];
      if (pick) chooseChallenge(pick.id);
    }
  }, [query.get('challenge')]);

  const progression = PROGRESSIONS.find((p) => p.id === progId) ?? PROGRESSIONS[0];
  const customParsed = useMemo(() => (useCustom ? parseCustomProgression(custom, key) : null), [useCustom, custom, key]);
  const bars = useCustom ? customParsed?.bars ?? [] : progression.bars;
  const beatsPerBar = 4;
  const chords = useMemo(() => (bars.length ? resolveProgression(bars, key, beatsPerBar) : []), [bars, key]);
  const slots = useMemo(() => toSlots(chords, beatsPerBar), [chords]);
  const loopBeats = slots.reduce((a, c) => a + c.beats, 0);
  const events = useMemo(() => (slots.length ? arrange(slots, style, { beatsPerBar, density }) : []), [slots, style, density]);

  // Keep the player in step with every control change, even while it is playing.
  useEffect(() => { player.current?.setEvents(events, loopBeats || 4); }, [events, loopBeats]);
  useEffect(() => { player.current?.setOptions({ bpm, mutes, tone: style.tone as Tone, maxSeconds: maxMin * 60 }); }, [bpm, mutes, style.tone, maxMin]);
  useEffect(() => { setBpm(Math.min(style.bpmRange[1], Math.max(style.bpmRange[0], bpm))); }, [styleId]);
  useEffect(() => () => player.current?.stop(), []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const p = player.current;
      if (!p) return;
      if (!p.running) { finishSession(); return; }
      setPos(p.positionBeats());
    }, 50);
    return () => clearInterval(id);
  });

  const loopPos = loopBeats ? pos % loopBeats : 0;
  const curIdx = Math.max(0, slots.findIndex((c) => loopPos >= c.start && loopPos < c.start + c.beats));
  const cur = chords[curIdx];
  const next = chords[(curIdx + 1) % Math.max(1, chords.length)];
  const view = useMemo(() => (cur ? chordView(cur, key, mode) : null), [cur, key, mode]);
  const nextView = useMemo(() => (next ? chordView(next, key, mode) : null), [next, key, mode]);

  const start = () => {
    if (!slots.length) return;
    getContext();
    const p = new BackingPlayer({ bpm, loopBeats, tone: style.tone as Tone, mutes, maxSeconds: maxMin * 60 });
    p.setEvents(events, loopBeats);
    p.play();
    player.current = p;
    setPlaying(true);
    setStartedAt(Date.now());
  };

  const finishSession = () => {
    player.current?.stop();
    player.current = null;
    setPlaying(false);
    setPos(0);
    if (startedAt && Date.now() - startedAt >= 30_000) {
      const minutes = Math.round(((Date.now() - startedAt) / 60000) * 10) / 10;
      const ch = challengeId ? built : null;
      store.append('jams', {
        id: uid('jam'), at: nowIso(), minutes, key, mode, progressionId: useCustom ? 'custom' : progId, styleId, bpm,
        challengeId: challengeId ?? undefined, challengeCompleted: ch ? ch.checklist.every((c) => checked.includes(c)) : undefined,
        reflection: reflection.trim() || undefined, updatedAt: nowIso(),
      });
      store.toast('Jam saved', `${fmtMinutes(minutes)} in ${key} ${mode}${challengeId ? ` · ${CHALLENGES.find((c) => c.id === challengeId)?.title}` : ''}.`, 'success');
    }
    setStartedAt(null);
  };

  const chooseChallenge = (id: string | null) => {
    setChallengeId(id);
    setChecked([]);
    setReflection('');
    const t = CHALLENGES.find((c) => c.id === id);
    if (t) {
      setUseCustom(false);
      const p = PROGRESSIONS.find((x) => x.id === t.progressions[0]);
      if (p) { setProgId(p.id); setMode(p.mode); if (p.mode === 'minor' && !KEY_ROOTS_MINOR.includes(key)) setKey('A'); if (p.mode === 'major' && !KEY_ROOTS_MAJOR.includes(key)) setKey('A'); }
    }
  };

  const template = CHALLENGES.find((c) => c.id === challengeId) ?? null;
  const built = useMemo(() => (template && !useCustom ? buildChallenge(template, { key, mode, progressionId: progId }) : null), [template, key, mode, progId, useCustom]);

  // Fretboard marks for the current visualisation.
  const marks: FretMark[] = useMemo(() => {
    if (!cur || !view) return [];
    const chord = cur.chord;
    const sugg = view.suggestions[Math.min(scaleChoice, view.suggestions.length - 1)];
    const scale = sugg ? buildScale(sugg.root, sugg.scaleId) : null;
    const rootPc = pcOf(chord.root);
    const chordMarks = markTones(tuning, rootPc, chord.intervals, 15);
    const chordPcs = new Set(chord.pcs);
    if (viz === 'chord') return chordMarks.map((m) => ({ string: m.string, fret: m.fret, tone: m.isRoot ? 'root' : 'chord', label: m.token }));
    if (viz === 'guide') {
      const guidePcs = new Set(view.guideTones.map((n) => pcOf(chord.notes.find((x) => noteName(x) === n) ?? chord.root)));
      return chordMarks.filter((m) => guidePcs.has(m.pc) || m.isRoot).map((m) => ({ string: m.string, fret: m.fret, tone: m.isRoot ? 'ghost' : 'target', label: m.token }));
    }
    if (viz === 'next' && next) {
      const nc = next.chord;
      return markTones(tuning, pcOf(nc.root), nc.intervals, 15).map((m) => ({ string: m.string, fret: m.fret, tone: m.isRoot ? 'root' : 'target', label: m.token }));
    }
    if (!scale) return [];
    const sm = markTones(tuning, pcOf(scale.root), scale.intervals, 15);
    return sm.map((m) => ({ string: m.string, fret: m.fret, tone: viz === 'both' && chordPcs.has(m.pc) ? (m.pc === rootPc ? 'root' : 'chord') : m.isRoot ? 'root' : 'tone', label: m.token }));
  }, [cur, next, view, viz, tuning, scaleChoice]);

  const keyRoots = mode === 'major' ? KEY_ROOTS_MAJOR : KEY_ROOTS_MINOR;
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  return (
    <div>
      <PageHeader eyebrow="Play" title="Jam Room" subtitle="Generated backing tracks in any key, style and progression, with live theory for the chord that is sounding."
        actions={playing
          ? <Button variant="danger" size="lg" onClick={finishSession} data-testid="jam-stop"><LuSquare size={18} /> Stop</Button>
          : <Button variant="primary" size="lg" onClick={start} disabled={!slots.length} data-testid="jam-play"><LuPlay size={18} /> Play backing</Button>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Key"><div className="flex gap-2">
                <Select value={key} onChange={setKey} options={keyRoots.map((k) => ({ value: k, label: k }))} aria-label="Key" data-testid="jam-key" />
                <Select value={mode} onChange={(m) => { setMode(m); if (!(m === 'major' ? KEY_ROOTS_MAJOR : KEY_ROOTS_MINOR).includes(key)) setKey(m === 'major' ? 'C' : 'A'); }} options={[{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }]} aria-label="Mode" />
              </div></Field>
              <Field label="Style"><Select value={styleId} onChange={setStyleId} options={JAM_STYLES.map((st) => ({ value: st.id, label: st.name }))} aria-label="Style" data-testid="jam-style" /></Field>
              <Field label={`Tempo (${style.bpmRange[0]}–${style.bpmRange[1]})`}><Stepper value={bpm} onChange={setBpm} min={40} max={240} step={2} suffix="bpm" label="Tempo" /></Field>
              <Field label="Stop after"><Select value={String(maxMin)} onChange={(v) => setMaxMin(Number(v))} options={[{ value: '0', label: 'Loop forever' }, { value: '2', label: '2 minutes' }, { value: '5', label: '5 minutes' }, { value: '10', label: '10 minutes' }, { value: '20', label: '20 minutes' }]} aria-label="Duration" /></Field>
              <Field label="Progression" className="sm:col-span-2">
                <Select value={useCustom ? 'custom' : progId} onChange={(v) => { if (v === 'custom') setUseCustom(true); else { setUseCustom(false); setProgId(v); const p = PROGRESSIONS.find((x) => x.id === v); if (p && p.mode !== mode) { setMode(p.mode); setKey(p.mode === 'major' ? 'C' : 'A'); } } }}
                  options={[...PROGRESSIONS.map((p) => ({ value: p.id, label: p.name, group: p.mode === 'major' ? 'Major-key' : 'Minor-key' })), { value: 'custom', label: 'Custom…', group: 'Your own' }]} aria-label="Progression" data-testid="jam-progression" />
              </Field>
              <Field label="Feel"><Segmented size="sm" value={String(density) as '1' | '2' | '3'} onChange={(v) => setDensity(Number(v) as 1 | 2 | 3)} options={[{ value: '1', label: 'Sparse' }, { value: '2', label: 'Normal' }, { value: '3', label: 'Busy' }]} aria-label="Density" /></Field>
              <Field label="Mix"><div className="flex flex-wrap gap-3">
                {(['drums', 'bass', 'chords'] as const).map((k) => <Toggle key={k} checked={!mutes[k]} onChange={(v) => setMutes({ ...mutes, [k]: !v })} label={k[0].toUpperCase() + k.slice(1)} />)}
              </div></Field>
            </div>
            {useCustom && (
              <div className="mt-3">
                <input className="input font-mono" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g.  i | bVI | bIII | bVII   or   ii7 V7 Imaj7 Imaj7" aria-label="Custom progression" data-testid="jam-custom" />
                {customParsed?.error ? <p className="mt-1 text-xs text-warn-400">{customParsed.error}</p> : <p className="mt-1 text-xs text-ink-400">Roman numerals are measured from the major scale of the key (so in minor, write i, bIII, bVI, bVII).</p>}
              </div>
            )}
            {!useCustom && <p className="mt-3 text-sm text-ink-300">{progression.description}</p>}
            <p className="mt-1 text-xs text-ink-400">{style.description}</p>
          </Card>

          <Card title="Chord chart" subtitle={playing ? `Playing · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : 'Press Play to start the loop.'}>
            <div className="grid grid-cols-4 gap-2" data-testid="jam-chart">
              {chords.map((c, i) => (
                <div key={i} className={cx('rounded-lg border px-3 py-2 transition-colors', playing && i === curIdx ? 'border-accent-400 bg-accent-500/15' : 'border-ink-700 bg-ink-900/60')} style={{ gridColumn: c.beats < beatsPerBar ? undefined : undefined }}>
                  <div className="text-lg font-semibold text-ink-50">{c.chord.symbol}</div>
                  <div className="text-xs text-ink-400">{c.numeral}{c.beats < beatsPerBar ? ` · ${c.beats} beats` : ''}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Fretboard" subtitle={cur ? `Following ${cur.chord.symbol}${viz === 'next' && next ? ` → showing next chord ${next.chord.symbol}` : ''}` : undefined}
            action={<Segmented size="sm" value={viz} onChange={setViz} aria-label="Fretboard view" options={[{ value: 'chord', label: 'Chord tones' }, { value: 'scale', label: 'Scale' }, { value: 'both', label: 'Scale + chord' }, { value: 'guide', label: 'Guide tones' }, { value: 'next', label: 'Next chord' }]} />}>
            <Fretboard tuning={tuning} maxFret={15} marks={marks} leftHanded={s.profile.leftHanded} testId="jam-fretboard" />
            <p className="mt-2 text-xs text-ink-400">Labels are intervals from each note's root. Purple = root, blue = chord tone, orange = target, grey = other scale tones.</p>
          </Card>
        </div>

        <div className="space-y-5">
          {view && (
            <Card title={<span className="flex items-center gap-2">{view.symbol} <Badge tone="accent">{view.numeral}</Badge>{!view.inKey && <Badge tone="warn">outside the key</Badge>}</span>} subtitle={next && nextView ? `Next: ${nextView.symbol} (${nextView.numeral})` : undefined} data-testid="jam-theory">
              <dl className="space-y-3 text-sm">
                <div><dt className="label">Chord tones</dt><dd className="mt-1 flex flex-wrap gap-1.5">{view.chordTones.map((t) => <Badge key={t.token}>{t.name} <span className="text-ink-400">{t.token}</span></Badge>)}</dd></div>
                <div><dt className="label">Guide tones</dt><dd className="mt-1 text-ink-200">{view.guideTones.join(', ')} — the notes that define this chord's sound.</dd></div>
                <div>
                  <dt className="label">Scale choices</dt>
                  <dd className="mt-1 space-y-2">
                    {view.suggestions.map((sg, i) => (
                      <button key={sg.name} type="button" onClick={() => { setScaleChoice(i); if (viz === 'chord' || viz === 'guide' || viz === 'next') setViz('both'); }} className={cx('block w-full rounded-lg border px-2.5 py-2 text-left', i === scaleChoice ? 'border-accent-500 bg-accent-500/10' : 'border-ink-700 hover:border-ink-500')}>
                        <div className="font-medium text-ink-100">{sg.name}</div>
                        <div className="text-xs text-ink-400">{sg.reason}</div>
                      </button>
                    ))}
                  </dd>
                </div>
                {view.tension.length > 0 && <div><dt className="label">Handle with care</dt><dd className="mt-1 text-ink-300">{view.tension.join(', ')} sit a half step above a chord tone: pass through them and resolve.</dd></div>}
                {!useCustom && <div><dt className="label">Whole-progression options</dt><dd className="mt-1 text-ink-300">{progression.soloScales.map((id) => { try { const sc = buildScale(key, id); return `${key} ${sc.def.name}`; } catch { return id; } }).join(' · ')}</dd></div>}
              </dl>
            </Card>
          )}

          <Card title="Guided challenges" subtitle="Constraints that build specific improvising skills." data-testid="jam-challenges">
            {template && built ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2"><b className="text-ink-50">{template.title}</b><Button size="sm" variant="ghost" onClick={() => chooseChallenge(null)}>Close</Button></div>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-200">{built.instructions.map((i) => <li key={i}>{i}</li>)}</ol>
                {built.targets.length > 0 && <div><div className="label mb-1 flex items-center gap-1"><LuTarget size={12} /> Targets</div><div className="flex flex-wrap gap-1.5">{built.targets.map((t) => <Badge key={t} tone="warn">{t}</Badge>)}</div></div>}
                <div>
                  <div className="label mb-1">After playing, check what you achieved</div>
                  {built.checklist.map((c) => (
                    <label key={c} className="flex items-start gap-2 py-0.5 text-sm text-ink-200"><input type="checkbox" className="mt-1" checked={checked.includes(c)} onChange={(e) => setChecked(e.target.checked ? [...checked, c] : checked.filter((x) => x !== c))} /> {c}</label>
                  ))}
                </div>
                <textarea className="input min-h-16 text-sm" value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="Reflection: what worked, what to try next time" aria-label="Reflection" />
                <p className="text-xs text-ink-400">The jam is saved when you press Stop (after at least 30 seconds). All boxes ticked = challenge completed.</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {CHALLENGES.map((c) => {
                  const open = unlocked.some((u) => u.id === c.id);
                  const done = s.jams.some((j) => j.challengeId === c.id && j.challengeCompleted);
                  return (
                    <li key={c.id}>
                      <button type="button" disabled={!open} onClick={() => chooseChallenge(c.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50">
                        {done ? <LuCircleCheck size={15} className="text-ok-400" /> : open ? <LuMusic size={15} className="text-accent-300" /> : <LuLock size={15} className="text-ink-500" />}
                        <span className="flex-1 text-ink-100">{c.title}</span>
                      </button>
                    </li>
                  );
                })}
                {unlocked.length === 0 && <li className="pt-2 text-xs text-ink-400">Challenges unlock as you complete lessons from Level 4 onward (starting with the minor pentatonic lesson). Free jamming is always open.</li>}
              </ul>
            )}
          </Card>
          <Callout tone="info" title="Practice idea">Alternate: one time through playing rhythm (mute the chords track and strum along), then one time soloing.</Callout>
        </div>
      </div>
    </div>
  );
}

// ── Improvisation Lab ────────────────────────────────────────────────────

export function ImprovisationPage() {
  useDocumentTitle('Improvisation Lab');
  const s = useStudent();
  const tuning = useActiveTuning();
  const [key, setKey] = useState('A');
  const [mode, setMode] = useState<'major' | 'minor'>('minor');
  const [chordIdx, setChordIdx] = useState(0);
  const [sevenths, setSevenths] = useState(true);
  const [picked, setPicked] = useState<{ string: number; fret: number } | null>(null);
  const [prog, setProg] = useState('i | bVI | bVII | i');

  const diatonic = useMemo(() => diatonicChords(key, mode === 'major' ? 'major' : 'aeolian', sevenths), [key, mode, sevenths]);
  const chord = diatonic[Math.min(chordIdx, 6)].chord;
  const chordMarks = useMemo(() => markTones(tuning, pcOf(chord.root), chord.intervals, 15), [tuning, chord]);
  const pickedPc = picked ? midiAt(tuning, picked.string, picked.fret) % 12 : null;
  const explain = pickedPc !== null ? noteOverChord(pickedPc, chord) : null;
  const marks: FretMark[] = [
    ...chordMarks.map((m) => ({ string: m.string, fret: m.fret, tone: (m.isRoot ? 'root' : 'chord') as FretMark['tone'], label: m.token })),
    ...(picked && !chordMarks.some((m) => m.string === picked.string && m.fret === picked.fret) ? [{ ...picked, tone: (explain?.role === 'avoid' ? 'wrong' : 'target') as FretMark['tone'], label: explain?.token }] : []),
  ];

  const parsed = useMemo(() => parseCustomProgression(prog, key), [prog, key]);
  const analysis = useMemo(() => (parsed.bars.length ? resolveProgression(parsed.bars, key).map((c) => chordView(c, key, mode)) : []), [parsed, key, mode]);

  const pick = (p: { string: number; fret: number }) => {
    setPicked(p);
    const c = getContext();
    const t = c.currentTime + 0.02;
    // Sound the chord softly, then the chosen note on top, so the relationship is audible.
    const root = 48 + pcOf(chord.root);
    chord.intervals.forEach((iv) => pluck(root + iv.semitones, t, 1.6, 0.35));
    pluck(midiAt(tuning, p.string, p.fret), t + 0.25, 1.4, 0.8);
  };

  const keyRoots = mode === 'major' ? KEY_ROOTS_MAJOR : KEY_ROOTS_MINOR;
  return (
    <div>
      <PageHeader eyebrow="Play" title="Improvisation Lab" subtitle="Hear and see how any note relates to a chord, and map a progression to the scales that fit each chord." actions={<Link to="/jam" className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-400"><LuMusic size={16} /> Open Jam Room</Link>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card title="Note over chord" subtitle="Click any fret: you hear the chord, then your note, and see what role the note plays.">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <Field label="Key"><div className="flex gap-2"><Select value={key} onChange={setKey} options={keyRoots.map((k) => ({ value: k, label: k }))} aria-label="Key" /><Select value={mode} onChange={(m) => { setMode(m); setKey(m === 'major' ? 'C' : 'A'); }} options={[{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }]} aria-label="Mode" /></div></Field>
            <Toggle checked={sevenths} onChange={setSevenths} label="Seventh chords" />
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Chord">
            {diatonic.map((d, i) => (
              <button key={d.degree} type="button" role="radio" aria-checked={i === chordIdx} onClick={() => { setChordIdx(i); setPicked(null); }} className={cx('rounded-lg border px-3 py-1.5 text-sm', i === chordIdx ? 'border-accent-500 bg-accent-500/15 text-ink-50' : 'border-ink-600 text-ink-300 hover:border-ink-400')}>
                <span className="font-semibold">{d.chord.symbol}</span> <span className="text-xs text-ink-400">{d.numeral}</span>
              </button>
            ))}
          </div>
          <Fretboard tuning={tuning} maxFret={15} marks={marks} onPick={pick} leftHanded={s.profile.leftHanded} noteNames="naturals" testId="improv-fretboard" />
          <div className="mt-3 min-h-12 rounded-xl border border-ink-700 bg-ink-900/60 px-4 py-3 text-sm" aria-live="polite" data-testid="improv-explain">
            {explain ? (
              <><Badge tone={explain.role === 'chord tone' ? 'ok' : explain.role === 'avoid' ? 'bad' : 'warn'}>{explain.role} · {explain.token}</Badge> <span className="ml-1 text-ink-200">{explain.explanation}</span></>
            ) : <span className="text-ink-400">Chord tones of {chord.symbol} are marked. Try a chord tone, then a note one fret above it, and listen for the difference.</span>}
          </div>
        </Card>
        <Card title="Phrasing toolkit">
          <ul className="space-y-2.5 text-sm text-ink-300">
            <li><b className="text-ink-100">Land on chord tones</b> on strong beats, especially when the chord changes.</li>
            <li><b className="text-ink-100">Leave space.</b> A phrase followed by silence sounds intentional.</li>
            <li><b className="text-ink-100">Repeat, then vary.</b> Play an idea twice, then change one thing.</li>
            <li><b className="text-ink-100">Question and answer.</b> End the first phrase unresolved, the second on the root.</li>
            <li><b className="text-ink-100">Rhythm before notes.</b> Three notes with a strong rhythm beat ten notes without one.</li>
          </ul>
          <p className="mt-3 text-xs text-ink-400">Supplementary pedagogy, not taken from the supplied books.</p>
        </Card>
      </div>
      <Card className="mt-5" title="Progression map" subtitle="Type a progression in Roman numerals to see each chord's function, tones and best-fitting scales.">
        <input className="input font-mono" value={prog} onChange={(e) => setProg(e.target.value)} aria-label="Progression" data-testid="improv-prog" />
        {parsed.error ? <p className="mt-2 text-xs text-warn-400">{parsed.error}</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="text-xs text-ink-400"><th className="py-2 pr-3 font-medium">Chord</th><th className="pr-3 font-medium">Tones</th><th className="pr-3 font-medium">Guide tones</th><th className="pr-3 font-medium">Best scale</th><th className="font-medium">Why</th></tr></thead>
              <tbody>
                {analysis.map((a, i) => (
                  <tr key={i} className="border-t border-ink-800 align-top">
                    <td className="py-2 pr-3"><b className="text-ink-50">{a.symbol}</b> <span className="text-xs text-ink-400">{a.numeral}</span>{!a.inKey && <Badge tone="warn" className="ml-1">borrowed</Badge>}</td>
                    <td className="pr-3 text-ink-200">{a.chordTones.map((t) => t.name).join(' ')}</td>
                    <td className="pr-3 text-ink-200">{a.guideTones.join(' ')}</td>
                    <td className="pr-3 text-ink-100">{a.suggestions[0]?.name ?? '—'}</td>
                    <td className="py-2 text-xs text-ink-400">{a.suggestions[0]?.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => { const p = PROGRESSIONS[Math.floor(Math.random() * PROGRESSIONS.length)]; setMode(p.mode); setKey(p.mode === 'major' ? 'C' : 'A'); setProg(p.bars.join(' | ')); }}><LuShuffle size={14} /> Random preset progression</Button>
        <Button onClick={() => { const c = getContext(); const t = c.currentTime + 0.05; diatonic.forEach((d, i) => { const r = 48 + pcOf(d.chord.root); d.chord.intervals.forEach((iv) => pluck(r + iv.semitones, t + i * 0.7, 0.65, 0.45)); }); }}><LuVolume2 size={14} /> Hear the key's chords</Button>
      </div>
    </div>
  );
}
