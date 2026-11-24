/**
 * Tab & Exercise Editor (Module C). Edits the structured TabScore model,
 * saves exercises to the student's library and exposes them to every tool
 * (Technique Lab, Practice Studio, Playing Analyzer).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuPlus, LuCopy, LuTrash2, LuSave, LuPlay, LuSquare, LuDownload, LuUpload, LuFileText, LuZap, LuMic, LuSearch, LuUndo2, LuRedo2,
} from 'react-icons/lu';
import {
  TECHNIQUES, beatLength, cloneScore, emptyScore, measureCapacity, measureLength, parseAscii, toAscii, toJson, validateScore,
  type Duration, type TabBeat, type TabScore, type Technique,
} from '@gma/notation';
import { CATEGORIES, type Category, type SavedExercise, type TechniqueId } from '@gma/learning';
import { pcName, midiAt, type Tuning } from '@gma/theory';
import { useAllTunings, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, download, nowIso, readFile, uid } from '@/lib/core';
import { playScore } from '@/lib/playback';
import { getContext, pluck } from '@/lib/audio';
import { navigate, useDocumentTitle, useLocation } from '@/lib/router';
import { Badge, Button, Callout, Card, Empty, Field, Kbd, Modal, PageHeader, Segmented, Select, Stepper } from '@/components/ui';
import { TabView } from '@/components/music';

const TECHNIQUE_IDS: { id: TechniqueId; name: string }[] = [
  { id: 'alternate-picking', name: 'Alternate picking' }, { id: 'economy-picking', name: 'Economy picking' }, { id: 'legato', name: 'Legato' },
  { id: 'sweep-picking', name: 'Sweep picking' }, { id: 'tapping', name: 'Tapping' }, { id: 'string-skipping', name: 'String skipping' },
  { id: 'bending', name: 'Bending' }, { id: 'vibrato', name: 'Vibrato' }, { id: 'tremolo-picking', name: 'Tremolo picking' },
  { id: 'synchronization', name: 'Synchronisation' }, { id: 'rhythm-accuracy', name: 'Rhythm accuracy' }, { id: 'hybrid-picking', name: 'Hybrid picking' },
  { id: 'chord-changes', name: 'Chord changes' }, { id: 'palm-muting', name: 'Palm muting' }, { id: 'harmonics', name: 'Harmonics' },
  { id: 'fretting', name: 'Fretting' }, { id: 'scales', name: 'Scales' }, { id: 'arpeggios', name: 'Arpeggios' }, { id: 'strumming', name: 'Strumming' },
];

const DURATIONS: { value: Duration; label: string }[] = [
  { value: 1, label: 'Whole' }, { value: 2, label: 'Half' }, { value: 4, label: 'Quarter' }, { value: 8, label: '8th' }, { value: 16, label: '16th' }, { value: 32, label: '32nd' },
];

/** Techniques exposed as one-click toggles in the editor. */
const QUICK_TECH: Technique[] = ['hammer', 'pull', 'slideUp', 'slideDown', 'bend', 'release', 'vibrato', 'palmMute', 'harmonic', 'artificialHarmonic', 'tap', 'ghost', 'dead', 'letRing', 'accent', 'tremolo', 'trill'];

interface Meta {
  id: string | null;
  category: Category;
  technique: TechniqueId;
  difficulty: 1 | 2 | 3 | 4 | 5;
  targetBpm: number;
  notesPerBeat: number;
  description: string;
  tags: string;
}

interface Cursor { m: number; b: number; s: number }

const blankMeta = (): Meta => ({ id: null, category: 'technique', technique: 'alternate-picking', difficulty: 2, targetBpm: 100, notesPerBeat: 4, description: '', tags: '' });

function starterScore(t: Tuning): TabScore {
  const s = emptyScore(t.strings, t.name, 'Untitled exercise');
  s.measures = [{ beats: Array.from({ length: 8 }, () => ({ duration: 8 as Duration, notes: [] })) }];
  return s;
}

