/**
 * PSARC ("PlayStation archive") reader. It is a self-contained module with
 * no UI or app dependencies, and it reads in slices through a ByteSource,
 * so large archives are never loaded whole.
 *
 * Layout (all integers big-endian):
 *   header (32 bytes): "PSAR", version u16.u16, compression char[4]
 *     ("zlib" | "lzma"), TOC length u32 (header included), TOC entry size u32,
 *     entry count u32, block size u32, archive flags u32
 *   TOC entries: name MD5 [16], first block u32, size u40, offset u40
 *   block-size table: one u16/u24/u32 per block (width from the block size);
 *     0 means a full, uncompressed block
 *   data: each entry is a run of blocks from its first block, each block
 *     zlib/LZMA-compressed or stored when its compressed size equals its size
 *   entry 0 is the manifest: the newline-separated paths of entries 1..n-1
 *
 * Flags: 1 = paths are case-insensitive, 2 = absolute paths, 4 = the table
 * of contents is encrypted. Rocksmith 2014's AES-256-CFB encrypted TOC is
 * decrypted before parsing, so its entries can be read like ordinary PSARC.
 */
import { ascii, hex, inflate, readExact, readUintBE, throwIfAborted, type ByteSource } from './bytes';
import { lzmaDecode } from './lzma';
import { md5 } from './md5';
import { decryptRs2014Toc } from './rs2014-crypto';
import { checkArchivePath } from './paths';
import type { ComponentReport, Fact } from './types';

export const PSARC_FLAGS = { IGNORE_CASE: 0x1, ABSOLUTE_PATHS: 0x2, ENCRYPTED_TOC: 0x4 } as const;
const HEADER_BYTES = 32;
const MIN_ENTRY_BYTES = 30;
const MAX_ENTRIES = 1_000_000;

export interface PsarcHeader {
  version: string;
  compression: string;
  tocLength: number;
  tocEntrySize: number;
  entryCount: number;
  blockSize: number;
  flags: number;
}

export interface PsarcTocEntry {
  index: number;
  nameHash: string;
  firstBlock: number;
  size: number;
  offset: number;
}

export interface PsarcFile extends PsarcTocEntry {
  /** Path from the manifest, checked for safety; null when unknown or rejected. */
  path: string | null;
  /** Why the path is null, or a problem found with this entry's layout. */
  problem?: string;
  hashOk: boolean | null;
}

export interface PsarcArchive {
  header: PsarcHeader;
  components: ComponentReport[];
  facts: Fact[];
  /** True when the archive TOC was encrypted on disk (and decrypted by this reader). */
  encrypted: boolean;
  /** Entries 1..n-1 (the manifest itself is not listed). Empty when encrypted. */
  files: PsarcFile[];
  read(file: PsarcTocEntry, opts?: { signal?: AbortSignal }): Promise<Uint8Array>;
}

export class PsarcFormatError extends Error {
  constructor(public component: string, message: string) { super(message); this.name = 'PsarcFormatError'; }
}

export interface PsarcOptions {
  signal?: AbortSignal;
  /** Refuse to inflate any single entry larger than this (decompression-bomb guard). */
  maxEntryBytes?: number;
}

