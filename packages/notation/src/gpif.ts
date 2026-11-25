/**
 * Guitar Pro 7/8 (.gp) import. A .gp file is a ZIP whose Content/score.gpif is
 * an open XML document describing master bars, bars, voices, beats, notes and
 * rhythms. Only the first voice of a fretted track is imported.
 */
import { child, children, num, parseXml, textOf, type XmlNode } from './xml';
import { listZip, readZipEntry } from './zip';
import type { Technique } from './model';
import type { PlaySong, SongEvent, SongNote, SongSection } from './song';

const NOTE_VALUES: Record<string, number> = { Whole: 4, Half: 2, Quarter: 1, Eighth: 0.5, '16th': 0.25, '32nd': 0.125, '64th': 0.0625, '128th': 0.03125 };

export interface GpTrackInfo { index: number; name: string; strings: number }

function prop(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return children(child(node, 'Properties'), 'Property').find((p) => p.attrs.name === name);
}

const ids = (s: string | undefined) => (s ?? '').trim().split(/\s+/).filter(Boolean).map(Number);

export async function gpifFromGpFile(bytes: Uint8Array): Promise<string> {
  const entries = listZip(bytes);
  const e = entries.find((x) => /score\.gpif$/i.test(x.name));
  if (!e) throw new Error('This .gp file has no score.gpif (Guitar Pro 6 .gpx and GP3–5 files are not supported; export as Guitar Pro 7/8 or MusicXML).');
  return new TextDecoder().decode(await readZipEntry(bytes, e));
}

function tuningOf(track: XmlNode): number[] | null {
  const staff = child(child(track, 'Staves'), 'Staff');
  const p = prop(staff, 'Tuning') ?? prop(track, 'Tuning');
  const pitches = ids(textOf(p, 'Pitches'));
  return pitches.length >= 4 ? pitches : null;
}

export function gpTracks(gpif: string): GpTrackInfo[] {
  const doc = child(parseXml(gpif), 'GPIF');
  return children(child(doc, 'Tracks'), 'Track').map((t, index) => ({ index, name: textOf(t, 'Name') ?? `Track ${index + 1}`, strings: tuningOf(t)?.length ?? 0 })).filter((t) => t.strings > 0);
}

