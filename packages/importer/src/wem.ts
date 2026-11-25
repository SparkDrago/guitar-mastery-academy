/**
 * Converts Wwise Encoded Media (.wem) to browser-playable OGG Vorbis (or WAV
 * if the WEM wraps raw PCM). Runs purely in JS/TS so it works inside the
 * import Web Worker and Node unit tests.
 */
import './buffer-polyfill';
import { convertWwiseRiffToOgg, getPackedCodebooks } from 'ww2ogg-ts';
import { ascii } from './bytes';

export interface WemResult {
  bytes: Uint8Array;
  container: 'ogg' | 'wav';
  mime: string;
  codec: string;
}

/** Inspects the RIFF/WAVE fmt chunk to identify the Wwise codec tag. */
export function detectWemCodec(data: Uint8Array): { tag: number; endian: 'le' | 'be' } | null {
  if (data.byteLength < 22) return null;
  const sig = ascii(data, 0, 4);
  if ((sig !== 'RIFF' && sig !== 'RIFX') || ascii(data, 8, 12) !== 'WAVE') return null;

  const le = sig === 'RIFF';
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let p = 12;

  while (p + 10 <= data.byteLength) {
    const id = ascii(data, p, p + 4);
    const len = dv.getUint32(p + 4, le);
    if (id === 'fmt ') {
      const tag = dv.getUint16(p + 8, le);
      return { tag, endian: le ? 'le' : 'be' };
    }
    p += 8 + len + (len & 1);
  }
  return null;
}

export function convertWem(data: Uint8Array): WemResult {
  const info = detectWemCodec(data);
  if (!info) {
    throw new Error('Not a valid RIFF/WAVE WEM file.');
  }

  // Standard PCM (1) or IEEE Float (3) wrapped in a .wem extension.
  if (info.tag === 0x0001 || info.tag === 0x0003) {
    return { bytes: data, container: 'wav', mime: 'audio/wav', codec: 'PCM' };
  }

  // Wwise Vorbis (0xFFFF) — standard for Rocksmith 2014 PSARC audio.
  if (info.tag === 0xffff) {
    // Rocksmith 2014 WEMs use the aoTuV 6.03 codebook; fall back to standard if needed.
    let ogg: Uint8Array;
    try {
      ({ ogg } = convertWwiseRiffToOgg(data, {
        codebooks: getPackedCodebooks('aoTuV_603'),
      }));
    } catch {
      ({ ogg } = convertWwiseRiffToOgg(data, {
        codebooks: getPackedCodebooks('standard'),
      }));
    }
    return {
      bytes: ogg instanceof Uint8Array ? ogg : new Uint8Array(ogg),
      container: 'ogg',
      mime: 'audio/ogg',
      codec: 'Wwise Vorbis',
    };
  }

  throw new Error(`Unsupported Wwise codec tag (0x${info.tag.toString(16).toUpperCase()}). Only Wwise Vorbis and PCM are supported.`);
}
