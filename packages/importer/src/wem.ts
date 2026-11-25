/**
 * Wwise Encoded Media (.wem) → audio a browser can play.
 *
 * A .wem file is a RIFF (little-endian) or RIFX (big-endian) WAVE container
 * whose `fmt ` chunk carries a Wwise codec tag. What this module can do
 * without any external data:
 *
 *   0x0001 PCM, 0x0003 float, 0xFFFE extensible PCM/float
 *       → rewritten as a plain little-endian WAV (extra Wwise chunks dropped).
 *   0x0002 Wwise IMA ADPCM
 *       → decoded to 16-bit PCM WAV.
 *
 * Wwise Vorbis (0xFFFF, the codec Rocksmith 2014 uses) strips the Vorbis
 * codebooks out of the stream and refers to them by number in an external
 * table (the "aoTuV 6.03 packed codebooks"). Rebuilding a playable Ogg needs
 * that table, which is not bundled here, so those files raise a
 * WemUnsupportedError that explains how to convert them. Wwise Opus
 * (0x3040/0x3041) is reported the same way.
 */
import { ascii } from './bytes';

export interface WemInfo {
  littleEndian: boolean;
  /** Codec tag from the fmt chunk (the sub-format for 0xFFFE extensible). */
  tag: number;
  codec: string;
  channels: number;
  sampleRate: number;
  blockAlign: number;
  bitsPerSample: number;
  /** Byte range of the data chunk. */
  dataOffset: number;
  dataLength: number;
}

export interface WemResult {
  bytes: Uint8Array;
  container: 'wav';
  mime: 'audio/wav';
  codec: string;
  info: WemInfo;
}

/** A recognised .wem whose codec cannot be decoded in the browser. */
export class WemUnsupportedError extends Error {
  constructor(message: string, readonly codec: string) {
    super(message);
    this.name = 'WemUnsupportedError';
  }
}

const CODECS: Record<number, string> = {
  0x0001: 'PCM', 0x0003: 'IEEE float PCM', 0x0002: 'Wwise IMA ADPCM',
  0xffff: 'Wwise Vorbis', 0x3040: 'Wwise Opus', 0x3041: 'Wwise Opus', 0x0166: 'XMA2', 0x0165: 'XMA',
  0x8311: 'Wwise PTADPCM', 0x0069: 'Wwise IMA ADPCM (Xbox)',
};

export const WEM_CONVERT_HELP =
  'Convert it to WAV or OGG first and add that file instead: vgmstream (`vgmstream-cli song.wem -o song.wav`, or the foobar2000 vgmstream component), ' +
  'ww2ogg with packed_codebooks_aoTuV_603.bin followed by revorb, or the Rocksmith Custom Song Toolkit, which writes OGG audio when it unpacks a song.';

/** Reads the RIFF/RIFX header. Returns null when the bytes are not a WAVE container. */
export function inspectWem(data: Uint8Array): WemInfo | null {
  if (data.byteLength < 20) return null;
  const sig = ascii(data, 0, 4);
  if ((sig !== 'RIFF' && sig !== 'RIFX') || ascii(data, 8, 12) !== 'WAVE') return null;
  const le = sig === 'RIFF';
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let fmt: Omit<WemInfo, 'dataOffset' | 'dataLength'> | null = null;
  let dataOffset = -1;
  let dataLength = 0;
  let p = 12;
  while (p + 8 <= data.byteLength) {
    const id = ascii(data, p, p + 4);
    const len = dv.getUint32(p + 4, le);
    const body = p + 8;
    if (id === 'fmt ' && body + 16 <= data.byteLength) {
      let tag = dv.getUint16(body, le);
      if (tag === 0xfffe && body + 26 <= data.byteLength) {
        // WAVE_FORMAT_EXTENSIBLE: the first two bytes of the sub-format GUID are the real tag.
        // Wwise also uses 0xFFFE for plain PCM; anything that is not PCM/float stays 0xFFFE.
        if (len >= 40) { const sub = dv.getUint16(body + 24, le); if (sub === 1 || sub === 3) tag = sub; }
        else tag = 0x0001;
      }
      fmt = {
        littleEndian: le, tag, codec: CODECS[tag] ?? `codec 0x${tag.toString(16).toUpperCase().padStart(4, '0')}`,
        channels: dv.getUint16(body + 2, le), sampleRate: dv.getUint32(body + 4, le),
        blockAlign: dv.getUint16(body + 12, le), bitsPerSample: dv.getUint16(body + 14, le),
      };
    } else if (id === 'data') {
      dataOffset = body;
      dataLength = Math.min(len, data.byteLength - body);
      if (fmt) break;
    }
    if (len > data.byteLength) break;
    p = body + len + (len & 1);
  }
  if (!fmt || dataOffset < 0) return null;
  return { ...fmt, dataOffset, dataLength };
}

