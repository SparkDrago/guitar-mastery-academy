import { test } from 'node:test';
import assert from 'node:assert/strict';
import { midiOfNote, songFromRocksmithXml, type PlaySong, type SongEvent, type SongNote } from '@gma/notation';
import { PlayScorer } from '@gma/learning';
import { drawHighway, techniqueTag } from '@/components/highway';

/** One note per technique, as Rocksmith arrangement XML writes them (times 1 s apart). */
const XML = `<?xml version="1.0"?>
<song><title>Tech</title><artistName>T</artistName><arrangement>Lead</arrangement><averageTempo>100</averageTempo><songLength>30</songLength>
<tuning string0="0" string1="0" string2="0" string3="0" string4="0" string5="0"/>
<chordTemplates count="1"><chordTemplate chordName="E5" displayName="E5" fret0="0" fret1="2" fret2="2" fret3="-1" fret4="-1" fret5="-1"/></chordTemplates>
<ebeats count="1"><ebeat time="0" measure="1"/></ebeats>
<levels count="1"><level difficulty="0"><notes count="15">
  <note time="1" string="3" fret="5" sustain="0" hammerOn="0" pullOff="0"/>
  <note time="2" string="3" fret="7" hammerOn="1"/>
  <note time="3" string="3" fret="5" pullOff="1"/>
  <note time="4" string="2" fret="7" sustain="1" bend="2"><bendValues count="2"><bendValue time="4" step="0"/><bendValue time="4.3" step="2"/></bendValues></note>
  <note time="5.5" string="2" fret="7" sustain="1" bend="2"><bendValues count="3"><bendValue time="5.5" step="2"/><bendValue time="6" step="2"/><bendValue time="6.4" step="0"/></bendValues></note>
  <note time="7" string="4" fret="8" sustain="1.5" vibrato="80"/>
  <note time="9" string="0" fret="0" palmMute="1"/>
  <note time="10" string="0" fret="3" mute="1"/>
  <note time="11" string="2" fret="5" sustain="1" slideTo="9" linkNext="1"/>
  <note time="12" string="2" fret="9" sustain="0.5"/>
  <note time="13" string="1" fret="5" harmonic="1"/>
  <note time="14" string="1" fret="7" harmonicPinch="1"/>
  <note time="15" string="3" fret="7" tremolo="1" sustain="1"/>
  <note time="17" string="3" fret="7" hopo="1"/>
  <note time="18" string="3" fret="5" hopo="1" accent="1" slideUnpitchTo="2" sustain="0.5"/>
</notes>
<chords count="1"><chord time="20" chordId="0" palmMute="1"><chordNote time="20" string="0" fret="0"/><chordNote time="20" string="1" fret="2"/><chordNote time="20" string="2" fret="2"/></chord></chords>
</level></levels></song>`;

const song = songFromRocksmithXml(XML, 'tech').song!;
const at = (time: number) => song.events.find((e) => Math.abs(e.time - time) < 1e-6)!;
const note = (time: number) => at(time) as SongNote;

test('Rocksmith techniques are read from note, chord and bend data', () => {
  assert.deepEqual(note(1).techniques, [], 'attributes set to 0 are off');
  assert.deepEqual(note(2).techniques, ['hammer']);
  assert.deepEqual(note(3).techniques, ['pull']);
  assert.deepEqual(note(4).techniques, ['bend']);
  assert.equal(note(4).bend, 2);
  assert.deepEqual(note(5.5).techniques, ['bend', 'prebend', 'release'], 'starts bent, lets the bend down');
  assert.deepEqual(note(7).techniques, ['vibrato']);
  assert.deepEqual(note(9).techniques, ['palmMute']);
  assert.deepEqual(note(10).techniques, ['dead']);
  assert.deepEqual(note(11).techniques, ['slideUp']);
  assert.equal(note(11).slideTo, 9);
  assert.equal(note(11).linkNext, true);
  assert.equal(note(12).tied, true, 'the note after linkNext is a continuation, not a new attack');
  assert.ok(!note(12).techniques.includes('letRing'), 'linkNext is not "let ring"');
  assert.deepEqual(note(13).techniques, ['harmonic']);
  assert.deepEqual(note(14).techniques, ['artificialHarmonic']);
  assert.deepEqual(note(15).techniques, ['tremolo']);
  assert.deepEqual(note(17).techniques, ['hammer'], 'hopo going up → hammer-on');
  assert.deepEqual(note(18).techniques.sort(), ['accent', 'pull', 'slideOut'].sort(), 'hopo going down → pull-off');
  const chord = at(20) as Extract<SongEvent, { kind: 'chord' }>;
  assert.equal(chord.name, 'E5');
  for (const n of chord.notes) assert.ok(n.techniques.includes('palmMute'), 'chord palm mute reaches every string');
});

test('natural harmonics sound their overtone, not the fretted pitch', () => {
  const s = { tuning: { name: 'E Standard', strings: [40, 45, 50, 55, 59, 64] }, capo: 0 };
  assert.equal(midiOfNote(s, { string: 1, fret: 5, techniques: ['harmonic'] }), 45 + 24, 'fret 5: two octaves above open A');
  assert.equal(midiOfNote(s, { string: 1, fret: 7, techniques: ['harmonic'] }), 45 + 19, 'fret 7: octave + fifth');
  assert.equal(midiOfNote(s, { string: 1, fret: 12, techniques: ['harmonic'] }), 57);
  assert.equal(midiOfNote(s, { string: 1, fret: 5, techniques: [] }), 50);
  assert.equal(midiOfNote({ ...s, capo: 2 }, { string: 1, fret: 7, techniques: ['harmonic'] }), 47 + 24, 'with a capo the nodes move with it');
});

