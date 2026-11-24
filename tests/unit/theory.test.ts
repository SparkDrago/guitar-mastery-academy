import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNote, noteName, parsePitch, midiName, midiToFreq, freqToMidi, centsBetween,
  parseInterval, intervalToken, intervalLongName, spellInterval,
  buildScale, getScale, stepPattern, stepNames, modeFormula, scaleIntervals, modesOf, preferredRoot, SCALES,
  buildChord, parseChordSymbol, identifyChord, chordNameFromPcs, CHORDS, inversions,
  diatonicChords, numeralToChord, keySignature, relativeMinor, chordScales, resolveProgression, PROGRESSIONS, noteOverChord,
  TUNINGS, findTuning, validateTuning, tuningLabel,
  noteAt, positionsOfPc, markTones, octavesOf,
  threeNpsPatterns, fivePositionPatterns, notesPerStringPattern, buildPillitierePattern, pillitiereShapes,
  PILLITIERE_START_SHAPES, PILLITIERE_MODES, pillitiereParentDegree, cagedPositions, anchoredWindowPatterns,
  findVoicings, voicingString, STANDARD_TUNING, pcOf, parentMajorOf,
} from '@gma/theory';

const names = (notes: { letter: number; acc: number }[]) => notes.map((n) => noteName(n)).join(' ');

test('pitch: parsing and naming', () => {
  assert.deepEqual(parseNote('C#'), { letter: 0, acc: 1 });
  assert.deepEqual(parseNote('Bb'), { letter: 6, acc: -1 });
  assert.deepEqual(parseNote('e♭'), { letter: 2, acc: -1 });
  assert.equal(parseNote('H'), null);
  assert.equal(parsePitch('E2'), 40);
  assert.equal(parsePitch('A4'), 69);
  assert.equal(parsePitch('B#3'), 60);
  assert.equal(parsePitch('Cb4'), 59);
  assert.equal(midiName(40), 'E2');
  assert.equal(midiName(61, true), 'Db4');
});

test('pitch: frequency conversions', () => {
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(40) - 82.4069) < 0.001, 'low E is 82.41 Hz');
  assert.ok(Math.abs(midiToFreq(64) - 329.6276) < 0.001, 'high E is 329.63 Hz');
  assert.ok(Math.abs(freqToMidi(110) - 45) < 1e-9);
  assert.ok(Math.abs(centsBetween(440 * Math.pow(2, 10 / 1200), 440) - 10) < 1e-9);
  assert.equal(Math.round(midiToFreq(69, 432)), 432);
});

test('intervals: tokens, names, spelling', () => {
  assert.deepEqual(parseInterval('b3'), { degree: 3, semitones: 3 });
  assert.deepEqual(parseInterval('#11'), { degree: 11, semitones: 18 });
  assert.deepEqual(parseInterval('bb7'), { degree: 7, semitones: 9 });
  assert.equal(intervalToken({ degree: 5, semitones: 6 }), 'b5');
  assert.equal(intervalLongName(parseInterval('b3')), 'minor 3rd');
  assert.equal(intervalLongName(parseInterval('#4')), 'augmented 4th');
  assert.equal(intervalLongName(parseInterval('5')), 'perfect 5th');
  assert.equal(intervalLongName(parseInterval('9')), 'major 9th');
  assert.equal(noteName(spellInterval(parseNote('F')!, parseInterval('4'))), 'Bb');
  assert.equal(noteName(spellInterval(parseNote('E')!, parseInterval('3'))), 'G#');
  assert.equal(noteName(spellInterval(parseNote('Gb')!, parseInterval('4'))), 'Cb');
});

test('scales: major scale spelling follows the key signature', () => {
  assert.equal(names(buildScale('C', 'major').notes), 'C D E F G A B');
  assert.equal(names(buildScale('F', 'major').notes), 'F G A Bb C D E');
  assert.equal(names(buildScale('F#', 'major').notes), 'F# G# A# B C# D# E#');
  assert.equal(names(buildScale('Db', 'major').notes), 'Db Eb F Gb Ab Bb C');
  assert.equal(names(buildScale('A', 'aeolian').notes), 'A B C D E F G');
  assert.equal(names(buildScale('A', 'minor-pentatonic').notes), 'A C D E G');
  assert.equal(names(buildScale('A', 'blues').notes), 'A C D Eb E G');
  assert.equal(names(buildScale('E', 'harmonic-minor').notes), 'E F# G A B C D#');
  assert.equal(stepNames(stepPattern('major')), 'W W H W W W H');
  assert.equal(stepNames(stepPattern('aeolian')), 'W H W W H W W');
  assert.equal(stepNames(stepPattern('harmonic-minor')), 'W H W W H W+H H');
});

