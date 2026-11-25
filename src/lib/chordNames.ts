/**
 * Chord names for Play mode. A chart's chord names are whatever its author typed
 * (Rocksmith charts often name a shape after the band's harmony, or keep a full
 * name on a two-note fragment). This names each chord from the notes actually
 * played instead, and reports where the two disagree.
 */
import { midiOfNote, type PlaySong, type SongEvent } from '@gma/notation';
import { parseChordSymbol, pcOf, reverseChordLookup } from '@gma/theory';

type ChordEvent = Extract<SongEvent, { kind: 'chord' }>;
export type ChordNameMode = 'chart' | 'notes';

const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]); // F, Bb, Eb, Ab, Db, Gb majors (and their relative minors)
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** True when the song's notes fit a flat key best (so B♭ rather than A♯). */
export function prefersFlats(song: PlaySong): boolean {
  const hist = new Array(12).fill(0);
  for (const e of song.events) for (const n of e.kind === 'note' ? [e] : e.notes) if (!n.techniques.includes('dead')) hist[midiOfNote(song, n) % 12] += 1;
  let best = 0, bestScore = -1;
  for (let k = 0; k < 12; k++) {
    const score = MAJOR.reduce((a, iv) => a + hist[(k + iv) % 12], 0);
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return FLAT_KEYS.has(best);
}

/** Name of a chord from its notes ('' when the notes do not form a nameable chord). */
export function nameFromNotes(song: PlaySong, e: ChordEvent, flats: boolean): string {
  const midis = e.notes.filter((n) => !n.techniques.includes('dead')).map((n) => midiOfNote(song, n));
  if (midis.length < 2) return '';
  const bass = Math.min(...midis) % 12;
  return reverseChordLookup(midis, { bassPc: bass, preferFlats: flats, max: 1 })[0]?.symbol ?? '';
}

const pcSet = (pcs: number[]) => [...new Set(pcs.map((p) => ((p % 12) + 12) % 12))].sort((a, b) => a - b).join(',');

/**
 * Does the chart's name describe exactly these notes (same pitch classes and bass)?
 * Rocksmith spellings are accepted: "Gmin7", "A#", "Fsus4/D".
 */
export function chartNameMatches(song: PlaySong, e: ChordEvent): boolean {
  const c = parseChordSymbol(e.name.replace(/min(?!or)/g, 'm'));
  if (!c) return false;
  const midis = e.notes.filter((n) => !n.techniques.includes('dead')).map((n) => midiOfNote(song, n));
  if (!midis.length) return true;
  const played = midis.map((m) => m % 12);
  const bassPc = Math.min(...midis) % 12;
  const slash = c.bass ? pcOf(c.bass) : null;
  const named = slash !== null ? [...c.pcs, slash] : c.pcs;
  const wantBass = slash ?? pcOf(c.root);
  return pcSet(played) === pcSet(named) && bassPc === wantBass;
}

export interface ChordNameReport {
  /** Distinct named shapes in the chart. */
  shapes: number;
  /** Shapes whose chart name does not describe their notes, with the name the notes give. */
  differing: { chart: string; notes: string; frets: string }[];
}

export function chordNameReport(song: PlaySong): ChordNameReport {
  const flats = prefersFlats(song);
  const seen = new Map<string, ChordEvent>();
  for (const e of song.events) if (e.kind === 'chord' && e.name) seen.set(`${e.name}|${e.notes.map((n) => `${n.string}:${n.fret}`).join(' ')}`, e);
  const differing: ChordNameReport['differing'] = [];
  for (const e of seen.values()) {
    if (chartNameMatches(song, e)) continue;
    const notes = nameFromNotes(song, e, flats);
    if (!notes) continue;
    const frets = song.tuning.strings.map((_, s) => e.notes.find((n) => n.string === s)?.fret ?? 'x').join('-');
    differing.push({ chart: e.name, notes, frets });
  }
  return { shapes: seen.size, differing };
}

/** The song with chord names taken from the chart (unchanged) or from the notes. */
export function withChordNames(song: PlaySong, mode: ChordNameMode): PlaySong {
  if (mode === 'chart') return song;
  const flats = prefersFlats(song);
  return {
    ...song,
    events: song.events.map((e) => (e.kind === 'chord' ? { ...e, name: nameFromNotes(song, e, flats) || e.name } : e)),
  };
}
