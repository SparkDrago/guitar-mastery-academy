import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PlaySong, SongEvent } from '@gma/notation';
import { chartNameMatches, chordNameReport, nameFromNotes, prefersFlats, withChordNames } from '@/lib/chordNames';

const chord = (time: number, name: string, frets: (number | null)[]): Extract<SongEvent, { kind: 'chord' }> => ({
  kind: 'chord', time, name, sustain: 0, techniques: [],
  notes: frets.flatMap((f, s) => (f === null ? [] : [{ time, string: s, fret: f, sustain: 0, techniques: [] }])),
});
const song = (events: SongEvent[]): PlaySong => ({
  format: 'gma-song', version: 1, id: 't', title: 'T', artist: '', arrangement: 'Lead',
  tuning: { name: 'E Standard', strings: [40, 45, 50, 55, 59, 64] }, capo: 0, duration: 30, averageTempo: 100,
  beats: [], sections: [], events, source: 'rocksmith-xml',
});

// Shapes and names as a real Rocksmith chart (B♭ major song) has them.
const GMIN7 = chord(1, 'Gmin7', [null, null, 8, 10, 8, 6]);
const GMIN7_EB = chord(2, 'Gmin7/D#', [null, 6, 8, 10, 8, 6]);
const FSUS4_D = chord(3, 'Fsus4/D', [null, null, 0, 3, 1, 1]);
const F_BARRE = chord(4, 'F', [1, 3, 3, 2, 1, 1]);
const A_SHARP5 = chord(5, 'A#5', [6, 8, 8, null, null, null]);
const s = song([GMIN7, GMIN7_EB, FSUS4_D, F_BARRE, A_SHARP5]);

test('chart names are checked against the notes, Rocksmith spellings included', () => {
  assert.equal(chartNameMatches(s, F_BARRE), true);
  assert.equal(chartNameMatches(s, A_SHARP5), true, '"A#5" is B♭5');
  assert.equal(chartNameMatches(s, FSUS4_D), true, 'a slash bass outside the chord is valid notation');
  assert.equal(chartNameMatches(s, GMIN7), false, 'B♭ is the lowest note, so it is Gm7/B♭');
  assert.equal(chartNameMatches(s, GMIN7_EB), false, 'E♭ G B♭ F (no D) is E♭add9');
  assert.equal(chartNameMatches(s, chord(6, 'Cmaj7', [null, 3, 2, 0, 0, 0])), true);
  assert.equal(chartNameMatches(s, chord(6, 'C', [null, 3, 2, 0, 0, 0])), false, 'a B in the chord is not plain C');
});

test('names from the notes use the song key for spelling', () => {
  assert.equal(prefersFlats(s), true, 'B♭-major material → flats');
  assert.equal(nameFromNotes(s, GMIN7_EB, true), 'Ebadd9');
  assert.equal(nameFromNotes(s, FSUS4_D, true), 'Bbadd9/D');
  assert.equal(nameFromNotes(s, A_SHARP5, true), 'Bb5');
  const sharp = song([chord(1, 'E', [0, 2, 2, 1, 0, 0]), chord(2, 'B', [null, 2, 4, 4, 4, 2]), chord(3, 'A', [null, 0, 2, 2, 2, 0])]);
  assert.equal(prefersFlats(sharp), false, 'E-major material → sharps');
});

test('report lists differing shapes once; "from the notes" renames every chord', () => {
  const r = chordNameReport(song([GMIN7, { ...GMIN7, time: 9 }, GMIN7_EB, F_BARRE]));
  assert.equal(r.shapes, 3);
  assert.deepEqual(r.differing.map((d) => [d.chart, d.frets, d.notes]), [['Gmin7', 'x-x-8-10-8-6', 'Gm7/Bb'], ['Gmin7/D#', 'x-6-8-10-8-6', 'Ebadd9']]);
  const named = withChordNames(s, 'notes').events.map((e) => (e.kind === 'chord' ? e.name : ''));
  assert.deepEqual(named, ['Gm7/Bb', 'Ebadd9', 'Bbadd9/D', 'F', 'Bb5']);
  assert.equal(withChordNames(s, 'chart'), s, 'chart mode leaves the song untouched');
});
