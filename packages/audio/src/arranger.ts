/**
 * Procedural backing-track arranger. Turns a chord progression plus a genre
 * style into a list of timed note events (drums, bass, comping). All musical
 * material is generated here, so nothing depends on recorded or licensed audio.
 */

export type Instrument = 'kick' | 'snare' | 'hat' | 'openhat' | 'ride' | 'crash' | 'bass' | 'chord';

export interface ArrEvent {
  /** Start time in beats from the beginning of the loop. */
  t: number;
  /** Duration in beats. */
  dur: number;
  inst: Instrument;
  /** MIDI notes (chord) or single note; drums have none. */
  notes?: number[];
  vel: number;
}

export interface ChordSlot {
  /** Start, in beats from the loop start. */
  start: number;
  beats: number;
  rootPc: number;
  /** Pitch classes of the chord, root first. */
  pcs: number[];
  symbol: string;
}

type BassStyle = 'root-eighths' | 'root-fifth' | 'walking' | 'gallop' | 'syncopated' | 'pedal' | 'arp' | 'whole';
type CompStyle = 'power-eighths' | 'stabs' | 'pad' | 'arpeggio' | 'shuffle' | 'strum' | 'chug' | 'skank';

export interface JamStyle {
  id: string;
  name: string;
  /** 0.5 = straight eighths, ~0.667 = shuffle/swing. */
  swing: number;
  /** 16-step patterns for one 4/4 bar; "x" = hit, "o" = soft hit, "." = rest. */
  kick: string;
  snare: string;
  hat: string;
  hatInst?: Instrument;
  bass: BassStyle;
  comp: CompStyle;
  defaultBpm: number;
  bpmRange: [number, number];
  tone: 'clean' | 'crunch' | 'distorted' | 'pad';
  description: string;
}

