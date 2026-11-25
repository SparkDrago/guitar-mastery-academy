import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawHighway, STRING_COLORS, type HighwayState } from '@/components/highway';
import { songFromRocksmithXml, type PlaySong, type SongEvent } from '@gma/notation';

type Box = { x: number; y: number; w: number; h: number; fill: string };
type Text = { text: string; x: number; y: number };

/** A 2D context stand-in that records what the highway draws. */
function recorder() {
  const boxes: Box[] = [], texts: Text[] = [], frames: Box[] = [];
  let arcs: number[][] = [];
  const g: Record<string, unknown> = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'center', globalAlpha: 1, shadowColor: '', shadowBlur: 0,
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, save() {}, restore() {}, setLineDash() {},
    beginPath() { arcs = []; },
    arcTo(x1: number, y1: number, x2: number, y2: number) { arcs.push([x1, y1, x2, y2]); },
    fill() {
      if (arcs.length === 4) {
        const [a, , c] = arcs; // roundRect: arcTo(x+w,y,..), arcTo(x+w,y+h,..), arcTo(x,y+h,..)
        boxes.push({ x: c[0], y: a[1], w: a[0] - c[0], h: c[1] - a[1], fill: String(g.fillStyle) });
      }
    },
    strokeRect(x: number, y: number, w: number, h: number) { frames.push({ x, y, w, h, fill: '' }); },
    fillText(text: string, x: number, y: number) { texts.push({ text, x, y }); },
  };
  return { g: g as unknown as CanvasRenderingContext2D, boxes, texts, frames };
}

const W = 900, H = 320;
const chord = (time: number, name: string, frets: (number | null)[]): SongEvent => ({
  kind: 'chord', time, name, sustain: 0, techniques: [],
  notes: frets.flatMap((f, s) => (f === null ? [] : [{ time, string: s, fret: f, sustain: 0, techniques: [] }])),
});
const song = (events: SongEvent[], extra: Partial<PlaySong> = {}): PlaySong => ({
  format: 'gma-song', version: 1, id: 't', title: 'T', artist: '', arrangement: 'Lead',
  tuning: { name: 'E Standard', strings: [40, 45, 50, 55, 59, 64] }, capo: 0, duration: 30, averageTempo: 120,
  beats: [], sections: [], events, source: 'rocksmith-xml', ...extra,
});
function draw(s: PlaySong, t: number, o: Partial<HighwayState> = {}) {
  const r = recorder();
  drawHighway(r.g, W, H, {
    song: s, t, lookahead: 3, cam: { lo: 0, hi: 12 }, status: () => 'pending', lowOnTop: true, leftHanded: false,
    flashes: new Map(), indexOf: new Map(s.events.map((e, i) => [e, i])), ...o,
  });
  return r;
}
const inside = (p: { x: number; y: number }, b: Box, pad = 1) => p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;

// The two chords from the reported screenshot.
const FSUS4_D = [null, null, 0, 3, 1, 1];
const GMIN7 = [null, null, 8, 10, 8, 6];

test('every note of a chord, open strings included, is drawn inside its chord frame', () => {
  for (const [frets, t] of [[FSUS4_D, 1.2], [FSUS4_D, 2.0], [GMIN7, 2.0], [GMIN7, 1.5]] as const) {
    const r = draw(song([chord(2, 'X', [...frets])]), t);
    assert.equal(r.frames.length, 1);
    const f = r.frames[0];
    const labels = r.texts.filter((x) => /^\d+$/.test(x.text) && x.y < H * 0.9); // fret labels, not the fret-number ruler
    // Close to the strings every note is labelled; further out a label that would collide is left out.
    if (t >= 1.5) assert.equal(labels.length, frets.filter((x) => x !== null).length, `one label per note (${frets})`);
    else assert.ok(labels.length >= 2, 'far chord still labelled where labels fit');
    for (const l of labels) assert.ok(inside(l, f), `"${l.text}" at (${l.x.toFixed(0)},${l.y.toFixed(0)}) lies in frame ${JSON.stringify(f)} (t=${t})`);
    const open = r.boxes.filter((b) => b.fill === STRING_COLORS[2]);
    if (frets[2] === 0) for (const b of open) assert.ok(b.x >= f.x - 1 && b.x + b.w <= f.x + f.w + 1, 'open-string bar stays within the chord frame');
  }
});

test('notes of a far chord never overlap each other', () => {
  for (const t of [0, -0.9, -0.95]) { // chord at the strings, near the horizon, at the horizon
    const r = draw(song([chord(2 + 0 * t, 'Fsus4/D', [...FSUS4_D])]), 2 + t);
    const fretted = r.boxes.filter((b) => b.w < W / 3);
    for (let i = 0; i < fretted.length; i++) for (let j = i + 1; j < fretted.length; j++) {
      const a = fretted[i], b = fretted[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `boxes overlap at depth t=${t}: ${JSON.stringify(a)} ${JSON.stringify(b)}`);
    }
  }
});

