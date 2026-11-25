import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHORDS, CHORD_FORMULAS, STANDARD_TUNING_MIDI, buildArpeggioPositions, buildFullNeckArpeggio, generateVoicings, intervalLabel,
  mod12, pitchClassToName, reverseLookupFrets, toDiagramVoicing,
} from '@gma/theory';

const F = (id: string) => CHORD_FORMULAS.find((f) => f.id === id)!;
const shape = (frets: (number | null)[]) => frets.map((f) => (f === null ? 'x' : f)).join('-');

test('CHORD_FORMULAS mirrors the chord catalog in semitones', () => {
  assert.equal(CHORD_FORMULAS.length, CHORDS.length);
  assert.deepEqual(F('maj').intervals, [0, 4, 7]);
  assert.deepEqual(F('m7b5').intervals, [0, 3, 6, 10]);
  assert.deepEqual(F('13').intervals, [0, 4, 7, 10, 14, 17, 21], 'extensions stay compound');
  assert.deepEqual(F('9').optional, [7], 'the 5th may be omitted');
  assert.equal(F('add9').category, 'added');
  assert.ok(F('maj').priority > F('aug').priority);
  assert.equal(pitchClassToName(10, true), 'Bb');
  assert.equal(pitchClassToName(-2), 'A#');
  assert.equal(mod12(-1), 11);
  assert.equal(intervalLabel(10), 'b7');
  assert.equal(intervalLabel(14, true), '9');
  assert.equal(intervalLabel(15, true), '#9');
});

test('generateVoicings: common shapes, slash bass, filters', () => {
  const c = generateVoicings(0, F('maj'));
  assert.equal(shape(c[0].frets), 'x-3-2-0-1-0', 'open C first');
  const g = generateVoicings(7, F('maj'), { filter: 'open' }).map((v) => shape(v.frets));
  assert.ok(g.includes('3-2-0-0-0-3'), 'open G');
  const f = generateVoicings(5, F('maj'), { filter: 'barre' });
  assert.equal(shape(f[0].frets), '1-3-3-2-1-1');
  assert.equal(f[0].barreFret, 1);
  for (const v of generateVoicings(0, F('maj'), { bassPc: 4 })) assert.equal(v.bassPc, 4, 'C/E: E is the lowest note');
  for (const v of generateVoicings(9, F('m7'), { filter: 'triad' })) assert.equal(v.frets.filter((x) => x !== null).length, 3);
  for (const v of generateVoicings(4, F('7#9'), { filter: 'shell' })) { const n = v.frets.filter((x) => x !== null).length; assert.ok(n >= 3 && n <= 4); }
  assert.ok(generateVoicings(4, F('7#9')).some((v) => shape(v.frets) === 'x-7-6-7-8-x'), 'the Hendrix chord');
});

test('generateVoicings: the bass is the lowest pitch, not the lowest string', () => {
  // x-x-0-12-x-x: open D (D3) under G-string fret 12 (G4); D is the bass even though both strings are higher.
  for (const v of generateVoicings(2, F('5'))) assert.equal(mod12(Math.min(...v.midiNotes)), 2);
  // Every voicing contains each required tone and only chord tones.
  const tones = new Set(F('m7').intervals.map((i) => mod12(9 + i)));
  for (const v of generateVoicings(9, F('m7'))) {
    for (const m of v.midiNotes) assert.ok(tones.has(mod12(m)));
    for (const req of [9, 0, 7]) assert.ok(v.midiNotes.some((m) => mod12(m) === req), `${shape(v.frets)} has ${req}`);
  }
});

test('generateVoicings works in other tunings and on 7 strings', () => {
  const dropD = [38, 45, 50, 55, 59, 64];
  assert.ok(generateVoicings(2, F('5'), { tuning: dropD }).some((v) => shape(v.frets) === '0-0-0-x-x-x' || shape(v.frets).startsWith('0-0-0')), 'one-finger D5 in drop D');
  const seven = [35, 40, 45, 50, 55, 59, 64];
  assert.ok(generateVoicings(11, F('m'), { tuning: seven }).length > 0);
});

test('reverseLookupFrets names shapes, inversions and omitted tones', () => {
  const name = (fr: (number | null)[], flat = false) => reverseLookupFrets(fr, STANDARD_TUNING_MIDI, flat)[0]?.name;
  assert.equal(name([null, 3, 2, 0, 1, 0]), 'C');
  assert.equal(name([null, 0, 2, 2, 1, 0]), 'Am');
  assert.equal(name([0, 2, 0, 1, 0, 0]), 'E7');
  assert.equal(name([null, 3, 2, 2, 1, null]), 'Am/C');
  assert.equal(name([null, null, 0, 3, 1, 1], true), 'Bbadd9/D');
  assert.equal(name([null, 7, 6, 7, 8, null]), 'E7#9 (no 5)');
  const all = reverseLookupFrets([null, 3, 2, 2, 1, null]).map((m) => m.name);
  assert.ok(all.includes('C6 (no 5)'), 'enharmonic reading listed too');
  assert.equal(new Set(all).size, all.length, 'no duplicate names');
  const m = reverseLookupFrets([null, 0, 2, 0, 1, 0])[0];
  assert.equal(m.name, 'Am7');
  assert.deepEqual(m.matchedIntervals.sort(), ['3', '5', 'R', 'b7'].sort().map((x) => (x === '3' ? 'b3' : x)).sort());
  assert.deepEqual(reverseLookupFrets([null, null, null, 2, null, null]), [], 'one note is not a chord');
});

test('arpeggios: full neck, CAGED positions and sweep order', () => {
  const nodes = buildFullNeckArpeggio(0, F('maj7'), STANDARD_TUNING_MIDI, 12);
  for (const n of nodes) assert.ok([0, 4, 7, 11].includes(mod12(n.midi)));
  assert.ok(nodes.find((n) => n.stringIndex === 1 && n.fret === 3)?.isRoot);
  assert.ok(nodes.filter((n) => n.isGuideTone).every((n) => ['3', '7'].includes(n.interval)));
  const pos = buildArpeggioPositions(0, F('maj7'));
  assert.deepEqual(pos.map((p) => p.shape), ['C', 'A', 'G', 'E', 'D']);
  for (const p of pos) {
    assert.ok(p.nodes.every((n) => n.fret >= p.minFret && n.fret <= p.maxFret));
    for (let i = 1; i < p.sweep.length; i++) {
      const a = p.sweep[i - 1], b = p.sweep[i];
      assert.ok(a.stringIndex < b.stringIndex || (a.stringIndex === b.stringIndex && a.fret < b.fret), 'sweep goes string by string, low to high');
    }
    assert.deepEqual(p.orderedMidi, [...p.orderedMidi].sort((x, y) => x - y));
  }
  // Non-standard intervals (open D): root-anchored windows instead of CAGED.
  const openD = buildArpeggioPositions(2, F('maj'), [38, 45, 50, 54, 57, 62]);
  assert.equal(openD.length, 5);
  assert.ok(openD.every((p) => !p.shape && p.maxFret - p.minFret === 4));
});

test('toDiagramVoicing labels intervals and the slash bass', () => {
  const v = generateVoicings(0, F('maj'), { bassPc: 4 })[0];
  const d = toDiagramVoicing(v, 0, F('maj'));
  assert.equal(d.inversion, 'E in the bass');
  assert.ok(d.tokens.filter(Boolean).every((t) => ['1', '3', '5'].includes(t!)));
});
