/**
 * Rocksmith 2014 binary chart (.sng) decryptor and parser.
 * Converts encrypted PC/Mac .sng files into PlaySong objects for Play mode.
 */
import type { PlaySong, SongEvent, SongNote, Technique } from '@gma/notation';
import { inflate } from './bytes';
import { decryptRs2014SngPayload } from './rs2014-crypto';
import { stemOf } from './paths';

const GUITAR_STD = [40, 45, 50, 55, 59, 64];
const BASS_STD = [28, 33, 38, 43];
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function tuningName(strings: number[], bass: boolean): string {
  const std = bass ? BASS_STD : GUITAR_STD;
  const off = strings.map((m, i) => m - std[i]);
  if (off.every((o) => o === 0)) return bass ? 'Bass E Standard' : 'E Standard';
  if (off.every((o) => o === off[0])) return `${NAMES[((40 + off[0]) % 12 + 12) % 12]} Standard`;
  if (off[0] === off[1] - 2 && off.slice(1).every((o) => o === off[1])) return `Drop ${NAMES[((strings[0]) % 12 + 12) % 12]}`;
  return strings.map((m) => NAMES[(m % 12 + 12) % 12]).join(' ');
}

function prettySection(s: string): string {
  const t = s.replace(/[_-]+/g, ' ').replace(/\d+$/, '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : 'Section';
}

function arrangementFromPath(path: string): { arrangement: string; isBass: boolean } {
  const stem = stemOf(path).toLowerCase();
  if (/bass/.test(stem)) return { arrangement: 'Bass', isBass: true };
  if (/rhythm/.test(stem)) return { arrangement: 'Rhythm', isBass: false };
  if (/combo/.test(stem)) return { arrangement: 'Combo', isBass: false };
  if (/lead/.test(stem)) return { arrangement: 'Lead', isBass: false };
  return { arrangement: 'Lead', isBass: false };
}

class BinReader {
  pos = 0;
  private dv: DataView;
  private dec = new TextDecoder('utf-8', { fatal: false });
  constructor(private buf: Uint8Array) {
    this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  i8() { const v = this.dv.getInt8(this.pos); this.pos += 1; return v; }
  i16() { const v = this.dv.getInt16(this.pos, true); this.pos += 2; return v; }
  i32() { const v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; }
  u32() { const v = this.dv.getUint32(this.pos, true); this.pos += 4; return v; }
  f32() { const v = this.dv.getFloat32(this.pos, true); this.pos += 4; return v; }
  skip(n: number) { this.pos += n; }
  str(n: number) {
    const slice = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    const nul = slice.indexOf(0);
    return this.dec.decode(nul >= 0 ? slice.subarray(0, nul) : slice);
  }
}

function techniquesFromMask(mask: number, fret: number, slideTo: number, slideUnpitchTo: number, tap: number, vibrato: number, bend: number): Technique[] {
  const t: Technique[] = [];
  if (mask & 0x00000200) t.push('hammer');
  if (mask & 0x00000400) t.push('pull');
  if (mask & 0x00000040) t.push('palmMute');
  if (mask & 0x00001000) t.push('dead');
  if (mask & 0x00000020) t.push('harmonic');
  if (mask & 0x00010000) t.push('artificialHarmonic');
  if (vibrato > 0) t.push('vibrato');
  if (mask & 0x00004000) t.push('tremolo');
  if (tap > 0) t.push('tap');
  if (mask & 0x04000000) t.push('accent');
  if (mask & 0x00020000) t.push('letRing');
  if (bend > 0) t.push('bend');
  if (slideTo >= 0) t.push(slideTo > fret ? 'slideUp' : 'slideDown');
  else if (slideUnpitchTo >= 0) t.push('slideOut');
  return t;
}

export interface SngImportResult {
  song: PlaySong | null;
  isVocals?: boolean;
  warnings: string[];
  errors: string[];
}

async function decryptAndInflateSng(raw: Uint8Array): Promise<Uint8Array> {
  for (const platform of ['pc', 'mac'] as const) {
    try {
      const payload = await decryptRs2014SngPayload(raw, platform);
      if (payload.byteLength < 6 || payload[4] !== 0x78) continue;
      return await inflate(payload.subarray(4), 'deflate');
    } catch {
      // Try next platform key.
    }
  }
  throw new Error('Could not decrypt or decompress SNG payload (unsupported key or damaged data).');
}

export async function songFromRocksmithSng(raw: Uint8Array, id: string, path: string): Promise<SngImportResult> {
  const warnings: string[] = [];
  let buf: Uint8Array;
  try {
    buf = await decryptAndInflateSng(raw);
  } catch (e) {
    return { song: null, warnings, errors: [(e as Error).message] };
  }

  const r = new BinReader(buf);

  // 1. BPMs (16 bytes each)
  const bpmCount = r.u32();
  const beats: { time: number; downbeat: boolean }[] = [];
  for (let i = 0; i < bpmCount; i++) {
    const time = r.f32();
    const measure = r.i16();
    const beat = r.i16();
    r.skip(8);
    beats.push({ time, downbeat: beat === 0 && measure >= 0 });
  }

  // 2. Phrases (44 bytes each)
  const phraseCount = r.u32();
  const phrases: { name: string; maxDifficulty: number }[] = [];
  for (let i = 0; i < phraseCount; i++) {
    r.skip(4);
    const maxDifficulty = r.i32();
    r.skip(4);
    const name = r.str(32);
    phrases.push({ name, maxDifficulty });
  }

  // 3. Chord templates (72 bytes each)
  const chordCount = r.u32();
  const templates: { name: string; frets: number[] }[] = [];
  for (let i = 0; i < chordCount; i++) {
    r.skip(4);
    const frets = [r.i8(), r.i8(), r.i8(), r.i8(), r.i8(), r.i8()];
    r.skip(30); // fingers[6] + notes[6]
    const name = r.str(32).replace(/-(arp|nop)$/i, '');
    templates.push({ name, frets });
  }

  // 4. ChordNotes (2376 bytes each)
  const cnCount = r.u32();
  const chordNotes: {
    masks: number[];
    bends: number[];
    slideTo: number[];
    slideUnpitchTo: number[];
    vibrato: number[];
  }[] = [];
  for (let i = 0; i < cnCount; i++) {
    const masks = [r.u32(), r.u32(), r.u32(), r.u32(), r.u32(), r.u32()];
    const bends: number[] = [];
    for (let s = 0; s < 6; s++) {
      let maxStep = 0;
      const steps: number[] = [];
      for (let b = 0; b < 32; b++) {
        r.skip(4); // time
        steps.push(r.f32());
        r.skip(4); // unk
      }
      const used = Math.min(32, Math.max(0, r.i32()));
      for (let b = 0; b < used; b++) if (steps[b] > maxStep) maxStep = steps[b];
      bends.push(maxStep);
    }
    const slideTo = [r.i8(), r.i8(), r.i8(), r.i8(), r.i8(), r.i8()];
    const slideUnpitchTo = [r.i8(), r.i8(), r.i8(), r.i8(), r.i8(), r.i8()];
    const vibrato = [r.i16(), r.i16(), r.i16(), r.i16(), r.i16(), r.i16()];
    chordNotes.push({ masks, bends, slideTo, slideUnpitchTo, vibrato });
  }

  // 5. Vocals
  const vocalCount = r.u32();
  r.skip(vocalCount * 60);
  if (vocalCount > 0) {
    const sh = r.u32(); r.skip(sh * 32);
    const st = r.u32(); r.skip(st * 144);
    const sd = r.u32(); r.skip(sd * 44);
  }

  // 6. PhraseIterations (24 bytes each)
  const piCount = r.u32();
  const phraseIters: { phraseId: number; startTime: number; nextPhraseTime: number }[] = [];
  for (let i = 0; i < piCount; i++) {
    const phraseId = r.i32();
    const startTime = r.f32();
    const nextPhraseTime = r.f32();
    r.skip(12);
    phraseIters.push({ phraseId, startTime, nextPhraseTime });
  }

  // 7. PhraseExtraInfo (12 bytes each)
  const peiCount = r.u32();
  r.skip(peiCount * 12);

  // 8. NLinkedDifficulty
  const nldCount = r.u32();
  for (let i = 0; i < nldCount; i++) {
    r.skip(4);
    const pc = r.u32();
    r.skip(pc * 4);
  }

  // 9. Actions (260 bytes each)
  const actCount = r.u32();
  r.skip(actCount * 260);

  // 10. Events (260 bytes each)
  const evCount = r.u32();
  r.skip(evCount * 260);

  // 11. Tones (8 bytes each)
  const toneCount = r.u32();
  r.skip(toneCount * 8);

  // 12. DNAs (8 bytes each)
  const dnaCount = r.u32();
  r.skip(dnaCount * 8);

  // 13. Sections (88 bytes each)
  const secCount = r.u32();
  const rawSections: { name: string; start: number; end: number }[] = [];
  for (let i = 0; i < secCount; i++) {
    const name = prettySection(r.str(32));
    r.skip(4); // number
    const start = r.f32();
    const end = r.f32();
    r.skip(44);
    rawSections.push({ name, start, end });
  }

  // 14. Arrangements (difficulty levels)
  const arrCount = r.u32();
  if (arrCount === 0 && vocalCount > 0) {
    return { song: null, isVocals: true, warnings, errors: [] };
  }

  interface SngNote {
    time: number;
    string: number;
    fret: number;
    sustain: number;
    chordId: number;
    chordNotesId: number;
    mask: number;
    slideTo: number;
    slideUnpitchTo: number;
    tap: number;
    vibrato: number;
    maxBend: number;
  }

  const levels: { d: number; notes: SngNote[] }[] = [];
  for (let a = 0; a < arrCount; a++) {
    const d = r.i32();
    const ac = r.u32(); r.skip(ac * 28);
    const aec = r.u32(); r.skip(aec * 12);
    const fp1 = r.u32(); r.skip(fp1 * 20);
    const fp2 = r.u32(); r.skip(fp2 * 20);
    const nc = r.u32();
    const notes: SngNote[] = [];
    for (let n = 0; n < nc; n++) {
      const mask = r.u32();
      r.skip(8); // noteFlags, hash
      const time = r.f32();
      const string = r.i8();
      const fret = r.i8();
      r.skip(2); // anchorFretId, anchorWidth
      const chordId = r.i32();
      const chordNotesId = r.i32();
      r.skip(18); // phraseId, phraseIterId, fingerPrintId[2], next/prev/parentPrev
      const slideTo = r.i8();
      const slideUnpitchTo = r.i8();
      r.skip(1); // leftHand
      const tap = r.i8();
      r.skip(3); // pickDir, slap, pluck
      const vibrato = r.i16();
      const sustain = r.f32();
      const maxBend = r.f32();
      const bc = r.u32();
      r.skip(bc * 12);
      notes.push({ time, string, fret, sustain, chordId, chordNotesId, mask, slideTo, slideUnpitchTo, tap, vibrato, maxBend });
    }
    const pcc = r.u32(); r.skip(pcc * 4);
    const nii1 = r.u32(); r.skip(nii1 * 4);
    const nii2 = r.u32(); r.skip(nii2 * 4);
    levels.push({ d, notes });
  }

  if (!levels.length) {
    return { song: null, warnings, errors: ['The SNG arrangement has no note levels.'] };
  }

  // 15. Metadata
  r.skip(32); // maxScore, maxNotesAndChords, maxNotesAndChordsReal, pointsPerNote
  r.skip(8);  // firstBeatLength, startTime
  const rawCapo = r.i8();
  r.skip(32); // lastConversionDateTime
  r.skip(2);  // part
  const songLength = r.f32();
  const tuningCount = r.i32();
  const tuningOffsets: number[] = [];
  for (let i = 0; i < tuningCount; i++) tuningOffsets.push(r.i16());

  const { arrangement, isBass } = arrangementFromPath(path);
  const base = isBass ? BASS_STD : GUITAR_STD;
  const strings = base.map((m, i) => m + (tuningOffsets[i] ?? 0));
  const capo = Math.max(0, rawCapo);

  // Select notes for each phrase iteration at its phrase's maxDifficulty.
  const selected: SngNote[] = [];
  if (!phraseIters.length || !phrases.length) {
    const top = levels.reduce((a, b) => (b.d > a.d ? b : a));
    selected.push(...top.notes);
  } else {
    for (let k = 0; k < phraseIters.length; k++) {
      const it = phraseIters[k];
      const end = k + 1 < phraseIters.length ? phraseIters[k + 1].startTime : Infinity;
      const want = phrases[it.phraseId]?.maxDifficulty ?? 0;
      const lvl = levels.filter((l) => l.d <= want).reduce<typeof levels[number] | null>((a, b) => (!a || b.d > a.d ? b : a), null) ?? levels[0];
      for (const n of lvl.notes) {
        if (n.time >= it.startTime && n.time < end) selected.push(n);
      }
    }
  }

  const events: SongEvent[] = [];
  for (const n of selected) {
    if (n.chordId >= 0) {
      const tpl = templates[n.chordId];
      if (!tpl) continue;
      const cn = n.chordNotesId >= 0 ? chordNotes[n.chordNotesId] : undefined;
      const notes: SongNote[] = [];
      for (let s = 0; s < strings.length; s++) {
        const f = tpl.frets[s];
        if (f === undefined || f < 0) continue;
        const m = cn ? cn.masks[s] : n.mask;
        const bend = cn ? cn.bends[s] : 0;
        const st = cn ? cn.slideTo[s] : -1;
        const su = cn ? cn.slideUnpitchTo[s] : -1;
        const vib = cn ? cn.vibrato[s] : 0;
        notes.push({
          time: n.time,
          string: s,
          fret: f,
          sustain: n.sustain,
          techniques: techniquesFromMask(m, f, st, su, 0, vib, bend),
          bend: bend > 0 ? bend : undefined,
          slideTo: st >= 0 ? st : undefined,
        });
      }
      if (!notes.length) continue;
      const tech: Technique[] = [];
      if (n.mask & 0x00000040) tech.push('palmMute');
      if (n.mask & 0x00001000) tech.push('dead');
      events.push({
        kind: 'chord',
        time: n.time,
        name: tpl.name,
        notes,
        sustain: Math.max(0, ...notes.map((x) => x.sustain)),
        techniques: tech,
      });
    } else {
      if (n.string < 0 || n.string >= strings.length || n.fret < 0) continue;
      events.push({
        kind: 'note',
        time: n.time,
        string: n.string,
        fret: n.fret,
        sustain: n.sustain,
        techniques: techniquesFromMask(n.mask, n.fret, n.slideTo, n.slideUnpitchTo, n.tap, n.vibrato, n.maxBend),
        bend: n.maxBend > 0 ? n.maxBend : undefined,
        slideTo: n.slideTo >= 0 ? n.slideTo : undefined,
      });
    }
  }

  events.sort((a, b) => a.time - b.time);
  if (!events.length) {
    return { song: null, warnings, errors: ['The SNG arrangement contains no playable notes.'] };
  }

  const lastTime = Math.max(...events.map((e) => e.time + e.sustain));
  const duration = Math.max(songLength, lastTime + 2);
  const sections = rawSections.map((s, k) => ({
    name: s.name,
    start: s.start,
    end: s.end > s.start ? s.end : (k + 1 < rawSections.length ? rawSections[k + 1].start : duration),
  }));
  const tempo = beats.length > 2 ? 60 / ((beats[beats.length - 1].time - beats[0].time) / (beats.length - 1)) : 120;

  return {
    song: {
      format: 'gma-song',
      version: 1,
      id,
      title: stemOf(path),
      artist: '',
      arrangement,
      tuning: { name: tuningName(strings, isBass), strings },
      capo,
      duration,
      averageTempo: Math.round(tempo),
      beats,
      sections,
      events,
      source: 'rocksmith-xml',
    },
    warnings,
    errors: [],
  };
}
