/**
 * Browser audio: one shared AudioContext, synthesised instruments (no samples,
 * so nothing to license), a drift-free metronome, the backing-track player,
 * microphone input for the tuner, and a recorder for the Playing Analyzer.
 * Microphone audio is processed on the device and never uploaded.
 */
import { scheduleUntil, type ClickEvent, type MetronomeConfig, type ArrEvent, beatsToSeconds } from '@gma/audio';
import { sendMidiNote, shouldMuteSynth } from './midi';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

export function audioSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}

/** Create or resume the shared context. Call from a user gesture. */
export function getContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function out(): GainNode {
  getContext();
  return master!;
}

export function setMasterVolume(v: number) {
  out().gain.value = v;
}

function noise(): AudioBuffer {
  const c = getContext();
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

export const midiFreq = (m: number, a4 = 440) => a4 * Math.pow(2, (m - 69) / 12);

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  return curve;
}

export type Tone = 'clean' | 'crunch' | 'distorted' | 'pad';

/** Plucked-string voice: detuned saws through an enveloped low-pass, optional drive. */
export function pluck(midi: number, time: number, dur: number, vel = 0.7, tone: Tone = 'clean', dest?: AudioNode) {
  const c = getContext();
  if (sendMidiNote(midi, time, c.currentTime, dur, vel) && shouldMuteSynth()) return;
  const f = midiFreq(midi);
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  const bright = tone === 'pad' ? 1200 : tone === 'clean' ? 2800 : 4200;
  filter.frequency.setValueAtTime(bright + f * 2, time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(400, f * 1.5), time + Math.min(dur, 1.2));
  const oscs = [-6, 6].map((detune) => {
    const o = c.createOscillator();
    o.type = tone === 'pad' ? 'triangle' : 'sawtooth';
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(filter);
    return o;
  });
  let node: AudioNode = filter;
  if (tone === 'crunch' || tone === 'distorted') {
    const shaper = c.createWaveShaper();
    shaper.curve = distortionCurve(tone === 'distorted' ? 40 : 8);
    shaper.oversample = '2x';
    node.connect(shaper);
    node = shaper;
  }
  node.connect(g);
  g.connect(dest ?? out());
  const peak = vel * (tone === 'distorted' ? 0.12 : tone === 'pad' ? 0.1 : 0.18);
  const attack = tone === 'pad' ? 0.25 : 0.004;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(peak, time + attack);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * (tone === 'pad' ? 0.7 : 0.35)), time + attack + Math.min(0.4, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur + (tone === 'pad' ? 0.6 : 0.15));
  oscs.forEach((o) => { o.start(time); o.stop(time + dur + 0.8); });
}

export function bass(midi: number, time: number, dur: number, vel = 0.8, dest?: AudioNode) {
  const c = getContext();
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  o.type = 'triangle';
  o2.type = 'sine';
  o.frequency.value = midiFreq(midi);
  o2.frequency.value = midiFreq(midi);
  o.connect(lp);
  o2.connect(lp);
  lp.connect(g).connect(dest ?? out());
  g.gain.setValueAtTime(0.0001, time);
  g.gain.exponentialRampToValueAtTime(0.32 * vel, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.12 * vel, time + Math.min(0.3, dur));
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.08);
  [o, o2].forEach((x) => { x.start(time); x.stop(time + dur + 0.2); });
}