test('scales: every mode equals a rotation of its parent', () => {
  for (const parent of ['major', 'harmonic-minor', 'melodic-minor']) {
    const modes = modesOf(parent);
    assert.equal(modes.length, 7, `${parent} has seven modes`);
    for (const m of modes) {
      const expected = modeFormula(parent, m.modeOf!.degree);
      const actual = scaleIntervals(m).map((i) => i.semitones % 12);
      assert.deepEqual(actual, expected, `${m.id} is mode ${m.modeOf!.degree} of ${parent}`);
    }
  }
});

test('scales: catalog formulas are well formed', () => {
  for (const s of SCALES) {
    const semis = scaleIntervals(s).map((i) => i.semitones);
    assert.equal(semis[0], 0, `${s.id} starts on the root`);
    for (let i = 1; i < semis.length; i++) assert.ok(semis[i] > semis[i - 1], `${s.id} ascends`);
    assert.ok(semis[semis.length - 1] < 12, `${s.id} stays within an octave`);
  }
  assert.equal(scaleIntervals('chromatic').length, 12);
  assert.equal(scaleIntervals('whole-tone').length, 6);
  assert.equal(scaleIntervals('diminished-hw').length, 8);
});

test('scales: preferred root spellings', () => {
  assert.equal(noteName(preferredRoot(10, 'major')), 'Bb');
  assert.equal(noteName(preferredRoot(1, 'major')), 'Db');
  assert.equal(noteName(preferredRoot(6, 'aeolian')), 'F#');
});

test('chords: construction and symbols', () => {
  assert.equal(names(buildChord('C', 'maj').notes), 'C E G');
  assert.equal(names(buildChord('A', 'm7').notes), 'A C E G');
  assert.equal(names(buildChord('B', 'm7b5').notes), 'B D F A');
  assert.equal(names(buildChord('C', 'dim7').notes), 'C Eb Gb Bbb');
  assert.equal(names(buildChord('E', '7#9').notes), 'E G# B D F##');
  assert.equal(parseChordSymbol('F#m7')!.symbol, 'F#m7');
  assert.equal(parseChordSymbol('Bbmaj7')!.def.id, 'maj7');
  assert.equal(parseChordSymbol('Asus2')!.def.id, 'sus2');
  assert.equal(parseChordSymbol('C6/9')!.def.id, '6/9');
  const slash = parseChordSymbol('G/B')!;
  assert.equal(slash.def.id, 'maj');
  assert.equal(noteName(slash.bass!), 'B');
  assert.equal(parseChordSymbol('Xm'), null);
  for (const c of CHORDS) assert.ok(buildChord('C', c).notes.length >= 2, c.id);
});

test('chords: identification and inversions', () => {
  assert.equal(chordNameFromPcs([0, 4, 7]), 'C');
  assert.equal(chordNameFromPcs([9, 0, 4]), 'Am');
  assert.equal(chordNameFromPcs([7, 11, 2, 5]), 'G7');
  assert.equal(chordNameFromPcs([4, 7, 0], 4), 'C/E');
  assert.equal(identifyChord([0, 7])[0].def.id, '5');
  const inv = inversions(buildChord('C', 'maj'));
  assert.equal(names(inv[1].notes), 'E G C');
  assert.equal(inv[2].name, '2nd inversion');
});

