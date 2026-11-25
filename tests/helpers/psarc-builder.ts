/**
 * Builds PSARC archives for tests (Node only): unencrypted, with zlib, LZMA
 * or no compression. With `encryptedToc` it writes a header flagged 0x4 and
 * random bytes in place of the table of contents, which is how an archive
 * with an encrypted TOC looks to a reader without the key.
 */
import { deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';

export interface BuildOptions {
  compression?: 'zlib' | 'lzma' | 'none';
  blockSize?: number;
  encryptedToc?: boolean;
  /** Corrupt the name hash of this file index (1-based, as in the TOC). */
  badHashAt?: number;
  /** Cut this many bytes off the end. */
  truncate?: number;
  /** Manifest names to use instead of the real paths. */
  names?: string[];
}

const lzma = (b: Buffer) => execFileSync('xz', ['--format=lzma', '-c', '-9'], { input: b });

export function buildPsarc(files: { path: string; data: Uint8Array | string }[], o: BuildOptions = {}): Uint8Array {
  const compression = o.compression ?? 'zlib';
  const blockSize = o.blockSize ?? 65536;
  const names = o.names ?? files.map((f) => f.path);
  const all = [Buffer.from(names.join('\n')), ...files.map((f) => Buffer.from(typeof f.data === 'string' ? Buffer.from(f.data) : f.data))];
  const width = blockSize <= 0x10000 ? 2 : blockSize <= 0x1000000 ? 3 : 4;
  const blocks: number[] = [];
  const chunks: Buffer[] = [];
  const entries = all.map((data) => {
    const first = blocks.length;
    let stored = 0;
    for (let p = 0; p < data.length; p += blockSize) {
      const raw = data.subarray(p, Math.min(data.length, p + blockSize));
      let z = compression === 'zlib' ? deflateSync(raw) : compression === 'lzma' ? lzma(raw) : raw;
      if (z.length >= raw.length) z = raw;
      blocks.push(z.length === blockSize ? 0 : z.length);
      chunks.push(z);
      stored += z.length;
    }
    return { first, size: data.length, stored };
  });
  const tocLength = 32 + all.length * 30 + blocks.length * width;
  const header = Buffer.alloc(32);
  header.write('PSAR', 0, 'ascii');
  header.writeUInt16BE(1, 4); header.writeUInt16BE(4, 6);
  header.write(compression === 'none' ? '\0\0\0\0' : compression, 8, 'ascii');
  header.writeUInt32BE(tocLength, 12);
  header.writeUInt32BE(30, 16);
  header.writeUInt32BE(all.length, 20);
  header.writeUInt32BE(blockSize, 24);
  header.writeUInt32BE(o.encryptedToc ? 4 : 0, 28);
  const toc = Buffer.alloc(tocLength - 32);
  let offset = tocLength;
  entries.forEach((e, i) => {
    const at = i * 30;
    if (i > 0) {
      const h = createHash('md5').update(names[i - 1] ?? '').digest();
      if (o.badHashAt === i) h[0] ^= 0xff;
      h.copy(toc, at);
    }
    toc.writeUInt32BE(e.first, at + 16);
    toc.writeUIntBE(e.size, at + 20, 5);
    toc.writeUIntBE(offset, at + 25, 5);
    offset += e.stored;
  });
  blocks.forEach((b, i) => toc.writeUIntBE(b, all.length * 30 + i * width, width));
  const body = o.encryptedToc ? randomBytes(toc.length) : toc;
  let out = Buffer.concat([header, body, ...chunks]);
  if (o.truncate) out = out.subarray(0, out.length - o.truncate);
  return new Uint8Array(out);
}

/** A tiny but valid-looking OGG page header followed by filler. */
export function fakeOgg(size = 2048): Uint8Array {
  const b = Buffer.alloc(size, 1);
  b.write('OggS', 0, 'ascii');
  return new Uint8Array(b);
}

/** A RIFF/WAVE header with the given format tag (1 = PCM, 0xFFFF = Wwise). */
export function riffWave(tag: number, size = 1024): Uint8Array {
  const b = Buffer.alloc(size);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(size - 8, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(tag, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(44100, 24);
  b.writeUInt32LE(88200, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(size - 44, 40);
  return new Uint8Array(b);
}
