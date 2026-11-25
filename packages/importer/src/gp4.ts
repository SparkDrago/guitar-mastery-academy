/**
 * Native Guitar Pro 4 (.gp4) binary parser.
 * Converts .gp4 tracks into PlaySong objects for Play mode.
 */
import type { PlaySong, SongEvent, SongNote, SongSection, Technique } from '@gma/notation';
import { stemOf } from './paths';

const GUITAR_STD = [40, 45, 50, 55, 59, 64];
const BASS_STD = [28, 33, 38, 43];
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function tuningName(strings: number[]): string {
  const bass = strings.length <= 5 && strings[0] < 36;
  const std = bass ? BASS_STD : GUITAR_STD;
  if (strings.length === std.length) {
    const off = strings.map((m, i) => m - std[i]);
    if (off.every((o) => o === 0)) return bass ? 'Bass E Standard' : 'E Standard';
    if (off.every((o) => o === off[0])) return `${NAMES[((std[0] + off[0]) % 12 + 12) % 12]} Standard`;
    if (off[0] === off[1] - 2 && off.slice(1).every((o) => o === off[1])) {
      return `Drop ${NAMES[(strings[0] % 12 + 12) % 12]}`;
    }
  }
  return strings.map((m) => NAMES[(m % 12 + 12) % 12]).join(' ');
}

