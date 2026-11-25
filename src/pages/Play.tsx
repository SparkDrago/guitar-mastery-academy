/**
 * Play mode: a note highway in the style of rhythm-game guitar trainers.
 * Songs come from built-in exercises, the Tab Editor, or imported open files
 * (Rocksmith arrangement XML, Guitar Pro 7/8, Guitar Mastery JSON) with an
 * optional recording supplied by the player. Scoring uses the microphone.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LuMaximize, LuPlay, LuPause, LuX, LuUpload, LuMusic, LuTrash2, LuRepeat, LuMic, LuMicOff, LuFileMusic, LuRotateCcw, LuTrophy, LuInfo, LuVolume2, LuLayers2,
} from 'react-icons/lu';
import {
  allNotes, fretWindow, midiOfNote, songFromTabScore,
  type PlaySong, type SongEvent,
} from '@gma/notation';
import { PlayScorer, type Exercise, type PlayStats } from '@gma/learning';
import { convertWem } from '@gma/importer';
import { chroma as chromaOf, yin } from '@gma/audio';
import { reverseChordLookup, pcName } from '@gma/theory';
import { useAllExercises, useStudent } from '@/lib/hooks';
import { store } from '@/lib/store';
import { cx, nowIso, uid } from '@/lib/core';
import { MicInput, click, getContext, micErrorMessage, pluck, type MicError } from '@/lib/audio';
import { library, type LibraryArrangement, type LibrarySong } from '@/lib/idb';
import { navigate, useDocumentTitle, useLocation } from '@/lib/router';
import { Badge, Button, Callout, Card, Empty, Field, Modal, PageHeader, Segmented, Select, Stepper, Toggle } from '@/components/ui';
import { HBars } from '@/components/charts';
import { drawHighway, STRING_COLORS } from '@/components/highway';

type Source = { kind: 'imported'; lib: LibrarySong; arr: LibraryArrangement } | { kind: 'exercise'; ex: Exercise };

interface PlayOptions {
  speed: number;
  fromSection: number;
  toSection: number;
  loop: boolean;
  useMic: boolean;
  anyOctave: boolean;
  guide: boolean;
  clickTrack: boolean;
  lowOnTop: boolean;
}

const PREF_KEY = 'gma.play.prefs';
const BEST_KEY = 'gma.play.best';
const readJson = <T,>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? { ...fb, ...JSON.parse(v) } : fb; } catch { return fb; } };
const writeJson = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not persisted */ } };

const chordNamer = (pcs: number[], bass: number) => reverseChordLookup(pcs, { bassPc: bass, max: 1 })[0]?.symbol ?? '';

