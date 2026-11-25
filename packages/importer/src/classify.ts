/**
 * Recognises what a file is from its first bytes and its name. The same
 * rules apply to loose files and to entries inside archives, so a file is
 * handled the same way wherever it comes from.
 */
import { ascii } from './bytes';
import { baseName, extOf } from './paths';

export type FileRole =
  | 'psarc' | 'zip'
  | 'arrangement-xml' | 'vocals-xml' | 'showlights-xml' | 'other-xml'
  | 'rs-manifest' | 'rs-hsan' | 'gma-song' | 'json'
  | 'guitar-pro' | 'guitar-pro-4' | 'guitar-pro-legacy'
  | 'audio' | 'wwise-audio' | 'wwise-bank'
  | 'sng' | 'image' | 'game-data' | 'unknown';

export interface Classification {
  role: FileRole;
  /** Human-readable kind, e.g. "Rocksmith arrangement (XML)". */
  kind: string;
  /** For audio: container, and whether the name marks it as a short preview. */
  audio?: { container: 'ogg' | 'wav' | 'mp3' | 'flac' | 'm4a' | 'webm'; mime: string; preview: boolean };
}

/** Bytes worth reading before classifying. */
export const SNIFF_BYTES = 4096;

const PREVIEW = /(^|[_\-. ])preview([_\-. ]|$)/i;

/** True when a file name marks audio as a short preview clip. */
export const isPreviewAudio = (name: string) => PREVIEW.test(baseName(name).toLowerCase());

function xmlRoot(head: Uint8Array): string | null {
  let text = new TextDecoder('utf-8', { fatal: false }).decode(head);
  text = text.replace(/^\ufeff/, '').replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>]*>/gi, '');
  const m = /^\s*<\s*([A-Za-z_][\w.:-]*)/.exec(text);
  return m ? m[1] : null;
}

const looksXml = (head: Uint8Array) => { const t = ascii(head, 0, 64).replace(/^\ufeff|^\xEF\xBB\xBF/, '').trimStart(); return t.startsWith('<'); };
const looksJson = (head: Uint8Array) => { const t = ascii(head, 0, 64).replace(/^\xEF\xBB\xBF/, '').trimStart(); return t.startsWith('{') || t.startsWith('['); };

/** RIFF/WAVE: PCM/float WAV plays in browsers; Wwise (.wem) uses its own codec tags. */
function riffAudio(head: Uint8Array): 'wav' | 'wem' | null {
  if (head.byteLength < 22 || (ascii(head, 0, 4) !== 'RIFF' && ascii(head, 0, 4) !== 'RIFX') || ascii(head, 8, 12) !== 'WAVE') return null;
  // Find the fmt chunk in the sniffed bytes.
  const le = ascii(head, 0, 4) === 'RIFF';
  const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
  let p = 12;
  while (p + 10 <= head.byteLength) {
    const id = ascii(head, p, p + 4);
    const len = dv.getUint32(p + 4, le);
    if (id === 'fmt ') {
      const tag = dv.getUint16(p + 8, le);
      // 1 PCM, 3 float, 0xFFFE extensible (PCM/float): playable. Wwise uses 0xFFFF / 0xFFFE with vorbis setup, 0x0166 etc.
      if (tag === 1 || tag === 3) return 'wav';
      if (tag === 0xfffe && len >= 40 && p + 8 + 26 <= head.byteLength) {
        const sub = dv.getUint16(p + 8 + 24, le);
        return sub === 1 || sub === 3 ? 'wav' : 'wem';
      }
      return 'wem';
    }
    p += 8 + len + (len & 1);
  }
  return null;
}