export const JAM_STYLES: JamStyle[] = [
  { id: 'blues', name: 'Blues shuffle', swing: 0.667, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'walking', comp: 'shuffle', defaultBpm: 90, bpmRange: [60, 140], tone: 'crunch', description: 'Shuffled eighths, walking bass, I–IV–V dominant chords.' },
  { id: 'classic-rock', name: 'Classic rock', swing: 0.5, kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'root-eighths', comp: 'power-eighths', defaultBpm: 116, bpmRange: [90, 150], tone: 'crunch', description: 'Straight eighths, driving bass, power-chord rhythm.' },
  { id: 'hard-rock', name: 'Hard rock', swing: 0.5, kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', hatInst: 'ride', bass: 'root-eighths', comp: 'chug', defaultBpm: 126, bpmRange: [100, 160], tone: 'distorted', description: 'Heavier groove with palm-muted chugs.' },
  { id: 'heavy-metal', name: 'Heavy metal', swing: 0.5, kick: 'x.x.x.x.x.x.x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'gallop', comp: 'chug', defaultBpm: 140, bpmRange: [110, 180], tone: 'distorted', description: 'Galloping rhythm, double-time kick.' },
  { id: 'thrash-metal', name: 'Thrash metal', swing: 0.5, kick: 'x.x.x.x.x.x.x.x.', snare: '..x...x...x...x.', hat: 'x.x.x.x.x.x.x.x.', bass: 'root-eighths', comp: 'chug', defaultBpm: 180, bpmRange: [150, 230], tone: 'distorted', description: 'Fast skank beat with tremolo-picked rhythm.' },
  { id: 'progressive-metal', name: 'Progressive metal', swing: 0.5, kick: 'x..x..x...x..x..', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', hatInst: 'ride', bass: 'syncopated', comp: 'chug', defaultBpm: 120, bpmRange: [90, 160], tone: 'distorted', description: 'Syncopated kick accents and palm-muted figures.' },
  { id: 'neoclassical', name: 'Neoclassical', swing: 0.5, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'arp', comp: 'arpeggio', defaultBpm: 120, bpmRange: [90, 170], tone: 'distorted', description: 'Arpeggiated harmony with a classical bass line.' },
  { id: 'jazz', name: 'Jazz swing', swing: 0.667, kick: 'o.......o.......', snare: '........o.......', hat: '....x.......x...', hatInst: 'ride', bass: 'walking', comp: 'stabs', defaultBpm: 140, bpmRange: [80, 220], tone: 'clean', description: 'Ride-cymbal swing, walking bass, comping stabs.' },
  { id: 'fusion', name: 'Fusion', swing: 0.5, kick: 'x..x....x.x.....', snare: '....x..o....x...', hat: 'xoxoxoxoxoxoxoxo', bass: 'syncopated', comp: 'pad', defaultBpm: 108, bpmRange: [80, 140], tone: 'clean', description: 'Sixteenth-note groove with extended chords.' },
  { id: 'funk', name: 'Funk', swing: 0.5, kick: 'x..x..x...x.....', snare: '....x..o.o..x...', hat: 'xxxxxxxxxxxxxxxx', bass: 'syncopated', comp: 'skank', defaultBpm: 100, bpmRange: [85, 120], tone: 'clean', description: 'Tight sixteenths, chicken-scratch stabs.' },
  { id: 'pop', name: 'Pop', swing: 0.5, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'root-fifth', comp: 'strum', defaultBpm: 100, bpmRange: [80, 130], tone: 'clean', description: 'Even eighths, strummed chords.' },
  { id: 'ambient', name: 'Ambient', swing: 0.5, kick: 'x...............', snare: '................', hat: '........x.......', hatInst: 'ride', bass: 'whole', comp: 'pad', defaultBpm: 70, bpmRange: [50, 90], tone: 'pad', description: 'Sustained pads and sparse pulse; space for long notes.' },
  { id: 'modal-rock', name: 'Modal rock', swing: 0.5, kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'pedal', comp: 'power-eighths', defaultBpm: 110, bpmRange: [85, 140], tone: 'crunch', description: 'Pedal-tone bass under shifting chords to spotlight the mode.' },
];

export function getStyle(id: string): JamStyle {
  return JAM_STYLES.find((s) => s.id === id) ?? JAM_STYLES[0];
}

/** Lowest MIDI note >= `floor` with the given pitch class. */
function pcAtOrAbove(pc: number, floor: number): number {
  let m = floor + ((((pc - floor) % 12) + 12) % 12);
  if (m < floor) m += 12;
  return m;
}

/** Close-position chord voicing whose notes start at or above `floor`. */
export function voiceChord(pcs: number[], floor = 52, maxNotes = 4): number[] {
  const tones = pcs.slice(0, maxNotes);
  const root = pcAtOrAbove(tones[0], floor);
  const out = [root];
  for (const pc of tones.slice(1)) {
    let m = pcAtOrAbove(pc, out[out.length - 1] + 1);
    if (m - root > 16) m -= 12;
    out.push(m);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Apply swing to a time in beats (only the off-beat eighth is moved). */
export function swingTime(t: number, swing: number): number {
  if (swing === 0.5) return t;
  const beat = Math.floor(t + 1e-9);
  const frac = t - beat;
  if (Math.abs(frac - 0.5) < 1e-6) return beat + swing;
  return t;
}

export interface ArrangeOptions {
  beatsPerBar?: number;
  /** 1 = sparse, 2 = normal, 3 = busy. Affects comping and fills. */
  density?: 1 | 2 | 3;
}

export function arrange(chords: ChordSlot[], style: JamStyle, opts: ArrangeOptions = {}): ArrEvent[] {
  const bpb = opts.beatsPerBar ?? 4;
  const density = opts.density ?? 2;
  const events: ArrEvent[] = [];
  const total = chords.reduce((a, c) => Math.max(a, c.start + c.beats), 0);
  const bars = Math.ceil(total / bpb);

  // Drums: the 16-step grid covers 4 beats; for other meters it is cycled by beat.
  for (let b = 0; b < bars; b++) {
    for (let beat = 0; beat < bpb; beat++) {
      for (let step = 0; step < 4; step++) {
        const gridIdx = ((beat % 4) * 4 + step) % 16;
        const t = b * bpb + beat + step / 4;
        if (t >= total) continue;
        const hit = (pat: string, inst: Instrument, loud: number) => {
          const ch = pat[gridIdx];
          if (ch === 'x' || ch === 'o') events.push({ t: swingTime(t, style.swing), dur: 0.25, inst, vel: ch === 'x' ? loud : loud * 0.45 });
        };
        hit(style.kick, 'kick', 0.95);
        // Backbeat lands on the last beat of odd meters too.
        hit(style.snare, 'snare', 0.85);
        if (density > 1 || step % 2 === 0) hit(style.hat, style.hatInst ?? 'hat', 0.5);
      }
    }
    if (b === 0) events.push({ t: 0, dur: 1, inst: 'crash', vel: 0.6 });
  }

  chords.forEach((c, ci) => {
    const next = chords[(ci + 1) % chords.length];
    const bassRoot = pcAtOrAbove(c.rootPc, 28);
    const fifth = bassRoot + 7;
    const third = pcAtOrAbove(c.pcs[1] ?? c.rootPc, bassRoot);
    const nextRoot = pcAtOrAbove(next.rootPc, 28);
    const end = c.start + c.beats;
    const push = (t: number, dur: number, inst: Instrument, notes: number[], vel: number) => {
      if (t < end - 1e-9) events.push({ t: swingTime(t, style.swing), dur: Math.min(dur, end - t), inst, notes, vel });
    };

    // ── Bass ──
    for (let t = c.start; t < end - 1e-9; ) {
      const beatInChord = t - c.start;
      switch (style.bass) {
        case 'root-eighths': push(t, 0.5, 'bass', [bassRoot], beatInChord % 1 === 0 ? 0.9 : 0.7); t += 0.5; break;
        case 'root-fifth': push(t, 1, 'bass', [Math.floor(beatInChord) % 2 === 0 ? bassRoot : fifth], 0.85); t += 1; break;
        case 'pedal': push(t, 0.5, 'bass', [pcAtOrAbove(chords[0].rootPc, 28)], 0.85); t += 0.5; break;
        case 'whole': push(t, c.beats, 'bass', [bassRoot], 0.7); t = end; break;
        case 'gallop': {
          push(t, 0.5, 'bass', [bassRoot], 0.9); push(t + 0.5, 0.25, 'bass', [bassRoot], 0.7); push(t + 0.75, 0.25, 'bass', [bassRoot], 0.7);
          t += 1; break;
        }
        case 'syncopated': {
          const pattern = [0, 0.75, 1.5, 2.5, 3];
          const notes = [bassRoot, bassRoot, bassRoot + 12, fifth, bassRoot];
          pattern.forEach((p, i) => { if (c.start + p < end) push(c.start + p, 0.4, 'bass', [notes[i]], i === 0 ? 0.95 : 0.75); });
          t = end; break;
        }
        case 'arp': {
          const arp = [bassRoot, third, fifth, third];
          push(t, 0.5, 'bass', [arp[Math.round(beatInChord * 2) % 4]], 0.8); t += 0.5; break;
        }
        case 'walking': {
          const beatIdx = Math.round(beatInChord);
          const last = t + 1 >= end - 1e-9;
          let note: number;
          if (beatIdx === 0) note = bassRoot;
          else if (last) note = nextRoot + (nextRoot > bassRoot + 2 ? -1 : 1); // chromatic approach
          else note = [third, fifth, bassRoot + 12, fifth][(beatIdx - 1) % 4];
          push(t, 1, 'bass', [note], 0.8); t += 1; break;
        }
      }
    }

    // ── Comping ──
    const chordVoicing = voiceChord(c.pcs, 52, 4);
    const power = [pcAtOrAbove(c.rootPc, 40), pcAtOrAbove(c.rootPc, 40) + 7, pcAtOrAbove(c.rootPc, 40) + 12];
    switch (style.comp) {
      case 'pad': push(c.start, c.beats, 'chord', voiceChord(c.pcs, 55, 5), 0.45); break;
      case 'strum':
        for (let t = c.start; t < end; t += 1) {
          push(t, 0.9, 'chord', chordVoicing, 0.6);
          if (density > 1) push(t + 0.5, 0.45, 'chord', chordVoicing, 0.4);
        }
        break;
      case 'power-eighths':
        for (let t = c.start; t < end; t += 0.5) push(t, 0.45, 'chord', power, (t - c.start) % 1 === 0 ? 0.7 : 0.55);
        break;
      case 'chug':
        for (let t = c.start; t < end; t += density === 3 ? 0.25 : 0.5) push(t, 0.2, 'chord', power.slice(0, 2), 0.6);
        break;
      case 'shuffle': {
        // Classic boogie: root+5 / root+6 alternation on the low strings.
        const r = pcAtOrAbove(c.rootPc, 40);
        for (let t = c.start; t < end; t += 0.5) {
          const second = Math.floor((t - c.start) * 2) % 4 >= 2;
          push(t, 0.45, 'chord', [r, r + (second ? 9 : 7)], 0.6);
        }
        break;
      }
      case 'stabs': {
        const hits = density === 1 ? [1.5] : [0, 1.5, 2.5];
        for (let bar = c.start; bar < end; bar += bpb) hits.forEach((h) => push(bar + h, 0.4, 'chord', voiceChord(c.pcs, 55, 4), 0.5));
        break;
      }
      case 'skank': {
        for (let t = c.start; t < end; t += 0.25) {
          const pos = Math.round((t - c.start) * 4) % 16;
          if ([2, 6, 7, 10, 14].includes(pos) || (density === 3 && pos % 2 === 1)) push(t, 0.12, 'chord', voiceChord(c.pcs, 60, 3), 0.45);
        }
        break;
      }
      case 'arpeggio': {
        const arp = voiceChord(c.pcs, 57, 3);
        const seq = [...arp, arp[0] + 12, ...arp.slice(1).reverse()];
        let i = 0;
        for (let t = c.start; t < end; t += 0.25, i++) push(t, 0.25, 'chord', [seq[i % seq.length]], 0.5);
        break;
      }
    }
  });

  return events.sort((a, b) => a.t - b.t);
}

/** Convert beats to seconds at a tempo. */
export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}
