import { useEffect, useMemo, useState } from 'react';
import { LuPlay, LuStar, LuInfo } from 'react-icons/lu';
import {
  SCALES, MAJOR_MODE_IDS, PILLITIERE_START_SHAPES, anchoredWindowPatterns, buildScale, cagedPositions, diatonicChords, fivePositionPatterns,
  getScale, hasStandardIntervals, markTones, noteName, parentMajorOf, parseNote, pcOf, pillitiereParentDegree, scaleIntervals,
  stepNames, stepPattern, threeNpsPatterns, type ScalePattern,
} from '@gma/theory';
import { useActiveTuning, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, nowIso, uid } from '@/lib/core';
import { getContext, pluck } from '@/lib/audio';
import { useDocumentTitle, useLocation } from '@/lib/router';
import { Badge, Button, Callout, Card, Field, PageHeader, Segmented, Select } from '@/components/ui';
import { Fretboard, PillitierePattern, type FretMark } from '@/components/music';
import { TuningPicker } from '@/components/widgets';

const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
type View = 'neck' | '3nps' | 'positions' | 'caged' | 'pillitiere';

const CAT_NAMES: Record<string, string> = {
  diatonic: 'Major modes', pentatonic: 'Pentatonic', blues: 'Blues', 'minor-variant': 'Minor scales', 'harmonic-minor-mode': 'Harmonic minor modes',
  'melodic-minor-mode': 'Melodic minor modes', symmetrical: 'Symmetrical', exotic: 'Exotic', bebop: 'Bebop', chromatic: 'Chromatic',
};