export function TabEditorPage() {
  useDocumentTitle('Tab Editor');
  const s = useStudent();
  const tunings = useAllTunings();
  const { query } = useLocation();
  const defaultTuning = tunings.find((t) => t.id === s.profile.tuningId) ?? tunings[0];
  const [doc, setDoc] = useState<{ score: TabScore; past: TabScore[]; future: TabScore[] }>(() => ({ score: starterScore(defaultTuning), past: [], future: [] }));
  const score = doc.score;
  const history = doc;
  /** Replace the score without recording an undo step (loading, importing a new document). */
  const setScoreRaw = (sc: TabScore) => setDoc({ score: sc, past: [], future: [] });
  const [meta, setMeta] = useState<Meta>(blankMeta);
  const [cur, setCur] = useState<Cursor>({ m: 0, b: 0, s: defaultTuning.strings.length - 1 });
  const [dirty, setDirty] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playBpm, setPlayBpm] = useState(90);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | Category>('all');
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bendAmt, setBendAmt] = useState(1);
  const typed = useRef<{ digits: string; at: number }>({ digits: '', at: 0 });
  const stopRef = useRef<(() => void) | null>(null);

  const setScore = useCallback((next: TabScore | ((s: TabScore) => TabScore)) => {
    setDoc((d) => {
      const val = typeof next === 'function' ? next(d.score) : next;
      if (val === d.score) return d;
      return { score: val, past: [...d.past.slice(-60), d.score], future: [] };
    });
    setDirty(true);
  }, []);

  const undo = () => setDoc((d) => (d.past.length ? { score: d.past[d.past.length - 1], past: d.past.slice(0, -1), future: [d.score, ...d.future] } : d));
  const redo = () => setDoc((d) => (d.future.length ? { score: d.future[0], past: [...d.past, d.score], future: d.future.slice(1) } : d));

  const load = (e: SavedExercise) => {
    setScoreRaw(cloneScore(e.score));
    setMeta({ id: e.id, category: e.category, technique: e.technique, difficulty: e.difficulty, targetBpm: e.targetBpm, notesPerBeat: e.notesPerBeat, description: e.description, tags: e.tags.join(', ') });
    setCur({ m: 0, b: 0, s: e.score.tuning.strings.length - 1 });
    setPlayBpm(e.score.tempo);
    setDirty(false);
  };

  // Open ?id= on arrival.
  useEffect(() => {
    const id = query.get('id');
    if (id) { const e = s.exercises.find((x) => x.id === id); if (e) load(e); }
  }, [query.get('id')]);

  const issues = useMemo(() => validateScore(score), [score]);
  const errors = issues.filter((i) => i.level === 'error');
  const cap = measureCapacity(score.timeSignature);
  const nStrings = score.tuning.strings.length;
  const tuningObj: Tuning = useMemo(() => tunings.find((t) => t.name === score.tuning.name && t.strings.length === nStrings && t.strings.every((m, i) => m === score.tuning.strings[i]))
    ?? { id: 'score', name: score.tuning.name, category: 'custom', strings: score.tuning.strings, description: '' } as Tuning, [score.tuning, tunings, nStrings]);

  const beatAt = (c: Cursor): TabBeat | undefined => score.measures[c.m]?.beats[c.b];
  const noteAt = (c: Cursor) => beatAt(c)?.notes.find((n) => n.string === c.s);

  const mutateBeat = (c: Cursor, fn: (b: TabBeat) => TabBeat) => setScore((sc) => {
    const next = cloneScore(sc);
    const m = next.measures[c.m];
    if (!m || !m.beats[c.b]) return sc;
    m.beats[c.b] = fn(m.beats[c.b]);
    return next;
  });

  const setFret = (fret: number | null) => {
    if (!beatAt(cur)) return;
    mutateBeat(cur, (b) => {
      const notes = b.notes.filter((n) => n.string !== cur.s);
      if (fret === null) return { ...b, notes };
      const old = b.notes.find((n) => n.string === cur.s);
      if (fret <= 30) {
        try { pluck(midiAt(tuningObj, cur.s, fret), getContext().currentTime + 0.01, 0.4, 0.5); } catch { /* audio optional */ }
      }
      return { ...b, rest: false, notes: [...notes, { ...(old ?? {}), string: cur.s, fret: Math.min(30, fret) }].sort((a, z) => a.string - z.string) };
    });
  };

  const toggleTech = (t: Technique) => {
    const n = noteAt(cur);
    if (!n) { store.toast('Select a note first', 'Click a cell with a fret number, then apply a technique.', 'info'); return; }
    mutateBeat(cur, (b) => ({
      ...b,
      notes: b.notes.map((x) => {
        if (x.string !== cur.s) return x;
        const has = x.techniques?.includes(t);
        const techniques = has ? x.techniques!.filter((y) => y !== t) : [...(x.techniques ?? []), t];
        const out = { ...x, techniques: techniques.length ? techniques : undefined };
        if (t === 'bend' || t === 'prebend') out.bend = has ? undefined : bendAmt;
        if (t === 'trill') out.trillFret = has ? undefined : x.fret + 2;
        return out;
      }),
    }));
  };

  const insertBeat = (after = true) => {
    const next = cloneScore(score);
    const m = next.measures[cur.m];
    const dur = beatAt(cur)?.duration ?? 8;
    const idx = m.beats.length === 0 ? 0 : after ? cur.b + 1 : cur.b;
    m.beats.splice(idx, 0, { duration: dur, notes: [] });
    setScore(next);
    setCur((c) => ({ ...c, b: idx }));
  };

  const deleteBeat = () => {
    const next = cloneScore(score);
    const m = next.measures[cur.m];
    if (!m.beats.length) return;
    m.beats.splice(cur.b, 1);
    setScore(next);
    setCur((c) => ({ ...c, b: Math.max(0, Math.min(c.b, m.beats.length - 1)) }));
  };

  const addMeasure = () => {
    const next = cloneScore(score);
    const fill = Math.max(1, Math.round(cap / beatLength({ duration: 8 })));
    next.measures.splice(cur.m + 1, 0, { beats: Array.from({ length: fill }, () => ({ duration: 8 as Duration, notes: [] })) });
    setScore(next);
    setCur((c) => ({ ...c, m: cur.m + 1, b: 0 }));
  };

  const deleteMeasure = () => {
    if (score.measures.length <= 1) return;
    const next = cloneScore(score);
    next.measures.splice(cur.m, 1);
    setScore(next);
    setCur((c) => ({ ...c, m: Math.max(0, cur.m - 1), b: 0 }));
  };

  const duplicateMeasure = () => setScore((sc) => {
    const next = cloneScore(sc);
    next.measures.splice(cur.m + 1, 0, cloneScore(sc).measures[cur.m]);
    return next;
  });

  const moveCursor = (dm: number, db: number, ds: number) => {
    setCur((c) => {
      let { m, b, s: st } = c;
      st = Math.max(0, Math.min(nStrings - 1, st + ds));
      b += db;
      if (b < 0) { if (m > 0) { m -= 1; b = Math.max(0, score.measures[m].beats.length - 1); } else b = 0; }
      else if (b >= score.measures[m].beats.length) { if (m < score.measures.length - 1) { m += 1; b = 0; } else b = Math.max(0, score.measures[m].beats.length - 1); }
      m = Math.max(0, Math.min(score.measures.length - 1, m + dm));
      if (dm) b = Math.min(b, Math.max(0, score.measures[m].beats.length - 1));
      return { m, b, s: st };
    });
    typed.current.digits = '';
  };

  // Keyboard entry
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || importOpen || exportOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
      if (!document.querySelector('[data-testid="tab-grid"]')?.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        const now = performance.now();
        const t = typed.current;
        const digits = now - t.at < 700 && t.digits.length === 1 ? t.digits + e.key : e.key;
        typed.current = { digits, at: now };
        setFret(Number(digits));
        return;
      }
      const map: Record<string, () => void> = {
        ArrowLeft: () => moveCursor(0, -1, 0), ArrowRight: () => moveCursor(0, 1, 0),
        ArrowUp: () => moveCursor(0, 0, 1), ArrowDown: () => moveCursor(0, 0, -1),
        Delete: () => setFret(null), Backspace: () => setFret(null),
        x: () => toggleTech('dead'), h: () => toggleTech('hammer'), p: () => toggleTech('pull'), b: () => toggleTech('bend'), v: () => toggleTech('vibrato'), m: () => toggleTech('palmMute'),
        '/': () => toggleTech('slideUp'), '\\': () => toggleTech('slideDown'),
        r: () => mutateBeat(cur, (bt) => ({ ...bt, rest: !bt.rest, notes: bt.rest ? bt.notes : [] })),
        Insert: () => insertBeat(true), Enter: () => insertBeat(true),
      };
      if (map[e.key]) { e.preventDefault(); map[e.key](); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const save = (asCopy = false) => {
    if (errors.length) { store.toast('Fix errors before saving', errors[0].message, 'warning'); return; }
    const now = nowIso();
    const id = asCopy || !meta.id ? uid('ex') : meta.id;
    const existing = s.exercises.find((x) => x.id === id);
    const title = asCopy ? `${score.title} (copy)` : score.title;
    const sc = { ...cloneScore(score), title };
    const item: SavedExercise = {
      id, title, category: meta.category, technique: meta.technique, difficulty: meta.difficulty, targetBpm: meta.targetBpm, notesPerBeat: meta.notesPerBeat,
      description: meta.description, tags: meta.tags.split(',').map((t) => t.trim()).filter(Boolean), score: sc, createdAt: existing?.createdAt ?? now, updatedAt: now,
    };
    store.append('exercises', item);
    setMeta((m) => ({ ...m, id }));
    if (asCopy) setDoc((d) => ({ ...d, score: sc }));
    setDirty(false);
    store.toast(asCopy ? 'Duplicated' : 'Saved', `"${title}" is in your exercise library and available in Technique Lab, Practice and the Analyzer.`, 'success');
  };

  const newExercise = () => {
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    const t = tunings.find((x) => x.id === s.profile.tuningId) ?? tunings[0];
    setScoreRaw(starterScore(t));
    setMeta(blankMeta());
    setCur({ m: 0, b: 0, s: t.strings.length - 1 });
    setDirty(false);
  };

  const removeExercise = (id: string) => {
    const e = s.exercises.find((x) => x.id === id);
    if (!e || !window.confirm(`Delete "${e.title}"? This cannot be undone.`)) return;
    store.remove('exercises', id);
    if (meta.id === id) newExercise();
  };

  const changeTuning = (id: string) => {
    const t = tunings.find((x) => x.id === id);
    if (!t) return;
    const n = t.strings.length;
    const dropped = score.measures.reduce((a, m) => a + m.beats.reduce((x, b) => x + b.notes.filter((nt) => nt.string >= n).length, 0), 0);
    if (dropped && !window.confirm(`${dropped} note(s) are on strings this tuning does not have and will be removed. Continue?`)) return;
    setScore((sc) => {
      const next = cloneScore(sc);
      next.tuning = { name: t.name, strings: [...t.strings] };
      next.measures.forEach((m) => m.beats.forEach((b) => { b.notes = b.notes.filter((nt) => nt.string < n); }));
      return next;
    });
    setCur((c) => ({ ...c, s: Math.min(c.s, n - 1) }));
  };

  const play = () => {
    if (playing) { stopRef.current?.(); stopRef.current = null; setPlaying(false); return; }
    if (!score.measures.some((m) => m.beats.some((b) => b.notes.length))) { store.toast('Nothing to play yet', 'Enter some fret numbers first.', 'info'); return; }
    setPlaying(true);
    stopRef.current = playScore(score, playBpm, { clickTrack: true, onEnd: () => setPlaying(false) });
  };
  useEffect(() => () => stopRef.current?.(), []);

  const library = useMemo(() => s.exercises
    .filter((e) => (catFilter === 'all' || e.category === catFilter) && (!search || `${e.title} ${e.tags.join(' ')} ${e.description}`.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [s.exercises, catFilter, search]);

  const selNote = noteAt(cur);
  const selBeat = beatAt(cur);

  return (
    <div>
      <PageHeader eyebrow="Practice" title="Tab & Exercise Editor" subtitle="Write riffs and exercises as tab, hear them, and save them to your library. Saved exercises appear in Technique Lab, Practice Studio and the Playing Analyzer."
        actions={<div className="flex flex-wrap gap-2">
          <Button onClick={newExercise} data-testid="tab-new"><LuPlus size={16} /> New</Button>
          <Button onClick={() => setImportOpen(true)} data-testid="tab-import"><LuUpload size={16} /> Import</Button>
          <Button onClick={() => setExportOpen(true)} data-testid="tab-export"><LuDownload size={16} /> Export</Button>
          <Button onClick={() => save(true)} disabled={!meta.id}><LuCopy size={16} /> Duplicate</Button>
          <Button variant="primary" onClick={() => save()} data-testid="tab-save"><LuSave size={16} /> {meta.id ? 'Save' : 'Save to library'}</Button>
        </div>} />

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Title" className="sm:col-span-2"><input className="input" value={score.title} onChange={(e) => setScore((sc) => ({ ...sc, title: e.target.value }))} data-testid="tab-title" /></Field>
              <Field label="Tuning"><Select value={tuningObj.id === 'score' ? '' : tuningObj.id} onChange={changeTuning} aria-label="Tuning"
                options={[...(tuningObj.id === 'score' ? [{ value: '', label: `${score.tuning.name} (from file)` }] : []), ...tunings.map((t) => ({ value: t.id, label: `${t.name} (${t.strings.length})`, group: t.strings.length === 6 ? '6-string' : t.strings.length === 7 ? '7-string' : t.strings.length === 8 ? '8-string' : 'Other' }))]} /></Field>
              <Field label="Time signature">
                <div className="flex items-center gap-1.5">
                  <input className="input w-16" type="number" min={1} max={32} value={score.timeSignature[0]} onChange={(e) => setScore((sc) => ({ ...sc, timeSignature: [Math.max(1, Math.min(32, Number(e.target.value) || 4)), sc.timeSignature[1]] }))} aria-label="Beats per bar" />
                  <span className="text-ink-400">/</span>
                  <select className="select w-20" value={score.timeSignature[1]} onChange={(e) => setScore((sc) => ({ ...sc, timeSignature: [sc.timeSignature[0], Number(e.target.value)] }))} aria-label="Beat unit">{[2, 4, 8, 16].map((d) => <option key={d} value={d}>{d}</option>)}</select>
                </div>
              </Field>
            </div>
          </Card>

          <Card title="Editor" subtitle="Click a cell, then type a fret number. Arrow keys move; Enter adds a beat."
            action={<div className="flex items-center gap-2">
              <Button size="sm" onClick={undo} disabled={!history.past.length} aria-label="Undo" title="Undo (Ctrl+Z)"><LuUndo2 size={14} /></Button>
              <Button size="sm" onClick={redo} disabled={!history.future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><LuRedo2 size={14} /></Button>
              <Stepper value={playBpm} onChange={setPlayBpm} min={30} max={300} step={2} label="Playback tempo" suffix="bpm" />
              <Button size="sm" variant={playing ? 'danger' : 'primary'} onClick={play} data-testid="tab-play">{playing ? <><LuSquare size={14} /> Stop</> : <><LuPlay size={14} /> Play</>}</Button>
            </div>}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="label mr-1">Duration</span>
              <Segmented size="sm" value={String(selBeat?.duration ?? 8) as `${Duration}`} onChange={(v) => selBeat && mutateBeat(cur, (b) => ({ ...b, duration: Number(v) as Duration }))}
                options={DURATIONS.map((d) => ({ value: String(d.value) as `${Duration}`, label: d.label }))} aria-label="Beat duration" />
              <Button size="sm" active={!!selBeat?.dotted} onClick={() => selBeat && mutateBeat(cur, (b) => ({ ...b, dotted: !b.dotted || undefined }))}>Dotted</Button>
              <Button size="sm" active={!!selBeat?.triplet} onClick={() => selBeat && mutateBeat(cur, (b) => ({ ...b, triplet: !b.triplet || undefined }))}>Triplet</Button>
              <Button size="sm" active={!!selBeat?.rest} onClick={() => selBeat && mutateBeat(cur, (b) => ({ ...b, rest: !b.rest || undefined, notes: b.rest ? b.notes : [] }))}>Rest</Button>
              <input className="input h-8 w-24 text-xs" placeholder="Chord" aria-label="Chord label" value={selBeat?.chord ?? ''} onChange={(e) => selBeat && mutateBeat(cur, (b) => ({ ...b, chord: e.target.value || undefined }))} />
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="label mr-1">Technique</span>
              {QUICK_TECH.map((t) => {
                const info = TECHNIQUES.find((x) => x.id === t)!;
                const on = !!selNote?.techniques?.includes(t);
                return <button key={t} type="button" title={info.description} onClick={() => toggleTech(t)} disabled={!selNote}
                  className={cx('rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-40', on ? 'border-accent-500 bg-accent-500/15 text-accent-300' : 'border-ink-600 text-ink-300 hover:border-ink-400')} aria-pressed={on}>{info.label}</button>;
              })}
              <select className="select h-7 w-auto py-0 text-xs" value={bendAmt} onChange={(e) => { const v = Number(e.target.value); setBendAmt(v); if (selNote?.techniques?.includes('bend')) mutateBeat(cur, (b) => ({ ...b, notes: b.notes.map((x) => (x.string === cur.s ? { ...x, bend: v } : x)) })); }} aria-label="Bend amount">
                <option value={0.25}>¼ bend</option><option value={0.5}>½ bend</option><option value={1}>Full bend</option><option value={1.5}>1½ bend</option><option value={2}>2 steps</option>
              </select>
            </div>

            <TabGrid score={score} cur={cur} setCur={(c) => { setCur(c); typed.current.digits = ''; }} cap={cap} />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => insertBeat(false)}>Insert beat before</Button>
              <Button size="sm" onClick={() => insertBeat(true)} data-testid="tab-add-beat"><LuPlus size={14} /> Beat after</Button>
              <Button size="sm" onClick={deleteBeat}><LuTrash2 size={14} /> Delete beat</Button>
              <span className="mx-1 h-5 w-px bg-ink-700" />
              <Button size="sm" onClick={addMeasure} data-testid="tab-add-measure"><LuPlus size={14} /> Measure</Button>
              <Button size="sm" onClick={duplicateMeasure}><LuCopy size={14} /> Duplicate measure</Button>
              <Button size="sm" onClick={deleteMeasure} disabled={score.measures.length <= 1}><LuTrash2 size={14} /> Delete measure</Button>
              <Button size="sm" active={!!score.measures[cur.m]?.repeatStart} onClick={() => setScore((sc) => { const n = cloneScore(sc); n.measures[cur.m].repeatStart = !n.measures[cur.m].repeatStart || undefined; return n; })}>Repeat start</Button>
              <label className="inline-flex items-center gap-1.5 text-xs text-ink-300">Repeat end ×
                <input className="input h-8 w-14 text-xs" type="number" min={1} max={16} value={score.measures[cur.m]?.repeatEnd ?? 1}
                  onChange={(e) => setScore((sc) => { const n = cloneScore(sc); const v = Math.max(1, Math.min(16, Number(e.target.value) || 1)); n.measures[cur.m].repeatEnd = v > 1 ? v : undefined; return n; })} aria-label="Repeat count" />
              </label>
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Selected: measure {cur.m + 1}, beat {cur.b + 1}, string {nStrings - cur.s} ({pcName(score.tuning.strings[cur.s] % 12)})
              {selNote ? <> — fret {selNote.fret} = <b className="text-ink-200">{pcName(midiAt(tuningObj, cur.s, selNote.fret) % 12)}</b></> : null}.
              {' '}Shortcuts: <Kbd>h</Kbd> hammer <Kbd>p</Kbd> pull <Kbd>/</Kbd> slide <Kbd>b</Kbd> bend <Kbd>v</Kbd> vibrato <Kbd>m</Kbd> mute <Kbd>x</Kbd> dead <Kbd>r</Kbd> rest <Kbd>Del</Kbd> clear.
            </p>
            {issues.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs" data-testid="tab-issues">
                {issues.slice(0, 6).map((i, k) => <li key={k} className={i.level === 'error' ? 'text-bad-400' : 'text-warn-400'}>{i.level === 'error' ? 'Error' : 'Note'}: {i.message}</li>)}
              </ul>
            )}
          </Card>

          <Card title="ASCII preview" subtitle="Live view of the tab as plain text.">
            <TabView score={score} />
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Exercise details">
            <div className="space-y-3">
              <Field label="Category"><Select value={meta.category} onChange={(v) => { setMeta({ ...meta, category: v }); setDirty(true); }} options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} aria-label="Category" /></Field>
              <Field label="Technique"><Select value={meta.technique} onChange={(v) => { setMeta({ ...meta, technique: v }); setDirty(true); }} options={TECHNIQUE_IDS.map((t) => ({ value: t.id, label: t.name }))} aria-label="Technique" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Difficulty"><Select value={String(meta.difficulty)} onChange={(v) => { setMeta({ ...meta, difficulty: Number(v) as Meta['difficulty'] }); setDirty(true); }} options={[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `${d} / 5` }))} aria-label="Difficulty" /></Field>
                <Field label="Notes per beat"><Select value={String(meta.notesPerBeat)} onChange={(v) => { setMeta({ ...meta, notesPerBeat: Number(v) }); setDirty(true); }} options={[{ value: '1', label: 'Quarters' }, { value: '2', label: '8ths' }, { value: '3', label: 'Triplets' }, { value: '4', label: '16ths' }, { value: '6', label: 'Sextuplets' }]} aria-label="Notes per beat" /></Field>
              </div>
              <Field label="Target tempo (bpm)"><input className="input" type="number" min={30} max={300} value={meta.targetBpm} onChange={(e) => { setMeta({ ...meta, targetBpm: Math.max(30, Math.min(300, Number(e.target.value) || 100)) }); setDirty(true); }} /></Field>
              <Field label="Description"><textarea className="input min-h-20" value={meta.description} onChange={(e) => { setMeta({ ...meta, description: e.target.value }); setDirty(true); }} placeholder="How to practise it, what to listen for" /></Field>
              <Field label="Tags" hint="Comma separated"><input className="input" value={meta.tags} onChange={(e) => { setMeta({ ...meta, tags: e.target.value }); setDirty(true); }} placeholder="warm-up, pentatonic" /></Field>
              {meta.id && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => navigate(`/technique-lab?exercise=${meta.id}`)}><LuZap size={14} /> Technique Lab</Button>
                  <Button size="sm" onClick={() => navigate(`/analyzer?exercise=${meta.id}`)}><LuMic size={14} /> Analyze</Button>
                </div>
              )}
              {dirty && <p className="text-xs text-warn-400">Unsaved changes</p>}
            </div>
          </Card>
          <Card title="My library" subtitle={`${s.exercises.length} saved`}>
            <div className="mb-2 flex gap-2">
              <div className="relative flex-1"><LuSearch size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-ink-400" /><input className="input pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search library" /></div>
            </div>
            <Select value={catFilter} onChange={setCatFilter} options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.name }))]} aria-label="Filter by category" className="mb-2 w-full" />
            {library.length === 0 ? <Empty title={s.exercises.length ? 'No matches' : 'No saved exercises'} body={s.exercises.length ? undefined : 'Save what you write here and it becomes a practice exercise everywhere in the app.'} icon={<LuFileText size={22} />} /> : (
              <ul className="max-h-96 space-y-1 overflow-y-auto" data-testid="tab-library">
                {library.map((e) => (
                  <li key={e.id} className={cx('group flex items-center gap-2 rounded-lg px-2 py-1.5', meta.id === e.id ? 'bg-accent-500/15' : 'hover:bg-ink-800')}>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { if (!dirty || window.confirm('Discard unsaved changes?')) load(e); }}>
                      <div className="truncate text-sm text-ink-100">{e.title}</div>
                      <div className="truncate text-xs text-ink-400">{CATEGORIES.find((c) => c.id === e.category)?.name} · {e.targetBpm} bpm · {e.score.tuning.strings.length}-string</div>
                    </button>
                    <button type="button" className="rounded p-1 text-ink-400 opacity-60 hover:text-bad-400 group-hover:opacity-100" onClick={() => removeExercise(e.id)} aria-label={`Delete ${e.title}`}><LuTrash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} tuning={tuningObj} onImport={(sc) => {
        setScore(sc);
        setMeta(blankMeta());
        setCur({ m: 0, b: 0, s: sc.tuning.strings.length - 1 });
        setPlayBpm(sc.tempo);
        setImportOpen(false);
      }} />
      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="Export tab" wide>
        <p className="mb-3 text-sm text-ink-300">ASCII tab is readable anywhere but loses rhythm detail. The JSON format keeps everything (rhythm, techniques, tuning, repeats) and can be imported back here.</p>
        <pre className="tab-text max-h-72 overflow-auto rounded-lg border border-ink-700 bg-ink-950 p-3" data-testid="tab-export-ascii">{toAscii(score)}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => { void navigator.clipboard?.writeText(toAscii(score)); store.toast('Copied ASCII tab'); }}><LuCopy size={14} /> Copy ASCII</Button>
          <Button onClick={() => download(`${slug(score.title)}.txt`, toAscii(score), 'text/plain')}><LuDownload size={14} /> Download .txt</Button>
          <Button variant="primary" onClick={() => download(`${slug(score.title)}.gmatab.json`, toJson(score), 'application/json')}><LuDownload size={14} /> Download JSON</Button>
        </div>
      </Modal>
    </div>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tab';

/** The editable grid: one column per beat, one row per string (highest on top). */
function TabGrid({ score, cur, setCur, cap }: { score: TabScore; cur: Cursor; setCur: (c: Cursor) => void; cap: number }) {
  const n = score.tuning.strings.length;
  const rows = [...Array(n).keys()].reverse();
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-700 bg-ink-950/60 p-3" data-testid="tab-grid" tabIndex={0} aria-label="Tab editor grid. Use arrow keys to move and number keys to enter frets.">
      <div className="flex items-stretch">
        <div className="mr-1 flex flex-col pt-5">
          {rows.map((st) => <div key={st} className="flex h-7 items-center justify-end pr-1 font-mono text-xs text-ink-400">{pcName(score.tuning.strings[st] % 12)}</div>)}
        </div>
        {score.measures.map((m, mi) => {
          const len = measureLength(m);
          const status = Math.abs(len - cap) < 1e-6 ? 'ok' : len > cap ? 'over' : 'under';
          return (
            <div key={mi} className="flex">
              <div className={cx('flex w-1.5 flex-col pt-5', m.repeatStart && 'border-l-4 border-double border-ink-300')}>
                {rows.map((st) => <div key={st} className="h-7 border-l border-ink-500" />)}
              </div>
              <div>
                <div className="flex h-5 items-center gap-1 px-1 text-[10px] text-ink-400">
                  <span>{mi + 1}</span>
                  {status !== 'ok' && m.beats.length > 0 && <Badge tone={status === 'over' ? 'bad' : 'neutral'} className="!px-1 !py-0 text-[9px]">{len.toFixed(1)}/{cap}</Badge>}
                  {m.repeatEnd && <span className="text-accent-300">×{m.repeatEnd}</span>}
                </div>
                <div className="flex">
                  {m.beats.length === 0 && (
                    <button type="button" className={cx('flex w-10 flex-col', cur.m === mi && 'bg-accent-500/10')} onClick={() => setCur({ m: mi, b: 0, s: cur.s })} aria-label={`Empty measure ${mi + 1}`}>
                      {rows.map((st) => <div key={st} className="relative h-7 w-full"><div className="absolute inset-x-0 top-1/2 h-px bg-ink-600" /></div>)}
                    </button>
                  )}
                  {m.beats.map((b, bi) => {
                    const w = b.duration <= 2 ? 'w-14' : b.duration === 4 ? 'w-11' : b.duration === 8 ? 'w-9' : 'w-8';
                    return (
                      <div key={bi} className={cx('relative flex flex-col', w, cur.m === mi && cur.b === bi && 'bg-accent-500/10')}>
                        {b.chord && <div className="absolute -top-4 left-0 whitespace-nowrap text-[10px] font-semibold text-cyan-400">{b.chord}</div>}
                        {rows.map((st) => {
                          const note = b.notes.find((x) => x.string === st);
                          const active = cur.m === mi && cur.b === bi && cur.s === st;
                          const label = note ? noteLabel(note) : b.rest && st === rows[Math.floor(rows.length / 2)] ? '𝄽' : '';
                          return (
                            <button key={st} type="button" data-cell={`${mi}-${bi}-${st}`} onClick={() => setCur({ m: mi, b: bi, s: st })}
                              className={cx('relative h-7 w-full font-mono text-xs', active && 'outline outline-2 -outline-offset-2 outline-accent-400 rounded')} aria-label={`Measure ${mi + 1}, beat ${bi + 1}, string ${n - st}${note ? `, fret ${note.fret}` : ''}`}>
                              <span className="absolute inset-x-0 top-1/2 h-px bg-ink-600" />
                              {label && <span className={cx('relative rounded px-0.5', note ? 'bg-ink-950 text-ink-50' : 'text-ink-400')}>{label}</span>}
                            </button>
                          );
                        })}
                        <div className="h-4 text-center text-[9px] text-ink-500">{durLabel(b)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div className="flex w-1.5 flex-col pt-5">{rows.map((st) => <div key={st} className="h-7 border-l-2 border-ink-400" />)}</div>
      </div>
    </div>
  );
}

function noteLabel(n: { fret: number; techniques?: Technique[]; bend?: number }): string {
  const t = n.techniques ?? [];
  if (t.includes('dead')) return 'x';
  let s = String(n.fret);
  if (t.includes('harmonic')) s = `<${s}>`;
  else if (t.includes('artificialHarmonic')) s = `[${s}]`;
  else if (t.includes('ghost')) s = `(${s})`;
  if (t.includes('hammer')) s = 'h' + s;
  if (t.includes('pull')) s = 'p' + s;
  if (t.includes('slideUp')) s = '/' + s;
  if (t.includes('slideDown')) s = '\\' + s;
  if (t.includes('tap')) s = 't' + s;
  if (t.includes('bend')) s += 'b';
  if (t.includes('vibrato')) s += '~';
  return s;
}

function durLabel(b: TabBeat): string {
  const base = { 1: 'w', 2: 'h', 4: 'q', 8: 'e', 16: 's', 32: 't' }[b.duration];
  return `${base}${b.dotted ? '.' : ''}${b.triplet ? '3' : ''}${b.notes.some((x) => x.techniques?.includes('palmMute')) ? ' PM' : ''}`;
}

function ImportModal({ open, onClose, onImport, tuning }: { open: boolean; onClose: () => void; onImport: (s: TabScore) => void; tuning: Tuning }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ score: TabScore | null; warnings: string[]; errors: string[] } | null>(null);
  useEffect(() => { if (open) { setText(''); setResult(null); } }, [open]);
  const parse = (raw: string) => {
    const t = raw.trim();
    if (!t) { setResult(null); return; }
    if (t.startsWith('{')) {
      try {
        const obj = JSON.parse(t);
        const issues = validateScore(obj);
        const errors = issues.filter((i) => i.level === 'error').map((i) => i.message);
        setResult({ score: errors.length ? null : (obj as TabScore), warnings: issues.filter((i) => i.level === 'warning').map((i) => i.message), errors });
      } catch (e) { setResult({ score: null, warnings: [], errors: [`Invalid JSON: ${(e as Error).message}`] }); }
      return;
    }
    const lines = t.split(/\r?\n/).filter((l) => /-{2,}/.test(l)).length;
    // Use the editor's tuning when it fits; otherwise fall back to the standard tuning for that string count.
    const first = parseAscii(t, { name: tuning.name, strings: tuning.strings });
    const mismatch = first.errors.some((e) => e.includes('string lines but the selected tuning'));
    setResult(mismatch && lines ? parseAscii(t) : first);
  };
  return (
    <Modal open={open} onClose={onClose} title="Import tab" wide>
      <p className="mb-3 text-sm text-ink-300">Paste ASCII tab (one line per string, highest string first) or a Guitar Mastery Academy JSON file. ASCII rhythm is inferred from spacing, so check durations after importing.</p>
      <textarea className="input min-h-48 font-mono text-xs" value={text} onChange={(e) => { setText(e.target.value); parse(e.target.value); }} placeholder={'e|-----------------|\nB|-----------------|\nG|-----------------|\nD|-------5-7-------|\nA|---5-7-----7-5---|\nE|-5-------------8-|'} data-testid="tab-import-text" />
      <div className="mt-2 flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-600 px-3 py-1.5 text-sm text-ink-200 hover:border-ink-400">
          <LuUpload size={14} /> Choose file
          <input type="file" accept=".txt,.json,.tab" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const c = await readFile(f); setText(c); parse(c); } }} />
        </label>
      </div>
      {result && (
        <div className="mt-3 space-y-2 text-sm" data-testid="tab-import-result">
          {result.errors.map((e, i) => <p key={i} className="text-bad-400">{e}</p>)}
          {result.warnings.map((w, i) => <p key={i} className="text-warn-400">{w}</p>)}
          {result.score && <TabView score={result.score} caption={`${result.score.measures.length} measure(s), ${result.score.tuning.strings.length} strings, ${result.score.tuning.name}`} />}
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!result?.score} onClick={() => result?.score && onImport(result.score)} data-testid="tab-import-confirm">Import</Button>
      </div>
      {!result && <Callout tone="info">Tip: the export from this editor round-trips exactly through JSON.</Callout>}
    </Modal>
  );
}