export function PlayPage() {
  useDocumentTitle('Play');
  const exercises = useAllExercises();
  const { query } = useLocation();
  const [imported, setImported] = useState<LibrarySong[]>([]);
  const [persistent, setPersistent] = useState(true);
  const [selected, setSelected] = useState<Source | null>(null);
  const [playing, setPlaying] = useState<{ song: PlaySong; audio: Blob | null; offset: number; opts: PlayOptions; source: Source; bpm: number } | null>(null);

  const refresh = async () => {
    const list = await library.list();
    setImported(list);
    setPersistent(await library.persistent());
    // Keep the selection pointing at fresh records (offset, audio, best score).
    setSelected((cur) => {
      if (cur?.kind !== 'imported') return cur;
      const lib = list.find((x) => x.id === cur.lib.id);
      const arr = lib?.arrangements.find((a) => a.id === cur.arr.id) ?? lib?.arrangements[0];
      return lib && arr ? { kind: 'imported', lib, arr } : null;
    });
    return list;
  };
  useEffect(() => {
    void refresh().then((list) => {
      const id = query.get('song');
      const lib = id ? list.find((x) => x.id === id) : undefined;
      if (lib) setSelected({ kind: 'imported', lib, arr: lib.arrangements.find((a) => a.id === query.get('arrangement')) ?? lib.arrangements[0] });
    });
  }, [query.get('song')]);
  useEffect(() => {
    const id = query.get('exercise');
    if (id) { const ex = exercises.find((e) => e.id === id); if (ex) setSelected({ kind: 'exercise', ex }); }
  }, [query.get('exercise'), exercises.length]);

  if (playing) return <Stage {...playing} onExit={() => { setPlaying(null); void refresh(); }} />;

  const goImport = () => navigate('/import');
  return (
    <div>
      <PageHeader eyebrow="Play" title="Play mode" subtitle="Play along with a scrolling note highway. The microphone listens and scores every note and chord. Import your own arrangements and recordings, or play any exercise."
        actions={<Button variant="primary" onClick={goImport} data-testid="play-import"><LuUpload size={16} /> Import songs</Button>} />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0 space-y-5">
          <Card title="My songs" subtitle={persistent ? 'Stored on this device only (not synced to your account).' : 'This browser blocks local storage: imported songs last only for this visit.'}>
            {imported.length === 0 ? (
              <Empty title="No imported songs yet" body="Import PSARC archives, Rocksmith arrangement XMLs with their OGG/WAV audio, Guitar Pro 7/8 files or Guitar Mastery song files." icon={<LuFileMusic size={22} />} action={<Button onClick={goImport}><LuUpload size={14} /> Import songs</Button>} />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2" data-testid="play-imported">
                {imported.map((lib) => (
                  <li key={lib.id}>
                    <button type="button" onClick={() => setSelected({ kind: 'imported', lib, arr: lib.arrangements[0] })} className={cx('w-full rounded-xl px-4 py-3 text-left transition-colors', selected?.kind === 'imported' && selected.lib.id === lib.id ? 'bg-accent-500/15 ring-1 ring-accent-500/50' : 'bg-ink-800 hover:bg-ink-700')}>
                      <div className="truncate font-medium text-ink-50">{lib.title}</div>
                      <div className="truncate text-xs text-ink-400">{lib.artist || 'Unknown artist'} · {lib.arrangements.map((a) => a.label).join(' / ')} · {lib.arrangements[0].song.tuning.name}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {lib.arrangements.length > 1 ? <Badge><LuLayers2 size={10} /> {lib.arrangements.length} arrangements</Badge> : <Badge>{allNotes(lib.arrangements[0].song).length} notes</Badge>}
                        {lib.audio ? <Badge tone="ok"><LuVolume2 size={10} /> audio</Badge> : <Badge>no audio</Badge>}
                        {bestOf(lib) && <Badge tone="warn"><LuTrophy size={10} /> {Math.round(bestOf(lib)! * 100)}%</Badge>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Exercises" subtitle="Built-in exercises and your own from the Tab Editor.">
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3" data-testid="play-exercises">
              {exercises.map((ex) => (
                <li key={ex.id}>
                  <button type="button" onClick={() => setSelected({ kind: 'exercise', ex })} className={cx('w-full rounded-lg px-3 py-2 text-left text-sm transition-colors', selected?.kind === 'exercise' && selected.ex.id === ex.id ? 'bg-accent-500/15 text-ink-50' : 'text-ink-200 hover:bg-ink-800')}>
                    <div className="truncate">{ex.name}</div>
                    <div className="text-[11px] text-ink-400">{ex.custom ? 'My exercise' : `Level ${ex.level}`} · {ex.bpmStart}–{ex.bpmTarget} bpm</div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <SetupPanel source={selected} onSelect={(arr) => setSelected((cur) => (cur?.kind === 'imported' ? { ...cur, arr } : cur))} onStart={(p) => setPlaying(p)} onChanged={refresh} />
      </div>
    </div>
  );
}

const bestOf = (lib: LibrarySong) => { const b = lib.arrangements.map((a) => a.best?.accuracy ?? 0); const m = Math.max(0, ...b); return m > 0 ? m : null; };

// ── Setup ────────────────────────────────────────────────────────────────

function SetupPanel({ source, onSelect, onStart, onChanged }: { source: Source | null; onSelect: (a: LibraryArrangement) => void; onStart: (p: { song: PlaySong; audio: Blob | null; offset: number; opts: PlayOptions; source: Source; bpm: number }) => void; onChanged: () => Promise<unknown> }) {
  const [opts, setOpts] = useState<PlayOptions>(() => readJson(PREF_KEY, { speed: 1, fromSection: 0, toSection: 0, loop: false, useMic: true, anyOctave: false, guide: true, clickTrack: true, lowOnTop: true }));
  const [bpm, setBpm] = useState(80);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [offset, setOffset] = useState(0);
  const set = (p: Partial<PlayOptions>) => setOpts((o) => { const n = { ...o, ...p }; writeJson(PREF_KEY, { ...n, fromSection: 0, toSection: 0 }); return n; });

  useEffect(() => {
    if (!source) return;
    if (source.kind === 'exercise') setBpm(source.ex.bpmStart);
    setOffset(source.kind === 'imported' ? source.lib.sync.offset : 0);
    setAudio(null);
    if (source.kind === 'imported' && source.lib.audio) void library.getAudio(source.lib.audio.key).then(setAudio);
  }, [source?.kind === 'imported' ? `${source.lib.id}|${source.lib.audio?.key}` : source]);

  const song = useMemo(() => {
    if (!source) return null;
    if (source.kind === 'imported') return source.arr.song;
    return songFromTabScore(source.ex.score, { id: source.ex.id, bpm, repeats: 2, arrangement: 'Exercise', source: 'exercise', chordName: chordNamer });
  }, [source, bpm]);
  useEffect(() => { if (song) setOpts((o) => ({ ...o, fromSection: 0, toSection: Math.max(0, song.sections.length - 1) })); }, [song?.id, song?.sections.length]);

  if (!source || !song) return <Card title="Get ready"><p className="text-sm text-ink-300">Pick a song or exercise to see its details and start playing.</p></Card>;

  const notes = allNotes(song);
  const frets = notes.map((n) => n.fret);
  const best = source.kind === 'imported' ? source.arr.best : readJson<Record<string, { accuracy: number }>>(BEST_KEY, {})[song.id];

  const attachAudio = async (picked: File) => {
    if (source.kind !== 'imported') return;
    const lib = source.lib;
    let f: File = picked;
    if (/\.wem$/i.test(picked.name)) {
      try {
        const r = convertWem(new Uint8Array(await picked.arrayBuffer()));
        f = new File([r.bytes as BlobPart], picked.name.replace(/\.wem$/i, '.wav'), { type: r.mime });
      } catch (e) {
        store.toast('This .wem file cannot be used', (e as Error).message, 'warning');
        return;
      }
    }
    const key = lib.audio?.key ?? `audio-${lib.id}`;
    await library.putAudio(key, f);
    await library.put({ ...lib, audio: { key, name: f.name, size: f.size, type: f.type }, sync: { ...lib.sync, method: 'manual' } });
    setAudio(f);
    await onChanged();
    store.toast('Recording attached', `${f.name} will play with “${lib.title}”. Adjust the sync offset if the notes run early or late.`, 'success');
  };
  const saveOffset = async (v: number) => {
    setOffset(v);
    if (source.kind === 'imported') await library.put({ ...source.lib, sync: { ...source.lib.sync, offset: v, method: 'manual' } });
  };
  const remove = async () => {
    if (source.kind !== 'imported') return;
    const n = source.lib.arrangements.length;
    if (!window.confirm(`Remove “${source.lib.title}”${n > 1 ? ` (${n} arrangements)` : ''} and its recording from this device?`)) return;
    await library.remove(source.lib.id);
    await onChanged();
  };

  return (
    <Card title={song.title} subtitle={`${song.artist ? song.artist + ' · ' : ''}${song.arrangement} · ${song.tuning.name}${song.capo ? ` · capo ${song.capo}` : ''}`} data-testid="play-setup">
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge>{notes.length} notes</Badge>
        <Badge>{Math.floor(song.duration / 60)}:{String(Math.round(song.duration % 60)).padStart(2, '0')}</Badge>
        <Badge>{song.averageTempo} bpm</Badge>
        {frets.length > 0 && <Badge>frets {Math.min(...frets)}–{Math.max(...frets)}</Badge>}
        {best && <Badge tone="warn"><LuTrophy size={10} /> best {Math.round(best.accuracy * 100)}%</Badge>}
      </div>
      <div className="space-y-4">
        {source.kind === 'imported' && source.lib.arrangements.length > 1 && (
          <Field label="Arrangement">
            <Segmented size="sm" value={source.arr.id} onChange={(id) => { const a = source.lib.arrangements.find((x) => x.id === id); if (a) onSelect(a); }} aria-label="Arrangement" options={source.lib.arrangements.map((a) => ({ value: a.id, label: a.label }))} data-testid="play-arrangement" />
          </Field>
        )}
        {source.kind === 'exercise' && <Field label="Tempo"><Stepper value={bpm} onChange={setBpm} min={30} max={260} step={2} suffix="bpm" label="Exercise tempo" /></Field>}
        {source.kind === 'imported' && (
          <Field label="Recording" hint="Your own audio of this song (MP3, OGG, WAV, M4A, or PCM/ADPCM .wem). Stays on this device.">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-ink-700 bg-ink-800 px-3 py-2 text-sm text-ink-100 hover:bg-ink-700">
                <LuMusic size={14} /> {source.lib.audio ? 'Replace audio' : 'Add audio'}
                <input type="file" accept="audio/*,.ogg,.mp3,.wav,.m4a,.flac,.wem" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void attachAudio(f); }} data-testid="play-audio" />
              </label>
              <span className="truncate text-xs text-ink-400">{source.lib.audio?.name ?? 'Without audio, a click and guide tones play instead.'}</span>
            </div>
          </Field>
        )}
        {audio && (
          <Field label={`Sync offset: ${offset >= 0 ? '+' : ''}${offset.toFixed(2)} s`} hint="Positive if notes arrive too late compared with the recording.">
            <input type="range" min={-3} max={3} step={0.01} value={offset} onChange={(e) => void saveOffset(Number(e.target.value))} aria-label="Sync offset" />
          </Field>
        )}
        <Field label={`Speed: ${Math.round(opts.speed * 100)}%`}>
          <Segmented size="sm" value={String(opts.speed)} onChange={(v) => set({ speed: Number(v) })} aria-label="Speed" options={[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => ({ value: String(v), label: `${Math.round(v * 100)}%` }))} />
        </Field>
        {song.sections.length > 1 && (
          <Field label="Sections (riff repeater)">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(opts.fromSection)} onChange={(v) => set({ fromSection: Number(v), toSection: Math.max(Number(v), opts.toSection) })} options={song.sections.map((s, i) => ({ value: String(i), label: `${i + 1}. ${s.name}` }))} aria-label="From section" />
              <span className="text-xs text-ink-400">to</span>
              <Select value={String(opts.toSection)} onChange={(v) => set({ toSection: Math.max(opts.fromSection, Number(v)) })} options={song.sections.map((s, i) => ({ value: String(i), label: `${i + 1}. ${s.name}` }))} aria-label="To section" />
              <Toggle checked={opts.loop} onChange={(v) => set({ loop: v })} label="Loop" />
            </div>
          </Field>
        )}
        <div className="grid gap-2.5">
          <Toggle checked={opts.useMic} onChange={(v) => set({ useMic: v })} label="Score with the microphone" />
          {opts.useMic && <Toggle checked={opts.anyOctave} onChange={(v) => set({ anyOctave: v })} label="Accept notes in any octave (easier)" />}
          {!audio && <Toggle checked={opts.guide} onChange={(v) => set({ guide: v })} label="Guide tones (hear the part)" />}
          {!audio && <Toggle checked={opts.clickTrack} onChange={(v) => set({ clickTrack: v })} label="Click on every beat" />}
          <Toggle checked={opts.lowOnTop} onChange={(v) => set({ lowOnTop: v })} label="Low string on top (off = tab order)" />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" size="lg" onClick={() => onStart({ song, audio, offset, opts, source, bpm })} data-testid="play-start"><LuPlay size={18} /> Play</Button>
          {source.kind === 'imported' && <Button variant="ghost" onClick={() => void remove()} aria-label="Remove song"><LuTrash2 size={16} /></Button>}
        </div>
        <p className="text-xs text-ink-400">Tip: plug in or play close to the microphone, and use headphones when a recording is playing so the app hears your guitar, not the speakers.</p>
      </div>
    </Card>
  );
}

// ── Stage (the player) ───────────────────────────────────────────────────

const LOOKAHEAD = 2.4;

function Stage({ song, audio, offset, opts, source, bpm, onExit }: { song: PlaySong; audio: Blob | null; offset: number; opts: PlayOptions; source: Source; bpm: number; onExit: () => void }) {
  const s = useStudent();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [hud, setHud] = useState<{ t: number; stats: PlayStats; section: string; next: string }>(() => ({ t: 0, stats: new PlayScorer(song).summary, section: '', next: '' }));
  const [micState, setMicState] = useState<'off' | 'starting' | 'on' | MicError>(opts.useMic ? 'starting' : 'off');
  const [summary, setSummary] = useState<PlayStats | null>(null);
  const [passes, setPasses] = useState<number[]>([]);
  const range = useMemo(() => {
    const a = song.sections[opts.fromSection], b = song.sections[opts.toSection];
    const from = song.sections.length > 1 && a ? a.start : 0;
    const to = song.sections.length > 1 && b ? b.end : song.duration;
    return { from, to, partial: song.sections.length > 1 && (opts.fromSection > 0 || opts.toSection < song.sections.length - 1) };
  }, [song, opts.fromSection, opts.toSection]);
  const lat = useMemo(() => { try { return Number(localStorage.getItem('gma.latencyMs') ?? 0) / 1000; } catch { return 0; } }, []);

  const r = useRef({
    scorer: new PlayScorer(song, { anyOctave: opts.anyOctave, from: range.from, to: range.to }),
    mic: null as MicInput | null,
    audioEl: null as HTMLAudioElement | null,
    url: '' as string,
    t0: 0, base: 0, songT: 0, running: false, raf: 0, frame: 0,
    cam: fretWindow(song, range.from), flashes: new Map<number, number>(),
    scheduledTo: 0, lastHud: 0, judgedErrors: [] as number[], ended: false,
    indexOf: new Map<SongEvent, number>(song.events.map((e, i) => [e, i])),
  });

  const now = () => {
    const st = r.current;
    if (st.audioEl) return st.audioEl.currentTime + offset;
    return st.base + (getContext().currentTime - st.t0) * opts.speed;
  };

  // Mic
  useEffect(() => {
    if (!opts.useMic) return;
    const m = new MicInput();
    void m.start(8192).then((res) => {
      if (res.ok) { r.current.mic = m; setMicState('on'); } else setMicState(res.error);
    });
    return () => { m.stop(); r.current.mic = null; };
  }, []);

  // Audio element
  useEffect(() => {
    if (!audio) return;
    const url = URL.createObjectURL(audio);
    const el = new Audio(url);
    el.preload = 'auto';
    el.playbackRate = opts.speed;
    (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    r.current.audioEl = el;
    r.current.url = url;
    return () => { el.pause(); URL.revokeObjectURL(url); r.current.audioEl = null; };
  }, [audio]);

  const begin = (at: number) => {
    const st = r.current;
    const c = getContext();
    const lead = Math.max(0, Math.min(2, at)) ; // up to 2 s of pre-roll before the section
    const startAt = Math.max(0, at - lead);
    if (st.audioEl) { st.audioEl.currentTime = Math.max(0, startAt - offset); void st.audioEl.play(); }
    st.base = startAt;
    st.t0 = c.currentTime + 0.05;
    st.scheduledTo = startAt;
    st.running = true;
    setPaused(false);
  };

  // Countdown, then start
  useEffect(() => {
    if (countdown <= 0) { begin(range.from); return; }
    const c = getContext();
    click(c.currentTime + 0.02, countdown === 3 ? 3 : 2, 'wood');
    const id = setTimeout(() => setCountdown((x) => x - 1), 700);
    return () => clearTimeout(id);
  }, [countdown]);

  const pause = () => {
    const st = r.current;
    if (!st.running) return;
    st.songT = now();
    st.running = false;
    st.audioEl?.pause();
    setPaused(true);
  };
  const resume = () => {
    const st = r.current;
    if (st.running || summary) return;
    if (st.audioEl) void st.audioEl.play();
    st.base = st.songT;
    st.t0 = getContext().currentTime;
    st.scheduledTo = st.songT;
    st.running = true;
    setPaused(false);
  };
  const restart = () => {
    const st = r.current;
    st.scorer = new PlayScorer(song, { anyOctave: opts.anyOctave, from: range.from, to: range.to });
    st.flashes.clear();
    st.judgedErrors = [];
    st.ended = false;
    st.audioEl?.pause();
    st.running = false;
    setSummary(null);
    setPasses([]);
    setCountdown(3);
  };

  const finish = () => {
    const st = r.current;
    if (st.ended) return;
    st.ended = true;
    st.running = false;
    st.audioEl?.pause();
    st.scorer.finish(range.to);
    const sum = st.scorer.summary;
    setSummary(sum);
    if (!opts.useMic || !r.current.mic) return; // nothing was measured
    if (sum.total === 0) return;
    // Save best score and, for exercises, a practice record.
    if (source.kind === 'imported') {
      if (!range.partial && (!source.arr.best || sum.accuracy > source.arr.best.accuracy)) {
        const best = { accuracy: sum.accuracy, score: sum.score, at: nowIso() };
        void library.get(source.lib.id).then((lib) => lib && library.put({ ...lib, arrangements: lib.arrangements.map((a) => (a.id === source.arr.id ? { ...a, best } : a)) }));
      }
    } else if (!range.partial) {
      const bests = readJson<Record<string, { accuracy: number; score: number }>>(BEST_KEY, {});
      if (!bests[song.id] || sum.accuracy > bests[song.id].accuracy) { bests[song.id] = { accuracy: sum.accuracy, score: sum.score }; writeJson(BEST_KEY, bests); }
      const errs = st.judgedErrors;
      const effBpm = Math.max(20, Math.round(bpm * opts.speed));
      store.append('exerciseRecords', {
        id: uid('rec'), exerciseId: source.ex.id, at: nowIso(), bpm: effBpm, clean: sum.accuracy >= 0.9, source: 'play',
        play: { accuracy: sum.accuracy, hits: sum.hits, total: sum.total, speed: opts.speed, meanAbsErrorMs: errs.length ? Math.round(errs.reduce((a, x) => a + Math.abs(x), 0) / errs.length) : undefined },
        updatedAt: nowIso(),
      });
    }
  };

  // Main loop
  useEffect(() => {
    const st = r.current;
    const g = canvas.current?.getContext('2d');
    let last = performance.now();
    const minHz = Math.max(30, 440 * Math.pow(2, (Math.min(...song.tuning.strings) - 69) / 12) * 0.85);
    const loop = () => {
      st.raf = requestAnimationFrame(loop);
      const nowMs = performance.now();
      const dt = Math.min(0.1, (nowMs - last) / 1000);
      last = nowMs;
      const t = st.running ? now() : st.songT || range.from - 0.001;
      if (st.running) st.songT = t;

      // Guide tones and click (synth clock only)
      if (st.running && !st.audioEl) {
        const c = getContext();
        const horizon = t + 0.3 * opts.speed;
        if (opts.guide) for (const e of song.events) {
          if (e.time < st.scheduledTo || e.time >= horizon) continue;
          const when = st.t0 + (e.time - st.base) / opts.speed;
          const ns = e.kind === 'note' ? [e] : e.notes;
          ns.forEach((n, k) => { if (!n.techniques.includes('dead') && !n.tied) pluck(midiOfNote(song, n), Math.max(c.currentTime, when + k * 0.012), Math.max(0.25, n.sustain / opts.speed), 0.35); });
        }
        if (opts.clickTrack) for (const b of song.beats) {
          if (b.time < st.scheduledTo || b.time >= horizon) continue;
          click(Math.max(c.currentTime, st.t0 + (b.time - st.base) / opts.speed), b.downbeat ? 3 : 2, 'wood');
        }
        st.scheduledTo = horizon;
      }

      // Microphone analysis (every other frame)
      if (st.running && st.mic && ++st.frame % 2 === 0) {
        const buf = st.mic.read();
        if (buf) {
          const sr = st.mic.sampleRate;
          const tail = buf.subarray(buf.length - 2048);
          let sum = 0;
          for (let i = 0; i < tail.length; i++) sum += tail[i] * tail[i];
          const level = Math.sqrt(sum / tail.length);
          const est = level > 0.004 ? yin(tail, sr, { minFreq: minHz, maxFreq: 1400 }) : null;
          const midi = est && est.probability > 0.75 ? 69 + 12 * Math.log2(est.freq / s.profile.a4) : null;
          const nearChord = song.events.some((e) => e.kind === 'chord' && Math.abs(e.time - t) < 0.35);
          const ch = nearChord && level > 0.004 ? chromaOf(buf, sr, { a4: s.profile.a4 }) : null;
          const frameT = t - (st.audioEl ? lat : lat * 0.5) - 0.02;
          for (const j of st.scorer.update({ time: frameT, midi, chroma: ch, level })) {
            if (j.result === 'hit') { st.flashes.set(j.index, t); if (j.errorMs !== undefined) st.judgedErrors.push(j.errorMs); }
          }
        }
      }

      // Loop / end
      if (st.running && t >= range.to + 0.3) {
        if (opts.loop) {
          st.scorer.finish(range.to);
          setPasses((p) => [...p, st.scorer.summary.accuracy]);
          st.scorer = new PlayScorer(song, { anyOctave: opts.anyOctave, from: range.from, to: range.to });
          st.flashes.clear();
          st.audioEl?.pause();
          begin(range.from);
        } else finish();
      }
      if (st.running && st.audioEl?.ended) finish();

      // Camera
      const target = fretWindow(song, t, 2.5, 5);
      st.cam = { lo: st.cam.lo + (target.lo - st.cam.lo) * Math.min(1, dt * 2.5), hi: st.cam.hi + (target.hi - st.cam.hi) * Math.min(1, dt * 2.5) };

      // Draw
      const cv = canvas.current;
      if (g && cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawHighway(g, w, h, {
          song, t, lookahead: LOOKAHEAD * opts.speed, cam: st.cam, status: (i) => st.scorer.statusOf(i), lowOnTop: opts.lowOnTop,
          leftHanded: s.profile.leftHanded, flashes: st.flashes, indexOf: st.indexOf, loop: range.partial ? { from: range.from, to: range.to } : null,
        });
      }

      // HUD (10 Hz)
      if (nowMs - st.lastHud > 100) {
        st.lastHud = nowMs;
        const sec = song.sections.find((x) => t >= x.start && t < x.end)?.name ?? '';
        const nextChord = song.events.find((e) => e.kind === 'chord' && e.time > t && e.name) as Extract<SongEvent, { kind: 'chord' }> | undefined;
        setHud({ t, stats: st.scorer.summary, section: sec, next: nextChord && nextChord.time - t < 4 ? nextChord.name : '' });
      }
    };
    st.raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(st.raf);
  }, []);

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); if (r.current.running) pause(); else resume(); }
      if (e.key === 'Escape') { pause(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  useEffect(() => () => { r.current.audioEl?.pause(); }, []);

  const st = hud.stats;
  const progress = Math.max(0, Math.min(1, (hud.t - range.from) / Math.max(1, range.to - range.from)));
  return (
    <div className="-mx-4 -mt-7 sm:-mx-8" data-testid="play-stage">
      <div ref={wrap} data-stage className="relative overflow-hidden bg-[#120f26]" style={{ height: "min(74vh, 700px)" }}>
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={`Note highway for ${song.title}`} role="img" data-testid="play-canvas" />
        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 text-white sm:p-6">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{song.title}</div>
            <div className="truncate text-xs text-white/60">{song.artist ? `${song.artist} · ` : ''}{hud.section}{passes.length ? ` · pass ${passes.length + 1}` : ''}</div>
            <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#8466f5]" style={{ width: `${progress * 100}%` }} /></div>
          </div>
          <div className="flex items-start gap-5 text-right" data-testid="play-hud">
            {hud.next && <div><div className="text-[10px] uppercase tracking-wider text-white/50">Next chord</div><div className="text-2xl font-semibold">{hud.next}</div></div>}
            {micState === 'on' && <>
              <div><div className="text-[10px] uppercase tracking-wider text-white/50">Streak</div><div className="text-2xl font-semibold tabular-nums">{st.streak}<span className="ml-1 text-sm text-[#f2c230]">×{st.multiplier}</span></div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-white/50">Accuracy</div><div className="text-2xl font-semibold tabular-nums">{st.judged ? Math.round(st.accuracy * 100) : 0}%</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-white/50">Score</div><div className="text-2xl font-semibold tabular-nums">{st.score.toLocaleString()}</div></div>
            </>}
          </div>
        </div>
        {countdown > 0 && <div className="absolute inset-0 grid place-items-center bg-black/30 text-7xl font-bold text-white" aria-live="assertive">{countdown}</div>}
        {paused && !summary && countdown <= 0 && (
          <div className="absolute inset-0 grid place-items-center bg-black/50">
            <div className="text-center text-white"><div className="text-3xl font-semibold">Paused</div><p className="mt-1 text-sm text-white/70">Space to resume</p><div className="mt-4 flex justify-center gap-2"><Button variant="primary" onClick={resume}><LuPlay size={16} /> Resume</Button><Button onClick={onExit}>Exit</Button></div></div>
          </div>
        )}
        {typeof micState === 'string' && !['on', 'off', 'starting'].includes(micState) && (
          <div className="absolute left-1/2 top-20 w-[min(90%,480px)] -translate-x-1/2"><Callout tone="warn" title="Playing without scoring">{micErrorMessage(micState as MicError)}</Callout></div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 bg-[#0e0b1f] px-4 py-3 sm:px-6">
        <button type="button" onClick={() => (paused ? resume() : pause())} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20" aria-label={paused ? 'Resume' : 'Pause'} data-testid="play-pause">{paused ? <LuPlay size={18} /> : <LuPause size={18} />}</button>
        <button type="button" onClick={restart} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20" aria-label="Restart"><LuRotateCcw size={18} /></button>
        <button type="button" onClick={() => { const el = wrap.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.(); }} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20" aria-label="Full screen"><LuMaximize size={18} /></button>
        <button type="button" onClick={() => { r.current.audioEl?.pause(); onExit(); }} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20" aria-label="Exit" data-testid="play-exit"><LuX size={18} /></button>
        <span className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/80" data-testid="play-mic-state">
          {micState === 'on' ? <><LuMic size={12} className="text-[#29b878]" /> scoring</> : micState === 'off' ? <><LuMicOff size={12} /> practice (no scoring)</> : micState === 'starting' ? 'starting mic…' : <><LuMicOff size={12} className="text-[#ff6f8e]" /> mic unavailable</>}
        </span>
        {opts.speed < 1 && <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/80">{Math.round(opts.speed * 100)}% speed</span>}
        {opts.loop && <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/80"><LuRepeat size={12} /> loop</span>}
        <div className="flex-1" />
        <div className="hidden gap-1 sm:flex" aria-label="String colours">
          {song.tuning.strings.map((m, i) => <span key={i} className="rounded px-1.5 py-0.5 font-mono text-[10px] text-white" style={{ background: STRING_COLORS[i % STRING_COLORS.length] }}>{pcName(m % 12)}</span>)}
        </div>
      </div>
      <Modal open={!!summary} onClose={onExit} title={opts.useMic && micState === 'on' ? 'Results' : 'Finished'} wide>
        {summary && <Summary sum={summary} scored={opts.useMic && micState === 'on'} passes={passes} onRetry={restart} onExit={onExit} />}
      </Modal>
    </div>
  );
}

function Summary({ sum, scored, passes, onRetry, onExit }: { sum: PlayStats; scored: boolean; passes: number[]; onRetry: () => void; onExit: () => void }) {
  return (
    <div data-testid="play-summary">
      {scored ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Accuracy', `${Math.round(sum.accuracy * 100)}%`], ['Notes hit', `${sum.hits} / ${sum.total}`], ['Best streak', String(sum.bestStreak)], ['Score', sum.score.toLocaleString()]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-800 px-4 py-3"><div className="text-xs text-ink-400">{k}</div><div className="text-2xl font-semibold tabular-nums text-ink-50">{v}</div></div>
            ))}
          </div>
          {sum.sections.filter((x) => x.total > 0).length > 1 && (
            <div className="mt-5"><div className="label mb-2">By section</div><HBars unit="%" data={sum.sections.filter((x) => x.total > 0).map((x) => ({ label: x.name, value: Math.round((x.hits / x.total) * 100), detail: `${x.hits}/${x.total}` }))} /></div>
          )}
          {passes.length > 0 && <p className="mt-4 text-sm text-ink-300">Loop passes: {passes.map((p) => `${Math.round(p * 100)}%`).join(' → ')}</p>}
          <p className="mt-4 text-xs text-ink-400">A note counts as hit when its pitch is detected within about 150 ms before to 200 ms after it is due; chords when at least all but one of their notes sound together. Results depend on your microphone and room.</p>
        </>
      ) : <p className="text-sm text-ink-300">You played through without scoring. Turn on “Score with the microphone” to measure your accuracy.</p>}
      <div className="mt-5 flex gap-2"><Button variant="primary" onClick={onRetry}><LuRotateCcw size={16} /> Play again</Button><Button onClick={onExit}>Back to songs</Button></div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-400"><LuInfo size={12} /> Space pauses during play; the riff repeater loops the chosen sections.</div>
    </div>
  );
}
