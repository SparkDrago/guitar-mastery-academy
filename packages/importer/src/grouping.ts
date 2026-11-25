/**
 * Groups imported arrangements into songs and pairs them with audio.
 *
 * A "scope" is where items came from: one archive, one selected folder, or
 * the loose files of a selection (scope ""). Inside a package scope,
 * arrangements group by song key (or title). Loose arrangements group by
 * title and artist, falling back to the file name without its arrangement
 * suffix ("song_lead.xml" and "song_bass.xml" → "song"). Audio from a package
 * goes with that package's song; loose audio is matched by name, or to the
 * only song still missing audio. Audio that matches nothing is kept and
 * offered in every song's audio picker; it is never dropped silently.
 */
import type { PlaySong } from '@gma/notation';
import type { SongMeta } from './metadata';
import { stemOf } from './paths';

export type ArrangementRole = 'lead' | 'rhythm' | 'combo' | 'bass' | 'other';

export interface ArrangementItem {
  key: string;
  song: PlaySong;
  path: string;
  origin: string;
  scope: string;
  hash: string;
  meta: SongMeta;
  warnings: string[];
}

export interface AudioItem {
  key: string;
  name: string;
  path: string;
  origin: string;
  scope: string;
  size: number;
  container: string;
  mime: string;
  preview: boolean;
  blob: Blob;
  fingerprint: string;
}

export interface MetaHint extends SongMeta { scope: string; path: string }

export interface DraftArrangement {
  key: string;
  label: string;
  role: ArrangementRole;
  song: PlaySong;
  path: string;
  origin: string;
  hash: string;
  warnings: string[];
}

export interface SongDraft {
  id: string;
  title: string;
  artist: string;
  album?: string;
  year?: number;
  arrangements: DraftArrangement[];
  /** Chosen audio (key into ImportResult.audio), or null. */
  audioKey: string | null;
  /** Audio offered for this song: its own first, then unmatched audio. */
  audioCandidates: string[];
  /** Song length declared by the chart or manifest, seconds. */
  songLength?: number;
  /** End of the last note, seconds. */
  chartEnd: number;
  origins: string[];
  scope: string;
  /** Explanation of how the song and its audio were put together. */
  notes: string[];
}

export function roleOf(name: string): ArrangementRole {
  const n = name.toLowerCase();
  if (/bass/.test(n)) return 'bass';
  if (/rhythm/.test(n)) return 'rhythm';
  if (/combo/.test(n)) return 'combo';
  if (/lead|solo/.test(n)) return 'lead';
  return 'other';
}

const ROLE_ORDER: Record<ArrangementRole, number> = { lead: 0, rhythm: 1, combo: 2, bass: 3, other: 4 };

/** Unique labels when a song has, say, two lead parts. */
export function arrangementLabels(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const seen = new Map<string, number>();
  return names.map((n) => {
    if ((counts.get(n) ?? 0) < 2) return n;
    const k = (seen.get(n) ?? 0) + 1;
    seen.set(n, k);
    return `${n} ${k}`;
  });
}

const STOP = new Set(['lead', 'rhythm', 'bass', 'combo', 'vocals', 'preview', 'audio', 'song', 'track', 'final', 'mix', 'master', 'p', 'm', 'pc', 'mac', 'the', 'a', 'arr', 'xml', 'ogg', 'wav']);
export const norm = (s: string | undefined) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s: string) => norm(s).split(' ').filter((t) => t && !STOP.has(t) && !/^\d{1,2}$/.test(t));

/** File stem without arrangement or preview suffixes. */
export const songStem = (path: string) => tokens(stemOf(path)).join(' ');

/** 0..1 name similarity (token overlap, with containment counting fully). */
export function nameSimilarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return 0;
  const ja = A.join(''), jb = B.join('');
  if (ja === jb) return 1;
  if (ja.length >= 4 && jb.length >= 4 && (ja.includes(jb) || jb.includes(ja))) return 0.9;
  const sb = new Set(B);
  const inter = A.filter((t) => sb.has(t)).length;
  return inter / new Set([...A, ...B]).size;
}

interface Bucket { id: string; scope: string; items: ArrangementItem[]; audio: AudioItem[]; meta: SongMeta[] }

