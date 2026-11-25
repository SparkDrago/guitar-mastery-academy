/**
 * Web MIDI Output for routing fretboard, exercise, scale, chord, and tab notes
 * directly to desktop guitar VSTs (via loopMIDI on Windows or IAC Driver on macOS).
 */

interface WebMidiOutput {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  state?: string;
  send(data: number[] | Uint8Array, timestamp?: number): void;
}

interface WebMidiAccess {
  outputs: Map<string, WebMidiOutput>;
  onstatechange: (() => void) | null;
}

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface MidiSettings {
  enabled: boolean;
  outputId: string;
  channel: number; // 1..16
  muteSynth: boolean;
  octaveShift: number; // -2..+2
}

const STORAGE_KEY = 'gma.midi';

const DEFAULT_SETTINGS: MidiSettings = {
  enabled: false,
  outputId: '',
  channel: 1,
  muteSynth: true,
  octaveShift: 0,
};

let access: WebMidiAccess | null = null;
let settings: MidiSettings = loadSettings();
const listeners = new Set<() => void>();

function loadSettings(): MidiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

function emit() {
  for (const fn of listeners) fn();
}

export function midiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as unknown as { requestMIDIAccess?: unknown }).requestMIDIAccess === 'function';
}

export function subscribeMidi(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMidiSettings(): MidiSettings {
  return { ...settings };
}

export function updateMidiSettings(patch: Partial<MidiSettings>) {
  settings = { ...settings, ...patch };
  saveSettings();
  emit();
}

export function getMidiOutputs(): MidiPortInfo[] {
  if (!access) return [];
  const list: MidiPortInfo[] = [];
  for (const out of access.outputs.values()) {
    list.push({
      id: out.id,
      name: out.name || `MIDI Output ${list.length + 1}`,
      manufacturer: out.manufacturer || '',
    });
  }
  return list;
}

export async function initMidi(): Promise<{ ok: boolean; error?: string }> {
  if (!midiSupported()) {
    return { ok: false, error: 'Web MIDI is not supported in this browser. Use Chrome, Edge, or Brave.' };
  }
  try {
    const req = (navigator as unknown as { requestMIDIAccess: (opts?: { sysex?: boolean }) => Promise<WebMidiAccess> }).requestMIDIAccess;
    access = await req.call(navigator, { sysex: false });
    access.onstatechange = () => {
      autoSelectPort();
      emit();
    };
    autoSelectPort();
    emit();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'MIDI permission was denied.' };
  }
}

function autoSelectPort() {
  if (!access) return;
  if (settings.outputId && access.outputs.has(settings.outputId)) return;
  const first = access.outputs.values().next().value as WebMidiOutput | undefined;
  if (first) {
    settings = { ...settings, outputId: first.id };
    saveSettings();
  }
}

function activeOutput(): WebMidiOutput | null {
  if (!settings.enabled || !access || !settings.outputId) return null;
  return access.outputs.get(settings.outputId) ?? null;
}

/** True when MIDI output is active and the built-in Web Audio guitar synth should be muted. */
export function shouldMuteSynth(): boolean {
  return settings.muteSynth && activeOutput() !== null;
}

/**
 * Schedules a MIDI Note-On and Note-Off aligned to the AudioContext clock.
 * Returns true if the note was sent to a connected MIDI output.
 */
export function sendMidiNote(
  midi: number,
  audioTime: number,
  audioNow: number,
  durSec: number,
  vel = 0.75,
): boolean {
  const out = activeOutput();
  if (!out) return false;

  const note = Math.max(0, Math.min(127, Math.round(midi + settings.octaveShift * 12)));
  const velocity = Math.max(1, Math.min(127, Math.round(vel * 127)));
  const ch = Math.max(0, Math.min(15, (settings.channel | 0) - 1));

  const delayMs = Math.max(0, (audioTime - audioNow) * 1000);
  const startMs = performance.now() + delayMs;
  const endMs = startMs + Math.max(40, durSec * 1000);

  try {
    out.send([0x90 | ch, note, velocity], startMs);
    out.send([0x80 | ch, note, 0], endMs);
    return true;
  } catch {
    return false;
  }
}

/** Sends All Notes Off (CC 123) on the active channel to stop any hanging VST notes. */
export function midiPanic() {
  const out = activeOutput();
  if (!out) return;
  const ch = Math.max(0, Math.min(15, (settings.channel | 0) - 1));
  try {
    out.send([0xb0 | ch, 123, 0]);
  } catch {
    // ignore
  }
}

/** Sends a short test chord (E2-B2-E3) to verify DAW/VST routing. */
export function sendMidiTest(): boolean {
  const now = performance.now();
  const out = activeOutput();
  if (!out) return false;
  const ch = Math.max(0, Math.min(15, (settings.channel | 0) - 1));
  const notes = [40, 47, 52].map((n) => Math.max(0, Math.min(127, n + settings.octaveShift * 12)));
  try {
    notes.forEach((n, i) => {
      out.send([0x90 | ch, n, 100], now + i * 35);
      out.send([0x80 | ch, n, 0], now + i * 35 + 650);
    });
    return true;
  } catch {
    return false;
  }
}

// Auto-initialize MIDI silently on startup if the user previously enabled it.
if (typeof window !== 'undefined' && settings.enabled && midiSupported()) {
  void initMidi();
}
