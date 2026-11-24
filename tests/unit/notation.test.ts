import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyScore, validateScore, toPlayback, toAscii, parseAscii, beatLength, measureLength, monophonicPitches, onsetBeats, cloneScore, toJson, type TabScore } from '@gma/notation';

function sample(): TabScore {
  const s = emptyScore([40, 45, 50, 55, 59, 64], 'E Standard', 'Test riff');
  s.measures = [
    { repeatStart: true, beats: [
      { duration: 8, notes: [{ string: 0, fret: 0, techniques: ['palmMute'] }] },
      { duration: 8, notes: [{ string: 0, fret: 0, techniques: ['palmMute'] }] },
      { duration: 8, notes: [{ string: 1, fret: 5 }] },
      { duration: 8, notes: [{ string: 1, fret: 7, techniques: ['hammer'] }] },
      { duration: 4, notes: [{ string: 2, fret: 7, techniques: ['bend', 'vibrato'], bend: 1 }] },
      { duration: 4, notes: [{ string: 0, fret: 3 }, { string: 1, fret: 5 }, { string: 2, fret: 5 }], chord: 'G5' },
    ], repeatEnd: 2 },
    { beats: [
      { duration: 8, notes: [{ string: 3, fret: 9 }] },
      { duration: 8, notes: [{ string: 3, fret: 7, techniques: ['pull'] }] },
      { duration: 8, notes: [{ string: 4, fret: 5 }] },
      { duration: 8, notes: [{ string: 4, fret: 7, techniques: ['slideUp'] }] },
      { duration: 4, notes: [{ string: 5, fret: 12, techniques: ['harmonic'] }] },
      { duration: 4, notes: [{ string: 0, fret: 0, techniques: ['dead'] }] },
    ] },
  ];
  return s;
}

test('model: durations and validation', () => {
  assert.equal(beatLength({ duration: 4 }), 1);
  assert.equal(beatLength({ duration: 8, dotted: true }), 0.75);
  assert.ok(Math.abs(beatLength({ duration: 8, triplet: true }) - 1 / 3) < 1e-9);
  const s = sample();
  assert.equal(measureLength(s.measures[0]), 4);
  assert.deepEqual(validateScore(s).filter((i) => i.level === 'error'), []);
  const bad = cloneScore(s);
  bad.measures[0].beats[0].notes[0].string = 7;
  assert.ok(validateScore(bad).some((i) => /does not exist on a 6-string/.test(i.message)));
  const long = cloneScore(s);
  long.measures[1].beats.push({ duration: 4, notes: [] });
  assert.ok(validateScore(long).some((i) => i.level === 'warning' && /too long/.test(i.message)));
  assert.ok(validateScore({ format: 'nope' }).some((i) => i.level === 'error'));
  const seven = emptyScore([35, 40, 45, 50, 55, 59, 64], '7-string');
  seven.measures[0].beats.push({ duration: 4, notes: [{ string: 6, fret: 3 }] });
  assert.deepEqual(validateScore(seven).filter((i) => i.level === 'error'), []);
});

test('model: playback expands repeats and computes pitches', () => {
  const s = sample();
  const notes = toPlayback(s);
  assert.equal(notes.filter((n) => n.measure === 0).length, 16, 'first measure played twice');
  assert.equal(notes[0].midi, 40);
  assert.equal(notes.find((n) => n.string === 5)!.midi, 76);
  const mono = monophonicPitches(s);
  assert.equal(mono[2], 50);
  const onsets = onsetBeats(s);
  assert.ok(!onsets.includes(1.5), 'hammer-on is not a picked onset');
});

test('ASCII: export contains technique symbols and round-trips through import', () => {
  const s = sample();
  const txt = toAscii(s);
  assert.match(txt, /e\|/);
  assert.match(txt, /5-*h7/);
  assert.match(txt, /7b9~/);
  assert.match(txt, /9-*p7/);
  assert.match(txt, /5-*\/7/);
  assert.match(txt, /<12>/);
  assert.match(txt, /PM/);
  assert.match(txt, /x2/);
  const back = parseAscii(txt, s.tuning, 'Round trip');
  assert.deepEqual(back.errors, []);
  assert.ok(back.score);
  const flat = (sc: TabScore) => sc.measures.flatMap((m) => m.beats.map((b) => b.notes.map((n) => `${n.string}:${n.fret}:${(n.techniques ?? []).filter((t) => t !== 'palmMute').sort().join('+')}`).join(',')));
  assert.deepEqual(flat(back.score!), flat(s));
  const bendNote = back.score!.measures[0].beats[4].notes[0];
  assert.equal(bendNote.bend, 1);
  assert.ok(back.score!.measures[0].beats[0].notes[0].techniques?.includes('palmMute'), 'PM row restored');
  assert.ok(back.warnings.some((w) => /rhythm/.test(w)));
});

test('ASCII: imports typical internet tab and infers durations from spacing', () => {
  const txt = [
    'e|-----------------|-----------------|',
    'B|-----------------|-----------------|',
    'G|-----------------|-----------------|',
    'D|-------2---------|-----------------|',
    'A|---0-------3-----|-----2---0-------|',
    'E|-----------------|-0-----------3---|',
  ].join('\n');
  const r = parseAscii(txt);
  assert.deepEqual(r.errors, []);
  assert.equal(r.score!.measures.length, 2);
  assert.equal(r.score!.measures[0].beats.length, 3);
  assert.equal(r.score!.tuning.name, 'E Standard');
  assert.ok(r.warnings.some((w) => /assumed/.test(w)));
  const m0 = r.score!.measures[0].beats.map((b) => b.notes[0].string + ':' + b.notes[0].fret);
  assert.deepEqual(m0, ['1:0', '2:2', '1:3']);
});

test('ASCII: rejects mismatched string counts and non-tab text', () => {
  assert.ok(parseAscii('hello world').errors.length > 0);
  const sevenLines = Array.from({ length: 7 }, () => '|---3---|').join('\n');
  const r = parseAscii(sevenLines, { name: 'E Standard', strings: [40, 45, 50, 55, 59, 64] });
  assert.ok(r.errors.some((e) => /7 string lines/.test(e)));
  const ok7 = parseAscii(sevenLines);
  assert.equal(ok7.score!.tuning.strings.length, 7);
});

test('JSON: native format survives serialisation', () => {
  const s = sample();
  const back = JSON.parse(toJson(s));
  assert.deepEqual(back, s);
  assert.deepEqual(validateScore(back).filter((i) => i.level === 'error'), []);
});
