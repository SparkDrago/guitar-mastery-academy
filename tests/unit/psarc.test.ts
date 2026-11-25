import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bytesSource, checkArchivePath, classify, openPsarc, parsePsarcHeader, runImport, type ImportInput } from '@gma/importer';
import { buildPsarc, fakeOgg, riffWave } from '../helpers/psarc-builder';

const demo = fs.readFileSync(new URL('../fixtures/demo-arrangement.xml', import.meta.url), 'utf8');
const arrXml = (arr: string, extra = '') => demo.replace('<arrangement>Lead</arrangement>', `<arrangement>${arr}</arrangement>${extra}`);
const input = (name: string, bytes: Uint8Array, path = name): ImportInput => ({ id: name, name, path, size: bytes.byteLength, source: bytesSource(bytes) });

const manifest = (arr: string) => JSON.stringify({ Entries: { ABC: { Attributes: { SongName: 'Demo Riff', ArtistName: 'GMA Band', AlbumName: 'Fixtures', SongYear: 2026, ArrangementName: arr, SongKey: 'demoriff', SongLength: 16 } } } });

function songPackage(opts: Parameters<typeof buildPsarc>[1] = {}) {
  return buildPsarc([
    { path: 'songs/arr/demoriff_lead.xml', data: arrXml('Lead', '<albumArt>urn:image:dds:album_demoriff</albumArt>') },
    { path: 'songs/arr/demoriff_bass.xml', data: arrXml('Bass').replace(/string5="0"/, 'string5="0"') },
    { path: 'songs/arr/demoriff_vocals.xml', data: '<?xml version="1.0"?><vocals count="0"></vocals>' },
    { path: 'manifests/songs_dlc_demoriff/demoriff_lead.json', data: manifest('Lead') },
    { path: 'audio/windows/demoriff.ogg', data: fakeOgg(200_000) },
    { path: 'audio/windows/demoriff_preview.ogg', data: fakeOgg(20_000) },
    { path: 'audio/windows/12345.wem', data: riffWave(0xffff) },
    { path: 'audio/windows/song_demoriff.bnk', data: Buffer.from('BKHD0000') },
    { path: 'songs/bin/generic/demoriff_lead.sng', data: Buffer.from([0x4a, 0, 0, 0, 3, 0, 0, 0, 1, 2, 3]) },
    { path: 'gfxassets/album_art/album_demoriff_256.dds', data: Buffer.from('DDS 0000') },
    { path: 'appid.appid', data: '248750' },
  ], opts);
}

test('header is parsed and validated', () => {
  const b = songPackage();
  const h = parsePsarcHeader(b.subarray(0, 32), b.byteLength);
  assert.equal(h.version, '1.4');
  assert.equal(h.compression, 'zlib');
  assert.equal(h.entryCount, 12);
  assert.equal(h.blockSize, 65536);
  assert.throws(() => parsePsarcHeader(new Uint8Array(32), 100), /signature/);
  const bad = b.slice(0, 32); new DataView(bad.buffer).setUint32(12, 10_000_000);
  assert.throws(() => parsePsarcHeader(bad, b.byteLength), /does not fit/);
});

for (const compression of ['zlib', 'lzma', 'none'] as const) {
  test(`unencrypted ${compression} archive: entries read back byte-exact across blocks`, async () => {
    const big = new Uint8Array(150_000).map((_, i) => (i * 7919) % 251);
    const b = buildPsarc([{ path: 'a/one.txt', data: 'hello' }, { path: 'b/big.bin', data: big }, { path: 'c/empty', data: '' }], { compression, blockSize: 65536 });
    const a = await openPsarc(bytesSource(b));
    assert.equal(a.encrypted, false);
    assert.deepEqual(a.files.map((f) => f.path), ['a/one.txt', 'b/big.bin', 'c/empty']);
    assert.ok(a.files.every((f) => f.hashOk === true));
    assert.equal(new TextDecoder().decode(await a.read(a.files[0])), 'hello');
    assert.deepEqual(await a.read(a.files[1]), big);
    assert.equal((await a.read(a.files[2])).byteLength, 0);
    assert.ok(a.components.every((c) => c.state === 'ok'), JSON.stringify(a.components));
  });
}

test('encrypted table of contents: each component gets an explicit status, nothing decrypted', async () => {
  const b = songPackage({ encryptedToc: true });
  const a = await openPsarc(bytesSource(b));
  assert.equal(a.encrypted, true);
  assert.deepEqual(a.files, []);
  const state = Object.fromEntries(a.components.map((c) => [c.id, c.state]));
  assert.deepEqual(state, { header: 'ok', compression: 'ok', toc: 'unsupported', blocks: 'unavailable', manifest: 'unavailable', data: 'unavailable' });
  await assert.rejects(() => a.read({ index: 1, nameHash: '', firstBlock: 0, size: 1, offset: 100 }), /encrypted/);
});

test('integrity: bad name hash is a warning, truncated data is reported per entry', async () => {
  const a = await openPsarc(bytesSource(songPackage({ badHashAt: 2 })));
  assert.equal(a.files[1].hashOk, false);
  assert.equal(a.components.find((c) => c.id === 'hashes')?.state, 'warning');
  const t = await openPsarc(bytesSource(songPackage({ truncate: 100 })));
  assert.equal(t.components.find((c) => c.id === 'data')?.state, 'warning');
  assert.ok(t.files.some((f) => /truncated|outside/.test(f.problem ?? '')));
});