export function classify(name: string, head: Uint8Array): Classification {
  const ext = extOf(name);
  const base = baseName(name).toLowerCase();
  const magic = ascii(head, 0, 4);

  if (magic === 'PSAR') return { role: 'psarc', kind: 'PSARC archive' };
  if (magic === 'PK\x03\x04' || magic === 'PK\x05\x06') {
    if (ext === 'gp') return { role: 'guitar-pro', kind: 'Guitar Pro 7/8 file' };
    return { role: 'zip', kind: 'ZIP archive' };
  }
  if (magic === 'OggS') return { role: 'audio', kind: 'OGG audio', audio: { container: 'ogg', mime: 'audio/ogg', preview: PREVIEW.test(base) } };
  const riff = riffAudio(head);
  // A .wem always goes through the Wwise converter, even when it wraps PCM (it may be big-endian RIFX).
  if (riff && ext === 'wem') return { role: 'wwise-audio', kind: 'Wwise audio (.wem)' };
  if (riff === 'wav') return { role: 'audio', kind: 'WAV audio', audio: { container: 'wav', mime: 'audio/wav', preview: PREVIEW.test(base) } };
  if (riff === 'wem' || ext === 'wem') return { role: 'wwise-audio', kind: 'Wwise audio (.wem)' };
  if (magic === 'BKHD' || ext === 'bnk') return { role: 'wwise-bank', kind: 'Wwise sound bank (.bnk)' };
  if (magic === 'fLaC') return { role: 'audio', kind: 'FLAC audio', audio: { container: 'flac', mime: 'audio/flac', preview: PREVIEW.test(base) } };
  if (magic.startsWith('ID3') || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0 && ext === 'mp3')) {
    return { role: 'audio', kind: 'MP3 audio', audio: { container: 'mp3', mime: 'audio/mpeg', preview: PREVIEW.test(base) } };
  }
  if (ascii(head, 4, 8) === 'ftyp' && /^(m4a|mp4|aac)$/.test(ext)) return { role: 'audio', kind: 'M4A audio', audio: { container: 'm4a', mime: 'audio/mp4', preview: PREVIEW.test(base) } };
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3 && ext === 'webm') return { role: 'audio', kind: 'WebM audio', audio: { container: 'webm', mime: 'audio/webm', preview: PREVIEW.test(base) } };
  if (magic === 'DDS ' || /^(dds|png|jpe?g|webp)$/.test(ext)) return { role: 'image', kind: ext === 'dds' || magic === 'DDS ' ? 'DirectDraw texture (.dds)' : 'Image' };
  if (ext === 'sng') return { role: 'sng', kind: 'Rocksmith binary chart (.sng)' };
  if (ext === 'gp4' || ascii(head, 1, 25).startsWith('FICHIER GUITAR PRO v4.')) {
    return { role: 'guitar-pro-4', kind: 'Guitar Pro 4 file (.gp4)' };
  }
  if (/^(gp3|gp5|gpx)$/.test(ext)) return { role: 'guitar-pro-legacy', kind: `Guitar Pro (.${ext})` };

  if (looksXml(head) || ext === 'xml') {
    const root = xmlRoot(head);
    if (root === 'song') return { role: 'arrangement-xml', kind: 'Rocksmith arrangement (XML)' };
    if (root === 'vocals') return { role: 'vocals-xml', kind: 'Rocksmith vocals (XML)' };
    if (root === 'showlights') return { role: 'showlights-xml', kind: 'Rocksmith showlights (XML)' };
    return { role: 'other-xml', kind: root ? `XML (<${root}>)` : 'XML' };
  }
  if (looksJson(head) || ext === 'json' || ext === 'hsan') {
    if (ext === 'hsan') return { role: 'rs-hsan', kind: 'Rocksmith song index (.hsan)' };
    const t = new TextDecoder().decode(head);
    if (/"format"\s*:\s*"gma-song"/.test(t)) return { role: 'gma-song', kind: 'Guitar Mastery song (JSON)' };
    if (/"Entries"\s*:/.test(t)) return { role: 'rs-manifest', kind: 'Rocksmith manifest (JSON)' };
    return { role: 'json', kind: 'JSON' };
  }
  if (/^(xblock|nt|appid|flat|txt|toolkit\.version)$/.test(ext) || base === 'appid.appid' || base === 'toolkit.version') {
    return { role: 'game-data', kind: `Game data (.${ext || base})` };
  }
  return { role: 'unknown', kind: ext ? `.${ext} file` : 'Unrecognised file' };
}

/** What an archive entry or loose file means for an import, before it is opened. */
export function roleSummary(role: FileRole): { status: 'import' | 'metadata' | 'unsupported' | 'not-used' | 'archive'; detail: string } {
  switch (role) {
    case 'psarc': case 'zip': return { status: 'archive', detail: 'Archive: its contents are inspected.' };
    case 'arrangement-xml': case 'gma-song': case 'guitar-pro': case 'guitar-pro-4': return { status: 'import', detail: 'Chart for Play mode.' };
    case 'audio': return { status: 'import', detail: 'Playable audio.' };
    case 'rs-manifest': case 'rs-hsan': return { status: 'metadata', detail: 'Song details (title, artist, album, arrangement).' };
    case 'vocals-xml': return { status: 'not-used', detail: 'Lyrics: Play mode does not show lyrics yet.' };
    case 'showlights-xml': return { status: 'not-used', detail: 'Stage lighting cues: not used by Play mode.' };
    case 'wwise-audio': return { status: 'import', detail: 'Wwise audio (.wem): Wwise Vorbis is converted to OGG, and PCM/ADPCM to WAV in the browser.' };
    case 'wwise-bank': return { status: 'unsupported', detail: 'Wwise sound bank (playback events for the game’s audio engine). Browsers cannot use it.' };
    case 'sng': return { status: 'import', detail: 'Rocksmith 2014 binary chart (.sng): decrypted and parsed in the browser.' };
    case 'guitar-pro-legacy': return { status: 'unsupported', detail: 'Older Guitar Pro format; save it as .gp (Guitar Pro 7/8) or .gp4 to import.' };
    case 'image': return { status: 'not-used', detail: 'Artwork or texture: not used by Play mode.' };
    case 'game-data': return { status: 'not-used', detail: 'Game engine data: not needed by Play mode.' };
    case 'other-xml': case 'json': return { status: 'not-used', detail: 'Not a chart or song description this app understands.' };
    default: return { status: 'not-used', detail: 'Unrecognised content.' };
  }
}
