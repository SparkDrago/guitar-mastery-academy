import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bytesSource, classify, convertWem, inspectWem, runImport, WemUnsupportedError, type ImportInput } from '@gma/importer';
import { buildPsarc, riffWave } from '../helpers/psarc-builder';
import { encodeWwiseIma, sine, SR, wem } from '../helpers/wem-builder';

const wavSamples = (wav: Uint8Array) => {
  const info = inspectWem(wav)!;
  const dv = new DataView(wav.buffer, wav.byteOffset + info.dataOffset, info.dataLength);
  return { info, s: Int16Array.from({ length: info.dataLength / 2 }, (_, i) => dv.getInt16(i * 2, true)) };
};

test('PCM .wem (with extra Wwise chunk) becomes a canonical WAV', () => {
  const pcm = sine(480, 440);
  const raw = new Uint8Array(pcm.buffer.slice(0));
  const r = convertWem(wem(1, 1, 2, 16, raw));
  assert.equal(r.mime, 'audio/wav');
  assert.equal(r.codec, 'PCM');
  assert.equal(r.bytes.byteLength, 44 + raw.length);
  const { info, s } = wavSamples(r.bytes);
  assert.equal(info.dataOffset, 44);
  assert.equal(info.sampleRate, SR);
  assert.deepEqual(Array.from(s), Array.from(pcm));
});

test('Wwise extensible PCM and big-endian RIFX PCM are handled', () => {
  const pcm = sine(100, 300);
  const le = new Uint8Array(pcm.buffer.slice(0));
  assert.equal(convertWem(wem(0, 1, 2, 16, le, { extensible: true })).codec, 'PCM');
  const be = new Uint8Array(le.length);
  for (let i = 0; i < le.length; i += 2) { be[i] = le[i + 1]; be[i + 1] = le[i]; }
  const { s } = wavSamples(convertWem(wem(1, 1, 2, 16, be, { be: true })).bytes);
  assert.deepEqual(Array.from(s), Array.from(pcm));
});

test('Wwise IMA ADPCM decodes to a WAV that tracks the source signal', () => {
  const sub = 36; // 65 samples per channel per block
  const left = sine(65 * 40, 440), right = sine(65 * 40, 660, 8000);
  const enc = encodeWwiseIma([left, right], sub);
  const r = convertWem(wem(2, 2, sub * 2, 4, enc));
  assert.equal(r.codec, 'Wwise IMA ADPCM');
  const { info, s } = wavSamples(r.bytes);
  assert.equal(info.channels, 2);
  assert.equal(s.length, 65 * 40 * 2);
  let errL = 0, errR = 0;
  for (let i = 0; i < left.length; i++) { errL += Math.abs(s[i * 2] - left[i]); errR += Math.abs(s[i * 2 + 1] - right[i]); }
  // Interleaving and nibble order are right only if both channels stay close to their own source.
  assert.ok(errL / left.length < 300, `left mean error ${errL / left.length}`);
  assert.ok(errR / right.length < 300, `right mean error ${errR / right.length}`);
  assert.equal(s[0], left[0]);
  assert.equal(s[1], right[0]);
});

test('Wwise Vorbis is recognised and explained, not mangled', () => {
  assert.throws(() => convertWem(riffWave(0xffff)), (e: unknown) => e instanceof WemUnsupportedError && e.codec === 'Wwise Vorbis' && /vgmstream/.test(e.message));
  assert.throws(() => convertWem(riffWave(0x3040)), (e: unknown) => e instanceof WemUnsupportedError && e.codec === 'Wwise Opus');
  assert.throws(() => convertWem(new Uint8Array(64)), /Not a Wwise/);
});

test('importer converts .wem audio inside a package and keeps it with the song', async () => {
  const demo = (await import('node:fs')).readFileSync(new URL('../fixtures/demo-arrangement.xml', import.meta.url), 'utf8');
  const pcm = new Uint8Array(sine(SR, 220).buffer.slice(0));
  const pkg = buildPsarc([
    { path: 'songs/arr/demoriff_lead.xml', data: demo },
    { path: 'audio/windows/111.wem', data: wem(1, 1, 2, 16, pcm) },
    { path: 'audio/windows/222.wem', data: riffWave(0xffff) },
  ]);
  const input: ImportInput = { id: 'p', name: 'demo_p.psarc', path: 'demo_p.psarc', size: pkg.byteLength, source: bytesSource(pkg) };
  const res = await runImport([input]);
  const entries = res.files[0].entries ?? [];
  const e111 = entries.find((e) => e.path.endsWith('111.wem'))!;
  const e222 = entries.find((e) => e.path.endsWith('222.wem'))!;
  assert.equal(e111.status, 'imported');
  assert.match(e111.detail, /PCM converted to WAV/);
  assert.equal(e222.status, 'unsupported');
  assert.match(e222.detail, /Wwise Vorbis/);
  assert.equal(res.audio.length, 1);
  assert.equal(res.audio[0].name, '111.wav');
  assert.equal(res.audio[0].mime, 'audio/wav');
  assert.equal(res.songs[0].audioKey, res.audio[0].key);
  assert.equal(classify('x.wem', new Uint8Array(0)).role, 'wwise-audio');
});