test('unsafe entry names are rejected', async () => {
  const b = buildPsarc([{ path: 'ok.txt', data: 'x' }, { path: 'x', data: 'y' }], { names: ['ok.txt', '../../evil.xml'] });
  const a = await openPsarc(bytesSource(b));
  assert.equal(a.files[1].path, null);
  assert.match(a.files[1].problem ?? '', /unsafe/);
  assert.equal(checkArchivePath('C:/x').ok, false);
  assert.deepEqual(checkArchivePath('/songs\\arr/./a.xml'), { ok: true, path: 'songs/arr/a.xml' });
});

test('classification: WAV vs Wwise, Rocksmith XML roots, manifests', () => {
  assert.equal(classify('x.wav', riffWave(1)).role, 'audio');
  assert.equal(classify('x.wem', riffWave(0xffff)).role, 'wwise-audio');
  assert.equal(classify('x.wav', riffWave(0xffff)).role, 'wwise-audio');
  assert.equal(classify('a.xml', new TextEncoder().encode(demo.slice(0, 200))).role, 'arrangement-xml');
  assert.equal(classify('v.xml', new TextEncoder().encode('<?xml version="1.0"?>\n<vocals count="1">')).role, 'vocals-xml');
  assert.equal(classify('m.json', new TextEncoder().encode(manifest('Lead'))).role, 'rs-manifest');
  assert.equal(classify('a_preview.ogg', fakeOgg()).audio?.preview, true);
});

test('importing a Rocksmith-layout package: one song, both arrangements, audio and every entry accounted for', async () => {
  const r = await runImport([input('Demo_-_Riff_p.psarc', songPackage())]);
  assert.equal(r.songs.length, 1);
  const s = r.songs[0];
  assert.equal(s.title, 'Demo Riff'); // from the manifest
  assert.equal(s.artist, 'GMA Band');
  assert.deepEqual(s.arrangements.map((a) => a.role), ['lead', 'bass']);
  const audio = r.audio.find((a) => a.key === s.audioKey)!;
  assert.equal(audio.name, 'demoriff.ogg');
  assert.equal(s.audioCandidates.length, 2); // full + preview
  const f = r.files[0];
  assert.equal(f.status, 'partial');
  assert.equal(f.entries!.length, 11);
  const by = Object.fromEntries(f.entries!.map((e) => [e.path.split('/').pop(), e.status]));
  assert.deepEqual(by, {
    'demoriff_lead.xml': 'imported', 'demoriff_bass.xml': 'imported', 'demoriff_vocals.xml': 'not-used', 'demoriff_lead.json': 'metadata',
    'demoriff.ogg': 'imported', 'demoriff_preview.ogg': 'imported', '12345.wem': 'unsupported', 'song_demoriff.bnk': 'unsupported',
    'demoriff_lead.sng': 'unsupported', 'album_demoriff_256.dds': 'not-used', 'appid.appid': 'not-used',
  });
});

test('importing an encrypted package explains which component blocks it', async () => {
  const r = await runImport([input('Scorpions_-_Send_me_an_Angel_p.psarc', songPackage({ encryptedToc: true }))]);
  assert.equal(r.songs.length, 0);
  const f = r.files[0];
  assert.equal(f.status, 'unsupported');
  assert.match(f.detail, /Blocked by: table of contents/);
  assert.ok(f.facts?.some((x) => x.label === 'Name suggests' && x.value === 'Scorpions — Send me an Angel'));
});

test('damaged archive header is attributed to the header component', async () => {
  const b = songPackage().slice(0, 40);
  const r = await runImport([input('broken.psarc', b)]);
  assert.equal(r.files[0].status, 'error');
  assert.equal(r.files[0].components?.[0].id, 'header');
});

test('loose files: arrangements group by title, audio matched by name, preview kept as an alternative', async () => {
  const r = await runImport([
    input('demo_lead.xml', new TextEncoder().encode(arrXml('Lead'))),
    input('demo_rhythm.xml', new TextEncoder().encode(arrXml('Rhythm'))),
    input('demo_bass.xml', new TextEncoder().encode(arrXml('Bass'))),
    input('Demo Riff in A Minor.ogg', fakeOgg(50_000)),
    input('demo_preview.wav', riffWave(1, 4000)),
    input('demo_lead copy.xml', new TextEncoder().encode(arrXml('Lead'))),
  ]);
  assert.equal(r.songs.length, 1);
  const s = r.songs[0];
  assert.deepEqual(s.arrangements.map((a) => a.label), ['Lead', 'Rhythm', 'Bass']);
  assert.equal(r.audio.find((a) => a.key === s.audioKey)?.name, 'Demo Riff in A Minor.ogg');
  assert.equal(r.files[5].status, 'skipped'); // identical chart, said so
  assert.match(r.files[5].detail, /Identical to demo_lead\.xml/);
});

test('two loose songs keep separate audio; unmatched audio is offered, not dropped', async () => {
  const other = demo.replace('Demo Riff in A Minor', 'Second Song');
  const r = await runImport([
    input('a.xml', new TextEncoder().encode(demo)),
    input('b.xml', new TextEncoder().encode(other)),
    input('second song.ogg', fakeOgg(3000)),
    input('random noise.wav', riffWave(1, 3000)),
  ]);
  assert.equal(r.songs.length, 2);
  const second = r.songs.find((s) => s.title === 'Second Song')!;
  const first = r.songs.find((s) => s.title !== 'Second Song')!;
  assert.equal(r.audio.find((a) => a.key === second.audioKey)?.name, 'second song.ogg');
  // The only song without audio gets the only unmatched full recording.
  assert.equal(r.audio.find((a) => a.key === first.audioKey)?.name, 'random noise.wav');
});

test('cancellation stops the pipeline', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  await assert.rejects(() => runImport([input('a.xml', new TextEncoder().encode(demo))], { signal: ctrl.signal }), /cancelled/);
});
