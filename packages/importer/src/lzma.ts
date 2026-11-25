/**
 * LZMA decoder (the "LZMA alone" stream: 5-byte properties, 8-byte size,
 * range-coded data), following the structure of Igor Pavlov's public-domain
 * LzmaSpec reference decoder. Used for PSARC archives whose blocks are
 * LZMA-compressed; browsers have no native LZMA.
 */

const kNumStates = 12;
const kNumPosBitsMax = 4;
const kNumLenToPosStates = 4;
const kEndPosModelIndex = 14;
const kNumFullDistances = 1 << (kEndPosModelIndex >> 1);
const kMatchMinLen = 2;
const PROB_INIT = 1024;

export class LzmaError extends Error {
  constructor(msg: string) { super(`LZMA: ${msg}`); this.name = 'LzmaError'; }
}

class RangeDecoder {
  range = 0xffffffff;
  code = 0;
  pos: number;
  constructor(private buf: Uint8Array, start: number) {
    this.pos = start;
    if (this.byte() !== 0) throw new LzmaError('corrupt stream start');
    for (let i = 0; i < 4; i++) this.code = ((this.code << 8) | this.byte()) >>> 0;
    if (this.code === this.range) throw new LzmaError('corrupt stream start');
  }
  private byte(): number {
    if (this.pos >= this.buf.length) throw new LzmaError('unexpected end of data');
    return this.buf[this.pos++];
  }
  private normalize() {
    if (this.range < 0x1000000) {
      this.range = (this.range << 8) >>> 0;
      this.code = ((this.code << 8) | this.byte()) >>> 0;
    }
  }
  bit(probs: Uint16Array, i: number): number {
    const p = probs[i];
    const bound = (this.range >>> 11) * p;
    let b: number;
    if (this.code < bound) {
      this.range = bound >>> 0;
      probs[i] = p + ((2048 - p) >>> 5);
      b = 0;
    } else {
      this.range = (this.range - bound) >>> 0;
      this.code = (this.code - bound) >>> 0;
      probs[i] = p - (p >>> 5);
      b = 1;
    }
    this.normalize();
    return b;
  }
  direct(numBits: number): number {
    let res = 0;
    for (let k = 0; k < numBits; k++) {
      this.range >>>= 1;
      let b = 0;
      if (this.code >= this.range) { this.code = (this.code - this.range) >>> 0; b = 1; }
      this.normalize();
      res = ((res << 1) | b) >>> 0;
    }
    return res;
  }
  finishedOk() { return this.code === 0; }
}

function treeDecode(rc: RangeDecoder, probs: Uint16Array, base: number, numBits: number): number {
  let m = 1;
  for (let i = 0; i < numBits; i++) m = (m << 1) + rc.bit(probs, base + m);
  return m - (1 << numBits);
}

function treeReverse(rc: RangeDecoder, probs: Uint16Array, base: number, numBits: number): number {
  let m = 1, sym = 0;
  for (let i = 0; i < numBits; i++) {
    const b = rc.bit(probs, base + m);
    m = (m << 1) + b;
    sym |= b << i;
  }
  return sym;
}

/** Layout of one length decoder inside a probability array. */
function lenLayout(at: number) {
  const choice = at, choice2 = at + 1;
  const low = at + 2; // 16 trees of 8 probs (3 bits)
  const mid = low + (1 << kNumPosBitsMax) * 8;
  const high = mid + (1 << kNumPosBitsMax) * 8; // 256 probs (8 bits)
  return { choice, choice2, low, mid, high, end: high + 256 };
}

function lenDecode(rc: RangeDecoder, p: Uint16Array, L: ReturnType<typeof lenLayout>, posState: number): number {
  if (rc.bit(p, L.choice) === 0) return treeDecode(rc, p, L.low + posState * 8, 3);
  if (rc.bit(p, L.choice2) === 0) return 8 + treeDecode(rc, p, L.mid + posState * 8, 3);
  return 16 + treeDecode(rc, p, L.high, 8);
}

export interface LzmaHeader { lc: number; lp: number; pb: number; dictSize: number; unpackSize: number | null; headerBytes: 13 }

export function readLzmaHeader(buf: Uint8Array): LzmaHeader {
  if (buf.length < 13) throw new LzmaError('header is truncated');
  let d = buf[0];
  if (d >= 9 * 5 * 5) throw new LzmaError('invalid properties byte');
  const lc = d % 9; d = Math.floor(d / 9);
  const lp = d % 5; const pb = Math.floor(d / 5);
  const dv = new DataView(buf.buffer, buf.byteOffset, 13);
  const dictSize = Math.max(dv.getUint32(1, true), 1 << 12);
  const lo = dv.getUint32(5, true), hi = dv.getUint32(9, true);
  const unpackSize = lo === 0xffffffff && hi === 0xffffffff ? null : hi * 2 ** 32 + lo;
  return { lc, lp, pb, dictSize, unpackSize, headerBytes: 13 };
}

/**
 * Decodes an LZMA-alone stream. `expectedSize` is used when the header says
 * the size is unknown (the stream then ends with an end marker), and is
 * checked against the header otherwise.
 */