const kib = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(n % (1024 * 1024) ? 1 : 0)} MiB` : `${Math.round(n / 1024)} KiB`);

export function isPsarc(head: Uint8Array): boolean {
  return head.byteLength >= 4 && ascii(head, 0, 4) === 'PSAR';
}

export function parsePsarcHeader(b: Uint8Array, fileSize: number): PsarcHeader {
  if (b.byteLength < HEADER_BYTES) throw new PsarcFormatError('header', `The file is ${b.byteLength} bytes; a PSARC header needs ${HEADER_BYTES}.`);
  if (!isPsarc(b)) throw new PsarcFormatError('header', 'The file does not start with the PSAR signature.');
  const dv = new DataView(b.buffer, b.byteOffset, HEADER_BYTES);
  const h: PsarcHeader = {
    version: `${dv.getUint16(4)}.${dv.getUint16(6)}`,
    compression: ascii(b, 8, 12).replace(/\0/g, ''),
    tocLength: dv.getUint32(12),
    tocEntrySize: dv.getUint32(16),
    entryCount: dv.getUint32(20),
    blockSize: dv.getUint32(24),
    flags: dv.getUint32(28),
  };
  if (h.tocLength < HEADER_BYTES || h.tocLength > fileSize) {
    throw new PsarcFormatError('header', `The table of contents is said to be ${h.tocLength} bytes, which does not fit a ${fileSize}-byte file.`);
  }
  if (h.blockSize < 1024 || h.blockSize > 0x4000000) throw new PsarcFormatError('header', `Implausible block size (${h.blockSize} bytes).`);
  if (h.entryCount > MAX_ENTRIES) throw new PsarcFormatError('header', `Implausible entry count (${h.entryCount}).`);
  return h;
}

const blockWidth = (blockSize: number) => (blockSize <= 0x10000 ? 2 : blockSize <= 0x1000000 ? 3 : 4);

export async function openPsarc(src: ByteSource, opts: PsarcOptions = {}): Promise<PsarcArchive> {
  const maxEntry = opts.maxEntryBytes ?? 1024 * 1024 * 1024;
  const headBytes = await readExact(src, 0, Math.min(HEADER_BYTES, src.size), 'The header');
  const header = parsePsarcHeader(headBytes, src.size);
  const components: ComponentReport[] = [];
  const facts: Fact[] = [
    { label: 'Format version', value: header.version },
    { label: 'Compression', value: header.compression || '(none)' },
    { label: 'Entries', value: String(Math.max(0, header.entryCount - 1)) + ' files + manifest' },
    { label: 'Block size', value: kib(header.blockSize) },
    { label: 'Flags', value: `0x${header.flags.toString(16)}` + [header.flags & 1 ? ' case-insensitive' : '', header.flags & 2 ? ' absolute paths' : '', header.flags & 4 ? ' encrypted TOC' : ''].join('') },
  ];
  const compressionKnown = header.compression === 'zlib' || header.compression === 'lzma' || header.compression === '';
  components.push({
    id: 'header', label: 'Header', state: 'ok',
    detail: `PSAR ${header.version}, ${header.entryCount} entries, ${kib(header.blockSize)} blocks, ${header.compression || 'uncompressed'}.`,
  });
  components.push(compressionKnown
    ? { id: 'compression', label: 'Compression', state: 'ok', detail: header.compression === 'lzma' ? 'LZMA (decoded by the built-in LZMA decoder).' : header.compression === 'zlib' ? 'zlib (decoded by the browser’s native decompressor).' : 'Stored without compression.' }
    : { id: 'compression', label: 'Compression', state: 'unsupported', detail: `Unknown compression “${header.compression}”. Only zlib and LZMA are defined for PSARC.` });

  const read = async (file: PsarcTocEntry, ro: { signal?: AbortSignal } = {}) => readEntry(src, header, blocks, file, maxEntry, ro.signal ?? opts.signal);
  let blocks: number[] = [];

  const tocEncrypted = !!(header.flags & PSARC_FLAGS.ENCRYPTED_TOC);

  if (!compressionKnown) {
    components.push({ id: 'toc', label: 'Table of contents', state: 'unavailable', detail: 'Not read, because the compression method is unknown.' });
    return { header, components, facts, encrypted: false, files: [], read };
  }

  // Table of contents.
  if (header.tocEntrySize < MIN_ENTRY_BYTES) throw new PsarcFormatError('toc', `TOC entries are ${header.tocEntrySize} bytes; at least ${MIN_ENTRY_BYTES} are needed.`);
  const entriesEnd = HEADER_BYTES + header.entryCount * header.tocEntrySize;
  if (entriesEnd > header.tocLength) throw new PsarcFormatError('toc', `${header.entryCount} entries of ${header.tocEntrySize} bytes do not fit in the ${header.tocLength}-byte table of contents.`);
  if (header.entryCount < 1) throw new PsarcFormatError('toc', 'The archive has no entries, not even a manifest.');
  let toc = await readExact(src, 0, header.tocLength, 'The table of contents');
  if (tocEncrypted) {
    try {
      toc = await decryptRs2014Toc(toc.subarray(HEADER_BYTES));
      components.push({ id: 'toc', label: 'Table of contents', state: 'ok', detail: 'Rocksmith 2014 AES-256-CFB TOC decrypted and parsed.' });
    } catch (e) {
      components.push({ id: 'toc', label: 'Table of contents', state: 'error', detail: `Could not decrypt the TOC: ${(e as Error).message}` });
      components.push(
        { id: 'blocks', label: 'Block-size table', state: 'unavailable', detail: 'Not readable: TOC decryption failed.' },
        { id: 'manifest', label: 'File manifest', state: 'unavailable', detail: 'Not readable: TOC decryption failed.' },
        { id: 'data', label: 'File data', state: 'unavailable', detail: 'Not readable: TOC decryption failed.' },
      );
      return { header, components, facts, encrypted: true, files: [], read: async () => { throw new PsarcFormatError('toc', 'TOC decryption failed.'); } };
    }
  } else {
    components.push({ id: 'toc', label: 'Table of contents', state: 'ok', detail: `${header.entryCount} entries read (${header.tocEntrySize} bytes each).` });
  }
  // Decrypted payload excludes the 32-byte archive header; normalize it back
  // to the on-disk layout so offsets below stay identical.
  if (tocEncrypted) toc = new Uint8Array([...new Uint8Array(HEADER_BYTES), ...toc]);

  const entries: PsarcTocEntry[] = [];
  for (let i = 0; i < header.entryCount; i++) {
    const o = HEADER_BYTES + i * header.tocEntrySize;
    entries.push({ index: i, nameHash: hex(toc.subarray(o, o + 16)), firstBlock: readUintBE(toc, o + 16, 4), size: readUintBE(toc, o + 20, 5), offset: readUintBE(toc, o + 25, 5) });
  }
  // Block-size table.
  const width = blockWidth(header.blockSize);
  const tableBytes = header.tocLength - entriesEnd;
  const blockCount = Math.floor(tableBytes / width);
  blocks = new Array(blockCount);
  for (let i = 0; i < blockCount; i++) blocks[i] = readUintBE(toc, entriesEnd + i * width, width);
  components.push({
    id: 'blocks', label: 'Block-size table', state: tableBytes % width ? 'warning' : 'ok',
    detail: `${blockCount} blocks (${width * 8}-bit sizes)${tableBytes % width ? `; ${tableBytes % width} stray byte(s) at the end were ignored` : ''}.`,
  });

  // Layout checks for every entry.
  const layoutProblem = (e: PsarcTocEntry): string | undefined => {
    if (e.size === 0) return undefined;
    const need = Math.ceil(e.size / header.blockSize);
    if (e.firstBlock + need > blockCount) return `needs blocks ${e.firstBlock}–${e.firstBlock + need - 1} but the table has ${blockCount}`;
    if (e.offset < header.tocLength || e.offset >= src.size) return `data offset ${e.offset} is outside the data area`;
    let stored = 0;
    for (let k = 0; k < need; k++) stored += blocks[e.firstBlock + k] || header.blockSize;
    if (e.offset + stored > src.size) return `data runs past the end of the file (truncated archive)`;
    if (e.size > maxEntry) return `entry is ${kib(e.size)}, over the ${kib(maxEntry)} safety limit`;
    return undefined;
  };

  // Manifest (entry 0).
  let names: string[] = [];
  const manifestProblem = layoutProblem(entries[0]);
  if (manifestProblem) {
    components.push({ id: 'manifest', label: 'File manifest', state: 'error', detail: `Unreadable: ${manifestProblem}. Entries are listed by number only.` });
  } else {
    try {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(await read(entries[0]));
      names = text.split(/\r?\n|\0/).filter((s, i, all) => s !== '' || i < all.length - 1);
      while (names.length && names[names.length - 1] === '') names.pop();
      const expected = header.entryCount - 1;
      components.push(names.length === expected
        ? { id: 'manifest', label: 'File manifest', state: 'ok', detail: `${names.length} file names.` }
        : { id: 'manifest', label: 'File manifest', state: 'warning', detail: `${names.length} names for ${expected} entries; unmatched entries are listed by number.` });
    } catch (e) {
      components.push({ id: 'manifest', label: 'File manifest', state: 'error', detail: `Could not be decompressed: ${(e as Error).message}` });
    }
  }

  // Files, names and name-hash integrity.
  const files: PsarcFile[] = [];
  let hashChecked = 0, hashBad = 0, rejected = 0;
  for (let i = 1; i < entries.length; i++) {
    throwIfAborted(opts.signal);
    const e = entries[i];
    const raw = names[i - 1];
    let path: string | null = null;
    let problem = layoutProblem(e);
    let hashOk: boolean | null = null;
    if (raw !== undefined) {
      const name = header.flags & PSARC_FLAGS.IGNORE_CASE ? raw.toUpperCase() : raw;
      const zero = /^0+$/.test(e.nameHash);
      if (!zero) { hashChecked++; hashOk = hex(md5(name)) === e.nameHash; if (!hashOk) hashBad++; }
      const chk = checkArchivePath(raw);
      if (chk.ok) path = chk.path;
      else { rejected++; problem = `unsafe name rejected (${chk.reason})`; }
    }
    files.push({ ...e, path, problem, hashOk });
  }
  if (names.length) {
    components.push(hashBad === 0
      ? { id: 'hashes', label: 'Name integrity', state: 'ok', detail: hashChecked ? `All ${hashChecked} name hashes match the manifest.` : 'The archive stores no name hashes.' }
      : { id: 'hashes', label: 'Name integrity', state: 'warning', detail: `${hashBad} of ${hashChecked} name hashes do not match the manifest; those names may be wrong.` });
  }
  const broken = files.filter((f) => f.problem && f.path !== null).length;
  components.push({
    id: 'data', label: 'File data', state: broken ? 'warning' : 'ok',
    detail: broken ? `${broken} entr${broken === 1 ? 'y has' : 'ies have'} layout problems and cannot be read; the rest can.` : `All ${files.length} entries are within the file.`,
  });
  if (rejected) components.push({ id: 'paths', label: 'Path safety', state: 'warning', detail: `${rejected} entr${rejected === 1 ? 'y was' : 'ies were'} rejected for unsafe names.` });
  return { header, components, facts, encrypted: tocEncrypted, files, read };
}

async function readEntry(src: ByteSource, h: PsarcHeader, blocks: number[], e: PsarcTocEntry, maxEntry: number, signal?: AbortSignal): Promise<Uint8Array> {
  if (e.size > maxEntry) throw new PsarcFormatError('data', `Entry ${e.index} is larger than the safety limit.`);
  const out = new Uint8Array(e.size);
  let written = 0, pos = e.offset, bi = e.firstBlock;
  while (written < e.size) {
    throwIfAborted(signal);
    if (bi >= blocks.length) throw new PsarcFormatError('blocks', `Entry ${e.index} runs past the block table.`);
    const zlen = blocks[bi] || h.blockSize;
    const expected = Math.min(h.blockSize, e.size - written);
    const chunk = await readExact(src, pos, zlen, `Block ${bi}`);
    let plain: Uint8Array;
    if (zlen === expected) plain = chunk;
    else if (zlen > expected) throw new PsarcFormatError('blocks', `Block ${bi} is larger stored (${zlen}) than unpacked (${expected}).`);
    else if (h.compression === 'zlib') {
      if (chunk[0] !== 0x78) throw new PsarcFormatError('data', `Block ${bi} of entry ${e.index} is not zlib data.`);
      try { plain = await inflate(chunk, 'deflate'); }
      catch (err) { throw new PsarcFormatError('data', `Block ${bi} of entry ${e.index} is damaged (${(err as Error).message}).`); }
    } else if (h.compression === 'lzma') {
      try { plain = lzmaDecode(chunk, expected); }
      catch (err) { throw new PsarcFormatError('data', `Block ${bi} of entry ${e.index} is damaged (${(err as Error).message}).`); }
    } else throw new PsarcFormatError('compression', `Block ${bi} is compressed with an unknown method.`);
    if (plain.byteLength !== expected) throw new PsarcFormatError('data', `Block ${bi} of entry ${e.index} unpacked to ${plain.byteLength} bytes, expected ${expected}.`);
    out.set(plain, written);
    written += expected;
    pos += zlen;
    bi++;
  }
  return out;
}
