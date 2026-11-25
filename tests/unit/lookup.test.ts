import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reverseChordLookup, shapePitches, findTuning, STANDARD_TUNING } from '@gma/theory';
import { chroma, activePitchClasses, matchChroma } from '@gma/audio';

test('reverse lookup names common shapes', () => {
  const open = (frets: (number | null)[]) => { const s = shapePitches(STANDARD_TUNING, frets); return reverseChordLookup(s.pcs, { bassPc: s.bassPc })[0]; };
  assert.equal(open([null, 3, 2, 0, 1, 0]).symbol, 'C');
  assert.equal(open([0, 2, 2, 0, 0, 0]).symbol, 'Em');
  assert.equal(open([null, 0, 2, 0, 2, 0]).symbol, 'A7');
  assert.equal(open([null, 0, 2, 2, 1, 0]).symbol, 'Am');
  assert.equal(open([3, 2, 0, 0, 0, 3]).symbol, 'G');
  assert.equal(open([null, null, 0, 2, 3, 2]).symbol, 'D');
  assert.equal(open([0, 2, 2, 1, 0, 0]).symbol, 'E');
  const cOverE = open([0, 3, 2, 0, 1, 0]);
  assert.equal(cOverE.symbol, 'C/E');
  assert.equal(cOverE.inversion, '1st inversion');
  assert.equal(open([null, 0, 2, 0, 1, 0]).symbol, 'Am7');
  assert.equal(open([null, 0, 2, 1, 2, 0]).symbol, 'Amaj7');
  assert.equal(open([1, 3, 3, 2, 1, 1]).symbol, 'F');
  assert.equal(open([null, 5, 7, 7, null, null]).symbol, 'D5');
});

test('reverse lookup gives alternatives and handles ambiguity', () => {
  // C E G A: C6 and Am7/C are the same notes.
  const r = reverseChordLookup([0, 4, 7, 9], { bassPc: 0 });
  const names = r.map((c) => c.symbol);
  assert.ok(names.includes('C6'));
  assert.ok(names.includes('Am7/C'));
  assert.equal(r[0].symbol, 'C6');
  // Tokens report each note's function.
  assert.deepEqual(r[0].tokens.map((t) => t.token).sort(), ['1', '3', '5', '6']);
  // Rootless voicing: E G B D over C is Cmaj9 without root, only when allowed.
  assert.ok(!reverseChordLookup([4, 7, 11, 2]).some((c) => c.rootless));
  assert.ok(reverseChordLookup([4, 11, 2, 9], { allowRootless: true, max: 40 }).some((c) => c.rootless));
  assert.equal(reverseChordLookup([0]).length, 0);
});

test('reverse lookup works in other tunings', () => {
  const dropD = findTuning('drop-d')!;
  const s = shapePitches(dropD, [0, 0, 0, null, null, null]);
  assert.equal(reverseChordLookup(s.pcs, { bassPc: s.bassPc })[0].symbol, 'D5');
});

function tone(freqs: number[], sr = 48000, n = 8192) {
  const out = new Float32Array(n);
  for (const f of freqs) for (let h = 1; h <= 4; h++) for (let i = 0; i < n; i++) out[i] += (0.3 / h) * Math.sin(2 * Math.PI * f * h * (i / sr));
  return out;
}
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

test('chroma recognises a strummed chord and rejects the wrong one', () => {
  const cMajor = tone([48, 52, 55, 60, 64].map(hz)); // C3 E3 G3 C4 E4
  const c = chroma(cMajor, 48000);
  assert.deepEqual(activePitchClasses(c, 0.5).sort((a, b) => a - b), [0, 4, 7]);
  assert.ok(matchChroma(c, [0, 4, 7]).matched, 'C major matches');
  assert.ok(!matchChroma(c, [2, 6, 9]).matched, 'D major does not');
  assert.ok(!matchChroma(c, [9, 1, 4]).matched, 'A major does not');
  assert.equal(chroma(new Float32Array(8192), 48000).every((v) => v === 0), true, 'silence is all zero');
});
