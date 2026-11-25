import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { parseXml, child, songFromRocksmithXml, songFromGpif, gpifFromGpFile, gpTracks, songFromTabScore, eventsBetween, fretWindow, midiOfNote, allNotes, validateSong, emptyScore } from '@gma/notation';

test('xml parser handles attributes, entities, CDATA and comments', () => {
  const d = parseXml(`<?xml version="1.0"?><!-- c --><a x="1" y='two &amp; three'><b>hi &lt;there&gt;</b><c/><d><![CDATA[<raw>]]></d></a>`);
  const a = child(d, 'a')!;
  assert.equal(a.attrs.y, 'two & three');
  assert.equal(child(a, 'b')!.text, 'hi <there>');
  assert.equal(child(a, 'd')!.text, '<raw>');
  assert.equal(a.children.length, 3);
});

const RS = `<?xml version="1.0" encoding="utf-8"?>
<song version="7">
  <title>Test Song</title><arrangement>Lead</arrangement><songLength>20.0</songLength><averageTempo>120</averageTempo>
  <tuning string0="-2" string1="0" string2="0" string3="0" string4="0" string5="0" />
  <capo>0</capo><artistName>Test Band</artistName><albumName>Album</albumName><albumYear>1990</albumYear>
  <phrases count="2"><phrase maxDifficulty="0" name="intro"/><phrase maxDifficulty="1" name="verse"/></phrases>
  <phraseIterations count="2"><phraseIteration time="0.000" phraseId="0"/><phraseIteration time="4.000" phraseId="1"/></phraseIterations>
  <chordTemplates count="1"><chordTemplate chordName="D5" displayName="D5" fret0="0" fret1="0" fret2="0" fret3="-1" fret4="-1" fret5="-1"/></chordTemplates>
  <ebeats count="3"><ebeat time="0.000" measure="1"/><ebeat time="0.500" measure="-1"/><ebeat time="1.000" measure="-1"/></ebeats>
  <sections count="2"><section name="intro" number="1" startTime="0.000"/><section name="verse" number="1" startTime="4.000"/></sections>
  <transcriptionTrack difficulty="-1"><notes count="0"/><chords count="0"/></transcriptionTrack>
  <levels count="2">
    <level difficulty="0">
      <notes count="2"><note time="1.000" string="0" fret="0" sustain="0.000"/><note time="5.000" string="1" fret="2" sustain="0.000"/></notes>
      <chords count="0"/>
    </level>
    <level difficulty="1">
      <notes count="3"><note time="1.500" string="0" fret="3" sustain="0.000"/><note time="5.000" string="2" fret="5" sustain="0.500" bend="2" vibrato="80"/><note time="5.500" string="2" fret="7" hammerOn="1" sustain="0"/></notes>
      <chords count="1"><chord time="6.000" chordId="0" palmMute="1"/></chords>
    </level>
  </levels>
</song>`;

test('Rocksmith arrangement XML import picks max difficulty per phrase', () => {
  const r = songFromRocksmithXml(RS, 'rs1');
  assert.deepEqual(r.errors, []);
  const s = r.song!;
  assert.equal(s.title, 'Test Song');
  assert.equal(s.artist, 'Test Band');
  assert.equal(s.year, 1990);
  assert.deepEqual(s.tuning.strings, [38, 45, 50, 55, 59, 64]);
  assert.equal(s.tuning.name, 'Drop D');
  // Intro phrase uses level 0 (note at 1.0, not level-1 note at 1.5); verse uses level 1.
  assert.deepEqual(s.events.map((e) => e.time), [1, 5, 5.5, 6]);
  const bent = s.events[1];
  assert.ok(bent.kind === 'note' && bent.bend === 2 && bent.techniques.includes('bend') && bent.techniques.includes('vibrato'));
  assert.ok(s.events[2].kind === 'note' && s.events[2].techniques.includes('hammer'));
  const ch = s.events[3];
  assert.ok(ch.kind === 'chord' && ch.name === 'D5' && ch.notes.length === 3 && ch.techniques.includes('palmMute'));
  assert.deepEqual(s.sections.map((x) => [x.name, x.start, x.end]), [['Intro', 0, 4], ['Verse', 4, 20]]);
  assert.equal(midiOfNote(s, { string: 0, fret: 0 }), 38);
  assert.deepEqual(validateSong(s), []);
});

test('Rocksmith import: bass arrangement and errors', () => {
  const bass = songFromRocksmithXml(RS.replace('<arrangement>Lead</arrangement>', '<arrangement>Bass</arrangement>'), 'b');
  assert.deepEqual(bass.song!.tuning.strings, [26, 33, 38, 43]);
  assert.ok(songFromRocksmithXml('<vocals><vocal time="1" lyric="la"/></vocals>', 'v').errors[0].includes('not a Rocksmith arrangement'));
  assert.ok(songFromRocksmithXml('not xml <', 'x').errors.length > 0 || songFromRocksmithXml('not xml <', 'x').song === null);
});

