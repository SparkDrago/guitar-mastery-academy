import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  yin, TunerEngine, matchString, detectOnsets, analyseTiming, analyseTimingGrid, checkPitches, timingFeedback,
  clickTime, scheduleUntil, tapTempo, defaultAccents, clampBpm, METRONOME_PRESETS,
  arrange, JAM_STYLES, voiceChord, swingTime, type MetronomeConfig,
} from '@gma/audio';
import { findTuning, STANDARD_TUNING } from '@gma/theory';

const SR = 48000;

/** Guitar-like tone: harmonics with a strong 2nd partial, optional decay and noise. */
function tone(freq: number, seconds: number, opts: { harmonics?: number[]; decay?: number; noise?: number; amp?: number; offset?: number } = {}): Float32Array {
  const n = Math.floor(seconds * SR);
  const out = new Float32Array(n);
  const h = opts.harmonics ?? [1, 0.9, 0.5, 0.35, 0.2, 0.12];
  const amp = opts.amp ?? 0.4;
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / SR + (opts.offset ?? 0);
    let v = 0;
    h.forEach((a, k) => (v += a * Math.sin(2 * Math.PI * freq * (k + 1) * t + k)));
    const env = opts.decay ? Math.exp(-t * opts.decay) : 1;
    out[i] = amp * env * v / h.length + (opts.noise ?? 0) * rnd();
  }
  return out;
}

const cents = (f: number, ref: number) => 1200 * Math.log2(f / ref);

test('YIN detects guitar fundamentals across the range (including extended-range strings)', () => {
  for (const f of [36.71 /* D1, 8-string drop D */, 46.25 /* F#1 */, 61.74 /* B1 */, 82.41, 110, 146.83, 196, 246.94, 329.63, 659.26, 1046.5]) {
    const frame = tone(f, 4096 / SR + 0.001).subarray(0, 4096);
    const est = yin(frame, SR)!;
    assert.ok(est, `pitch found for ${f}`);
    assert.ok(Math.abs(cents(est.freq, f)) < 3, `${f} Hz detected as ${est.freq.toFixed(2)} Hz`);
    assert.ok(est.probability > 0.85, `${f} Hz is confidently periodic`);
  }
});

test('YIN rejects silence and reports low probability for noise', () => {
  assert.equal(yin(new Float32Array(4096), SR), null);
  const noise = new Float32Array(4096).map(() => Math.random() * 2 - 1);
  const est = yin(noise, SR);
  assert.ok(!est || est.probability < 0.6, 'white noise is not periodic');
});

test('YIN stays accurate with moderate noise and a strong 2nd harmonic (no octave error)', () => {
  const frame = tone(82.41, 0.1, { harmonics: [0.6, 1, 0.7, 0.4], noise: 0.02 }).subarray(0, 4096);
  const est = yin(frame, SR)!;
  assert.ok(Math.abs(cents(est.freq, 82.41)) < 5, `got ${est.freq}`);
});

test('Tuner engine: cents, string match, flat/sharp, lock and A4 calibration', () => {
  const engine = new TunerEngine();
  const strings = STANDARD_TUNING.strings;
  const flatA = 110 * Math.pow(2, -12 / 1200);
  let r = null;
  for (let k = 0; k < 8; k++) r = engine.process(tone(flatA, 0.09, { offset: k * 0.09 }).subarray(0, 4096), SR, strings);
  assert.ok(r);
  assert.equal(r!.note, 'A');
  assert.equal(r!.octave, 2);
  assert.equal(r!.target!.index, 1, 'A string');
  assert.ok(Math.abs(r!.cents + 12) < 1.5, `cents ${r!.cents}`);
  assert.equal(r!.status, 'flat');
  assert.equal(r!.locked, false);

  engine.reset();
  for (let k = 0; k < 8; k++) r = engine.process(tone(329.63, 0.09, { offset: k * 0.09 }).subarray(0, 4096), SR, strings);
  assert.equal(r!.status, 'in-tune');
  assert.equal(r!.locked, true);
  assert.equal(r!.target!.index, 5, 'high E');

  const tuned432 = new TunerEngine({ a4: 432 });
  for (let k = 0; k < 6; k++) r = tuned432.process(tone(432, 0.09, { offset: k * 0.09 }).subarray(0, 4096), SR, []);
  assert.equal(r!.note, 'A');
  assert.ok(Math.abs(r!.cents) < 1.5);
});