export function ScalesPage() {
  useDocumentTitle('Scale Explorer');
  const { query } = useLocation();
  const s = useStudent();
  const tuning = useActiveTuning();
  const [root, setRoot] = useState(query.get('root') ?? 'A');
  const [scaleId, setScaleId] = useState(query.get('scale') ?? 'aeolian');
  const [view, setView] = useState<View>((query.get('view') as View) ?? 'neck');
  const [labels, setLabels] = useState<'interval' | 'note' | 'degree' | 'finger'>('interval');
  const [posIdx, setPosIdx] = useState(0);
  // Follow deep links (e.g. from lessons or the Jam Room) even when the page is already open.
  useEffect(() => {
    const qr = query.get('root'); const qs = query.get('scale'); const qv = query.get('view') as View | null;
    if (qr && parseNote(qr)) setRoot(qr);
    if (qs && SCALES.some((x) => x.id === qs)) { setScaleId(qs); setPosIdx(0); }
    if (qv) setView(qv);
  }, [query.toString()]);
  const def = getScale(scaleId);
  const r = parseNote(root)!;
  const built = useMemo(() => buildScale(r, def), [root, scaleId]);
  const ivs = scaleIntervals(def);
  const isMajorMode = (MAJOR_MODE_IDS as readonly string[]).includes(def.id);

  const patterns: ScalePattern[] = useMemo(() => {
    if (view === '3nps') return threeNpsPatterns(tuning, pcOf(r), ivs, 0, 22);
    if (view === 'positions') return ivs.length === 5 ? fivePositionPatterns(tuning, pcOf(r), ivs, 0, 22) : anchoredWindowPatterns(tuning, pcOf(r), ivs, 0, 22);
    if (view === 'caged') return cagedPositions(tuning, pcOf(r), ivs);
    return [];
  }, [view, root, scaleId, tuning]);
  const pat = patterns[Math.min(posIdx, patterns.length - 1)];

  const marks: FretMark[] = useMemo(() => {
    const label = (token: string, idx: number, finger?: number) => (labels === 'note' ? noteName(built.notes[idx]) : labels === 'degree' ? String(idx + 1) : labels === 'finger' ? String(finger ?? '') : token);
    if (view === 'neck' || !pat) return markTones(tuning, pcOf(r), ivs, 22).map((m) => ({ string: m.string, fret: m.fret, tone: m.isRoot ? 'root' : 'tone', label: label(m.token, m.toneIndex) }));
    return pat.notes.map((n) => ({ string: n.string, fret: n.fret, tone: n.isRoot ? 'root' : 'tone', label: label(n.token, n.degreeIndex, n.finger) }));
  }, [view, pat, labels, built, tuning]);

  const play = () => {
    const c = getContext();
    const base = 48 + pcOf(r) + (pcOf(r) > 7 ? -12 : 0);
    const seq = [...ivs.map((i) => base + i.semitones), base + 12];
    [...seq, ...seq.slice(0, -1).reverse()].forEach((m, i) => pluck(m, c.currentTime + 0.05 + i * 0.22, 0.3, 0.65));
  };

  const chords = built.notes.length === 7 ? diatonicChords(r, def) : [];
  const charSet = new Set(def.characteristic ?? []);

  // Pillitiere builder state
  const modeIndex = isMajorMode ? (MAJOR_MODE_IDS as readonly string[]).indexOf(def.id) + 1 : 1;
  const [pillDegree, setPillDegree] = useState(1);
  const [pillString, setPillString] = useState(0);
  const parentKey = isMajorMode ? noteName(parentMajorOf(r, modeIndex)) : root;
  const parentDegree = pillitiereParentDegree(modeIndex, pillDegree);

  const views: { value: View; label: string }[] = [
    { value: 'neck', label: 'Full neck' },
    ...(ivs.length === 7 ? [{ value: '3nps' as View, label: '3 notes/string' }] : []),
    { value: 'positions', label: ivs.length === 5 ? '5 positions' : 'Positions' },
    ...(hasStandardIntervals(tuning) ? [{ value: 'caged' as View, label: 'CAGED' }] : []),
    ...(isMajorMode ? [{ value: 'pillitiere' as View, label: 'Pillitiere builder' }] : []),
  ];
  const currentView = views.some((v) => v.value === view) ? view : 'neck';

  return (
    <div>
      <PageHeader title="Scale Explorer" eyebrow="Tools" subtitle="Formula, intervals and every fretboard system for each scale, plus Pillitiere's rule-based pattern builder." actions={
        <>
          <Button onClick={play}><LuPlay size={16} /> Play scale</Button>
          <Button onClick={() => { store.append('saved', { id: uid('saved'), kind: 'scale', root, type: scaleId, tuningId: tuning.id, label: `${root} ${def.name}`, updatedAt: nowIso() }); store.toast('Scale saved', `${root} ${def.name}`, 'success'); }}><LuStar size={16} /> Save</Button>
        </>} />
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Root"><Select value={root} onChange={setRoot} options={ROOTS.map((x) => ({ value: x, label: x }))} aria-label="Scale root" /></Field>
          <Field label="Scale"><Select value={scaleId} onChange={(v) => { setScaleId(v); setPosIdx(0); }} options={SCALES.map((x) => ({ value: x.id, label: x.name, group: CAT_NAMES[x.category] }))} aria-label="Scale" data-testid="scale-select" /></Field>
          <Field label="Tuning"><TuningPicker value={tuning.id} onChange={(id) => store.setProfile({ tuningId: id })} /></Field>
          <Field label="System"><Segmented value={currentView} onChange={(v) => { setView(v); setPosIdx(0); }} size="sm" options={views} /></Field>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {currentView === 'pillitiere' ? (
            <Card title="Pillitiere pattern builder" subtitle="Start degree + the shape cycle X X X Y Y Z Z + two shift rules = the whole pattern.">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <Field label={`Start on ${def.name} degree`}><Segmented value={String(pillDegree)} onChange={(v) => setPillDegree(Number(v))} size="sm" options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: String(d) }))} /></Field>
                <Field label="Start string"><Segmented value={String(pillString)} onChange={(v) => setPillString(Number(v))} size="sm" options={[0, 1, 2].map((st) => ({ value: String(st), label: `${tuning.strings.length - st}th` }))} /></Field>
              </div>
              <PillitierePattern tuning={tuning} keyName={parentKey} degree={parentDegree} startString={pillString}
                caption={<>Parent key <b>{parentKey} major</b>, pattern from parent degree {parentDegree} (starts <span className="font-mono">{PILLITIERE_START_SHAPES[parentDegree]}</span>). Labels show the parent-major degree.</>} />
              {!hasStandardIntervals(tuning) && <Callout tone="warn" title="Generalised rule">This tuning is not standard-interval. The builder applies the shift rule generalised from Pillitiere's G→B rule (shift = 5 − string interval). This is an extension of the source method.</Callout>}
            </Card>
          ) : (
            <Card title={currentView === 'neck' ? 'Whole neck' : pat ? pat.name : 'Positions'} action={
              <Segmented value={labels} onChange={setLabels} size="sm" options={[{ value: 'interval', label: 'Intervals' }, { value: 'note', label: 'Notes' }, { value: 'degree', label: 'Degrees' }, ...(currentView !== 'neck' ? [{ value: 'finger' as const, label: 'Fingers' }] : [])]} />}>
              {currentView !== 'neck' && patterns.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {patterns.map((p, i) => <button key={p.id} type="button" onClick={() => setPosIdx(i)} className={cx('rounded-md border px-2.5 py-1 text-xs', i === posIdx ? 'border-accent-500 bg-accent-500/15 text-accent-300' : 'border-ink-600 text-ink-200 hover:border-ink-400')}>{p.system === 'caged' ? (p as { shape?: string }).shape + ' shape' : p.name.split(' (')[0]} <span className="text-ink-400">fr {p.minFret}</span></button>)}
                </div>
              )}
              {currentView !== 'neck' && patterns.length === 0 && <p className="mb-3 text-sm text-ink-300">No patterns of this type fit this scale and tuning.</p>}
              <Fretboard tuning={tuning} minFret={currentView === 'neck' || !pat ? 0 : Math.max(0, pat.minFret - 1)} maxFret={currentView === 'neck' || !pat ? 17 : Math.min(24, pat.maxFret + 1)} marks={marks} leftHanded={s.profile.leftHanded} testId="scale-fretboard"
                onPick={(p) => pluck(tuning.strings[p.string] + p.fret, getContext().currentTime + 0.02, 0.6)} />
              {currentView === 'caged' && <p className="mt-2 text-xs text-ink-400">Each CAGED window surrounds the movable chord shape of the same name.</p>}
            </Card>
          )}
          {chords.length > 0 && (
            <Card title="Associated chords" subtitle="Chords built by stacking thirds inside this scale.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {chords.map((c) => (
                  <div key={c.degree} className="rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-2 text-center">
                    <div className="font-mono text-xs text-ink-400">{c.numeral}</div>
                    <div className="text-sm font-semibold text-ink-50">{c.chord.symbol}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
        <Card title={`${noteName(built.root)} ${def.name}`}>
          <dl className="space-y-3 text-sm">
            <div><dt className="label">Formula</dt><dd className="mt-1 flex flex-wrap gap-1">{built.tokens.map((t) => <span key={t} className={cx('rounded px-1.5 py-0.5 font-mono text-xs', charSet.has(t) ? 'bg-warn-500/20 text-warn-400' : 'bg-ink-700 text-ink-100')}>{t}</span>)}</dd></div>
            <div><dt className="label">Notes</dt><dd className="mt-1 font-mono text-ink-100" data-testid="scale-notes">{built.notes.map((n) => noteName(n)).join(' ')}</dd></div>
            <div><dt className="label">Steps</dt><dd className="mt-1 font-mono text-ink-200">{stepNames(stepPattern(def))}</dd></div>
            {def.characteristic && <div><dt className="label">Characteristic notes</dt><dd className="mt-1 text-ink-200">{def.characteristic.join(', ')} <span className="text-xs text-ink-400">(highlighted)</span></dd></div>}
            <div><dt className="label">Sound</dt><dd className="mt-1 text-ink-200">{def.sound}</dd></div>
            <div><dt className="label">Use it for</dt><dd className="mt-1"><ul className="ml-4 list-disc space-y-1 text-ink-200">{def.applications.map((a) => <li key={a}>{a}</li>)}</ul></dd></div>
            {def.chordFit.length > 0 && <div><dt className="label">Fits chords</dt><dd className="mt-1 flex flex-wrap gap-1">{def.chordFit.map((c) => <Badge key={c}>{noteName(built.root)}{c === 'maj' ? '' : c}</Badge>)}</dd></div>}
            {def.modeOf && def.modeOf.parent !== def.id && <div><dt className="label">Parent</dt><dd className="mt-1 text-ink-200">Mode {def.modeOf.degree} of {getScale(def.modeOf.parent).name}</dd></div>}
            {def.naturalDiatonic && <div className="flex gap-2 rounded-lg bg-ink-800 p-2.5 text-xs text-ink-300"><LuInfo size={14} className="mt-0.5 shrink-0" />Natural diatonic scale: covered by Pillitiere's X/Y/Z system. Try the pattern builder.</div>}
          </dl>
        </Card>
      </div>
    </div>
  );
}
