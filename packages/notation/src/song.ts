/**
 * Timed song model for Play mode (note highway). Unlike TabScore, which is
 * measured in beats, a PlaySong is measured in seconds so it can be synced to
 * a recording. Built-in exercises, Tab Editor scores and imported files
 * (Rocksmith arrangement XML, Guitar Pro 7/8) all convert to this shape.
 */
import { toPlayback, type TabScore, type Technique } from './model';

export interface SongNote {
  time: number;
  string: number;
  fret: number;
  /** Seconds the note rings (0 = short). */
  sustain: number;
  techniques: Technique[];
  /** Bend in semitones. */
  bend?: number;
  slideTo?: number;
}

export type SongEvent =
  | ({ kind: 'note' } & SongNote)
  | { kind: 'chord'; time: number; name: string; notes: SongNote[]; sustain: number; techniques: Technique[] };

/** A held chord shape (Rocksmith hand shape). Arpeggios are shown as a frame while their notes play one by one. */
export interface SongShape {
  start: number;
  end: number;
  name: string;
  /** Fret per string, null = not part of the shape. */
  frets: (number | null)[];
  arpeggio: boolean;
}

export interface SongSection {
  name: string;
  start: number;
  end: number;
}

export interface PlaySong {
  format: 'gma-song';
  version: 1;
  id: string;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  arrangement: string;
  tuning: { name: string; strings: number[] };
  capo: number;
  /** Length in seconds. */
  duration: number;
  averageTempo: number;
  beats: { time: number; downbeat: boolean }[];
  sections: SongSection[];
  events: SongEvent[];
  /** Optional chord shapes held over time (arpeggios). */
  shapes?: SongShape[];
  source: 'exercise' | 'tab' | 'rocksmith-xml' | 'guitar-pro';
}

export const midiOfNote = (song: Pick<PlaySong, 'tuning' | 'capo'>, n: Pick<SongNote, 'string' | 'fret'>): number =>
  song.tuning.strings[n.string] + (n.fret === 0 ? song.capo : n.fret);

/** Single notes and chord notes flattened (handy for statistics and the camera). */
export function allNotes(song: PlaySong): SongNote[] {
  return song.events.flatMap((e) => (e.kind === 'note' ? [e] : e.notes));
}

/** Convert a beat-based TabScore (exercise or Tab Editor) to seconds at the given tempo. */
export function songFromTabScore(score: TabScore, opts: { bpm?: number; id: string; artist?: string; arrangement?: string; source?: PlaySong['source']; repeats?: number; chordName?: (pcs: number[], bass: number) => string } = { id: 'tab' }): PlaySong {
  const bpm = opts.bpm ?? score.tempo;
  const spb = 60 / bpm;
  const lead = 2 * (score.timeSignature[0] * 4 / score.timeSignature[1]) * spb; // two bars of count-in
  const once = toPlayback(score);
  const lenBeats = Math.max(score.measures.reduce((a, m) => a + m.beats.reduce((x, b) => x + (4 / b.duration) * (b.dotted ? 1.5 : 1) * (b.triplet ? 2 / 3 : 1), 0), 0), once.reduce((a, n) => Math.max(a, n.time + n.duration), 0));
  const repeats = Math.max(1, opts.repeats ?? 1);
  const byTime = new Map<number, SongNote[]>();
  for (let r = 0; r < repeats; r++) {
    for (const p of once) {
      const t = +(lead + (p.time + r * lenBeats) * spb).toFixed(4);
      const note: SongNote = { time: t, string: p.string, fret: p.fret, sustain: p.duration * spb >= 0.5 ? p.duration * spb * 0.9 : 0, techniques: p.techniques, bend: p.bend ? p.bend * 2 : undefined };
      const list = byTime.get(t) ?? [];
      list.push(note);
      byTime.set(t, list);
    }
  }
  const events: SongEvent[] = [...byTime.entries()].sort((a, b) => a[0] - b[0]).map(([time, notes]) => {
    if (notes.length === 1) return { kind: 'note' as const, ...notes[0] };
    const midis = notes.map((n) => score.tuning.strings[n.string] + n.fret);
    const bass = Math.min(...midis);
    return { kind: 'chord' as const, time, notes: notes.sort((a, b) => a.string - b.string), sustain: Math.max(...notes.map((n) => n.sustain)), techniques: [], name: opts.chordName?.(midis.map((m) => m % 12), bass % 12) ?? '' };
  });
  const bpb = score.timeSignature[0] * 4 / score.timeSignature[1];
  const totalBeats = lead / spb + lenBeats * repeats;
  const beats = Array.from({ length: Math.ceil(totalBeats) + 1 }, (_, i) => ({ time: +(i * spb).toFixed(4), downbeat: i % Math.round(bpb) === 0 }));
  const sections: SongSection[] = [{ name: 'Count-in', start: 0, end: lead }];
  for (let r = 0; r < repeats; r++) sections.push({ name: repeats > 1 ? `Take ${r + 1}` : 'Exercise', start: lead + r * lenBeats * spb, end: lead + (r + 1) * lenBeats * spb });
  return {
    format: 'gma-song', version: 1, id: opts.id, title: score.title, artist: opts.artist ?? '', arrangement: opts.arrangement ?? 'Exercise',
    tuning: { ...score.tuning, strings: [...score.tuning.strings] }, capo: 0, duration: totalBeats * spb + 1, averageTempo: bpm,
    beats, sections, events, source: opts.source ?? 'tab',
  };
}

/** Events whose time falls in [from, to). Events are time-sorted, so this uses binary search. */
export function eventsBetween(song: PlaySong, from: number, to: number): SongEvent[] {
  const ev = song.events;
  let lo = 0, hi = ev.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ev[mid].time < from) lo = mid + 1; else hi = mid; }
  const out: SongEvent[] = [];
  for (let k = lo; k < ev.length && ev[k].time < to; k++) out.push(ev[k]);
  return out;
}

/** Fret window the highway should show around time t (smooth camera input). */
export function fretWindow(song: PlaySong, t: number, ahead = 3, minSpan = 5): { lo: number; hi: number } {
  const fr = eventsBetween(song, t - 0.5, t + ahead).flatMap((e) => (e.kind === 'note' ? [e] : e.notes)).map((n) => n.fret).filter((f) => f > 0);
  if (!fr.length) return { lo: 0, hi: minSpan + 1 };
  let lo = Math.min(...fr) - 1, hi = Math.max(...fr) + 1;
  if (hi - lo < minSpan) { const pad = (minSpan - (hi - lo)) / 2; lo -= pad; hi += pad; }
  if (lo < 0) { hi -= lo; lo = 0; }
  return { lo, hi };
}

/** Basic sanity checks for imported songs. */
export function validateSong(s: unknown): string[] {
  const e: string[] = [];
  const x = s as Partial<PlaySong>;
  if (!x || x.format !== 'gma-song') return ['Not a song document.'];
  if (!Array.isArray(x.tuning?.strings) || x.tuning!.strings.length < 4 || x.tuning!.strings.length > 9) e.push('Tuning must have 4–9 strings.');
  if (!Array.isArray(x.events)) e.push('No notes.');
  else if (!x.events.length) e.push('The arrangement contains no notes.');
  if (!(typeof x.duration === 'number' && x.duration > 0)) e.push('Missing duration.');
  return e;
}