test('Tuner engine: chromatic notes outside the tuning and alternate tunings', () => {
  const engine = new TunerEngine();
  let r = null;
  for (let k = 0; k < 6; k++) r = engine.process(tone(277.18, 0.09, { offset: k * 0.09 }).subarray(0, 4096), SR, STANDARD_TUNING.strings);
  assert.equal(r!.note, 'C#', 'all 12 semitones are detected, not only string notes');
  const dropD = findTuning('drop-d')!;
  engine.reset();
  for (let k = 0; k < 6; k++) r = engine.process(tone(73.42, 0.09, { offset: k * 0.09 }).subarray(0, 4096), SR, dropD.strings);
  assert.equal(r!.target!.index, 0);
  assert.equal(r!.target!.note, 'D');
  const eight = findTuning('8-standard')!;
  engine.reset();
  for (let k = 0; k < 6; k++) r = engine.process(tone(46.25, 0.09, { offset: k * 0.09 }).subarray(0, 4096), SR, eight.strings);
  assert.equal(r!.target!.index, 0, 'low F# of an 8-string');
});

test('Tuner engine: noise gate, outlier rejection and manual string octave hints', () => {
  const engine = new TunerEngine();
  assert.equal(engine.process(tone(110, 0.09, { amp: 0.0005 }).subarray(0, 4096), SR, []), null, 'below the noise gate');
  let r = null;
  for (let k = 0; k < 5; k++) r = engine.process(tone(110, 0.09, { offset: k * 0.09 }).subarray(0, 4096), SR, []);
  const before = r!.midiFloat;
  r = engine.process(tone(220, 0.09).subarray(0, 4096), SR, []); // single-frame octave glitch
  assert.ok(Math.abs(r!.midiFloat - before) < 0.05, 'a one-frame jump does not move the needle');
  r = engine.process(tone(220, 0.09, { offset: 0.09 }).subarray(0, 4096), SR, []);
  assert.ok(Math.abs(r!.midiFloat - 57) < 0.1, 'a sustained new note is accepted');
  const m = matchString(52, STANDARD_TUNING.strings, 0); // E3 while tuning low E2
  assert.equal(m.octaveHint, 'down');
});

test('Onset detection and timing analysis on synthetic plucks', () => {
  const bpm = 120;
  const step = 60 / bpm / 2; // eighth notes
  const jitter = [0, 0.012, -0.008, 0.02, -0.015, 0.005, 0.01, -0.01, 0, 0.018, -0.006, 0.004, 0.009, -0.012, 0.0, 0.006];
  const start = 0.5;
  const total = start + jitter.length * step + 0.5;
  const sig = new Float32Array(Math.floor(total * SR));
  jitter.forEach((j, i) => {
    const t0 = start + i * step + j;
    const pluck = tone(196 * (i % 2 ? 1.122 : 1), step * 0.9, { decay: 9 });
    sig.set(pluck, Math.floor(t0 * SR));
  });
  const onsets = detectOnsets(sig, SR);
  assert.equal(onsets.length, jitter.length, `found ${onsets.length} onsets`);
  onsets.forEach((o, i) => assert.ok(Math.abs(o.time - (start + i * step + jitter[i])) < 0.015, `onset ${i} at ${o.time}`));
  const timing = analyseTiming(onsets, bpm, 2, start, jitter.length);
  assert.equal(timing.matched, jitter.length);
  assert.ok(timing.meanAbsErrorMs < 18, `mean abs error ${timing.meanAbsErrorMs}`);
  assert.ok(timing.playedBpm! > 112 && timing.playedBpm! < 128);
  const fb = timingFeedback(timing, bpm);
  assert.ok(fb.every((f) => f.evidence.length > 0), 'every statement cites its measurement');
  const pitches = checkPitches(sig, SR, onsets.map((o) => o.time), [55, 57]);
  assert.ok(pitches.filter((p) => p.correct).length >= 14, 'G3/A3 alternation recognised');
});