class GpReader {
  pos = 0;
  private dv: DataView;
  private dec = new TextDecoder('latin1');
  constructor(private buf: Uint8Array) {
    this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  get remaining() { return this.buf.byteLength - this.pos; }
  u8() { const v = this.dv.getUint8(this.pos); this.pos += 1; return v; }
  i8() { const v = this.dv.getInt8(this.pos); this.pos += 1; return v; }
  i32() { const v = this.dv.getInt32(this.pos, true); this.pos += 4; return v; }
  skip(n: number) { this.pos += n; }
  byteSizeString(maxLen: number): string {
    const len = this.u8();
    const slice = this.buf.subarray(this.pos, this.pos + Math.min(len, maxLen));
    this.pos += maxLen;
    return this.dec.decode(slice).trim();
  }
  intSizeString(): string {
    const total = this.i32();
    if (total <= 0) return '';
    const len = this.u8();
    const avail = Math.max(0, total - 1);
    const slice = this.buf.subarray(this.pos, this.pos + Math.min(len, avail));
    this.pos += avail;
    return this.dec.decode(slice).trim();
  }
  intString(): string {
    const len = this.i32();
    if (len <= 0) return '';
    const slice = this.buf.subarray(this.pos, this.pos + len);
    this.pos += len;
    return this.dec.decode(slice).trim();
  }
}

export interface Gp4TrackResult {
  name: string;
  song: PlaySong;
  warnings: string[];
}

export interface Gp4ParseResult {
  title: string;
  artist: string;
  album?: string;
  tracks: Gp4TrackResult[];
  skipped: string[];
}

function skipBend(r: GpReader): number {
  r.skip(1); // type
  const val = r.i32(); // 100 = full step (2 semitones)
  const count = r.i32();
  let maxVal = val;
  for (let i = 0; i < count; i++) {
    r.skip(4); // position
    const pv = r.i32();
    if (pv > maxVal) maxVal = pv;
    r.skip(1); // vibrato
  }
  return maxVal > 0 ? +(maxVal / 50).toFixed(2) : 0;
}

function skipChord(r: GpReader): string {
  const header = r.u8();
  if (header === 0) {
    const name = r.intSizeString();
    const firstFret = r.i32();
    if (firstFret !== 0) r.skip(6 * 4);
    return name;
  }
  r.skip(1 + 3 + 1 + 1 + 1 + 4 + 4 + 1); // sharp..add
  const name = r.byteSizeString(20);
  r.skip(2 + 1 + 1 + 1 + 4 + 7 * 4 + 1 + 5 + 5 + 5 + 5 + 1 + 7 + 1);
  return name;
}

function beatDurationBeats(dur: number, dotted: boolean, tuplet: number): number {
  // dur: -2=whole(4), -1=half(2), 0=quarter(1), 1=8th(0.5), 2=16th(0.25), 3=32nd, 4=64th
  let b = 4 / Math.pow(2, dur + 2);
  if (dotted) b *= 1.5;
  if (tuplet > 0) {
    const map: Record<number, number> = { 3: 2 / 3, 5: 4 / 5, 6: 4 / 6, 7: 4 / 7, 9: 8 / 9, 10: 8 / 10, 11: 8 / 11, 12: 8 / 12, 13: 8 / 13 };
    b *= map[tuplet] ?? 1;
  }
  return b;
}

export function parseGp4(raw: Uint8Array, path: string, idPrefix: string): Gp4ParseResult {
  const r = new GpReader(raw);
  const version = r.byteSizeString(30);
  if (!/^FICHIER GUITAR PRO v4\./i.test(version)) {
    throw new Error(`Unsupported Guitar Pro binary version: "${version || 'unknown'}".`);
  }

  // Song info
  const title = r.intSizeString() || stemOf(path);
  r.intSizeString(); // subtitle
  const artist = r.intSizeString();
  const album = r.intSizeString() || undefined;
  r.intSizeString(); // author
  r.intSizeString(); // copyright
  r.intSizeString(); // tab
  r.intSizeString(); // instructions
  const noticeCount = r.i32();
  for (let i = 0; i < noticeCount; i++) r.intSizeString();

  r.skip(1); // triplet feel

  // Lyrics
  r.skip(4); // lyrics track
  for (let i = 0; i < 5; i++) {
    r.skip(4); // start measure
    r.intString();
  }

  const initialTempo = Math.max(20, Math.min(400, r.i32() || 120));
  r.skip(4 + 1); // key + octave
  r.skip(64 * 12); // 64 MIDI channels

  const measureCount = r.i32();
  const trackCount = r.i32();

  interface MeasureHeader {
    num: number;
    den: number;
    marker?: string;
  }
  const headers: MeasureHeader[] = [];
  let curNum = 4;
  let curDen = 4;
  for (let m = 0; m < measureCount; m++) {
    const flags = r.u8();
    if (flags & 0x01) curNum = r.i8();
    if (flags & 0x02) curDen = r.i8();
    if (flags & 0x08) r.skip(1); // repeatClose
    if (flags & 0x10) r.skip(1); // repeatAlternative
    let marker: string | undefined;
    if (flags & 0x20) {
      marker = r.intSizeString() || undefined;
      r.skip(4); // color
    }
    if (flags & 0x40) r.skip(2); // key + minor
    headers.push({ num: curNum, den: curDen, marker });
  }

  interface TrackDef {
    index: number;
    name: string;
    isDrums: boolean;
    stringCount: number;
    strings: number[]; // low-to-high MIDI
    capo: number;
    events: SongEvent[];
  }
  const trackDefs: TrackDef[] = [];
  for (let t = 0; t < trackCount; t++) {
    const flags = r.u8();
    const name = r.byteSizeString(40) || `Track ${t + 1}`;
    const stringCount = r.i32();
    const gpTuning: number[] = [];
    for (let s = 0; s < 7; s++) gpTuning.push(r.i32());
    r.skip(4); // port
    const channel = r.i32();
    r.skip(4); // channelE
    r.skip(4); // fretCount
    const capo = Math.max(0, r.i32());
    r.skip(4); // color

    const isDrums = (flags & 0x01) !== 0 || channel === 10;
    const validStrings = Math.min(7, Math.max(4, stringCount));
    // GP4 stores tuning high-to-low; PlaySong expects low-to-high.
    const strings = gpTuning.slice(0, validStrings).reverse();
    trackDefs.push({ index: t, name, isDrums, stringCount: validStrings, strings, capo, events: [] });
  }

  let currentTempo = initialTempo;
  let currentTime = 0;
  const beats: { time: number; downbeat: boolean }[] = [];
  const rawSections: { name: string; start: number }[] = [];
  const tempoSamples: number[] = [initialTempo];

  for (let m = 0; m < measureCount; m++) {
    const h = headers[m];
    const measureStart = currentTime;
    if (h.marker) rawSections.push({ name: h.marker, start: measureStart });

    const measureBeats = (h.num * 4) / Math.max(1, h.den);
    let measureTempo = currentTempo;

    for (let t = 0; t < trackCount; t++) {
      const tr = trackDefs[t];
      const beatCount = r.i32();
      let beatOffset = 0;

      for (let b = 0; b < beatCount; b++) {
        const bFlags = r.u8();
        let status = 1;
        if (bFlags & 0x40) status = r.u8();
        const dur = r.i8();
        const dotted = (bFlags & 0x01) !== 0;
        const tuplet = (bFlags & 0x20) !== 0 ? r.i32() : 0;
        const durBeats = beatDurationBeats(dur, dotted, tuplet);

        let chordName = '';
        if (bFlags & 0x02) chordName = skipChord(r);
        if (bFlags & 0x04) r.intSizeString(); // text

        let beatTap = false;
        if (bFlags & 0x08) {
          const ef1 = r.u8();
          const ef2 = r.u8();
          if (ef1 & 0x20) {
            const tapVal = r.u8();
            if (tapVal === 1) beatTap = true;
          }
          if (ef2 & 0x04) skipBend(r); // tremoloBar
          if (ef1 & 0x40) r.skip(2); // stroke
          if (ef2 & 0x02) r.skip(1); // pickStroke
        }

        if (bFlags & 0x10) {
          r.skip(1); // instrument
          const vol = r.i8();
          const pan = r.i8();
          const cho = r.i8();
          const rev = r.i8();
          const pha = r.i8();
          const tre = r.i8();
          const newTempo = r.i32();
          if (vol >= 0) r.skip(1);
          if (pan >= 0) r.skip(1);
          if (cho >= 0) r.skip(1);
          if (rev >= 0) r.skip(1);
          if (pha >= 0) r.skip(1);
          if (tre >= 0) r.skip(1);
          if (newTempo >= 0) {
            r.skip(1);
            if (newTempo >= 20 && newTempo <= 400) {
              measureTempo = newTempo;
              tempoSamples.push(newTempo);
            }
          }
          r.skip(1); // allTracksFlags (GP4)
        }

        const spb = 60 / measureTempo;
        const time = +(measureStart + beatOffset * spb).toFixed(4);
        const sustain = durBeats * spb >= 0.45 ? +(durBeats * spb * 0.9).toFixed(4) : 0;

        const stringFlags = r.u8();
        const beatNotes: SongNote[] = [];

        for (let s = 0; s < 7; s++) {
          if ((stringFlags & (1 << (6 - s))) === 0) continue;
          const nFlags = r.u8();
          let noteType = 1;
          if (nFlags & 0x20) noteType = r.u8();
          if (nFlags & 0x01) r.skip(2); // timeIndependentDuration + tuplet
          if (nFlags & 0x10) r.skip(1); // dynamic
          let fret = 0;
          if (nFlags & 0x20) fret = r.i8();
          if (nFlags & 0x80) r.skip(2); // left/right finger

          const tech: Technique[] = [];
          if (beatTap) tech.push('tap');
          if (noteType === 3) tech.push('dead');
          if (nFlags & 0x40) tech.push('accent');

          let bend = 0;
          if (nFlags & 0x08) {
            const nef1 = r.u8();
            const nef2 = r.u8();
            if (nef1 & 0x01) bend = skipBend(r);
            if (nef1 & 0x10) r.skip(4); // graceNote
            if (nef1 & 0x02) tech.push('hammer');
            if (nef1 & 0x08) tech.push('letRing');
            if (nef2 & 0x02) tech.push('palmMute');
            if (nef2 & 0x04) { r.skip(1); tech.push('tremolo'); }
            if (nef2 & 0x08) {
              const sl = r.i8();
              if (sl === 1 || sl === 2 || sl === 3 || sl === 4) tech.push('slideUp');
              else if (sl === -1 || sl === -2) tech.push('slideDown');
            }
            if (nef2 & 0x10) {
              const harm = r.i8();
              if (harm === 1) tech.push('harmonic');
              else if (harm > 1) tech.push('artificialHarmonic');
            }
            if (nef2 & 0x20) r.skip(2); // trill
            if (nef2 & 0x40) tech.push('vibrato');
          }
          if (bend > 0) tech.push('bend');

          if (!tr.isDrums && status === 1 && noteType !== 2 && s < tr.stringCount && fret >= 0) {
            const gmaString = tr.stringCount - 1 - s;
            beatNotes.push({
              time,
              string: gmaString,
              fret,
              sustain,
              techniques: tech,
              bend: bend > 0 ? bend : undefined,
            });
          }
        }

        if (beatNotes.length === 1) {
          tr.events.push({ kind: 'note', ...beatNotes[0] });
        } else if (beatNotes.length > 1) {
          beatNotes.sort((a, b) => a.string - b.string);
          tr.events.push({
            kind: 'chord',
            time,
            name: chordName,
            notes: beatNotes,
            sustain: Math.max(...beatNotes.map((n) => n.sustain)),
            techniques: [],
          });
        }

        beatOffset += durBeats;
      }
    }

    currentTempo = measureTempo;
    const spb = 60 / currentTempo;
    const numBeats = Math.max(1, Math.round(measureBeats));
    for (let bi = 0; bi < numBeats; bi++) {
      beats.push({ time: +(measureStart + bi * spb).toFixed(4), downbeat: bi === 0 });
    }
    currentTime += measureBeats * spb;
  }

  const avgTempo = Math.round(tempoSamples.reduce((a, b) => a + b, 0) / tempoSamples.length);
  const duration = Math.max(1, +(currentTime + 2).toFixed(2));
  const sections: SongSection[] = rawSections.map((s, idx) => ({
    name: s.name,
    start: s.start,
    end: idx + 1 < rawSections.length ? rawSections[idx + 1].start : duration,
  }));

  const tracks: Gp4TrackResult[] = [];
  const skipped: string[] = [];

  for (const tr of trackDefs) {
    if (tr.isDrums) {
      skipped.push(`${tr.name} (drums)`);
      continue;
    }
    if (!tr.events.length) {
      skipped.push(`${tr.name} (no notes)`);
      continue;
    }
    tr.events.sort((a, b) => a.time - b.time);
    tracks.push({
      name: tr.name,
      warnings: [],
      song: {
        format: 'gma-song',
        version: 1,
        id: `${idPrefix}-${tr.index}`,
        title,
        artist,
        album,
        arrangement: tr.name,
        tuning: { name: tuningName(tr.strings), strings: tr.strings },
        capo: tr.capo,
        duration,
        averageTempo: avgTempo,
        beats,
        sections,
        events: tr.events,
        source: 'guitar-pro',
      },
    });
  }

  return { title, artist, album, tracks, skipped };
}