export function songFromGpif(gpif: string, id: string, trackIndex?: number): { song: PlaySong | null; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const doc = child(parseXml(gpif), 'GPIF');
  if (!doc) return { song: null, warnings, errors: ['Not a Guitar Pro score.'] };
  const tracks = children(child(doc, 'Tracks'), 'Track');
  const fretted = tracks.map((t, i) => ({ t, i, tuning: tuningOf(t) })).filter((x) => x.tuning);
  if (!fretted.length) return { song: null, warnings, errors: ['No guitar or bass track with a tuning was found.'] };
  const pick = fretted.find((x) => x.i === trackIndex) ?? fretted[0];
  const strings = pick.tuning!;
  const capo = num(textOf(prop(child(child(pick.t, 'Staves'), 'Staff'), 'CapoFret'), 'Fret'));

  const byId = (list: string, item: string) => new Map(children(child(doc, list), item).map((n) => [n.attrs.id, n]));
  const bars = byId('Bars', 'Bar');
  const voices = byId('Voices', 'Voice');
  const beats = byId('Beats', 'Beat');
  const notes = byId('Notes', 'Note');
  const rhythms = byId('Rhythms', 'Rhythm');
  const masterBars = children(child(doc, 'MasterBars'), 'MasterBar');

  // Tempo map: automations of type Tempo (bpm per quarter) by bar.
  const tempos = children(child(child(doc, 'MasterTrack'), 'Automations'), 'Automation')
    .filter((a) => textOf(a, 'Type') === 'Tempo')
    .map((a) => { const [bpm, unit] = (textOf(a, 'Value') ?? '120 2').split(/\s+/).map(Number); return { bar: num(textOf(a, 'Bar')), pos: num(textOf(a, 'Position')), bpm: (bpm || 120) * ((unit === 1 ? 0.5 : unit === 3 ? 1.5 : unit === 4 ? 2 : 1)) }; })
    .sort((a, b) => a.bar - b.bar || a.pos - b.pos);
  const tempoAt = (bar: number) => { let t = tempos[0]?.bpm ?? 120; for (const x of tempos) if (x.bar <= bar) t = x.bpm; return t; };

  const events: SongEvent[] = [];
  const beatList: PlaySong['beats'] = [];
  const sections: SongSection[] = [];
  let time = 0;
  let tieCarry = new Map<number, SongNote>();
  const slideFrom = new Map<number, SongNote>();
  const lastFret = new Map<number, number>();
  masterBars.forEach((mb, bi) => {
    const [numr, den] = (textOf(mb, 'Time') ?? '4/4').split('/').map(Number);
    const barQuarters = (numr * 4) / (den || 4);
    const bpm = tempoAt(bi);
    const spq = 60 / bpm;
    const section = child(mb, 'Section');
    if (section) sections.push({ name: textOf(section, 'Text') || textOf(section, 'Letter') || `Section ${sections.length + 1}`, start: time, end: 0 });
    for (let q = 0; q < numr; q++) beatList.push({ time: time + q * (4 / (den || 4)) * spq, downbeat: q === 0 });
    const barId = ids(textOf(mb, 'Bars'))[pick.i];
    const bar = bars.get(String(barId));
    const voiceId = ids(textOf(bar, 'Voices')).find((v) => v >= 0);
    const voice = voices.get(String(voiceId));
    let pos = 0;
    for (const beatId of ids(textOf(voice, 'Beats'))) {
      const beat = beats.get(String(beatId));
      if (!beat) continue;
      const rh = rhythms.get(child(beat, 'Rhythm')?.attrs.ref ?? '');
      let len = NOTE_VALUES[textOf(rh, 'NoteValue') ?? 'Quarter'] ?? 1;
      const dot = num(child(rh, 'AugmentationDot')?.attrs.count);
      if (dot === 1) len *= 1.5; else if (dot === 2) len *= 1.75;
      const tup = child(rh, 'PrimaryTuplet');
      if (tup) len *= num(tup.attrs.den, 1) / num(tup.attrs.num, 1);
      const t = time + pos * spq;
      const noteIds = ids(textOf(beat, 'Notes'));
      const made: SongNote[] = [];
      const nextCarry = new Map<number, SongNote>();
      for (const nid of noteIds) {
        const n = notes.get(String(nid));
        if (!n) continue;
        const s = num(textOf(prop(n, 'String'), 'String'), -1);
        const f = num(textOf(prop(n, 'Fret'), 'Fret'), -1);
        if (s < 0 || f < 0 || s >= strings.length) continue;
        const tie = child(n, 'Tie');
        if (tie?.attrs.destination === 'true' && tieCarry.has(s)) {
          const prev = tieCarry.get(s)!;
          prev.sustain = t + len * spq - prev.time;
          nextCarry.set(s, prev);
          continue;
        }
        const tech: Technique[] = [];
        if (prop(n, 'HopoDestination')) tech.push((lastFret.get(s) ?? -1) > f ? 'pull' : 'hammer');
        if (prop(n, 'PalmMuted')) tech.push('palmMute');
        if (prop(n, 'Muted')) tech.push('dead');
        // Bends: values in GP are 100 per whole step (2 semitones).
        const bOrigin = num(textOf(prop(n, 'BendOriginValue'), 'Float'), 0);
        const bMiddle = num(textOf(prop(n, 'BendMiddleValue'), 'Float'), 0);
        const bDest = num(textOf(prop(n, 'BendDestinationValue'), 'Float'), 0);
        const bPeak = Math.max(bOrigin, bMiddle, bDest);
        if (prop(n, 'Bended') && bPeak > 0) {
          tech.push('bend');
          if (bOrigin > 0) tech.push('prebend');
          if (bDest < bPeak - 1) tech.push('release');
        }
        // Slide flags: 1 shift, 2 legato (direction from the next note), 4 out down, 8 out up, 16 in from below, 32 in from above.
        const slide = num(textOf(prop(n, 'Slide'), 'Flags'), 0);
        if (slide & 3) tech.push('slideUp'); // direction and target fixed once the next note on the string is known
        if (slide & 12) tech.push('slideOut');
        if (slide & 48) tech.push('slideIn');
        const harm = textOf(prop(n, 'HarmonicType'), 'HType');
        if (harm !== undefined || prop(n, 'HarmonicType')) tech.push(!harm || /natural/i.test(harm) ? 'harmonic' : 'artificialHarmonic');
        if (child(n, 'Vibrato')) tech.push('vibrato');
        if (prop(n, 'Tapped')) tech.push('tap');
        if (child(n, 'LetRing')) tech.push('letRing');
        if (num(textOf(n, 'Accent'), 0) & 12) tech.push('accent');
        if (child(n, 'AntiAccent')) tech.push('ghost');
        if (child(beat, 'Tremolo')) tech.push('tremolo');
        const note: SongNote = { time: t, string: s, fret: f, sustain: len * spq >= 0.45 ? len * spq * 0.9 : 0, techniques: tech, bend: bPeak > 0 && tech.includes('bend') ? bPeak / 50 : undefined };
        const pendingSlide = slideFrom.get(s);
        if (pendingSlide) {
          // The previous note on this string slid here: set its target and direction.
          pendingSlide.slideTo = f;
          if (f < pendingSlide.fret) pendingSlide.techniques = pendingSlide.techniques.map((k) => (k === 'slideUp' ? 'slideDown' : k));
          slideFrom.delete(s);
        }
        if (slide & 3) slideFrom.set(s, note);
        made.push(note);
        lastFret.set(s, f);
        if (tie?.attrs.origin === 'true') nextCarry.set(s, note);
      }
      tieCarry = nextCarry;
      if (made.length === 1) events.push(Object.assign(made[0], { kind: 'note' as const })); // same object, so a later tie can extend it
      else if (made.length > 1) events.push({ kind: 'chord', time: t, name: '', notes: made.sort((a, b) => a.string - b.string), sustain: Math.max(...made.map((m) => m.sustain)), techniques: [] });
      pos += len;
    }
    time += barQuarters * spq;
  });
  sections.forEach((s, k) => { s.end = k + 1 < sections.length ? sections[k + 1].start : time; });
  if (!events.length) return { song: null, warnings, errors: ['The selected track has no notes.'] };
  const score = child(doc, 'Score');
  const avgTempo = tempos.length ? Math.round(tempos.reduce((a, x) => a + x.bpm, 0) / tempos.length) : 120;
  if (fretted.length > 1) warnings.push(`Imported track “${textOf(pick.t, 'Name') ?? pick.i + 1}”; the file has ${fretted.length} fretted tracks.`);
  return {
    song: {
      format: 'gma-song', version: 1, id, title: textOf(score, 'Title') || 'Untitled', artist: textOf(score, 'Artist') || '', album: textOf(score, 'Album') || undefined,
      arrangement: textOf(pick.t, 'Name') || 'Guitar', tuning: { name: `${strings.length}-string`, strings }, capo, duration: time + 1, averageTempo: avgTempo,
      beats: beatList, sections: sections.length ? sections : [{ name: 'Song', start: 0, end: time }], events, source: 'guitar-pro',
    },
    warnings, errors: [],
  };
}
