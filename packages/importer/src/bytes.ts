/**
 * Random-access byte sources and small binary helpers. Archives are read in
 * slices (Blob.slice), so a large file is never loaded into memory whole.
 */

export interface ByteSource {
  readonly size: number;
  /** Up to `length` bytes starting at `offset` (shorter only at the end of the source). */
  read(offset: number, length: number): Promise<Uint8Array>;
}

export function bytesSource(bytes: Uint8Array): ByteSource {
  return {
    size: bytes.byteLength,
    read: async (offset, length) => bytes.subarray(offset, Math.min(bytes.byteLength, offset + length)),
  };
}

export function blobSource(blob: Blob): ByteSource {
  return {
    size: blob.size,
    read: async (offset, length) => new Uint8Array(await blob.slice(offset, Math.min(blob.size, offset + length)).arrayBuffer()),
  };
}

/** Reads exactly `length` bytes or throws (truncated file). */
export async function readExact(src: ByteSource, offset: number, length: number, what: string): Promise<Uint8Array> {
  if (offset < 0 || length < 0 || offset + length > src.size) {
    throw new RangeError(`${what} lies outside the file (needs bytes ${offset}–${offset + length}, file has ${src.size}).`);
  }
  const b = await src.read(offset, length);
  if (b.byteLength !== length) throw new RangeError(`${what} is truncated.`);
  return b;
}

export const ascii = (b: Uint8Array, from = 0, to = b.byteLength) => {
  let s = '';
  for (let i = from; i < Math.min(to, b.byteLength); i++) s += String.fromCharCode(b[i]);
  return s;
};

export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Big-endian unsigned integer of 1–6 bytes (safe up to 2^48). */
export function readUintBE(b: Uint8Array, at: number, width: number): number {
  let v = 0;
  for (let i = 0; i < width; i++) v = v * 256 + b[at + i];
  return v;
}

export async function inflate(data: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser has no built-in decompression (DecompressionStream).');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return hex(new Uint8Array(digest));
}

/** Cheap fingerprint of a large blob: size plus hashes of its head and tail. */
export async function blobFingerprint(blob: Blob): Promise<string> {
  const span = 256 * 1024;
  const head = new Uint8Array(await blob.slice(0, span).arrayBuffer());
  const tail = blob.size > span ? new Uint8Array(await blob.slice(Math.max(span, blob.size - span)).arrayBuffer()) : new Uint8Array(0);
  return `${blob.size}:${(await sha256Hex(head)).slice(0, 16)}:${(await sha256Hex(tail)).slice(0, 16)}`;
}

export class ImportAborted extends Error {
  constructor() { super('Import cancelled.'); this.name = 'ImportAborted'; }
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new ImportAborted();
}