/** Builds a canonical little-endian WAV around interleaved sample bytes. */
export function wavFile(samples: Uint8Array, channels: number, sampleRate: number, bitsPerSample: number, float = false): Uint8Array {
  const out = new Uint8Array(44 + samples.byteLength + (samples.byteLength & 1));
  const dv = new DataView(out.buffer);
  const w = (at: number, s: string) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  const blockAlign = channels * (bitsPerSample / 8);
  w(0, 'RIFF'); dv.setUint32(4, out.byteLength - 8, true); w(8, 'WAVE');
  w(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, float ? 3 : 1, true); dv.setUint16(22, channels, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * blockAlign, true);
  dv.setUint16(32, blockAlign, true); dv.setUint16(34, bitsPerSample, true);
  w(36, 'data'); dv.setUint32(40, samples.byteLength, true);
  out.set(samples, 44);
  return out;
}

const IMA_STEPS = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143,
  157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552,
  1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
  12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];
const IMA_INDEX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

/** One IMA nibble → next predictor, mirroring the reference decoder. */
export function imaStep(pred: number, index: number, nibble: number): [number, number] {
  const step = IMA_STEPS[index];
  let diff = step >> 3;
  if (nibble & 1) diff += step >> 2;
  if (nibble & 2) diff += step >> 1;
  if (nibble & 4) diff += step;
  if (nibble & 8) diff = -diff;
  pred = Math.max(-32768, Math.min(32767, pred + diff));
  index = Math.max(0, Math.min(88, index + IMA_INDEX[nibble]));
  return [pred, index];
}

/**
 * Wwise IMA ADPCM: each block holds one sub-block per channel, one after the
 * other (not interleaved every 4 bytes as in Microsoft IMA). A sub-block is a
 * 4-byte header (int16 first sample, uint8 step index, padding) followed by
 * nibbles, low nibble first: (subBlockBytes − 4) × 2 + 1 samples.
 */
export function decodeWwiseIma(data: Uint8Array, info: Pick<WemInfo, 'channels' | 'blockAlign' | 'littleEndian'>): Int16Array {
  const ch = info.channels;
  const sub = Math.floor(info.blockAlign / ch);
  if (ch < 1 || sub <= 4) throw new Error('Wwise IMA ADPCM: invalid block size.');
  const perBlock = (sub - 4) * 2 + 1;
  const blocks = Math.floor(data.byteLength / info.blockAlign);
  const out = new Int16Array(blocks * perBlock * ch);
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let b = 0; b < blocks; b++) {
    for (let c = 0; c < ch; c++) {
      const base = b * info.blockAlign + c * sub;
      let pred = dv.getInt16(base, info.littleEndian);
      let index = Math.min(88, data[base + 2]);
      let o = (b * perBlock) * ch + c;
      out[o] = pred; o += ch;
      for (let i = 4; i < sub; i++) {
        const byte = data[base + i];
        [pred, index] = imaStep(pred, index, byte & 0x0f); out[o] = pred; o += ch;
        [pred, index] = imaStep(pred, index, byte >> 4); out[o] = pred; o += ch;
      }
    }
  }
  return out;
}

const int16Bytes = (s: Int16Array) => {
  const b = new Uint8Array(s.length * 2);
  const dv = new DataView(b.buffer);
  for (let i = 0; i < s.length; i++) dv.setInt16(i * 2, s[i], true);
  return b;
};

/** Converts a .wem to a playable WAV, or throws WemUnsupportedError with guidance. */
export function convertWem(data: Uint8Array): WemResult {
  const info = inspectWem(data);
  if (!info) throw new Error('Not a Wwise .wem file (no RIFF/WAVE header with fmt and data chunks).');
  const samples = data.subarray(info.dataOffset, info.dataOffset + info.dataLength);
  if (info.channels < 1 || info.channels > 8 || info.sampleRate < 1000 || info.sampleRate > 192000) {
    throw new Error(`Wwise ${info.codec}: implausible header (${info.channels} channels, ${info.sampleRate} Hz).`);
  }

  if (info.tag === 0x0001 || info.tag === 0x0003) {
    const bytesPer = info.bitsPerSample / 8;
    if (![1, 2, 3, 4].includes(bytesPer)) throw new Error(`PCM with ${info.bitsPerSample}-bit samples is not supported.`);
    let body = samples.slice(0, samples.byteLength - (samples.byteLength % (bytesPer * info.channels)));
    if (!info.littleEndian && bytesPer > 1) {
      for (let i = 0; i < body.byteLength; i += bytesPer) body.subarray(i, i + bytesPer).reverse();
    }
    return { bytes: wavFile(body, info.channels, info.sampleRate, info.bitsPerSample, info.tag === 0x0003), container: 'wav', mime: 'audio/wav', codec: info.codec, info };
  }

  if (info.tag === 0x0002) {
    const pcm = decodeWwiseIma(samples, info);
    return { bytes: wavFile(int16Bytes(pcm), info.channels, info.sampleRate, 16), container: 'wav', mime: 'audio/wav', codec: info.codec, info };
  }

  if (info.tag === 0xffff) {
    throw new WemUnsupportedError(
      `Wwise Vorbis audio (${info.channels} ch, ${info.sampleRate} Hz). This codec leaves out the Vorbis codebooks, so the browser cannot rebuild the stream without the external codebook table Wwise encodes against (aoTuV 6.03), which this app does not include. ${WEM_CONVERT_HELP}`,
      info.codec,
    );
  }
  throw new WemUnsupportedError(`${info.codec} audio cannot be decoded in the browser. ${WEM_CONVERT_HELP}`, info.codec);
}
