import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlayScorer, multiplierFor } from '@gma/learning';
import type { PlaySong } from '@gma/notation';

const song: PlaySong = {
  format: 'gma-song', version: 1, id: 't', title: 'T', artist: '', arrangement: 'Lead', tuning: { name: 'E', strings: [40, 45, 50, 55, 59, 64] }, capo: 0,
  duration: 10, averageTempo: 120, beats: [], source: 'tab',
  sections: [{ name: 'A', start: 0, end: 3 }, { name: 'B', start: 3, end: 10 }],
  events: [
    { kind: 'note', time: 1, string: 0, fret: 0, sustain: 0, techniques: [] },            // E2 = 40
    { kind: 'note', time: 2, string: 1, fret: 2, sustain: 0, techniques: [] },            // B2 = 47
    { kind: 'chord', time: 4, name: 'G', sustain: 0, techniques: [], notes: [ { time: 4, string: 0, fret: 3, sustain: 0, techniques: [] }, { time: 4, string: 1, fret: 2, sustain: 0, techniques: [] }, { time: 4, string: 2, fret: 0, sustain: 0, techniques: [] } ] }, // G B D
    { kind: 'note', time: 5, string: 2, fret: 7, sustain: 0.5, techniques: ['bend'], bend: 2 }, // A3 = 57, bends to 59
  ],
};
const chromaOf = (pcs: number[]) => { const c = new Array(12).fill(0.05); pcs.forEach((p) => (c[p] = 1)); return c; };

test('scorer judges notes, chords, bends and timing windows', () => {
  const s = new PlayScorer(song);
  assert.equal(s.update({ time: 0.5, midi: 40, chroma: null, level: 0.2 }).length, 0, 'too early to count');
  const j1 = s.update({ time: 1.05, midi: 40.1, chroma: null, level: 0.2 });
  assert.equal(j1[0].result, 'hit');
  assert.equal(j1[0].errorMs, 50);
  assert.equal(s.update({ time: 2.02, midi: 48, chroma: null, level: 0.2 }).length, 0, 'wrong pitch is not a hit');
  const expired = s.update({ time: 2.5, midi: null, chroma: null, level: 0 });
  assert.deepEqual(expired.map((j) => [j.index, j.result]), [[1, 'miss']]);
  assert.equal(s.update({ time: 4.0, midi: null, chroma: chromaOf([0, 4, 9]), level: 0.3 }).length, 0, 'Am chroma does not match G');
  assert.equal(s.update({ time: 4.1, midi: null, chroma: chromaOf([7, 11, 2]), level: 0.3 })[0].result, 'hit');
  assert.equal(s.update({ time: 5.1, midi: 58.6, chroma: null, level: 0.3 })[0].result, 'hit', 'pitch inside the bend range');
  const sum = s.summary;
  assert.equal(sum.hits, 3);
  assert.equal(sum.misses, 1);
  assert.equal(sum.bestStreak, 2);
  assert.deepEqual(sum.sections.map((x) => [x.hits, x.total]), [[1, 2], [2, 2]]);
  assert.ok(Math.abs(sum.accuracy - 0.75) < 1e-9);
});

test('scorer gate, octave leniency, ranges and finish', () => {
  const quiet = new PlayScorer(song);
  assert.equal(quiet.update({ time: 1, midi: 40, chroma: null, level: 0.001 }).length, 0, 'below the noise gate');
  const strict = new PlayScorer(song);
  assert.equal(strict.update({ time: 1, midi: 52, chroma: null, level: 0.2 }).length, 0);
  const easy = new PlayScorer(song, { anyOctave: true });
  assert.equal(easy.update({ time: 1, midi: 52, chroma: null, level: 0.2 })[0].result, 'hit');
  const loop = new PlayScorer(song, { from: 3, to: 10 });
  assert.equal(loop.summary.total, 2);
  assert.equal(loop.finish().length, 2);
  assert.equal(loop.summary.misses, 2);
  assert.deepEqual([0, 9, 10, 25, 31].map(multiplierFor), [1, 1, 2, 3, 4]);
});

import { SessionFollower } from '@gma/learning';

test('session follower: busy playing raises density, silence makes the band wait', () => {
  const f = new SessionFollower({ waitAfter: 2 });
  let st = f.update({ time: 0, level: 0 });
  // 8 attacks per second for 6 seconds
  for (let k = 1; k < 240; k++) st = f.update({ time: k * 0.025, level: k % 5 === 0 ? 0.2 : 0.02 }); // 8 attacks/s
  assert.equal(st.density, 3);
  assert.ok(st.notesPerSecond > 6);
  assert.equal(st.waiting, false);
  for (let k = 0; k < 60; k++) st = f.update({ time: 6 + k * 0.05, level: 0.001 });
  assert.equal(st.waiting, true);
  assert.equal(st.density, 1);
  // Moderate playing settles in the middle; sparse, soft playing thins the band out.
  const run = (every: number, level: number) => { const g = new SessionFollower({ waitAfter: 4 }); let x = g.update({ time: 0, level: 0 }); for (let k = 1; k < 400; k++) x = g.update({ time: k * 0.025, level: k % every === 0 ? level : 0.01 }); return x; };
  assert.equal(run(10, 0.08).density, 2); // 4 attacks/s
  const sparse = run(40, 0.04); // 1 soft attack/s
  assert.equal(sparse.density, 1);
  assert.equal(sparse.waiting, false);
});
