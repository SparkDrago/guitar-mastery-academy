/**
 * Polyfills Node's global Buffer for browser / Web Worker environments
 * (required by ww2ogg-ts when decoding packed codebooks and WEM streams).
 */
import { Buffer } from 'buffer';

if (typeof (globalThis as Record<string, unknown>).Buffer === 'undefined') {
  (globalThis as Record<string, unknown>).Buffer = Buffer;
}
