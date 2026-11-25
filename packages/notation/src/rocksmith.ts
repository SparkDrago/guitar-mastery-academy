/**
 * Import of Rocksmith 2014 *arrangement XML* (the open, unencrypted format that
 * custom-song authoring tools such as EOF and the Custom Song Toolkit read and
 * write). Encrypted .psarc/.sng game files are deliberately not supported.
 *
 * Conventions taken from the format:
 *  - string 0 is the lowest string; <tuning stringN> holds semitone offsets
 *    from E standard (bass: E1 A1 D2 G2);
 *  - note times are seconds in the song's audio;
 *  - bend values are in half steps;
 *  - notes live in difficulty <levels>; each <phraseIteration> uses its
 *    phrase's maxDifficulty level, which together form the full arrangement.
 */
import { child, children, num, parseXml, textOf, type XmlNode } from './xml';
import type { Technique } from './model';
import type { PlaySong, SongEvent, SongNote, SongShape } from './song';

const GUITAR_STD = [40, 45, 50, 55, 59, 64];
const BASS_STD = [28, 33, 38, 43];

function techniquesOf(n: XmlNode): Technique[] {
  const a = n.attrs;
  const t: Technique[] = [];
  const on = (k: string) => a[k] !== undefined && a[k] !== '0' && a[k] !== '-1' && a[k] !== '';
  if (on('hammerOn')) t.push('hammer');
  if (on('pullOff')) t.push('pull');
  if (on('palmMute')) t.push('palmMute');
  if (on('mute') || on('fretHandMute')) t.push('dead');
  if (on('harmonic')) t.push('harmonic');
  if (on('harmonicPinch')) t.push('artificialHarmonic');
  if (on('vibrato')) t.push('vibrato');
  if (on('tremolo')) t.push('tremolo');
  if (on('tap')) t.push('tap');
  if (on('accent')) t.push('accent');
  if (num(a.bend) > 0) t.push('bend');
  if (num(a.slideTo, -1) >= 0) t.push(num(a.slideTo) > num(a.fret) ? 'slideUp' : 'slideDown');
  else if (num(a.slideUnpitchTo, -1) >= 0) t.push('slideOut');
  return t;
}

function noteOf(n: XmlNode): SongNote {
  const a = n.attrs;
  const time = num(a.time);
  const slide = num(a.slideTo, -1);
  const techniques = techniquesOf(n);
  // Bend curve: <bendValues><bendValue time step/></bendValues>, steps in half steps.
  const curve = children(child(n, 'bendValues'), 'bendValue')
    .map((b) => ({ t: Math.max(0, num(b.attrs.time) - time), step: num(b.attrs.step) }))
    .sort((x, y) => x.t - y.t);
  let bend = num(a.bend);
  if (curve.length) {
    bend = Math.max(bend, ...curve.map((c) => c.step));
    if (bend > 0 && !techniques.includes('bend')) techniques.push('bend');
    // Starts already bent → pre-bend; ends lower than its peak → release.
    if (curve[0].t < 0.02 && curve[0].step > 0) techniques.push('prebend');
    if (bend > 0 && curve[curve.length - 1].step < bend - 0.01 && curve.findIndex((c) => c.step >= bend - 0.01) < curve.length - 1) techniques.push('release');
  }
  return {
    time, string: num(a.string), fret: num(a.fret), sustain: num(a.sustain), techniques,
    bend: bend > 0 ? bend : undefined, bendCurve: curve.length ? curve : undefined, slideTo: slide >= 0 ? slide : undefined,
    linkNext: a.linkNext === '1' ? true : undefined,
  };
}

interface LevelData { notes: XmlNode[]; chords: XmlNode[]; shapes: XmlNode[] }

export interface RocksmithImport {
  song: PlaySong | null;
  warnings: string[];
  errors: string[];
}

