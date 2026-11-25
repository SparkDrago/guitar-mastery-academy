/**
 * Play mode scoring. The UI feeds analysis frames (detected pitch, chroma and
 * level, already time-aligned to the song); the scorer judges each note or
 * chord as hit or missed inside a timing window, and keeps streak, multiplier
 * and per-section accuracy. Pure logic, no audio or DOM.
 */
import { midiOfNote, type PlaySong, type SongEvent } from '@gma/notation';

export interface PlayFrame {
  /** Song time of the analysed audio, seconds (latency already removed). */
  time: number;
  /** Detected monophonic pitch as fractional MIDI, or null. */
  midi: number | null;
  /** 12-bin chroma (0..1) or null when not computed. */
  chroma: Float32Array | number[] | null;
  /** RMS level 0..1. */
  level: number;
}

export interface Judgement {
  index: number;
  result: 'hit' | 'miss';
  /** Signed timing error in ms for hits (negative = early). */
  errorMs?: number;
}

export interface PlayStats {
  hits: number;
  misses: number;
  judged: number;
  total: number;
  accuracy: number;
  streak: number;
  bestStreak: number;
  multiplier: number;
  score: number;
  sections: { name: string; hits: number; total: number }[];
}

export interface ScorerOptions {
  early?: number;
  late?: number;
  /** Accept the right pitch class in another octave (forgiving for beginners). */
  anyOctave?: boolean;
  /** Only judge events inside [from, to) (riff repeater). */
  from?: number;
  to?: number;
  /** Minimum level for a sound to count. */
  gate?: number;
}

export function multiplierFor(streak: number): number {
  return streak >= 30 ? 4 : streak >= 20 ? 3 : streak >= 10 ? 2 : 1;
}

function chordPcs(song: PlaySong, e: Extract<SongEvent, { kind: 'chord' }>): number[] {
  return [...new Set(e.notes.filter((n) => !n.techniques.includes('dead')).map((n) => midiOfNote(song, n) % 12))];
}

export class PlayScorer {
  readonly song: PlaySong;
  private opts: Required<Omit<ScorerOptions, 'from' | 'to'>> & { from: number; to: number };
  private state: ('pending' | 'hit' | 'miss' | 'skip')[];
  private next = 0;
  private stats: PlayStats;

  constructor(song: PlaySong, opts: ScorerOptions = {}) {
    this.song = song;
    this.opts = { early: opts.early ?? 0.15, late: opts.late ?? 0.2, anyOctave: opts.anyOctave ?? false, gate: opts.gate ?? 0.01, from: opts.from ?? -Infinity, to: opts.to ?? Infinity };
    this.state = song.events.map((e) => (e.time >= this.opts.from && e.time < this.opts.to ? 'pending' : 'skip'));
    const sections = song.sections.map((s) => ({ name: s.name, hits: 0, total: 0 }));
    song.events.forEach((e, i) => { if (this.state[i] === 'pending') { const k = this.sectionIndex(e.time); if (k >= 0) sections[k].total++; } });
    this.stats = { hits: 0, misses: 0, judged: 0, total: this.state.filter((s) => s === 'pending').length, accuracy: 0, streak: 0, bestStreak: 0, multiplier: 1, score: 0, sections };
  }

  private sectionIndex(t: number): number {
    return this.song.sections.findIndex((s) => t >= s.start && t < s.end);
  }

  statusOf(i: number): 'pending' | 'hit' | 'miss' | 'skip' {
    return this.state[i];
  }

  get summary(): PlayStats {
    return { ...this.stats, sections: this.stats.sections.map((s) => ({ ...s })) };
  }

  private matches(e: SongEvent, f: PlayFrame): boolean {
    if (f.level < this.opts.gate) return false;
    const dead = e.kind === 'note' ? e.techniques.includes('dead') : e.notes.every((n) => n.techniques.includes('dead'));
    if (dead) return true; // muted strums only need a sound
    if (e.kind === 'note') {
      if (f.midi === null) return false;
      const want = midiOfNote(this.song, e);
      const diff = f.midi - want;
      // A bent note may be detected anywhere between its start and target pitch.
      const bendUp = e.bend ? e.bend + 0.5 : 0.5;
      if (diff >= -0.5 && diff <= bendUp) return true;
      if (this.opts.anyOctave) {
        const pcDiff = ((Math.round(diff) % 12) + 12) % 12;
        return pcDiff === 0 && Math.abs(diff - Math.round(diff)) <= 0.5;
      }
      return false;
    }
    if (!f.chroma) return false;
    const pcs = chordPcs(this.song, e);
    const c = f.chroma;
    const present = pcs.filter((p) => c[p] >= 0.35).length;
    const need = pcs.length >= 3 ? pcs.length - 1 : pcs.length;
    const others = [...Array(12).keys()].filter((p) => !pcs.includes(p));
    const meanExp = pcs.reduce((a, p) => a + c[p], 0) / Math.max(1, pcs.length);
    const meanOther = others.reduce((a, p) => a + c[p], 0) / Math.max(1, others.length);
    return present >= need && meanExp / (meanOther + 0.05) > 1.6;
  }

  private judge(i: number, result: 'hit' | 'miss', at?: number): Judgement {
    this.state[i] = result;
    const s = this.stats;
    const e = this.song.events[i];
    const k = this.sectionIndex(e.time);
    s.judged++;
    if (result === 'hit') {
      s.hits++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      s.multiplier = multiplierFor(s.streak);
      s.score += 100 * s.multiplier;
      if (k >= 0) s.sections[k].hits++;
    } else {
      s.misses++;
      s.streak = 0;
      s.multiplier = 1;
    }
    s.accuracy = s.judged ? s.hits / s.judged : 0;
    return { index: i, result, errorMs: at !== undefined ? Math.round((at - e.time) * 1000) : undefined };
  }

  /** Feed one analysis frame; returns the events judged by it. */
  update(f: PlayFrame): Judgement[] {
    const out: Judgement[] = [];
    const ev = this.song.events;
    // Expire events whose window has closed.
    while (this.next < ev.length && (this.state[this.next] !== 'pending' || ev[this.next].time + this.opts.late < f.time)) {
      if (this.state[this.next] === 'pending') out.push(this.judge(this.next, 'miss'));
      this.next++;
    }
    // A frame can satisfy at most one pending event: the earliest in its window that it matches.
    for (let i = this.next; i < ev.length && ev[i].time - this.opts.early <= f.time; i++) {
      if (this.state[i] !== 'pending') continue;
      if (f.time > ev[i].time + this.opts.late) continue;
      if (this.matches(ev[i], f)) { out.push(this.judge(i, 'hit', f.time)); break; }
    }
    return out;
  }

  /** Close the run: everything still pending (before `until`) is a miss. */
  finish(until = Infinity): Judgement[] {
    const out: Judgement[] = [];
    this.song.events.forEach((e, i) => { if (this.state[i] === 'pending' && e.time < until) out.push(this.judge(i, 'miss')); });
    return out;
  }
}