export function groupSongs(arrangements: ArrangementItem[], audio: AudioItem[], hints: MetaHint[]): { songs: SongDraft[]; unmatchedAudio: string[] } {
  const buckets = new Map<string, Bucket>();
  const identity = (a: ArrangementItem) => {
    const titleKey = a.meta.title ? `${norm(a.meta.title)}|${norm(a.meta.artist)}` : '';
    if (a.scope) return `${a.scope}#${a.meta.songKey ?? (titleKey || '*')}`;
    return `#${titleKey || 'stem:' + songStem(a.path)}`;
  };
  for (const a of arrangements) {
    const id = identity(a);
    const b = buckets.get(id) ?? { id, scope: a.scope, items: [], audio: [], meta: [] };
    b.items.push(a);
    buckets.set(id, b);
  }
  // Within one package, merge a "*" bucket (no key or title) into the only keyed bucket.
  for (const b of [...buckets.values()]) {
    if (!b.id.endsWith('#*')) continue;
    const peers = [...buckets.values()].filter((x) => x !== b && x.scope === b.scope);
    if (peers.length === 1) { peers[0].items.push(...b.items); buckets.delete(b.id); }
  }
  const list = [...buckets.values()];

  // Metadata hints (manifests) go to the bucket with the same song key in their scope, else the scope's only bucket.
  for (const h of hints) {
    const inScope = list.filter((b) => b.scope === h.scope);
    const byKey = h.songKey ? inScope.find((b) => b.items.some((i) => i.meta.songKey === h.songKey)) : undefined;
    const target = byKey ?? (inScope.length === 1 ? inScope[0] : undefined);
    if (target) target.meta.push(h);
  }

  // Audio.
  const unmatched: AudioItem[] = [];
  const nameOf = (b: Bucket) => {
    const m = b.items[0].meta;
    return [m.title, `${m.artist ?? ''} ${m.title ?? ''}`, ...b.items.map((i) => stemOf(i.path)), m.songKey ?? ''].filter(Boolean) as string[];
  };
  for (const au of audio) {
    if (au.scope) {
      const inScope = list.filter((b) => b.scope === au.scope);
      if (inScope.length === 1) { inScope[0].audio.push(au); continue; }
      if (inScope.length > 1) {
        const best = bestBucket(inScope, au, nameOf);
        if (best) { best.audio.push(au); continue; }
      }
    }
    unmatched.push(au);
  }
  // Loose (or unplaced) audio: name match first, then the only song without audio.
  const still: AudioItem[] = [];
  for (const au of unmatched) {
    const best = bestBucket(list, au, nameOf);
    if (best) best.audio.push(au); else still.push(au);
  }
  const lacking = list.filter((b) => !b.audio.some((a) => !a.preview));
  const fullStill = still.filter((a) => !a.preview);
  if (lacking.length === 1 && fullStill.length === 1) {
    lacking[0].audio.push(fullStill[0]);
    still.splice(still.indexOf(fullStill[0]), 1);
  }

  const songs: SongDraft[] = list.map((b, idx) => {
    const notes: string[] = [];
    const metas = [...b.meta, ...b.items.map((i) => i.meta)];
    const pick = <K extends keyof SongMeta>(k: K): SongMeta[K] | undefined => metas.find((m) => m[k] !== undefined && m[k] !== '')?.[k];
    const items = [...b.items].sort((x, y) => ROLE_ORDER[roleOf(x.song.arrangement)] - ROLE_ORDER[roleOf(y.song.arrangement)] || x.path.localeCompare(y.path));
    const labels = arrangementLabels(items.map((i) => i.song.arrangement || 'Part'));
    const own = [...b.audio].sort((x, y) => Number(x.preview) - Number(y.preview) || y.size - x.size);
    const chosen = own[0] ?? null;
    if (b.meta.length) notes.push(`Song details from ${b.meta.length} manifest entr${b.meta.length === 1 ? 'y' : 'ies'}.`);
    if (items.length > 1) notes.push(`${items.length} arrangements grouped by ${b.scope ? 'their package' : 'title and artist'}.`);
    if (chosen) notes.push(`Audio: ${chosen.name}${chosen.preview ? ' (a short preview clip — no full recording was found)' : ''}${own.length > 1 ? `; ${own.length - 1} other file(s) available` : ''}.`);
    else notes.push('No audio matched this song. Pick one below or add it later in Play mode.');
    const title = pick('title') ?? items[0].song.title ?? stemOf(items[0].path);
    return {
      id: `draft-${idx}-${norm(title).replace(/ /g, '-').slice(0, 40) || 'song'}`,
      title,
      artist: pick('artist') ?? items[0].song.artist ?? '',
      album: pick('album') ?? items[0].song.album,
      year: pick('year') ?? items[0].song.year,
      arrangements: items.map((i, k) => ({ key: i.key, label: labels[k], role: roleOf(i.song.arrangement), song: { ...i.song, arrangement: labels[k] }, path: i.path, origin: i.origin, hash: i.hash, warnings: i.warnings })),
      audioKey: chosen?.key ?? null,
      audioCandidates: [...own.map((a) => a.key), ...still.map((a) => a.key)],
      songLength: pick('songLength'),
      chartEnd: Math.max(0, ...items.map((i) => lastNoteEnd(i.song))),
      origins: [...new Set(items.map((i) => i.origin))],
      scope: b.scope,
      notes,
    };
  });
  return { songs, unmatchedAudio: still.map((a) => a.key) };
}

function bestBucket(list: Bucket[], au: AudioItem, nameOf: (b: Bucket) => string[]): Bucket | null {
  let best: Bucket | null = null, score = 0;
  for (const b of list) {
    const s = Math.max(...nameOf(b).map((n) => nameSimilarity(stemOf(au.path), n)));
    if (s > score) { score = s; best = b; }
  }
  return score >= 0.6 ? best : null;
}

export function lastNoteEnd(song: PlaySong): number {
  let end = 0;
  for (const e of song.events) end = Math.max(end, e.time + e.sustain);
  return end;
}
