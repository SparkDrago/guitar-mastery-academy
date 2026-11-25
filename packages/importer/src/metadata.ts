/**
 * Song details from Rocksmith-format files: the arrangement XML header and
 * the JSON/HSAN manifests that sit next to arrangements in a song package.
 */

export interface SongMeta {
  /** Identifier shared by all arrangements of one song in a package (DLC key / song key). */
  songKey?: string;
  title?: string;
  artist?: string;
  album?: string;
  year?: number;
  arrangement?: string;
  songLength?: number;
  persistentId?: string;
}

const tag = (xml: string, name: string): string | undefined => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  if (!m) return undefined;
  const v = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  return v || undefined;
};

/** Header fields of a Rocksmith arrangement XML (read from the first part of the file). */
export function metaFromArrangementXml(xml: string, path: string): SongMeta {
  const head = xml.slice(0, 8192);
  const art = tag(head, 'albumArt');
  const len = Number(tag(head, 'songLength'));
  const year = Number(tag(head, 'albumYear'));
  return {
    songKey: keyFromAlbumArt(art) ?? keyFromPath(path),
    title: tag(head, 'title'),
    artist: tag(head, 'artistName'),
    album: tag(head, 'albumName'),
    year: Number.isFinite(year) && year > 0 ? year : undefined,
    arrangement: tag(head, 'arrangement'),
    songLength: Number.isFinite(len) && len > 0 ? len : undefined,
    persistentId: tag(head, 'persistentID'),
  };
}

/** "urn:image:dds:album_sendmeanangel" → "sendmeanangel". */
export function keyFromAlbumArt(art?: string): string | undefined {
  const m = art ? /album_([a-z0-9]+)/i.exec(art) : null;
  return m ? m[1].toLowerCase() : undefined;
}

/** "songs/arr/sendmeanangel_lead.xml" → "sendmeanangel" (Rocksmith package layout only). */
export function keyFromPath(path: string): string | undefined {
  const m = /(?:^|\/)(?:songs\/arr|manifests\/[^/]+)\/([a-z0-9]+)_(?:lead|rhythm|bass|combo|vocals|jvocals|showlights)\d*\.(?:xml|json)$/i.exec(path);
  return m ? m[1].toLowerCase() : undefined;
}

/** Rocksmith manifest (.json) or song index (.hsan): {"Entries": {id: {"Attributes": {...}}}}. */
export function metaFromManifest(text: string, path: string): SongMeta[] {
  let doc: unknown;
  try { doc = JSON.parse(text.replace(/^﻿/, '')); } catch { return []; }
  const entries = (doc as { Entries?: Record<string, { Attributes?: Record<string, unknown> }> })?.Entries;
  if (!entries || typeof entries !== 'object') return [];
  const out: SongMeta[] = [];
  for (const e of Object.values(entries)) {
    const a = e?.Attributes;
    if (!a || typeof a !== 'object') continue;
    const s = (k: string) => (typeof a[k] === 'string' && (a[k] as string).trim() ? (a[k] as string).trim() : undefined);
    const n = (k: string) => (typeof a[k] === 'number' && Number.isFinite(a[k]) ? (a[k] as number) : Number(s(k)) || undefined);
    const key = s('SongKey') ?? s('DLCKey');
    out.push({
      songKey: key?.toLowerCase() ?? keyFromPath(path),
      title: s('SongName'),
      artist: s('ArtistName'),
      album: s('AlbumName'),
      year: n('SongYear'),
      arrangement: s('ArrangementName'),
      songLength: n('SongLength'),
      persistentId: s('PersistentID'),
    });
  }
  return out;
}

/** "Scorpions_-_Send_me_an_Angel_p.psarc" → { artist: "Scorpions", title: "Send me an Angel" }. */
export function guessFromFileName(name: string): { artist?: string; title?: string } {
  // Strip the extension, the platform suffix (_p PC, _m Mac) and a version tag (_v, _v2, _v1_3).
  const stem = name.replace(/\.[^.]+$/, '').replace(/_[pm]$/i, '').replace(/_v\d*(_\d+)*$/i, '');
  const clean = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  // "Artist_-_Title" or "Artist - Title".
  let parts = stem.split(/_-_|\s+-\s+/);
  if (parts.length >= 2) return { artist: clean(parts[0]), title: clean(parts.slice(1).join(' - ')) };
  // "Artist-Name_Song-Title": words joined by hyphens, artist and title by one underscore.
  parts = stem.split('_');
  if (parts.length === 2 && parts.every((p) => p.length > 0)) return { artist: clean(parts[0]), title: clean(parts[1]) };
  return { title: clean(stem) || undefined };
}
