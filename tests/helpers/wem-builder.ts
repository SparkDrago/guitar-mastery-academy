/** Builders for synthetic Wwise .wem files used by unit and browser tests. */
import { imaStep } from '../../packages/importer/src/wem';

export const SR = 48000;


/** A RIFF/RIFX WAVE with a Wwise-style extra chunk between fmt and data. */
export function wem(tag: number, channels: number, blockAlign: number, bits: number, data: Uint8Array, { be = false, extensible = false, sampleRate = SR } = {}): Uint8Array {
  const fmtLen = extensible ? 24 : 16;
  const junk = new Uint8Array([0x4a, 0x55, 0x4e, 0x4b, ...(be ? [0, 0, 0, 4] : [4, 0, 0, 0]), 1, 2, 3, 4]); // 'JUNK' chunk, 4 bytes
  const size = 12 + 8 + fmtLen + junk.length + 8 + data.length;
  const b = new Uint8Array(size);
  const dv = new DataView(b.buffer);
  const le = !be;
  const w = (at: number, s: string) => { for (let i = 0; i < 4; i++) b[at + i] = s.charCodeAt(i); };
  w(0, be ? 'RIFX' : 'RIFF'); dv.setUint32(4, size - 8, le); w(8, 'WAVE');
  w(12, 'fmt '); dv.setUint32(16, fmtLen, le);
  dv.setUint16(20, extensible ? 0xfffe : tag, le); dv.setUint16(22, channels, le); dv.setUint32(24, sampleRate, le);
  dv.setUint32(28, sampleRate * blockAlign, le); dv.setUint16(32, blockAlign, le); dv.setUint16(34, bits, le);
  let p = 20 + fmtLen;
  b.set(junk, p); p += junk.length;
  w(p, 'data'); dv.setUint32(p + 4, data.length, le);
  b.set(data, p + 8);
  return b;
}

export const sine = (n: number, hz: number, amp = 12000) => Int16Array.from({ length: n }, (_, i) => Math.round(amp * Math.sin((2 * Math.PI * hz * i) / SR)));

/** Reference IMA encoder producing Wwise layout (per-channel sub-blocks, low nibble first). */
export function encodeWwiseIma(channels: Int16Array[], subBytes: number): Uint8Array {
  const per = (subBytes - 4) * 2 + 1;
  const blocks = Math.ceil(channels[0].length / per);
  const out = new Uint8Array(blocks * subBytes * channels.length);
  const dv = new DataView(out.buffer);
  const state = channels.map(() => ({ index: 0 }));
  for (let b = 0; b < blocks; b++) {
    channels.forEach((src, c) => {
      const base = (b * channels.length + c) * subBytes;
      const at = (i: number) => src[Math.min(src.length - 1, b * per + i)];
      let pred = at(0);
      let index = state[c].index;
      dv.setInt16(base, pred, true); out[base + 2] = index;
      const enc = (target: number) => {
        // Pick the nibble whose decoded value lands closest to the target.
        let best = 0, bestErr = Infinity, bestState: [number, number] = [pred, index];
        for (let n = 0; n < 16; n++) { const s = imaStep(pred, index, n); const e = Math.abs(s[0] - target); if (e < bestErr) { bestErr = e; best = n; bestState = s; } }
        [pred, index] = bestState;
        return best;
      };
      for (let i = 4, k = 1; i < subBytes; i++, k += 2) out[base + i] = enc(at(k)) | (enc(at(k + 1)) << 4);
      state[c].index = index;
    });
  }
  return out;
}

