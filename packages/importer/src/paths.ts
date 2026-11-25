/**
 * Path checks for names that come from inside archives or from folder
 * selections. Nothing is ever written to disk, but names are shown in the UI
 * and used for grouping, so hostile names are rejected rather than trusted.
 */

const MAX_PATH = 1024;
const MAX_SEGMENT = 255;

export type PathCheck = { ok: true; path: string } | { ok: false; reason: string };

export function checkArchivePath(raw: string): PathCheck {
  if (typeof raw !== 'string' || raw.length === 0) return { ok: false, reason: 'empty name' };
  if (raw.length > MAX_PATH) return { ok: false, reason: 'name is too long' };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return { ok: false, reason: 'name contains control characters' };
  let p = raw.replace(/\\/g, '/');
  if (/^[a-zA-Z]:/.test(p)) return { ok: false, reason: 'absolute drive path' };
  p = p.replace(/^\/+/, '').replace(/^(\.\/)+/, '');
  const segs = p.split('/');
  if (segs.some((s) => s === '..')) return { ok: false, reason: 'path climbs out of the archive (..)' };
  const clean = segs.filter((s) => s !== '' && s !== '.');
  if (!clean.length) return { ok: false, reason: 'empty name' };
  if (clean.some((s) => s.length > MAX_SEGMENT)) return { ok: false, reason: 'a path segment is too long' };
  return { ok: true, path: clean.join('/') };
}

export const baseName = (p: string) => p.split('/').pop() ?? p;
export const extOf = (p: string) => { const m = /\.([^./]+)$/.exec(p); return m ? m[1].toLowerCase() : ''; };
export const stemOf = (p: string) => baseName(p).replace(/\.[^.]+$/, '');
