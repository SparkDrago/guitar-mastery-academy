import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLengths, estimateOffset, onsetEnvelope } from '@gma/audio';

const SR = 11025;

/** Plucks (decaying noise bursts) at the given audio times over a quiet noise floor. */
function render(times: number[], seconds: number, seed = 1): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  let s = seed;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < out.length; i++) out[i] = rnd() * 0.01;
  for (const t of times) {
    const at = Math.round(t * SR);
    for (let k = 0; k < SR * 0.25 && at + k < out.length; k++) if (at + k >= 0) out[at + k] += rnd() * 0.6 * Math.exp(-k / (SR * 0.05));
  }
  return out;
}

// An irregular rhythm so only one shift lines up.
const chart: number[] = [];
for (let i = 0, t = 2, s = 7; i < 80; i++) { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; t += 0.2 + (s % 1000) / 2500; chart.push(t); }

test('finds a recording that starts late (notes would be early)', () => {
  const shift = 0.42; // chart time = audio time + offset → audio time = chart time − offset
  const audio = render(chart.map((t) => t - shift), 40);
  const env = onsetEnvelope(audio, SR, 0.01);
  const r = estimateOffset(env, 0.01, chart);
  assert.equal(r.method, 'onsets');
  assert.ok(Math.abs(r.offset - shift) <= 0.02, `offset ${r.offset}`);
  assert.ok(r.confidence > 4);
});

test('keeps the chart timing when it already lines up', () => {
  const env = onsetEnvelope(render(chart, 40), SR, 0.01);
  const r = estimateOffset(env, 0.01, chart);
  assert.equal(r.method, 'chart');
  assert.equal(r.offset, 0);
});

test('reports no match on unrelated audio', () => {
  const env = onsetEnvelope(render([], 40), SR, 0.01);
  const r = estimateOffset(env, 0.01, chart);
  assert.equal(r.method, 'none');
  assert.equal(r.offset, 0);
});

test('length check', () => {
  assert.equal(checkLengths(200.2, 200, 190).verdict, 'match');
  assert.equal(checkLengths(203, 200, 190).verdict, 'close');
  assert.equal(checkLengths(30, 200, 190).verdict, 'mismatch');
  assert.equal(checkLengths(undefined, 200, 190).verdict, 'unknown');
});

test('a strictly periodic riff is flagged as ambiguous and resolves to the smallest matching shift', () => {
  const riff = Array.from({ length: 64 }, (_, i) => 2 + i * 0.25);
  const env = onsetEnvelope(render(riff.map((t) => t - 0.3), 24), SR, 0.01);
  const r = estimateOffset(env, 0.01, riff);
  assert.equal(r.ambiguous, true);
  assert.ok(Math.abs(r.offset - 0.05) <= 0.02, `offset ${r.offset} (${r.method})`);
});