test('Timing analysis detects a dragging tempo and too-few notes', () => {
  const start = 0.2;
  const onsets = Array.from({ length: 24 }, (_, i) => ({ time: start + i * 0.25 + i * 0.004, strength: 1 }));
  const r = analyseTiming(onsets, 120, 2, start, 24);
  assert.ok(r.driftMsPerBar > 8, `drift ${r.driftMsPerBar}`);
  assert.ok(timingFeedback(r, 120).some((f) => f.kind === 'tempo' && /slows/.test(f.message)));
  const sparse = analyseTiming([{ time: 0.2, strength: 1 }], 120, 2, 0.2, 16);
  assert.equal(timingFeedback(sparse, 120)[0].kind, 'completion');
});

test('Metronome: drift-free click times, lookahead scheduling, accents, swing and tap tempo', () => {
  const cfg: MetronomeConfig = { bpm: 120, beatsPerBar: 4, beatUnit: 4, subdivision: 2, accents: defaultAccents(4) };
  assert.equal(clickTime(cfg, 10, 0), 10);
  assert.equal(clickTime(cfg, 10, 2), 10.5);
  assert.ok(Math.abs(clickTime(cfg, 0, 20000) - 5000) < 1e-9, 'no cumulative drift after 20,000 clicks');
  const a = scheduleUntil(cfg, 0, 0, 1.0);
  assert.equal(a.events.length, 4);
  assert.equal(a.events[0].level, 3);
  assert.equal(a.events[1].level, 1);
  assert.equal(a.events[2].level, 2);
  const b = scheduleUntil(cfg, 0, a.next, 2.0);
  assert.equal(b.events[0].time, 1.0, 'scheduling continues seamlessly');
  const swing = { ...cfg, swing: 2 / 3 };
  assert.ok(Math.abs(clickTime(swing, 0, 1) - (2 / 3) * 0.5) < 1e-9);
  assert.equal(tapTempo([0, 500, 1000, 1500]), 120);
  assert.equal(tapTempo([0]), null);
  assert.equal(clampBpm(1000), 400);
  assert.ok(METRONOME_PRESETS.length >= 8);
});

test('Arranger: every style produces valid, in-range events', () => {
  const chords = [
    { start: 0, beats: 4, rootPc: 9, pcs: [9, 1, 4, 7], symbol: 'A7' },
    { start: 4, beats: 4, rootPc: 2, pcs: [2, 6, 9, 0], symbol: 'D7' },
  ];
  for (const style of JAM_STYLES) {
    const ev = arrange(chords, style);
    assert.ok(ev.length > 5, style.id);
    for (const e of ev) {
      assert.ok(e.t >= 0 && e.t < 8.001 && Number.isFinite(e.dur) && e.dur > 0, `${style.id} event in range`);
      if (e.notes) e.notes.forEach((m) => assert.ok(m >= 24 && m <= 96, `${style.id} note ${m}`));
    }
    const bassOnOne = ev.find((e) => e.inst === 'bass' && Math.abs(e.t) < 1e-9);
    if (bassOnOne && style.bass !== 'pedal') assert.equal(bassOnOne.notes![0] % 12, 9, `${style.id} bass starts on the root`);
  }
  assert.deepEqual(voiceChord([0, 4, 7], 52), [60, 64, 67]);
  assert.equal(swingTime(1.5, 2 / 3), 1 + 2 / 3);
  assert.equal(swingTime(1.25, 2 / 3), 1.25);
});

test('analyseTimingGrid matches irregular rhythms and reports per-note matches', () => {
  // Quarter, quarter, rest, eighth, eighth at 100 bpm (0.6 s per beat).
  const grid = [1.0, 1.6, 2.8, 3.1];
  const onsets = [{ time: 1.01, strength: 1 }, { time: 1.58, strength: 1 }, { time: 2.2, strength: 0.3 }, { time: 2.83, strength: 1 }, { time: 3.1, strength: 1 }];
  const r = analyseTimingGrid(onsets, grid, 100);
  assert.equal(r.matched, 4);
  assert.deepEqual(r.matches.map((m) => m.index), [0, 1, 2, 3]);
  assert.ok(Math.abs(r.matches[2].errorMs - 30) < 1e-6);
  assert.equal(r.playedBpm, null, 'irregular grids do not claim a played tempo');
  assert.equal(r.extra, 1, 'the stray onset in the rest is reported as extra');
});