function makeZip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = []; const centrals: Uint8Array[] = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text));
    const nameB = enc.encode(name);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(8, 8, true); lh.setUint32(18, data.length, true); lh.setUint32(22, text.length, true); lh.setUint16(26, nameB.length, true);
    const local = new Uint8Array([...new Uint8Array(lh.buffer), ...nameB, ...data]);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(10, 8, true); ch.setUint32(20, data.length, true); ch.setUint32(24, text.length, true); ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
    centrals.push(new Uint8Array([...new Uint8Array(ch.buffer), ...nameB]));
    locals.push(local); offset += local.length;
  }
  const cdSize = centrals.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, centrals.length, true); end.setUint16(10, centrals.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const GPIF = `<GPIF><Score><Title><![CDATA[GP Song]]></Title><Artist><![CDATA[Somebody]]></Artist></Score>
<MasterTrack><Automations><Automation><Type>Tempo</Type><Bar>0</Bar><Position>0</Position><Value>60 2</Value></Automation></Automations></MasterTrack>
<Tracks><Track id="0"><Name>Guitar</Name><Staves><Staff><Properties><Property name="Tuning"><Pitches>40 45 50 55 59 64</Pitches></Property></Properties></Staff></Staves></Track></Tracks>
<MasterBars><MasterBar><Time>4/4</Time><Section><Text>Intro</Text></Section><Bars>0</Bars></MasterBar><MasterBar><Time>4/4</Time><Bars>1</Bars></MasterBar></MasterBars>
<Bars><Bar id="0"><Voices>0 -1 -1 -1</Voices></Bar><Bar id="1"><Voices>1 -1 -1 -1</Voices></Bar></Bars>
<Voices><Voice id="0"><Beats>0 1 2</Beats></Voice><Voice id="1"><Beats>3</Beats></Voice></Voices>
<Beats><Beat id="0"><Rhythm ref="0"/><Notes>0</Notes></Beat><Beat id="1"><Rhythm ref="0"/><Notes>1 2</Notes></Beat><Beat id="2"><Rhythm ref="1"/><Notes>3</Notes></Beat><Beat id="3"><Rhythm ref="2"/><Notes>4</Notes></Beat></Beats>
<Notes>
<Note id="0"><Properties><Property name="String"><String>0</String></Property><Property name="Fret"><Fret>3</Fret></Property></Properties></Note>
<Note id="1"><Properties><Property name="String"><String>1</String></Property><Property name="Fret"><Fret>2</Fret></Property></Properties></Note>
<Note id="2"><Properties><Property name="String"><String>2</String></Property><Property name="Fret"><Fret>0</Fret></Property></Properties></Note>
<Note id="3"><Tie origin="true" destination="false"/><Properties><Property name="String"><String>3</String></Property><Property name="Fret"><Fret>2</Fret></Property></Properties></Note>
<Note id="4"><Tie origin="false" destination="true"/><Properties><Property name="String"><String>3</String></Property><Property name="Fret"><Fret>2</Fret></Property></Properties></Note>
</Notes>
<Rhythms><Rhythm id="0"><NoteValue>Quarter</NoteValue></Rhythm><Rhythm id="1"><NoteValue>Half</NoteValue></Rhythm><Rhythm id="2"><NoteValue>Whole</NoteValue></Rhythm></Rhythms></GPIF>`;

test('Guitar Pro 7/8 import from a .gp zip', async () => {
  const zip = makeZip({ 'VERSION': '7.0', 'Content/score.gpif': GPIF });
  const gpif = await gpifFromGpFile(zip);
  assert.deepEqual(gpTracks(gpif).map((t) => t.name), ['Guitar']);
  const r = songFromGpif(gpif, 'gp1');
  assert.deepEqual(r.errors, []);
  const s = r.song!;
  assert.equal(s.title, 'GP Song');
  assert.equal(s.averageTempo, 60);
  assert.deepEqual(s.events.map((e) => [e.kind, e.time]), [['note', 0], ['chord', 1], ['note', 2]]);
  const tied = s.events[2];
  assert.ok(tied.kind === 'note' && Math.abs(tied.sustain - 6) < 1e-9, 'tie extends the half note through the next bar');
  assert.deepEqual(s.sections.map((x) => x.name), ['Intro']);
  assert.equal(s.beats.length, 8);
});

test('songFromTabScore converts beats to seconds with a count-in', () => {
  const sc = emptyScore([40, 45, 50, 55, 59, 64]);
  sc.measures = [{ beats: [{ duration: 4, notes: [{ string: 0, fret: 0 }] }, { duration: 4, notes: [{ string: 1, fret: 2 }, { string: 2, fret: 2 }] }, { duration: 2, notes: [{ string: 0, fret: 3 }] }] }];
  const s = songFromTabScore(sc, { id: 'x', bpm: 120, chordName: () => 'E5' });
  assert.deepEqual(s.events.map((e) => e.time), [4, 4.5, 5]);
  assert.equal(s.events[1].kind === 'chord' && s.events[1].name, 'E5');
  assert.equal(eventsBetween(s, 4.2, 5).length, 1);
  assert.equal(allNotes(s).length, 4);
  const w = fretWindow(s, 4);
  assert.ok(w.lo === 0 && w.hi >= 5);
  const twice = songFromTabScore(sc, { id: 'y', bpm: 120, repeats: 2 });
  assert.equal(twice.events.length, 6);
});
