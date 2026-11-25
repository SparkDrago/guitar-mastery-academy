/**
 * Guitar audio input settings: supports both standard browser Audio Interface
 * capture (WASAPI/CoreAudio via getUserMedia with device + Input 1/2 channel
 * selection) and ultra-low-latency native ASIO via the local Node/WebSocket
 * ASIO bridge (ws://127.0.0.1:4174).
 */

export type InputMode = 'browser' | 'asio';
export type BrowserChannel = 'mix' | 0 | 1;
export type BridgeApi = 'asio' | 'wasapi';

export interface AudioInputSettings {
  mode: InputMode;
  /** Browser MediaDeviceInfo.deviceId ('' = system default). */
  browserDeviceId: string;
  /** 'mix' = default mono/sum, 0 = Input 1 (Left), 1 = Input 2 (Right). */
  browserChannel: BrowserChannel;
  /** Input gain multiplier (0.25 .. 4.0). */
  gain: number;
  /** Local ASIO bridge WebSocket URL. */
  bridgeUrl: string;
  /** RtAudio backend on the local bridge ('asio' or 'wasapi'). */
  bridgeApi: BridgeApi;
  /** RtAudio device ID (-1 = default). */
  bridgeDeviceId: number;
  /** 0-based input channel index on the ASIO interface. */
  bridgeChannel: number;
}

export interface BridgeDeviceInfo {
  id: number;
  name: string;
  inputChannels: number;
  sampleRates: number[];
  preferredSampleRate: number;
  isDefaultInput: boolean;
}

const STORAGE_KEY = 'gma.audioInput';

const DEFAULT_SETTINGS: AudioInputSettings = {
  mode: 'browser',
  browserDeviceId: '',
  browserChannel: 'mix',
  gain: 1,
  bridgeUrl: 'ws://127.0.0.1:4174',
  bridgeApi: 'asio',
  bridgeDeviceId: -1,
  bridgeChannel: 0,
};

let settings: AudioInputSettings = loadSettings();
const listeners = new Set<() => void>();

function loadSettings(): AudioInputSettings {
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

export function subscribeAudioInput(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAudioInputSettings(): AudioInputSettings {
  return { ...settings };
}

export function updateAudioInputSettings(patch: Partial<AudioInputSettings>) {
  settings = { ...settings, ...patch };
  saveSettings();
  emit();
}

/** Query available ASIO/WASAPI input devices from the local Node bridge. */
export async function probeAsioBridge(
  url = settings.bridgeUrl,
  api: BridgeApi = settings.bridgeApi,
): Promise<{ ok: true; devices: BridgeDeviceInfo[] } | { ok: false; error: string }> {
  if (typeof WebSocket === 'undefined') {
    return { ok: false, error: 'WebSocket is unavailable in this environment.' };
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res: { ok: true; devices: BridgeDeviceInfo[] } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(res);
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      resolve({ ok: false, error: (e as Error).message });
      return;
    }

    const timer = setTimeout(() => finish({ ok: false, error: `Could not reach ASIO bridge at ${url}. Start it with "npm start" inside asio-bridge/.` }), 2500);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'list', api }));
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      try {
        const msg = JSON.parse(ev.data) as { type: string; devices?: BridgeDeviceInfo[]; error?: string };
        if (msg.type === 'devices') finish({ ok: true, devices: msg.devices ?? [] });
        else if (msg.type === 'error') finish({ ok: false, error: msg.error ?? 'Bridge error.' });
      } catch {
        // ignore
      }
    };
    ws.onerror = () => finish({ ok: false, error: `Could not connect to ASIO bridge at ${url}.` });
  });
}

/** Lock-free-style Float32 ring buffer client for the local ASIO WebSocket bridge. */
export class AsioBridgeClient {
  private ws: WebSocket | null = null;
  private ring: Float32Array;
  private writePos = 0;
  private filled = 0;
  private outBuf: Float32Array;
  sampleRate = 48000;
  onFrame: ((chunk: Float32Array) => void) | null = null;

  constructor(private fftSize: number, private gain = 1) {
    this.ring = new Float32Array(Math.max(fftSize * 4, 16384));
    this.outBuf = new Float32Array(fftSize);
  }

  start(cfg: AudioInputSettings): Promise<{ ok: true } | { ok: false; error: string }> {
    return new Promise((resolve) => {
      let settled = false;
      const done = (r: { ok: true } | { ok: false; error: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      };

      let ws: WebSocket;
      try {
        ws = new WebSocket(cfg.bridgeUrl);
      } catch (e) {
        done({ ok: false, error: (e as Error).message });
        return;
      }
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      const timer = setTimeout(() => {
        this.stop();
        done({ ok: false, error: 'ASIO bridge timed out.' });
      }, 3000);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'start',
          api: cfg.bridgeApi,
          deviceId: cfg.bridgeDeviceId,
          channel: cfg.bridgeChannel,
        }));
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data) as { type: string; sampleRate?: number; error?: string };
            if (msg.type === 'started') {
              if (msg.sampleRate) this.sampleRate = msg.sampleRate;
              done({ ok: true });
            } else if (msg.type === 'error') {
              this.stop();
              done({ ok: false, error: msg.error ?? 'Failed to open ASIO stream.' });
            }
          } catch {
            // ignore
          }
          return;
        }
        if (ev.data instanceof ArrayBuffer) {
          const samples = new Float32Array(ev.data);
          const g = this.gain;
          const len = this.ring.length;
          if (g !== 1) {
            for (let i = 0; i < samples.length; i++) samples[i] *= g;
          }
          for (let i = 0; i < samples.length; i++) {
            this.ring[this.writePos] = samples[i];
            this.writePos = (this.writePos + 1) % len;
          }
          this.filled = Math.min(len, this.filled + samples.length);
          this.onFrame?.(samples);
        }
      };

      ws.onerror = () => {
        this.stop();
        done({ ok: false, error: `Could not connect to ASIO bridge at ${cfg.bridgeUrl}.` });
      };
      ws.onclose = () => {
        if (!settled) done({ ok: false, error: 'ASIO bridge closed.' });
      };
    });
  }

  read(): Float32Array | null {
    if (this.filled < this.fftSize) return null;
    const len = this.ring.length;
    let p = (this.writePos - this.fftSize + len) % len;
    for (let i = 0; i < this.fftSize; i++) {
      this.outBuf[i] = this.ring[p];
      p = (p + 1) % len;
    }
    return this.outBuf;
  }

  stop() {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'stop' }));
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.onFrame = null;
    this.filled = 0;
    this.writePos = 0;
  }
}
