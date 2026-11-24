/** Play a TabScore with the synth at a tempo, optionally with a click. Returns a stop function. */
import { toPlayback, type TabScore } from '@gma/notation';
import { click, getContext, pluck, type Tone } from './audio';

export function playScore(score: TabScore, bpm: number, opts: { tone?: Tone; clickTrack?: boolean; onEnd?: () => void } = {}): () => void {
  const c = getContext();
  const spb = 60 / bpm;
  const start = c.currentTime + 0.12;
  const notes = toPlayback(score);
  const end = notes.reduce((a, n) => Math.max(a, n.time + n.duration), 0);
  const gain = c.createGain();
  gain.connect(c.destination);
  // Route through a private gain so stop() can silence everything at once.
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (const n of notes) {
    const t = start + n.time * spb;
    const dur = Math.max(0.08, n.duration * spb * (n.techniques.includes('palmMute') ? 0.35 : n.techniques.includes('dead') ? 0.05 : 0.95));
    pluck(n.midi, t, dur, n.techniques.includes('ghost') ? 0.3 : 0.7, opts.tone ?? 'clean', gain);
    if (n.techniques.includes('bend') && n.bend) pluck(n.midi + Math.round(n.bend * 2), t + dur * 0.35, dur * 0.65, 0.5, opts.tone ?? 'clean', gain);
  }
  if (opts.clickTrack) for (let b = 0; b < Math.ceil(end); b++) click(start + b * spb, b % 4 === 0 ? 3 : 2, 'wood', gain);
  timers.push(setTimeout(() => opts.onEnd?.(), (end * spb + 0.3) * 1000));
  return () => {
    timers.forEach(clearTimeout);
    gain.gain.setTargetAtTime(0, c.currentTime, 0.02);
    setTimeout(() => gain.disconnect(), 200);
    opts.onEnd?.();
  };
}