export function songFromRocksmithXml(text: string, id: string): RocksmithImport {
  const warnings: string[] = [];
  let doc: XmlNode;
  try { doc = parseXml(text); } catch (e) { return { song: null, warnings, errors: [`Not valid XML: ${(e as Error).message}`] }; }
  const root = child(doc, 'song');
  if (!root) return { song: null, warnings, errors: ['This is not a Rocksmith arrangement XML (no <song> element). Vocals and showlights files cannot be played.'] };

  const arrangement = textOf(root, 'arrangement') ?? 'Lead';
  const props = child(root, 'arrangementProperties');
  const isBass = /bass/i.test(arrangement) || props?.attrs.pathBass === '1';
  const tuningNode = child(root, 'tuning');
  const base = isBass ? BASS_STD : GUITAR_STD;
  const strings = base.map((m, i) => m + num(tuningNode?.attrs[`string${i}`]));
  const capo = Math.max(0, num(textOf(root, 'capo')));
  const songLength = num(textOf(root, 'songLength'));

  const templates = children(child(root, 'chordTemplates'), 'chordTemplate').map((c) => ({
    name: (c.attrs.displayName || c.attrs.chordName || '').replace(/-(arp|nop)$/i, ''),
    arpeggio: /-arp$/i.test(c.attrs.displayName ?? ''),
    frets: base.map((_, i) => { const f = num(c.attrs[`fret${i}`], -1); return f >= 0 ? f : null; }),
  }));

  // Choose the notes that make up the full arrangement.
  let data: LevelData = { notes: [], chords: [], shapes: [] };
  const transcription = child(root, 'transcriptionTrack');
  const tNotes = children(child(transcription, 'notes'), 'note');
  const tChords = children(child(transcription, 'chords'), 'chord');
  if (tNotes.length + tChords.length > 0) data = { notes: tNotes, chords: tChords, shapes: children(child(transcription, 'handShapes'), 'handShape') };
  else {
    const levels = children(child(root, 'levels'), 'level').map((l) => ({ d: num(l.attrs.difficulty), notes: children(child(l, 'notes'), 'note'), chords: children(child(l, 'chords'), 'chord'), shapes: children(child(l, 'handShapes'), 'handShape') }));
    if (!levels.length) return { song: null, warnings, errors: ['The arrangement has no note levels.'] };
    const phrases = children(child(root, 'phrases'), 'phrase').map((p) => ({ name: p.attrs.name ?? '', max: num(p.attrs.maxDifficulty) }));
    const iters = children(child(root, 'phraseIterations'), 'phraseIteration').map((p) => ({ time: num(p.attrs.time), phrase: num(p.attrs.phraseId) }));
    if (!iters.length || !phrases.length) {
      const top = levels.reduce((a, b) => (b.d > a.d ? b : a));
      data = { notes: top.notes, chords: top.chords, shapes: top.shapes };
      warnings.push('No phrase information: using the hardest difficulty level throughout.');
    } else {
      iters.forEach((it, k) => {
        const end = k + 1 < iters.length ? iters[k + 1].time : Infinity;
        const want = phrases[it.phrase]?.max ?? 0;
        const lvl = levels.filter((l) => l.d <= want).reduce<typeof levels[number] | null>((a, b) => (!a || b.d > a.d ? b : a), null) ?? levels[0];
        const inRange = (n: XmlNode) => { const t = num(n.attrs.time ?? n.attrs.startTime); return t >= it.time && t < end; };
        data.notes.push(...lvl.notes.filter(inRange));
        data.chords.push(...lvl.chords.filter(inRange));
        data.shapes.push(...lvl.shapes.filter(inRange));
      });
    }
  }

  const events: SongEvent[] = [];
  for (const n of data.notes) {
    const note = noteOf(n);
    if (note.string < 0 || note.string >= strings.length) continue;
    events.push({ kind: 'note', ...note });
  }
  let missingTemplates = 0;
  for (const c of data.chords) {
    const tpl = templates[num(c.attrs.chordId, -1)];
    const chordNotes = children(c, 'chordNote').map(noteOf).filter((n) => n.string >= 0 && n.string < strings.length);
    const time = num(c.attrs.time);
    const notes: SongNote[] = chordNotes.length ? chordNotes.map((n) => ({ ...n, time }))
      : tpl ? tpl.frets.flatMap((f, s) => (f === null ? [] : [{ time, string: s, fret: f, sustain: 0, techniques: [] as Technique[] }])) : [];
    if (!tpl) missingTemplates++;
    if (!notes.length) continue;
    const tech: Technique[] = [];
    if (c.attrs.palmMute === '1') tech.push('palmMute');
    if (c.attrs.fretHandMute === '1') tech.push('dead');
    if (c.attrs.accent === '1') tech.push('accent');
    // Chord-level techniques apply to every string of the chord.
    for (const nt of notes) {
      for (const k of tech) if (!nt.techniques.includes(k)) nt.techniques.push(k);
      if (c.attrs.linkNext === '1') nt.linkNext = true;
    }
    events.push({ kind: 'chord', time, name: tpl?.name ?? '', notes: notes.sort((a, b) => a.string - b.string), sustain: Math.max(0, ...notes.map((n) => n.sustain)), techniques: tech });
  }
  const shapes: SongShape[] = [];
  for (const h of data.shapes) {
    const tpl = templates[num(h.attrs.chordId, -1)];
    const start = num(h.attrs.startTime), end = num(h.attrs.endTime);
    if (!tpl || !(end > start)) continue;
    shapes.push({ start, end, name: tpl.name, frets: tpl.frets.slice(0, strings.length), arpeggio: tpl.arpeggio });
  }
  shapes.sort((a, b) => a.start - b.start);
  if (missingTemplates) warnings.push(`${missingTemplates} chord(s) referenced a missing chord template.`);
  events.sort((a, b) => a.time - b.time);
  linkStrings(events, data.notes);
  if (!events.length) return { song: null, warnings, errors: ['The arrangement contains no notes.'] };

  const beats = children(child(root, 'ebeats'), 'ebeat').map((b) => ({ time: num(b.attrs.time), downbeat: num(b.attrs.measure, -1) >= 0 }));
  const lastTime = Math.max(...events.map((e) => e.time + e.sustain));
  const duration = Math.max(songLength, lastTime + 2);
  const sectionNodes = children(child(root, 'sections'), 'section').map((s) => ({ name: prettySection(s.attrs.name ?? ''), start: num(s.attrs.startTime) }));
  const sections = sectionNodes.map((s, k) => ({ ...s, end: k + 1 < sectionNodes.length ? sectionNodes[k + 1].start : duration }));
  if (strings.length !== 4 && strings.length !== 6) warnings.push('Unusual string count.');
  if (capo) warnings.push(`Capo on fret ${capo}: open strings sound at the capo.`);

  const tempo = num(textOf(root, 'averageTempo')) || (beats.length > 2 ? 60 / ((beats[beats.length - 1].time - beats[0].time) / (beats.length - 1)) : 120);
  return {
    song: {
      format: 'gma-song', version: 1, id,
      title: textOf(root, 'title') || 'Untitled', artist: textOf(root, 'artistName') || '', album: textOf(root, 'albumName') || undefined,
      year: num(textOf(root, 'albumYear')) || undefined, arrangement,
      tuning: { name: tuningName(strings, isBass), strings }, capo, duration, averageTempo: Math.round(tempo),
      beats, sections, events, ...(shapes.length ? { shapes } : {}), source: 'rocksmith-xml',
    },
    warnings, errors: [],
  };
}