export function lzmaDecode(buf: Uint8Array, expectedSize?: number, maxSize = 1 << 30): Uint8Array {
  const h = readLzmaHeader(buf);
  const size = h.unpackSize ?? expectedSize ?? null;
  if (h.unpackSize !== null && expectedSize !== undefined && h.unpackSize !== expectedSize) {
    throw new LzmaError(`size mismatch (header ${h.unpackSize}, expected ${expectedSize})`);
  }
  if (size !== null && size > maxSize) throw new LzmaError('declared size is too large');
  let out = new Uint8Array(size ?? 1 << 16);
  let outSize = 0;
  const put = (b: number) => {
    if (outSize >= out.length) {
      if (size !== null) throw new LzmaError('data is longer than declared');
      if (out.length >= maxSize) throw new LzmaError('output is too large');
      const n = new Uint8Array(Math.min(maxSize, out.length * 2)); n.set(out); out = n;
    }
    out[outSize++] = b;
  };

  const { lc, lp, pb } = h;
  // Probability array layout.
  let at = 0;
  const lit = at; at += 0x300 << (lc + lp);
  const posSlot = at; at += kNumLenToPosStates * 64; // 4 trees of 6 bits
  const posDec = at; at += 1 + kNumFullDistances - kEndPosModelIndex;
  const align = at; at += 16;
  const isMatch = at; at += kNumStates << kNumPosBitsMax;
  const isRep = at; at += kNumStates;
  const isRepG0 = at; at += kNumStates;
  const isRepG1 = at; at += kNumStates;
  const isRepG2 = at; at += kNumStates;
  const isRep0Long = at; at += kNumStates << kNumPosBitsMax;
  const lenL = lenLayout(at); at = lenL.end;
  const repL = lenLayout(at); at = repL.end;
  const p = new Uint16Array(at).fill(PROB_INIT);

  const rc = new RangeDecoder(buf, h.headerBytes);
  const pbMask = (1 << pb) - 1, lpMask = (1 << lp) - 1;
  let state = 0, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0;

  for (;;) {
    if (size !== null && outSize === size && h.unpackSize !== null) break;
    const posState = outSize & pbMask;
    if (rc.bit(p, isMatch + (state << kNumPosBitsMax) + posState) === 0) {
      if (size !== null && outSize === size) throw new LzmaError('data is longer than declared');
      const prev = outSize > 0 ? out[outSize - 1] : 0;
      const base = lit + 0x300 * (((outSize & lpMask) << lc) + (prev >> (8 - lc)));
      let sym = 1;
      if (state >= 7) {
        if (rep0 >= outSize) throw new LzmaError('match distance out of range');
        let matchByte = out[outSize - rep0 - 1];
        do {
          const mb = (matchByte >> 7) & 1;
          matchByte <<= 1;
          const b = rc.bit(p, base + ((1 + mb) << 8) + sym);
          sym = (sym << 1) | b;
          if (mb !== b) break;
        } while (sym < 0x100);
      }
      while (sym < 0x100) sym = (sym << 1) | rc.bit(p, base + sym);
      put(sym - 0x100);
      state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6;
      continue;
    }

    let len: number;
    if (rc.bit(p, isRep + state) !== 0) {
      if (outSize === 0) throw new LzmaError('repeat match at start');
      if (rc.bit(p, isRepG0 + state) === 0) {
        if (rc.bit(p, isRep0Long + (state << kNumPosBitsMax) + posState) === 0) {
          state = state < 7 ? 9 : 11;
          put(out[outSize - rep0 - 1]);
          continue;
        }
      } else {
        let dist: number;
        if (rc.bit(p, isRepG1 + state) === 0) dist = rep1;
        else {
          if (rc.bit(p, isRepG2 + state) === 0) dist = rep2;
          else { dist = rep3; rep3 = rep2; }
          rep2 = rep1;
        }
        rep1 = rep0; rep0 = dist;
      }
      len = lenDecode(rc, p, repL, posState);
      state = state < 7 ? 8 : 11;
    } else {
      rep3 = rep2; rep2 = rep1; rep1 = rep0;
      len = lenDecode(rc, p, lenL, posState);
      state = state < 7 ? 7 : 10;
      // Distance.
      const lenState = Math.min(len, kNumLenToPosStates - 1);
      const slot = treeDecode(rc, p, posSlot + lenState * 64, 6);
      if (slot < 4) rep0 = slot;
      else {
        const numDirect = (slot >> 1) - 1;
        let dist = ((2 | (slot & 1)) << numDirect) >>> 0;
        if (slot < kEndPosModelIndex) dist += treeReverse(rc, p, posDec + dist - slot, numDirect);
        else {
          dist += rc.direct(numDirect - 4) * 16;
          dist += treeReverse(rc, p, align, 4);
        }
        rep0 = dist >>> 0;
      }
      if (rep0 === 0xffffffff) {
        // End marker.
        if (size !== null && outSize !== size) throw new LzmaError('stream ended early');
        break;
      }
      if (rep0 >= outSize || rep0 >= h.dictSize) throw new LzmaError('match distance out of range');
    }
    len += kMatchMinLen;
    for (let i = 0; i < len; i++) {
      if (size !== null && outSize === size) {
        if (h.unpackSize !== null) throw new LzmaError('data is longer than declared');
        break;
      }
      put(out[outSize - rep0 - 1]);
    }
  }
  if (size !== null && outSize !== size) throw new LzmaError(`decoded ${outSize} bytes, expected ${size}`);
  return outSize === out.length ? out : out.slice(0, outSize);
}