export function drum(kind: ArrEvent['inst'], time: number, vel = 0.8, dest?: AudioNode) {
  const c = getContext();
  const d = dest ?? out();
  if (kind === 'kick') {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    g.gain.setValueAtTime(0.9 * vel, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
    o.connect(g).connect(d);
    o.start(time);
    o.stop(time + 0.4);
    return;
  }
  const src = c.createBufferSource();
  src.buffer = noise();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  let len = 0.06;
  if (kind === 'snare') {
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; len = 0.18;
    const body = c.createOscillator();
    const bg = c.createGain();
    body.frequency.value = 190;
    bg.gain.setValueAtTime(0.35 * vel, time);
    bg.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    body.connect(bg).connect(d);
    body.start(time);
    body.stop(time + 0.15);
  } else if (kind === 'hat') { f.type = 'highpass'; f.frequency.value = 7500; len = 0.05; }
  else if (kind === 'openhat') { f.type = 'highpass'; f.frequency.value = 7000; len = 0.3; }
  else if (kind === 'ride') { f.type = 'bandpass'; f.frequency.value = 6000; f.Q.value = 1.5; len = 0.45; }
  else if (kind === 'crash') { f.type = 'highpass'; f.frequency.value = 4000; len = 1.4; }
  const peak = (kind === 'snare' ? 0.5 : kind === 'crash' ? 0.25 : 0.2) * vel;
  g.gain.setValueAtTime(peak, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + len);
  src.connect(f).connect(g).connect(d);
  src.start(time);
  src.stop(time + len + 0.05);
}

/** Metronome click: higher and louder on accents. */
export function click(time: number, level: number, sound: 'beep' | 'wood' | 'hat' = 'beep', dest?: AudioNode) {
  if (level === 0) return;
  const c = getContext();
  if (sound === 'hat') { drum('hat', time, level === 3 ? 1 : level === 2 ? 0.7 : 0.4, dest); return; }
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = sound === 'wood' ? 'triangle' : 'sine';
  o.frequency.value = level === 3 ? (sound === 'wood' ? 1600 : 1760) : level === 2 ? (sound === 'wood' ? 1100 : 1320) : 880;
  const peak = level === 3 ? 0.6 : level === 2 ? 0.42 : 0.2;
  g.gain.setValueAtTime(peak, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + (sound === 'wood' ? 0.035 : 0.05));
  o.connect(g).connect(dest ?? out());
  o.start(time);
  o.stop(time + 0.08);
}

/** Sustained reference tone for the tuner (sine plus gentle harmonics). */
export function referenceTone(freq: number, seconds = 2.5): () => void {
  const c = getContext();
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
  g.gain.setValueAtTime(0.25, t + seconds - 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  g.connect(out());
  const oscs = [1, 2, 3].map((h, i) => {
    const o = c.createOscillator();
    const hg = c.createGain();
    hg.gain.value = [1, 0.35, 0.15][i];
    o.frequency.value = freq * h;
    o.connect(hg).connect(g);
    o.start(t);
    o.stop(t + seconds + 0.05);
    return o;
  });
  return () => oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
}

export interface PlayStep { notes: number[]; duration: number; click?: boolean }

/** Play a sequence (ear training). Returns total duration in seconds. */
export function playSteps(steps: PlayStep[], startDelay = 0.08): number {
  const c = getContext();
  let t = c.currentTime + startDelay;
  for (const s of steps) {
    if (s.click) click(t, 2, 'wood');
    else for (const m of s.notes) pluck(m, t, s.duration * 0.95, 0.7, 'clean');
    t += s.duration;
  }
  return t - c.currentTime;
}

// ── Metronome ────────────────────────────────────────────────────────────

export class MetronomePlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private start = 0;
  private next = 0;
  private cfg: MetronomeConfig;
  sound: 'beep' | 'wood' | 'hat' = 'beep';
  onClick?: (e: ClickEvent) => void;

  constructor(cfg: MetronomeConfig) {
    this.cfg = cfg;
  }

  get running() {
    return this.timer !== null;
  }

  get startTime() {
    return this.start;
  }

  setConfig(cfg: MetronomeConfig) {
    const wasRunning = this.running;
    if (wasRunning) {
      // Restart on the next click so tempo changes take effect without a gap.
      const c = getContext();
      this.cfg = cfg;
      this.start = c.currentTime + 0.05;
      this.next = 0;
    } else this.cfg = cfg;
  }

  begin(atTime?: number) {
    const c = getContext();
    this.stop();
    this.start = atTime ?? c.currentTime + 0.1;
    this.next = 0;
    const tick = () => {
      const { events, next } = scheduleUntil(this.cfg, this.start, this.next, c.currentTime + 0.12);
      this.next = next;
      for (const e of events) {
        click(e.time, e.level, this.sound);
        const delay = Math.max(0, (e.time - c.currentTime) * 1000);
        setTimeout(() => this.onClick?.(e), delay);
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

// ── Backing-track player ─────────────────────────────────────────────────

export interface BackingOptions {
  bpm: number;
  loopBeats: number;
  tone: Tone;
  mutes: Partial<Record<'drums' | 'bass' | 'chords', boolean>>;
  /** Stop after this many seconds (0 = no limit). */
  maxSeconds: number;
}

export class BackingPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private start = 0;
  private scheduledUntilBeat = 0;
  private events: ArrEvent[] = [];
  private opts: BackingOptions;
  private bus: GainNode | null = null;

  constructor(opts: BackingOptions) {
    this.opts = opts;
  }

  get running() {
    return this.timer !== null;
  }

  setEvents(events: ArrEvent[], loopBeats: number) {
    this.events = events;
    this.opts.loopBeats = loopBeats;
  }

  setOptions(patch: Partial<BackingOptions>) {
    this.opts = { ...this.opts, ...patch };
  }

  /** Current position in beats since start (for UI). */
  positionBeats(): number {
    if (!this.running || !ctx) return 0;
    return Math.max(0, ((ctx.currentTime - this.start) * this.opts.bpm) / 60);
  }

  play() {
    const c = getContext();
    this.stop();
    this.bus = c.createGain();
    this.bus.gain.value = 0.9;
    this.bus.connect(out());
    this.start = c.currentTime + 0.12;
    this.scheduledUntilBeat = 0;
    const tick = () => {
      const now = c.currentTime;
      if (this.opts.maxSeconds && now - this.start > this.opts.maxSeconds) { this.stop(); return; }
      const horizonBeat = ((now + 0.2 - this.start) * this.opts.bpm) / 60;
      while (this.scheduledUntilBeat < horizonBeat) {
        const loopIndex = Math.floor(this.scheduledUntilBeat / this.opts.loopBeats);
        const loopStart = loopIndex * this.opts.loopBeats;
        const from = this.scheduledUntilBeat - loopStart;
        const to = Math.min(this.opts.loopBeats, from + 0.5);
        for (const e of this.events) {
          if (e.t < from || e.t >= to) continue;
          const time = this.start + beatsToSeconds(loopStart + e.t, this.opts.bpm);
          const dur = beatsToSeconds(e.dur, this.opts.bpm);
          if (e.inst === 'bass') { if (!this.opts.mutes.bass) bass(e.notes![0], time, dur, e.vel, this.bus!); }
          else if (e.inst === 'chord') { if (!this.opts.mutes.chords) for (const m of e.notes!) pluck(m, time, dur, e.vel, this.opts.tone, this.bus!); }
          else if (!this.opts.mutes.drums) drum(e.inst, time, e.vel, this.bus!);
        }
        this.scheduledUntilBeat = loopStart + to;
      }
    };
    tick();
    this.timer = setInterval(tick, 40);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.bus && ctx) {
      const b = this.bus;
      b.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => b.disconnect(), 400);
    }
    this.bus = null;
  }
}

// ── Microphone ───────────────────────────────────────────────────────────

export type MicError = 'unsupported' | 'insecure' | 'denied' | 'not-found' | 'busy' | 'unknown';

export function micErrorMessage(e: MicError): string {
  switch (e) {
    case 'unsupported': return 'This browser does not support microphone input (getUserMedia). Try a current Chrome, Edge, Firefox or Safari.';
    case 'insecure': return 'Microphone access requires a secure (HTTPS) connection. Open the app over https:// or on localhost.';
    case 'denied': return 'Microphone permission was blocked. Allow microphone access for this site in your browser\'s address bar or site settings, then try again.';
    case 'not-found': return 'No microphone was found. Connect a microphone or audio interface and try again.';
    case 'busy': return 'The microphone is in use by another application. Close it and try again.';
    default: return 'The microphone could not be started.';
  }
}

export class MicInput {
  stream: MediaStream | null = null;
  source: MediaStreamAudioSourceNode | null = null;
  analyser: AnalyserNode | null = null;
  private buf: Float32Array<ArrayBuffer> | null = null;

  async start(fftSize = 4096): Promise<{ ok: true } | { ok: false; error: MicError }> {
    if (!window.isSecureContext) return { ok: false, error: 'insecure' };
    if (!navigator.mediaDevices?.getUserMedia) return { ok: false, error: 'unsupported' };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      const name = (e as { name?: string }).name;
      return { ok: false, error: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'not-found' : name === 'NotReadableError' ? 'busy' : 'unknown' };
    }
    const c = getContext();
    this.source = c.createMediaStreamSource(this.stream);
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.analyser.smoothingTimeConstant = 0;
    this.source.connect(this.analyser);
    this.buf = new Float32Array(new ArrayBuffer(fftSize * 4));
    return { ok: true };
  }

  /** Latest time-domain frame (shared buffer; copy if you keep it). */
  read(): Float32Array | null {
    if (!this.analyser || !this.buf) return null;
    this.analyser.getFloatTimeDomainData(this.buf);
    return this.buf;
  }

  get sampleRate(): number {
    return ctx?.sampleRate ?? 48000;
  }

  stop() {
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.source = null;
    this.analyser = null;
  }
}

/** Halve the sample rate by averaging pairs (cheap anti-alias + decimation). */
export function decimate(buf: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return buf;
  const out = new Float32Array(Math.floor(buf.length / factor));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let k = 0; k < factor; k++) s += buf[i * factor + k];
    out[i] = s / factor;
  }
  return out;
}

