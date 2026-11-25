/**
 * Song importer. Files are read in a Web Worker (archives, charts, grouping),
 * audio is decoded with the Web Audio API for sync analysis, and finished
 * songs are saved to the device-local library in IndexedDB. Nothing leaves
 * the browser.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  LuImport, LuFolderOpen, LuX, LuPlay, LuPause, LuSkipBack, LuSave, LuCircleCheck, LuTriangleAlert, LuCircleMinus, LuCircleX, LuCircleDashed,
  LuLoaderCircle, LuLayers2, LuVolume2, LuGamepad2, LuRefreshCw, LuFileMusic, LuPackage, LuAudioWaveform, LuInfo,
} from 'react-icons/lu';
import { fretWindow, type PlaySong, type SongEvent } from '@gma/notation';
import { checkLengths, type LengthCheck, type OffsetEstimate } from '@gma/audio';
import { sha256Hex, type AudioItem, type ComponentReport, type EntryReport, type FileReport, type ImportProgress, type ImportResult, type SongDraft } from '@gma/importer';
import { analyseAudio, filesFromDrop, ImportCancelled, startImport, type ImportJob, type PickedFile } from '@/lib/importer';
import { library, type LibrarySong, type SyncInfo } from '@/lib/idb';
import { cx, nowIso, uid } from '@/lib/core';
import { store } from '@/lib/store';
import { useStudent } from '@/lib/hooks';
import { Link, useDocumentTitle } from '@/lib/router';
import { Badge, Button, Callout, Card, Field, PageHeader, ProgressBar, Select } from '@/components/ui';
import { drawHighway } from '@/components/highway';

const ACCEPT = '.psarc,.xml,.ogg,.oga,.wav,.mp3,.flac,.m4a,.json,.hsan,.gp,.gpx,.gp3,.gp4,.gp5,.zip,.sng,.wem,.bnk,audio/*';

interface DraftSync {
  offset: number;
  method: SyncInfo['method'];
  confidence?: number;
  audioDuration?: number;
  status: 'idle' | 'analysing' | 'done' | 'error';
  message?: string;
  length?: LengthCheck;
}

interface DraftState {
  draft: SongDraft;
  title: string;
  artist: string;
  include: Record<string, boolean>;
  audioKey: string | null;
  sync: DraftSync;
  fingerprint: string;
  duplicate: LibrarySong | null;
  saved: string | null;
  saving: boolean;
}

const fmtTime = (s: number) => `${s < 0 ? '-' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.floor(Math.abs(s) % 60)).padStart(2, '0')}`;
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} s`;

function describeEstimate(e: OffsetEstimate): string {
  if (e.ambiguous && e.method !== 'none') return `${e.method === 'chart' ? 'The chart’s own timing fits the recording' : `The best fit is a shift of ${signed(e.offset)}`}, but the part repeats so evenly that a shift of a beat would fit almost as well. Play the preview and check by ear.`;
  if (e.method === 'chart') return 'The chart’s own timing lines up with the recording. No adjustment needed.';
  if (e.method === 'onsets') return `The notes line up when the chart is shifted by ${signed(e.offset)} against the recording.`;
  return 'The timing could not be confirmed from the audio. Charts made for their recording usually match it exactly; play the preview and nudge if the notes run early or late.';
}

export function ImportPage() {
  useDocumentTitle('Import songs');
  const [phase, setPhase] = useState<'idle' | 'running' | 'review'>('idle');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [drafts, setDrafts] = useState<DraftState[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const job = useRef<ImportJob | null>(null);
  const analysis = useRef<AbortController | null>(null);
  useEffect(() => () => { job.current?.cancel(); analysis.current?.abort(); }, []);

  const audioMap = useMemo(() => new Map<string, AudioItem>(result?.audio.map((a) => [a.key, a]) ?? []), [result]);
  const update = (id: string, fn: (s: DraftState) => DraftState) => setDrafts((all) => all.map((s) => (s.draft.id === id ? fn(s) : s)));

  const analyse = async (draft: SongDraft, audioKey: string, res: ImportResult, signal: AbortSignal) => {
    const au = res.audio.find((a) => a.key === audioKey);
    if (!au) return;
    update(draft.id, (s) => ({ ...s, sync: { ...s.sync, status: 'analysing', message: undefined } }));
    const times = draft.arrangements.flatMap((a) => a.song.events.map((e) => e.time));
    const r = await analyseAudio(au.blob, times, signal);
    if (signal.aborted) return;
    const length = checkLengths(r.duration, draft.songLength, draft.chartEnd);
    update(draft.id, (s) => {
      if (s.audioKey !== audioKey) return s;
      const manual = s.sync.method === 'manual';
      if (r.estimate) {
        return { ...s, sync: { offset: manual ? s.sync.offset : r.estimate.offset, method: manual ? 'manual' : r.estimate.method, confidence: r.estimate.confidence, audioDuration: r.duration, status: 'done', message: describeEstimate(r.estimate), length } };
      }
      return { ...s, sync: { ...s.sync, audioDuration: r.duration, status: r.duration ? 'done' : 'error', message: r.error, length } };
    });
  };

  const run = async (picked: PickedFile[]) => {
    if (!picked.length) return;
    job.current?.cancel();
    analysis.current?.abort();
    setPhase('running'); setError(null); setResult(null); setDrafts([]); setActive(null);
    setProgress({ fileIndex: 0, fileCount: picked.length, file: picked[0].file.name, step: 'Starting', fraction: 0 });
    let j: ImportJob;
    try { j = startImport(picked, setProgress); } catch (e) { setError((e as Error).message); setPhase('idle'); return; }
    job.current = j;
    try {
      const res = await j.promise;
      const states = await Promise.all(res.songs.map(async (d): Promise<DraftState> => {
        const hashes = d.arrangements.map((a) => a.hash);
        const fingerprint = await sha256Hex([...hashes].sort().join('|'));
        return {
          draft: d, title: d.title, artist: d.artist, include: Object.fromEntries(d.arrangements.map((a) => [a.key, true])),
          audioKey: d.audioKey, sync: { offset: 0, method: 'none', status: 'idle' }, fingerprint,
          duplicate: await library.findDuplicate(fingerprint, hashes), saved: null, saving: false,
        };
      }));
      setResult(res); setDrafts(states); setActive(states[0]?.draft.id ?? null); setPhase('review');
      const ctrl = new AbortController();
      analysis.current = ctrl;
      for (const s of states) {
        if (ctrl.signal.aborted) break;
        if (s.audioKey) await analyse(s.draft, s.audioKey, res, ctrl.signal);
      }
    } catch (e) {
      if (e instanceof ImportCancelled) { setPhase('idle'); store.toast('Import cancelled', 'Nothing was saved.', 'info'); }
      else { setError((e as Error).message); setPhase('idle'); }
    } finally {
      if (job.current === j) job.current = null;
    }
  };

  const cancel = () => { job.current?.cancel(); job.current = null; };

  const chooseAudio = (s: DraftState, key: string | null) => {
    update(s.draft.id, (x) => ({ ...x, audioKey: key, sync: { offset: x.sync.method === 'manual' ? x.sync.offset : 0, method: x.sync.method === 'manual' ? 'manual' : 'none', status: 'idle' } }));
    if (key && result) { const ctrl = new AbortController(); analysis.current = ctrl; void analyse(s.draft, key, result, ctrl.signal); }
  };

  const save = async (s: DraftState, mode: 'new' | 'replace'): Promise<boolean> => {
    const arrs = s.draft.arrangements.filter((a) => s.include[a.key]);
    if (!arrs.length) { store.toast('Nothing to save', 'Include at least one arrangement.', 'warning'); return false; }
    update(s.draft.id, (x) => ({ ...x, saving: true }));
    try {
      const target = mode === 'replace' ? s.duplicate : null;
      const id = target?.id ?? uid('song');
      const au = s.audioKey ? audioMap.get(s.audioKey) : undefined;
      let audio: LibrarySong['audio'] = null;
      if (au) {
        const key = uid('audio');
        await library.putAudio(key, au.blob);
        audio = { key, name: au.name, size: au.size, type: au.mime, duration: s.sync.audioDuration, fingerprint: au.fingerprint, preview: au.preview };
      }
      const title = s.title.trim() || 'Untitled';
      const artist = s.artist.trim();
      const rec: LibrarySong = {
        id, schema: 2, title, artist, album: s.draft.album, year: s.draft.year,
        arrangements: arrs.map((a) => {
          const arrId = uid('arr');
          return { id: arrId, label: a.label, role: a.role, song: { ...a.song, id: arrId, title, artist }, hash: a.hash, sourcePath: a.path, best: target?.arrangements.find((x) => x.hash === a.hash)?.best };
        }),
        audio,
        sync: { offset: s.sync.offset, method: s.sync.method, confidence: s.sync.confidence, audioDuration: s.sync.audioDuration, songLength: s.draft.songLength, note: s.sync.message },
        source: { kind: 'import', files: s.draft.origins },
        fingerprint: s.fingerprint,
        addedAt: target?.addedAt ?? nowIso(),
        updatedAt: nowIso(),
      };
      await library.put(rec);
      if (target?.audio && target.audio.key !== audio?.key) {
        const others = (await library.list()).some((x) => x.id !== id && x.audio?.key === target.audio!.key);
        if (!others) await library.removeAudio(target.audio.key);
      }
      try { void navigator.storage?.persist?.(); } catch { /* best effort */ }
      update(s.draft.id, (x) => ({ ...x, saving: false, saved: id, duplicate: rec }));
      return true;
    } catch (e) {
      update(s.draft.id, (x) => ({ ...x, saving: false }));
      const msg = (e as Error)?.name === 'QuotaExceededError' ? 'The browser is out of storage space for this site. Remove songs you no longer need, or free up disk space.' : (e as Error).message;
      store.toast('Could not save', msg, 'warning');
      return false;
    }
  };

  const saveAll = async () => {
    let n = 0;
    for (const s of drafts) if (!s.saved && !s.duplicate && !s.saving && (await save(s, 'new'))) n++;
    if (n) store.toast('Saved to your library', `${n} song${n === 1 ? '' : 's'} saved on this device.`, 'success');
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (phase === 'running') return;
    void run(await filesFromDrop(e.dataTransfer));
  };

  const current = drafts.find((d) => d.draft.id === active) ?? null;
  const unsaved = drafts.filter((d) => !d.saved && !d.duplicate).length;
  const encrypted = result?.files.some((f) => f.components?.some((c) => c.id === 'toc' && c.state !== 'ok'));

  return (
    <div>
      <PageHeader eyebrow="Play" title="Import songs" subtitle="Add songs to your library from PSARC archives, Rocksmith arrangement XMLs with their OGG/WAV audio, Guitar Pro 7/8 or Guitar Mastery files. Everything is processed in this browser and stays on this device."
        actions={<Link to="/play" className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-4 text-sm font-medium text-ink-100 hover:bg-ink-700"><LuGamepad2 size={16} /> Play mode</Link>} />

      <div
        onDragEnter={(e) => { e.preventDefault(); if (phase !== 'running') setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={(e) => void onDrop(e)}
        className={cx('card mb-5 flex flex-col items-center gap-3 border-2 border-dashed px-6 py-8 text-center transition-colors', dragging ? 'border-accent-500 bg-accent-500/10' : 'border-ink-600', phase === 'running' && 'pointer-events-none opacity-60')}
        data-testid="import-drop">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-500/15 text-accent-300"><LuImport size={24} /></span>
        <div>
          <div className="font-medium text-ink-50">Drop files or folders here</div>
          <div className="mt-1 text-xs text-ink-400">PSARC · arrangement XML · OGG · WAV · Guitar Pro .gp · ZIP · Guitar Mastery .json, any mix. Arrangements of one song are grouped automatically.</div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-accent-500 px-4 text-sm font-medium text-white hover:bg-accent-600">
            <LuFileMusic size={16} /> Choose files
            <input type="file" multiple accept={ACCEPT} className="sr-only" disabled={phase === 'running'} data-testid="import-files"
              onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; void run(fs.map((f) => ({ file: f, path: f.name }))); }} />
          </label>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-4 text-sm font-medium text-ink-100 hover:bg-ink-700">
            <LuFolderOpen size={16} /> Choose a folder
            <input type="file" multiple className="sr-only" disabled={phase === 'running'} data-testid="import-folder" {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; void run(fs.map((f) => ({ file: f, path: f.webkitRelativePath || f.name }))); }} />
          </label>
        </div>
      </div>

      {error && <Callout tone="warn" title="The import stopped">{error}</Callout>}

      {phase === 'running' && progress && (
        <Card title="Importing" subtitle={`${Math.min(progress.fileIndex + 1, progress.fileCount)} of ${progress.fileCount} file${progress.fileCount === 1 ? '' : 's'}`} data-testid="import-progress"
          action={<Button variant="danger" size="sm" onClick={cancel} data-testid="import-cancel"><LuX size={14} /> Cancel</Button>}>
          <ProgressBar value={progress.fraction} label="Import progress" />
          <div className="mt-2 flex items-center gap-2 text-sm text-ink-300">
            <LuLoaderCircle size={14} className="animate-spin text-accent-300" />
            <span className="truncate">{progress.file ? `${progress.file}: ` : ''}{progress.step}</span>
            <span className="ml-auto tabular-nums text-ink-400">{Math.round(progress.fraction * 100)}%</span>
          </div>
        </Card>
      )}

      {phase === 'review' && result && (
        <div className="space-y-5">
          {drafts.length > 0 ? (
            <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
              <Card title={`${drafts.length} song${drafts.length === 1 ? '' : 's'} found`} subtitle="Choose a song to preview it."
                action={drafts.length > 1 && unsaved > 0 ? <Button size="sm" onClick={() => void saveAll()} data-testid="import-save-all"><LuSave size={14} /> Save all</Button> : undefined}>
                <ul className="space-y-2" data-testid="import-songs">
                  {drafts.map((s) => (
                    <li key={s.draft.id}>
                      <button type="button" onClick={() => setActive(s.draft.id)} className={cx('w-full rounded-xl px-4 py-3 text-left transition-colors', active === s.draft.id ? 'bg-accent-500/15 ring-1 ring-accent-500/50' : 'bg-ink-800 hover:bg-ink-700')}>
                        <div className="truncate font-medium text-ink-50">{s.title || 'Untitled'}</div>
                        <div className="truncate text-xs text-ink-400">{s.artist || 'Unknown artist'}</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Badge><LuLayers2 size={10} /> {s.draft.arrangements.map((a) => a.label).join(' / ')}</Badge>
                          {s.audioKey ? <Badge tone="ok"><LuVolume2 size={10} /> audio</Badge> : <Badge>no audio</Badge>}
                          {s.saved ? <Badge tone="ok"><LuCircleCheck size={10} /> saved</Badge> : s.duplicate ? <Badge tone="warn">in library</Badge> : null}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              {current && <SongPreview key={current.draft.id} s={current} audioMap={audioMap}
                onChange={(fn) => update(current.draft.id, fn)} onAudio={(k) => chooseAudio(current, k)} onSave={(m) => void save(current, m).then((ok) => ok && store.toast('Saved to your library', `“${current.title}” is ready in Play mode.`, 'success'))}
                onRedetect={() => { if (current.audioKey && result) { update(current.draft.id, (x) => ({ ...x, sync: { ...x.sync, method: 'none' } })); const c = new AbortController(); analysis.current = c; void analyse(current.draft, current.audioKey, result, c.signal); } }} />}
            </div>
          ) : (
            <Callout tone="warn" title="No playable songs in this selection">
              The files below say why. A song needs at least one chart: a Rocksmith arrangement XML (lead, rhythm or bass), a Guitar Pro 7/8 file, or a Guitar Mastery song file. Audio on its own cannot be played without a chart.
            </Callout>
          )}
          {encrypted && (
            <Callout tone="info" title="About encrypted Rocksmith 2014 archives">
              Rocksmith 2014 packages encrypt their table of contents, so the charts and audio inside cannot be located without the game’s key, and this app does not decrypt game files. If you made the song or have its project files, import the arrangement XMLs together with the OGG or WAV audio: select them all at once (or their folder) and they are grouped into one song.
            </Callout>
          )}
          <FileReports files={result.files} unmatched={result.unmatchedAudio.map((k) => audioMap.get(k)?.name ?? k)} />
        </div>
      )}

      <Callout tone="source" title="Your files stay on this device">
        Files are read by your browser; nothing is uploaded. Imported songs are kept in this browser’s storage, are not synced to your account, and can be removed in Play mode. Only import material you have the right to use.
      </Callout>
    </div>
  );
}

// ── Song preview ─────────────────────────────────────────────────────────

function SongPreview({ s, audioMap, onChange, onAudio, onSave, onRedetect }: {
  s: DraftState; audioMap: Map<string, AudioItem>;
  onChange: (fn: (s: DraftState) => DraftState) => void; onAudio: (key: string | null) => void; onSave: (mode: 'new' | 'replace') => void; onRedetect: () => void;
}) {
  const [arrKey, setArrKey] = useState(s.draft.arrangements[0].key);
  const arr = s.draft.arrangements.find((a) => a.key === arrKey) ?? s.draft.arrangements[0];
  const audio = s.audioKey ? audioMap.get(s.audioKey) ?? null : null;
  const setOffset = (v: number) => onChange((x) => ({ ...x, sync: { ...x.sync, offset: Math.round(Math.max(-10, Math.min(10, v)) * 1000) / 1000, method: 'manual' } }));
  const included = s.draft.arrangements.filter((a) => s.include[a.key]).length;
  const sync = s.sync;

  return (
    <Card title="Preview" subtitle={s.draft.origins.join(', ')} data-testid="import-preview">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title"><input className="input" value={s.title} onChange={(e) => onChange((x) => ({ ...x, title: e.target.value }))} data-testid="import-title" /></Field>
        <Field label="Artist"><input className="input" value={s.artist} onChange={(e) => onChange((x) => ({ ...x, artist: e.target.value }))} data-testid="import-artist" /></Field>
      </div>

      <div className="mt-4">
        <div className="label mb-2">Arrangements</div>
        <ul className="grid gap-2 sm:grid-cols-2" data-testid="import-arrangements">
          {s.draft.arrangements.map((a) => (
            <li key={a.key} className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5', arrKey === a.key ? 'bg-accent-500/15 ring-1 ring-accent-500/50' : 'bg-ink-800')}>
              <input type="checkbox" checked={!!s.include[a.key]} onChange={(e) => onChange((x) => ({ ...x, include: { ...x.include, [a.key]: e.target.checked } }))} aria-label={`Include ${a.label}`} className="h-4 w-4 accent-[var(--color-accent-500)]" />
              <button type="button" onClick={() => setArrKey(a.key)} className="min-w-0 flex-1 text-left" data-testid={`import-arr-${a.role}`}>
                <div className="truncate text-sm font-medium text-ink-50">{a.label}</div>
                <div className="truncate text-[11px] text-ink-400">{a.song.tuning.name}{a.song.capo ? ` · capo ${a.song.capo}` : ''} · {a.song.events.length} events · {a.path.split('/').pop()}</div>
              </button>
            </li>
          ))}
        </ul>
        {arr.warnings.length > 0 && <p className="mt-2 text-xs text-warn-400">{arr.warnings.join(' ')}</p>}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Audio" hint={audio ? `${audio.name} · ${fmtSize(audio.size)}${audio.preview ? ' · preview clip' : ''}` : 'Without audio, Play mode uses a click and guide tones.'}>
          <Select value={s.audioKey ?? ''} onChange={(v) => onAudio(v || null)} aria-label="Audio for this song" data-testid="import-audio"
            options={[{ value: '', label: 'No audio' }, ...s.draft.audioCandidates.map((k) => { const a = audioMap.get(k)!; return { value: k, label: `${a.name}${a.preview ? ' (preview)' : ''}` }; })]} />
        </Field>
        <Field label={`Sync offset: ${signed(sync.offset)}`} hint="Positive if the notes arrive too late compared with the recording.">
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setOffset(sync.offset - 0.1)} aria-label="Earlier by 0.1 s">−0.1</Button>
            <Button size="sm" variant="ghost" onClick={() => setOffset(sync.offset - 0.01)} aria-label="Earlier by 0.01 s">−.01</Button>
            <input type="range" min={-5} max={5} step={0.01} value={sync.offset} onChange={(e) => setOffset(Number(e.target.value))} aria-label="Sync offset" className="min-w-0 flex-1" data-testid="import-offset" disabled={!audio} />
            <Button size="sm" variant="ghost" onClick={() => setOffset(sync.offset + 0.01)} aria-label="Later by 0.01 s">+.01</Button>
            <Button size="sm" variant="ghost" onClick={() => setOffset(sync.offset + 0.1)} aria-label="Later by 0.1 s">+0.1</Button>
          </div>
        </Field>
      </div>

      {audio && (
        <div className="mt-3 rounded-xl bg-ink-800 px-4 py-3 text-sm" data-testid="import-sync">
          <div className="flex items-start gap-2">
            {sync.status === 'analysing' ? <LuLoaderCircle size={16} className="mt-0.5 shrink-0 animate-spin text-accent-300" /> : sync.method === 'chart' || sync.method === 'onsets' ? <LuCircleCheck size={16} className="mt-0.5 shrink-0 text-ok-400" /> : <LuAudioWaveform size={16} className="mt-0.5 shrink-0 text-ink-400" />}
            <div className="min-w-0 flex-1 text-ink-200">
              {sync.status === 'analysing' ? 'Checking the timing against the recording…' : (
                <>
                  <div>{sync.method === 'manual' ? `Set by hand to ${signed(sync.offset)}.` : sync.message ?? 'Not analysed yet.'}</div>
                  {sync.length && <div className={cx('mt-1 text-xs', sync.length.verdict === 'mismatch' ? 'text-warn-400' : 'text-ink-400')}>{sync.length.message}</div>}
                </>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={onRedetect} disabled={sync.status === 'analysing'} data-testid="import-redetect"><LuRefreshCw size={13} /> Detect</Button>
          </div>
        </div>
      )}

      <PreviewPlayer song={arr.song} audio={audio?.blob ?? null} offset={sync.offset} audioDuration={sync.audioDuration} />

      <ul className="mt-3 space-y-1 text-xs text-ink-400">
        {s.draft.notes.map((n, i) => <li key={i} className="flex gap-1.5"><LuInfo size={12} className="mt-0.5 shrink-0" /> {n}</li>)}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
        {s.saved ? (
          <>
            <Badge tone="ok"><LuCircleCheck size={11} /> Saved to your library</Badge>
            <Link to={`/play?song=${encodeURIComponent(s.saved)}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent-500 px-4 text-sm font-medium text-white hover:bg-accent-600" data-testid="import-open-play"><LuGamepad2 size={16} /> Open in Play mode</Link>
          </>
        ) : s.duplicate ? (
          <>
            <span className="text-sm text-warn-400" data-testid="import-duplicate">Already in your library as “{s.duplicate.title}”.</span>
            <Button onClick={() => onSave('replace')} disabled={s.saving || !included} data-testid="import-replace"><LuRefreshCw size={14} /> Replace it</Button>
            <Button variant="ghost" onClick={() => onSave('new')} disabled={s.saving || !included}>Keep both</Button>
          </>
        ) : (
          <Button variant="primary" size="lg" onClick={() => onSave('new')} disabled={s.saving || !included} data-testid="import-save">
            {s.saving ? <LuLoaderCircle size={16} className="animate-spin" /> : <LuSave size={16} />} Save {included > 1 ? `${included} arrangements` : 'song'} to library
          </Button>
        )}
      </div>
    </Card>
  );
}

// ── Synced preview player ────────────────────────────────────────────────

function PreviewPlayer({ song, audio, offset, audioDuration }: { song: PlaySong; audio: Blob | null; offset: number; audioDuration?: number }) {
  const student = useStudent();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const st = useRef({ el: null as HTMLAudioElement | null, base: 0, startedAt: 0, playing: false, waiting: false, offset, cam: fretWindow(song, 0), lastUi: 0, t: 0 });
  st.current.offset = offset;
  const indexOf = useMemo(() => new Map<SongEvent, number>(song.events.map((e, i) => [e, i])), [song]);
  const end = Math.max(song.duration, audioDuration !== undefined ? audioDuration + offset : 0);

  const now = () => {
    const x = st.current;
    if (x.el) return x.el.currentTime + x.offset;
    return x.playing ? x.base + (performance.now() - x.startedAt) / 1000 : x.base;
  };

  useEffect(() => {
    setAudioError(null);
    if (!audio) { st.current.el = null; return; }
    const url = URL.createObjectURL(audio);
    const el = new Audio();
    el.preload = 'auto';
    el.src = url;
    el.onended = () => { st.current.base = st.current.t; st.current.playing = false; setPlaying(false); };
    el.onerror = () => setAudioError('This browser cannot play this audio file. WAV works everywhere; OGG Vorbis needs a recent browser.');
    el.currentTime = Math.max(0, st.current.t - st.current.offset);
    st.current.el = el;
    return () => { el.pause(); el.removeAttribute('src'); el.load(); URL.revokeObjectURL(url); if (st.current.el === el) st.current.el = null; st.current.playing = false; setPlaying(false); };
  }, [audio]);

  // A changed offset moves the audio, not the chart position.
  useEffect(() => { const x = st.current; if (x.el && !x.playing) x.el.currentTime = Math.max(0, x.t - offset); }, [offset]);

  useEffect(() => { st.current.cam = fretWindow(song, st.current.t); }, [song]);

  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (ms: number) => {
      const x = st.current;
      const dt = Math.min(0.1, (ms - last) / 1000);
      last = ms;
      let time: number;
      if (x.el && x.playing && x.waiting) {
        // The chart starts before the recording (positive offset): run on the clock until the audio's first sample is due.
        time = x.base + (performance.now() - x.startedAt) / 1000;
        if (time >= x.offset) { x.waiting = false; x.el.currentTime = Math.max(0, time - x.offset); void x.el.play().catch(() => undefined); }
      } else time = x.playing ? now() : x.base;
      if (x.playing && !x.el && time >= end) { x.playing = false; x.base = end; setPlaying(false); time = end; }
      x.t = time;
      const target = fretWindow(song, time, 2.5, 5);
      x.cam = { lo: x.cam.lo + (target.lo - x.cam.lo) * Math.min(1, dt * 2.5), hi: x.cam.hi + (target.hi - x.cam.hi) * Math.min(1, dt * 2.5) };
      const cv = canvas.current;
      const g = cv?.getContext('2d');
      if (cv && g) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawHighway(g, w, h, {
          song, t: time, lookahead: 2.4, cam: x.cam, lowOnTop: true, leftHanded: student.profile.leftHanded, flashes: new Map(), indexOf,
          status: (i) => (song.events[i].time < time - 0.05 ? 'skip' : 'pending'),
        });
      }
      if (ms - x.lastUi > 100) { x.lastUi = ms; setT(time); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [song, indexOf, end, student.profile.leftHanded]);

  const play = () => {
    const x = st.current;
    const from = x.t >= end - 0.05 ? 0 : x.t;
    x.base = from;
    x.startedAt = performance.now();
    x.playing = true;
    setPlaying(true);
    if (x.el) {
      const at = from - x.offset;
      x.el.currentTime = Math.max(0, at);
      x.waiting = at < 0;
      if (at >= 0) x.el.play().catch((e: Error) => { setAudioError(`Playback failed: ${e.message}`); x.playing = false; setPlaying(false); });
    }
  };
  const pause = () => {
    const x = st.current;
    x.base = x.t;
    x.playing = false;
    x.waiting = false;
    x.el?.pause();
    setPlaying(false);
  };
  const seek = (v: number) => {
    const x = st.current;
    x.t = v; x.base = v; x.startedAt = performance.now();
    x.cam = fretWindow(song, v);
    if (x.el) {
      const at = v - x.offset;
      x.el.currentTime = Math.max(0, at);
      x.waiting = x.playing && at < 0;
      if (x.waiting) x.el.pause();
      else if (x.playing && x.el.paused) void x.el.play().catch(() => undefined);
    }
    setT(v);
  };

  const section = song.sections.find((sec) => t >= sec.start && t < sec.end);
  return (
    <div className="mt-4" data-testid="import-player">
      <div className="relative overflow-hidden rounded-2xl">
        <canvas ref={canvas} className="block h-56 w-full sm:h-72" aria-label={`Note highway preview of ${song.arrangement}`} data-testid="import-canvas" />
        {section && <span className="absolute left-3 top-3 rounded-lg bg-black/40 px-2 py-0.5 text-xs text-white/80">{section.name}</span>}
        {!audio && <span className="absolute right-3 top-3 rounded-lg bg-black/40 px-2 py-0.5 text-xs text-white/70">silent preview</span>}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => seek(0)} aria-label="Back to start"><LuSkipBack size={15} /></Button>
        <Button size="sm" variant="primary" onClick={playing ? pause : play} aria-label={playing ? 'Pause preview' : 'Play preview'} data-testid="import-play">{playing ? <LuPause size={15} /> : <LuPlay size={15} />}</Button>
        <input type="range" min={0} max={Math.max(1, end)} step={0.05} value={Math.min(t, end)} onChange={(e) => seek(Number(e.target.value))} aria-label="Position" className="min-w-0 flex-1" data-testid="import-seek" />
        <span className="w-24 text-right text-xs tabular-nums text-ink-300" data-testid="import-time">{fmtTime(t)} / {fmtTime(end)}</span>
      </div>
      {audioError && <p className="mt-1 text-xs text-warn-400">{audioError}</p>}
    </div>
  );
}

// ── File reports ─────────────────────────────────────────────────────────

const FILE_STATUS: Record<FileReport['status'], { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  imported: { label: 'Imported', tone: 'ok' },
  partial: { label: 'Partly imported', tone: 'warn' },
  unsupported: { label: 'Not supported', tone: 'warn' },
  error: { label: 'Damaged', tone: 'bad' },
  skipped: { label: 'Skipped', tone: 'neutral' },
};

const ENTRY_STATUS: Record<EntryReport['status'], { label: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' | 'cyan' }> = {
  imported: { label: 'Imported', tone: 'ok' },
  metadata: { label: 'Song details', tone: 'cyan' },
  unsupported: { label: 'Unsupported', tone: 'warn' },
  'not-used': { label: 'Not needed', tone: 'neutral' },
  duplicate: { label: 'Duplicate', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'bad' },
  error: { label: 'Damaged', tone: 'bad' },
};

function ComponentIcon({ state }: { state: ComponentReport['state'] }) {
  const m: Record<ComponentReport['state'], ReactNode> = {
    ok: <LuCircleCheck size={15} className="text-ok-400" aria-label="OK" />,
    warning: <LuTriangleAlert size={15} className="text-warn-400" aria-label="Warning" />,
    unsupported: <LuCircleMinus size={15} className="text-warn-400" aria-label="Unsupported" />,
    error: <LuCircleX size={15} className="text-bad-400" aria-label="Error" />,
    unavailable: <LuCircleDashed size={15} className="text-ink-500" aria-label="Not reachable" />,
  };
  return <span className="mt-0.5 shrink-0">{m[state]}</span>;
}

function FileReports({ files, unmatched }: { files: FileReport[]; unmatched: string[] }) {
  return (
    <Card title="Files" subtitle="What was found in each file, and what happened to it." data-testid="import-files-report">
      <ul className="divide-y divide-ink-700">
        {files.map((f) => {
          const st = FILE_STATUS[f.status];
          const hasDetails = !!(f.components?.length || f.entries?.length || f.facts?.length);
          const row = (
            <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
              <span className="mt-0.5 text-ink-400">{f.role === 'psarc' || f.role === 'zip' ? <LuPackage size={16} /> : f.role === 'audio' || f.role === 'wwise-audio' ? <LuVolume2 size={16} /> : <LuFileMusic size={16} />}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-ink-50">{f.path}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="text-xs text-ink-400">{f.kind} · {fmtSize(f.size)}</span>
                </div>
                <p className="mt-0.5 text-sm text-ink-300">{f.detail}</p>
              </div>
            </div>
          );
          return (
            <li key={f.id} className="py-3" data-testid="import-file-report" data-status={f.status}>
              {hasDetails ? (
                <details>
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">{row}<span className="ml-7 text-xs text-accent-300">Details</span></summary>
                  <div className="ml-7 mt-3 space-y-4">
                    {f.components && f.components.length > 0 && (
                      <div>
                        <div className="label mb-1.5">Components</div>
                        <ul className="space-y-1.5" data-testid="import-components">
                          {f.components.map((c) => (
                            <li key={c.id} className="flex gap-2 text-sm" data-component={c.id} data-state={c.state}>
                              <ComponentIcon state={c.state} />
                              <span><span className="font-medium text-ink-100">{c.label}</span> <span className="text-ink-300">— {c.detail}</span></span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {f.facts && f.facts.length > 0 && (
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                        {f.facts.flatMap((x) => [<dt key={`${x.label}-t`} className="text-ink-400">{x.label}</dt>, <dd key={`${x.label}-d`} className="text-ink-200">{x.value}</dd>])}
                      </dl>
                    )}
                    {f.entries && f.entries.length > 0 && (
                      <div>
                        <div className="label mb-1.5">Contents ({f.entries.length})</div>
                        <div className="max-h-80 overflow-auto rounded-xl border border-ink-700">
                          <table className="w-full text-left text-xs" data-testid="import-entries">
                            <thead className="sticky top-0 bg-ink-900 text-ink-400"><tr><th className="px-3 py-2 font-medium">Path</th><th className="px-3 py-2 font-medium">Size</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Notes</th></tr></thead>
                            <tbody className="divide-y divide-ink-800">
                              {f.entries.map((e, i) => (
                                <tr key={i} data-status={e.status}>
                                  <td className="max-w-[18rem] truncate px-3 py-1.5 font-mono text-ink-200" title={e.path}>{e.path}</td>
                                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-ink-400">{fmtSize(e.size)}</td>
                                  <td className="px-3 py-1.5"><Badge tone={ENTRY_STATUS[e.status].tone}>{ENTRY_STATUS[e.status].label}</Badge></td>
                                  <td className="px-3 py-1.5 text-ink-300">{e.detail}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              ) : row}
            </li>
          );
        })}
      </ul>
      {unmatched.length > 0 && <p className="mt-3 text-xs text-ink-400">Audio not matched to a song (available in every song’s audio list): {unmatched.join(', ')}.</p>}
    </Card>
  );
}