/**
 * Per string, in time order: the note after a linkNext note is a continuation
 * (tied), and a hopo note without an explicit hammer/pull becomes one by
 * comparing it with the previous note on that string.
 */
function linkStrings(events: SongEvent[], rawNotes: XmlNode[]) {
  const hopoAt = new Set(rawNotes.filter((n) => n.attrs.hopo === '1').map((n) => `${num(n.attrs.time).toFixed(4)}:${num(n.attrs.string)}`));
  const last = new Map<number, SongNote>();
  for (const e of events) {
    const ns = e.kind === 'note' ? [e as SongNote] : e.notes;
    for (const n of ns) {
      const prev = last.get(n.string);
      if (prev?.linkNext) n.tied = true;
      if (hopoAt.has(`${n.time.toFixed(4)}:${n.string}`) && !n.techniques.includes('hammer') && !n.techniques.includes('pull')) {
        n.techniques.push(prev && prev.fret > n.fret ? 'pull' : 'hammer');
      }
      last.set(n.string, n);
    }
  }
}

function prettySection(s: string): string {
  const t = s.replace(/[_-]+/g, ' ').replace(/\d+$/, '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : 'Section';
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function tuningName(strings: number[], bass: boolean): string {
  const std = bass ? BASS_STD : GUITAR_STD;
  const off = strings.map((m, i) => m - std[i]);
  if (off.every((o) => o === 0)) return bass ? 'Bass E Standard' : 'E Standard';
  if (off.every((o) => o === off[0])) return `${NAMES[((40 + off[0]) % 12 + 12) % 12]} Standard`;
  if (off[0] === off[1] - 2 && off.slice(1).every((o) => o === off[1])) return `Drop ${NAMES[((strings[0]) % 12 + 12) % 12]}`;
  return strings.map((m) => NAMES[(m % 12 + 12) % 12]).join(' ');
}