test('string rows, colours and fret positions follow the chart', () => {
  const ev = chord(2, 'Gmin7', [...GMIN7]);
  for (const lowOnTop of [true, false]) {
    const r = draw(song([ev]), 2, { lowOnTop });
    const byColor = (s: number) => r.boxes.find((b) => b.fill === STRING_COLORS[s])!;
    const ys = [2, 3, 4, 5].map((s) => byColor(s).y);
    const sorted = [...ys].sort((a, b) => (lowOnTop ? a - b : b - a));
    assert.deepEqual(ys, sorted, `rows ordered low→high ${lowOnTop ? 'top-down' : 'bottom-up'}`);
    // Fret 6 (string 5) left of fret 8 (strings 2, 4) left of fret 10 (string 3).
    const cxOf = (s: number) => byColor(s).x + byColor(s).w / 2;
    assert.ok(cxOf(5) < cxOf(2) && Math.abs(cxOf(2) - cxOf(4)) < 0.5 && cxOf(2) < cxOf(3));
  }
  const lh = draw(song([ev]), 2, { leftHanded: true });
  const c = (s: number) => { const b = lh.boxes.find((x) => x.fill === STRING_COLORS[s])!; return b.x + b.w / 2; };
  assert.ok(c(5) > c(2) && c(2) > c(3), 'left-handed view mirrors the frets');
});

test('chord name is drawn above its frame; open-only chords span the board', () => {
  const r = draw(song([chord(2, 'Gmin7', [...GMIN7])]), 1.5);
  const name = r.texts.find((x) => x.text === 'Gmin7')!;
  const f = r.frames[0];
  assert.ok(name && name.y < f.y && name.x > f.x && name.x < f.x + f.w);
  const em = draw(song([chord(2, 'Em', [0, 2, 2, 0, 0, 0])]), 2);
  const zero = draw(song([chord(2, 'open', [0, null, null, 0, 0, 0])]), 2);
  assert.ok(zero.frames[0].w > W * 0.8, 'all-open chord frame covers the board');
  assert.ok(em.frames[0].w < W * 0.4, 'fretted chord frame covers its frets only');
});

const ARP_XML = `<?xml version="1.0"?>
<song><title>Arp</title><artistName>T</artistName><arrangement>Lead</arrangement><averageTempo>100</averageTempo><songLength>10</songLength>
<tuning string0="0" string1="0" string2="0" string3="0" string4="0" string5="0"/>
<chordTemplates count="2">
  <chordTemplate chordName="Am" displayName="Am-arp" fret0="-1" fret1="0" fret2="2" fret3="2" fret4="1" fret5="0"/>
  <chordTemplate chordName="C" displayName="C" fret0="-1" fret1="3" fret2="2" fret3="0" fret4="1" fret5="0"/>
</chordTemplates>
<ebeats count="1"><ebeat time="0" measure="1"/></ebeats>
<levels count="1"><level difficulty="0">
  <notes count="3"><note time="1" string="1" fret="0"/><note time="1.5" string="2" fret="2"/><note time="2" string="3" fret="2"/></notes>
  <chords count="1"><chord time="4" chordId="1"/></chords>
  <handShapes count="2"><handShape chordId="0" startTime="1" endTime="2.5"/><handShape chordId="1" startTime="4" endTime="4.5"/></handShapes>
</level></levels></song>`;

test('Rocksmith arpeggio hand shapes are kept and drawn with their chord name', () => {
  const s = songFromRocksmithXml(ARP_XML, 'arp').song!;
  assert.deepEqual(s.shapes?.map((x) => [x.name, x.arpeggio, x.start, x.end]), [['Am', true, 1, 2.5], ['C', false, 4, 4.5]]);
  const chordEv = s.events.find((e) => e.kind === 'chord');
  assert.equal(chordEv && chordEv.kind === 'chord' && chordEv.name, 'C', 'template-only chord takes the template name and frets');
  assert.deepEqual(chordEv && chordEv.kind === 'chord' && chordEv.notes.map((n) => `${n.string}:${n.fret}`), ['1:3', '2:2', '3:0', '4:1', '5:0']);
  const r = draw(s, 0.5);
  assert.ok(r.texts.some((x) => x.text === 'Am arp.'), 'arpeggio name shown');
  assert.ok(!r.texts.some((x) => x.text === 'C arp.'), 'ordinary shapes are not labelled as arpeggios');
  // The open A (string 1) inside the Am arpeggio is drawn across the shape's frets (0–2), not the whole board.
  const atStrings = draw(s, 1);
  const openA = atStrings.boxes.find((b) => b.fill === STRING_COLORS[1])!;
  assert.ok(openA.w < W * 0.3, `open string in the arpeggio stays within its shape (${openA.w.toFixed(0)} px)`);
});