// ── Recorder (Playing Analyzer) ─────────────────────────────────────────

const WORKLET = `class GmaRecorder extends AudioWorkletProcessor {
  process(inputs) { const ch = inputs[0] && inputs[0][0]; if (ch) this.port.postMessage(ch.slice(0)); return true; }
}
registerProcessor('gma-recorder', GmaRecorder);`;

export class Recorder {
  private chunks: Float32Array[] = [];
  private node: AudioWorkletNode | ScriptProcessorNode | null = null;
  private mic = new MicInput();
  startTime = 0;

  async start(): Promise<{ ok: true } | { ok: false; error: MicError }> {
    const r = await this.mic.start(2048);
    if (!r.ok) return r;
    const c = getContext();
    this.chunks = [];
    try {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      await c.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(c, 'gma-recorder');
      node.port.onmessage = (e) => this.chunks.push(e.data as Float32Array);
      this.mic.source!.connect(node);
      this.node = node;
    } catch {
      const sp = c.createScriptProcessor(2048, 1, 1);
      sp.onaudioprocess = (e) => this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      this.mic.source!.connect(sp);
      sp.connect(c.destination);
      this.node = sp;
    }
    this.startTime = c.currentTime;
    return { ok: true };
  }

  stop(): { samples: Float32Array; sampleRate: number; startTime: number } {
    this.node?.disconnect();
    this.node = null;
    const sr = this.mic.sampleRate;
    this.mic.stop();
    const total = this.chunks.reduce((a, c) => a + c.length, 0);
    const samples = new Float32Array(total);
    let off = 0;
    for (const c of this.chunks) { samples.set(c, off); off += c.length; }
    this.chunks = [];
    return { samples, sampleRate: sr, startTime: this.startTime };
  }
}