test('harmony: diatonic triads and sevenths', () => {
  const triads = diatonicChords('C', 'major');
  assert.deepEqual(triads.map((c) => c.chord.symbol), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
  assert.deepEqual(triads.map((c) => c.numeral), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  const sevenths = diatonicChords('G', 'major', true);
  assert.deepEqual(sevenths.map((c) => c.chord.symbol), ['Gmaj7', 'Am7', 'Bm7', 'Cmaj7', 'D7', 'Em7', 'F#m7b5']);
  const minor = diatonicChords('A', 'aeolian');
  assert.deepEqual(minor.map((c) => c.numeral), ['i', 'ii°', 'bIII', 'iv', 'v', 'bVI', 'bVII']);
  const hm = diatonicChords('A', 'harmonic-minor', true);
  assert.equal(hm[4].chord.symbol, 'E7');
  assert.equal(hm[0].chord.symbol, 'AmMaj7');
});

test('harmony: Roman numerals, secondary dominants, progressions', () => {
  assert.equal(numeralToChord('bVII', 'A').symbol, 'G');
  assert.equal(numeralToChord('bVI', 'A').symbol, 'F');
  assert.equal(numeralToChord('V7/V', 'C').symbol, 'D7');
  assert.equal(numeralToChord('V7/ii', 'C').symbol, 'A7');
  assert.equal(numeralToChord('iiø7', 'C').symbol, 'Dm7b5');
  assert.equal(numeralToChord('IVmaj7', 'Eb').symbol, 'Abmaj7');
  assert.equal(numeralToChord('i7', 'E').symbol, 'Em7');
  const blues = resolveProgression(PROGRESSIONS.find((p) => p.id === '12-bar-blues')!.bars, 'A');
  assert.equal(blues.length, 12);
  assert.deepEqual([...new Set(blues.map((c) => c.chord.symbol))], ['A7', 'D7', 'E7']);
  for (const p of PROGRESSIONS) {
    const r = resolveProgression(p.bars, p.mode === 'major' ? 'C' : 'A');
    assert.ok(r.length >= p.bars.length, `${p.id} resolves`);
  }
});

test('harmony: key signatures and relative keys', () => {
  assert.deepEqual(keySignature('D').accidentals, ['F#', 'C#']);
  assert.deepEqual(keySignature('F').accidentals, ['Bb']);
  assert.equal(keySignature('Gb').flats, 6);
  assert.equal(keySignature('E', 'minor').sharps, 1);
  assert.equal(noteName(relativeMinor(parseNote('C')!)), 'A');
  assert.equal(noteName(relativeMinor(parseNote('Eb')!)), 'C');
});

test('harmony: chord-scale recommendations follow the harmonic context', () => {
  assert.equal(chordScales(parseChordSymbol('Dm7')!, 'C').suggestions[0].scale.id, 'dorian');
  assert.equal(chordScales(parseChordSymbol('G7')!, 'C').suggestions[0].scale.id, 'mixolydian');
  assert.equal(chordScales(parseChordSymbol('Fmaj7')!, 'C').suggestions[0].scale.id, 'lydian');
  assert.equal(chordScales(parseChordSymbol('Bm7b5')!, 'C').suggestions[0].scale.id, 'locrian');
  // A major V chord in a minor key needs the leading tone: Phrygian dominant.
  const e7 = chordScales(parseChordSymbol('E7')!, 'A', 'minor');
  assert.equal(e7.suggestions[0].scale.id, 'phrygian-dominant');
  assert.deepEqual(e7.suggestions[0].outsideNotes, ['G#']);
  assert.deepEqual(chordScales(parseChordSymbol('G7')!, 'C').guideTones, ['B', 'F']);
  const over = noteOverChord(5, parseChordSymbol('C')!); // F over C
  assert.equal(over.role, 'avoid');
  assert.equal(noteOverChord(4, parseChordSymbol('C')!).role, 'chord tone');
});

test('tunings: presets are explicit and correct', () => {
  assert.equal(TUNINGS.length, 39);
  assert.deepEqual(findTuning('e-standard')!.strings, [40, 45, 50, 55, 59, 64]);
  assert.deepEqual(findTuning('drop-d')!.strings, [38, 45, 50, 55, 59, 64]);
  assert.deepEqual(findTuning('eb-standard')!.strings, [39, 44, 49, 54, 58, 63]);
  assert.deepEqual(findTuning('db-standard')!.strings, [37, 42, 47, 52, 56, 61]);
  assert.deepEqual(findTuning('open-g')!.strings, [38, 43, 50, 55, 59, 62]);
  assert.deepEqual(findTuning('dadgad')!.strings, [38, 45, 50, 55, 57, 62]);
  assert.deepEqual(findTuning('nst')!.strings, [36, 43, 50, 57, 64, 67]);
  assert.equal(findTuning('7-standard')!.strings.length, 7);
  assert.equal(findTuning('7-standard')!.strings[0], 35);
  assert.equal(findTuning('8-standard')!.strings.length, 8);
  assert.equal(findTuning('8-standard')!.strings[0], 30);
  assert.equal(findTuning('8-drop-d')!.strings[0], 26);
  // Lowered standards keep the standard interval pattern.
  for (const id of ['eb-standard', 'd-standard', 'c-standard', 'b-standard', 'a-standard']) {
    const s = findTuning(id)!.strings;
    assert.deepEqual(s.slice(1).map((m, i) => m - s[i]), [5, 5, 5, 4, 5], id);
  }
  for (const t of TUNINGS) for (let i = 1; i < t.strings.length; i++) assert.ok(t.strings[i] > t.strings[i - 1], `${t.id} ascends`);
  assert.equal(tuningLabel(findTuning('e-standard')!), 'E A D G B E');
  assert.equal(validateTuning({ name: 'x', strings: [40, 45] }).ok, false);
  assert.equal(validateTuning({ name: 'Baritone', strings: [35, 40, 45, 50, 54, 59] }).ok, true);
});

test('fretboard: note calculation', () => {
  assert.equal(noteAt(STANDARD_TUNING, 0, 5).midi, 45, 'low E fret 5 = A2');
  assert.equal(noteAt(STANDARD_TUNING, 0, 12).pc, 4, 'fret 12 is the octave');
  assert.equal(noteAt(STANDARD_TUNING, 3, 4).midi, noteAt(STANDARD_TUNING, 4, 0).midi, 'G string fret 4 = open B');
  assert.equal(noteAt(STANDARD_TUNING, 1, 5).midi, noteAt(STANDARD_TUNING, 2, 0).midi, 'A string fret 5 = open D');
  const cs = positionsOfPc(STANDARD_TUNING, 0, 12);
  assert.deepEqual(cs.filter((p) => p.string === 0).map((p) => p.fret), [8]);
  assert.deepEqual(cs.filter((p) => p.string === 1).map((p) => p.fret), [3]);
  const marks = markTones(STANDARD_TUNING, 9, ['1', 'b3', '5'], 12);
  assert.ok(marks.every((m) => [9, 0, 4].includes(m.pc)));
  assert.ok(marks.find((m) => m.string === 0 && m.fret === 5)!.isRoot);
  const oct = octavesOf(STANDARD_TUNING, { string: 0, fret: 3 }, 15); // G2
  assert.ok(oct.some((o) => o.string === 2 && o.fret === 5 && o.octaves === 1), 'two strings over, two frets up');
  const seven = findTuning('7-standard')!;
  assert.equal(noteAt(seven, 0, 5).midi, noteAt(seven, 1, 0).midi);
});

test('patterns: 3NPS and five-position systems', () => {
  const pats = threeNpsPatterns(STANDARD_TUNING, 0, scaleIntervals('major'));
  assert.equal(pats.length, 7);
  for (const p of pats) {
    assert.equal(p.notes.length, 18);
    const pcs = new Set(p.notes.map((n) => n.pc));
    assert.deepEqual([...pcs].sort((a, b) => a - b), [0, 2, 4, 5, 7, 9, 11]);
    for (let i = 1; i < p.notes.length; i++) assert.ok(p.notes[i].midi > p.notes[i - 1].midi, 'strictly ascending');
  }
  const pent = fivePositionPatterns(STANDARD_TUNING, 9, scaleIntervals('minor-pentatonic'));
  assert.equal(pent.length, 5);
  const box1 = pent.find((p) => p.notes[0].fret === 5 && p.notes[0].isRoot)!;
  assert.ok(box1, 'A minor pentatonic box 1 starts on the 5th fret root');
  assert.equal(box1.maxFret, 8);
  const blues = anchoredWindowPatterns(STANDARD_TUNING, 9, scaleIntervals('blues'));
  assert.equal(blues.length, 5);
  assert.ok(blues[0].notes.some((n) => n.token === 'b5'));
});

test('Pillitiere: shape chart and mode table match the derived cycle', () => {
  for (let d = 1; d <= 7; d++) {
    const expected = PILLITIERE_START_SHAPES[d];
    assert.equal(pillitiereShapes(d, expected.length).join(''), expected, `degree ${d}`);
  }
  assert.equal(pillitiereShapes(1, 6).join(''), 'XXYYZZ');
  assert.equal(pillitiereShapes(5, 6).join(''), 'XXXYYZ');
  for (const m of PILLITIERE_MODES) assert.equal(pillitiereShapes(m.parentDegree, m.shapes.length).join(''), m.shapes);
  // Book example: Lydian starting on its 3rd degree uses the pattern that starts ZZ.
  assert.equal(PILLITIERE_START_SHAPES[pillitiereParentDegree(4, 3)], 'ZZ');
  // Book example: G major starting on the 7th fret of string 6 (B, degree 3) starts YZ.
  const g = buildPillitierePattern(STANDARD_TUNING, 7, 3, { minFret: 7 });
  assert.equal(g.notes[0].fret, 7);
  assert.equal(g.shapes!.slice(0, 2).join(''), 'YZ');
});

test('Pillitiere: rules reproduce computed 3NPS fingerings in every key, degree and start string', () => {
  const tunings = [STANDARD_TUNING, findTuning('7-standard')!, findTuning('8-standard')!, findTuning('eb-standard')!];
  let checked = 0;
  for (const tuning of tunings) {
    for (let key = 0; key < 12; key++) {
      for (let degree = 1; degree <= 7; degree++) {
        for (const startString of [0, 1, 2]) {
          const rule = buildPillitierePattern(tuning, key, degree, { startString });
          const computed = notesPerStringPattern(tuning, key, scaleIntervals('major'), degree - 1, 3, { startString, maxFret: 40 })!;
          assert.deepEqual(rule.notes.map((n) => [n.string, n.fret]), computed.map((n) => [n.string, n.fret]),
            `${tuning.id} key ${key} degree ${degree} from string ${startString}`);
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 4 * 12 * 7 * 3);
});

test('Pillitiere: generalised string-gap rule also holds for drop tunings', () => {
  const dropD = findTuning('drop-d')!;
  for (let key = 0; key < 12; key++)
    for (let degree = 1; degree <= 7; degree++) {
      const rule = buildPillitierePattern(dropD, key, degree, { minFret: 2 });
      const computed = notesPerStringPattern(dropD, key, scaleIntervals('major'), degree - 1, 3, { minFret: 2, maxFret: 40 })!;
      assert.deepEqual(rule.notes.map((n) => n.fret), computed.map((n) => n.fret));
    }
});

test('CAGED: five shapes in standard tuning, none for non-standard intervals', () => {
  const c = cagedPositions(STANDARD_TUNING, 0, scaleIntervals('major'));
  assert.deepEqual(c.map((p) => p.shape).sort(), ['A', 'C', 'D', 'E', 'G']);
  const cShape = c.find((p) => p.shape === 'C')!;
  assert.deepEqual(cShape.chordShape.map((p) => p.fret), [3, 2, 0, 1, 0]);
  assert.ok(cShape.notes.every((n) => [0, 2, 4, 5, 7, 9, 11].includes(n.pc)));
  assert.equal(cagedPositions(findTuning('drop-d')!, 0, scaleIntervals('major')).length, 0);
  assert.equal(cagedPositions(findTuning('eb-standard')!, 0, scaleIntervals('major')).length, 5);
});

test('voicings: finds the standard open and barre shapes', () => {
  const v = (sym: string, t = STANDARD_TUNING) => findVoicings(parseChordSymbol(sym)!, t, { limit: 40 }).map((x) => voicingString(x.frets));
  assert.ok(v('C').includes('x32010'), 'open C');
  assert.ok(v('E').includes('022100'), 'open E');
  assert.ok(v('Am').includes('x02210'), 'open Am');
  assert.ok(v('D').includes('xx0232'), 'open D');
  assert.ok(v('G').some((s) => s === '320003' || s === '320033'), 'open G');
  assert.ok(v('F').includes('133211'), 'F barre');
  assert.ok(v('Bb').includes('x13331'), 'Bb A-shape barre');
  assert.ok(v('Bm').includes('x24432'), 'Bm barre');
  assert.ok(v('E7').includes('020100'), 'open E7');
  assert.ok(v('D5', findTuning('drop-d')!).includes('000xxx'), 'drop D one-finger power chord');
  assert.ok(v('C/E').some((s) => s.startsWith('0')), 'slash chord with E in the bass');
  const seven = findVoicings(parseChordSymbol('Em')!, findTuning('7-standard')!);
  assert.ok(seven.length > 0 && seven.every((x) => x.frets.length === 7));
  const f = findVoicings(parseChordSymbol('F')!, STANDARD_TUNING).find((x) => voicingString(x.frets) === '133211')!;
  assert.equal(f.barre?.fret, 1);
  assert.equal(pcOf(parseNote('C')!), 0);
});

test('parent major of a mode', () => {
  assert.equal(noteName(parentMajorOf('D', 2)), 'C');
  assert.equal(noteName(parentMajorOf('E', 3)), 'C');
  assert.equal(noteName(parentMajorOf('A', 5)), 'D');
  assert.equal(noteName(parentMajorOf('F#', 7)), 'G');
  assert.equal(noteName(parentMajorOf('Bb', 4)), 'F');
  assert.equal(noteName(parentMajorOf('C#', 6)), 'E');
});