test('scoring: harmonics, pinch harmonics, mutes, bends and hammer-ons', () => {
  const judge = (time: number, midi: number | null, level = 0.2) => {
    const sc = new PlayScorer(song, { from: time - 0.01, to: time + 0.01 });
    return sc.update({ time, midi, chroma: null, level }).some((j) => j.result === 'hit');
  };
  assert.ok(judge(13, 69), 'fret-5 harmonic on A = A4 (69)');
  assert.ok(!judge(13, 50), 'the fretted pitch is not the harmonic');
  assert.ok(judge(14, 52 + 12) && judge(14, 52 + 19) && !judge(14, 52 + 4), 'pinch harmonic: octave or fifth overtone of the fretted note');
  assert.ok(judge(10, null), 'a muted note only needs a sound');
  assert.ok(judge(4, 57 + 1.2), 'a bend may be heard on its way up');
  assert.ok(judge(2, 62), 'hammer-ons are judged by pitch, no pick attack needed');
});

test('technique marks above gems', () => {
  const tag = (time: number) => techniqueTag(note(time));
  assert.equal(tag(2), 'H');
  assert.equal(tag(3), 'P');
  assert.equal(tag(4), '↑full');
  assert.equal(tag(5.5), 'pb↑full↓');
  assert.equal(tag(7), '~');
  assert.equal(tag(9), 'PM');
  assert.equal(tag(10), '', 'mute is shown by the gem (×), not a tag');
  assert.equal(tag(11), '↗9');
  assert.equal(tag(14), 'PH');
  assert.equal(tag(15), '≋');
  assert.equal(tag(18), 'P ↘out');
  assert.equal(techniqueTag({ ...note(4), bend: 1 }), '↑½');
  const chord = at(20) as Extract<SongEvent, { kind: 'chord' }>;
  assert.equal(techniqueTag(chord.notes[1], ['palmMute']), '', 'a chord-wide palm mute is not repeated on each gem');
});

// ---------- drawing ----------
function recorder() {
  const texts: { text: string; x: number; y: number }[] = [], polys: number[][][] = [], strokes: number[][][] = [];
  let path: number[][] = [];
  const g: Record<string, unknown> = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'center', globalAlpha: 1, shadowColor: '', shadowBlur: 0, lineCap: 'butt',
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {}, closePath() {}, save() {}, restore() {}, setLineDash() {}, strokeRect() {}, arcTo() {},
    beginPath() { path = []; },
    moveTo(x: number, y: number) { path.push([x, y]); },
    lineTo(x: number, y: number) { path.push([x, y]); },
    fill() { polys.push(path.slice()); },
    stroke() { strokes.push(path.slice()); },
    fillText(text: string, x: number, y: number) { texts.push({ text, x, y }); },
  };
  return { g: g as unknown as CanvasRenderingContext2D, texts, polys, strokes };
}
const W = 900, H = 320;
const draw = (s: PlaySong, t: number) => {
  const r = recorder();
  drawHighway(r.g, W, H, { song: s, t, lookahead: 3, cam: { lo: 0, hi: 12 }, status: () => 'pending', lowOnTop: true, leftHanded: false, flashes: new Map(), indexOf: new Map(s.events.map((e, i) => [e, i])) });
  return r;
};
const only = (time: number): PlaySong => ({ ...song, events: [at(time)], shapes: undefined, beats: [] });

test('highway draws each technique', () => {
  // Muted note: × instead of the fret number.
  const mute = draw(only(10), 9.6);
  assert.ok(mute.texts.some((x) => x.text === '×') && !mute.texts.some((x) => x.text === '3' && x.y < H * 0.9));
  // Palm-muted open string still gets its PM mark.
  assert.ok(draw(only(9), 8.6).texts.some((x) => x.text === 'PM'));
  // Chord palm mute: once, next to the name.
  const pm = draw(only(20), 19.4);
  assert.ok(pm.texts.some((x) => x.text === 'E5 · PM'));
  assert.equal(pm.texts.filter((x) => x.text === 'PM').length, 0);
  // Harmonic: diamond (4-point polygon) gem.
  assert.ok(draw(only(13), 12.6).polys.some((p) => p.length === 4 && Math.abs(p[0][0] - p[2][0]) < 0.01));
  // Slide: the tail ends over the target fret (9), right of where it starts (5).
  const slide = draw(only(11), 11);
  const tail = slide.strokes.filter((p) => p.length === 2);
  assert.ok(tail.length > 20, 'tail drawn');
  assert.ok(tail[tail.length - 1][1][0] > tail[0][0][0] + 100, 'slide tail travels toward fret 9');
  // Vibrato: the tail waves left and right.
  const vib = draw(only(7), 7).strokes.filter((p) => p.length === 2);
  const dx = vib.map((p) => p[1][0] - p[0][0]);
  assert.ok(dx.some((d) => d > 0.5) && dx.some((d) => d < -0.5), 'vibrato tail changes direction');
  // Bend: the tail rises as the bend goes up.
  const bend = draw(only(4), 4).strokes.filter((p) => p.length === 2);
  const straight = draw({ ...only(4), events: [{ ...note(4), kind: 'note', techniques: [], bend: undefined, bendCurve: undefined }] }, 4).strokes.filter((p) => p.length === 2);
  assert.ok(bend[bend.length - 1][1][1] < straight[straight.length - 1][1][1] - 2, 'bent tail sits above an unbent one');
  const lifts = bend.map((b, i) => straight[i][1][1] - b[1][1]);
  assert.ok(Math.max(...lifts) > 5, 'clearly lifted once the bend reaches full');
  assert.ok(lifts[0] < 0.5, 'starts unbent');
});
