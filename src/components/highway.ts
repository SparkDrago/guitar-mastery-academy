/**
 * Canvas renderer for the Play-mode note highway: notes travel from the
 * horizon toward the string rows; x is the fret, the row (and colour) is the
 * string. Drawn every animation frame; no React involvement.
 */
import { eventsBetween, type PlaySong, type SongEvent, type SongNote } from '@gma/notation';

/** Low string first. 7- and 8-string guitars get two extra colours. */
export const STRING_COLORS = ['#e2445f', '#f2c230', '#3a9be6', '#f08a35', '#29b878', '#9a6cf0', '#38c3c8', '#b8b2d6'];

export interface HighwayState {
  song: PlaySong;
  /** Current song time, seconds. */
  t: number;
  /** Seconds of song visible ahead of the strings. */
  lookahead: number;
  cam: { lo: number; hi: number };
  status: (index: number) => 'pending' | 'hit' | 'miss' | 'skip';
  lowOnTop: boolean;
  leftHanded: boolean;
  /** Index → song time it was judged a hit (for the flash). */
  flashes: Map<number, number>;
  /** Event index of each event in song.events (eventsBetween returns objects). */
  indexOf: Map<SongEvent, number>;
  loop?: { from: number; to: number } | null;
}

const PERSPECTIVE = 3.2;

export function drawHighway(g: CanvasRenderingContext2D, W: number, H: number, st: HighwayState) {
  const { song, t, lookahead, cam } = st;
  const n = song.tuning.strings.length;
  const horizonY = H * 0.08;
  const rowTop = H * 0.66;
  const rowBottom = H * 0.86;
  const fretLabelY = H * 0.95;
  const m = W * 0.05;
  const cx = W / 2;
  const span = Math.max(1, cam.hi - cam.lo);
  const rowOf = (s: number) => (st.lowOnTop ? s : n - 1 - s);
  const rowY = (s: number) => rowTop + (rowOf(s) * (rowBottom - rowTop)) / Math.max(1, n - 1);
  const fx0 = (f: number) => { const x = m + ((f - cam.lo) / span) * (W - 2 * m); return st.leftHanded ? W - x : x; };
  const scale = (z: number) => 1 / (1 + PERSPECTIVE * Math.max(0, z));
  const P = (x: number, y: number, z: number) => { const s = scale(z); return [cx + (x - cx) * s, horizonY + (y - horizonY) * s] as const; };
  const zOf = (time: number) => (time - t) / lookahead;

  // Background
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#120f26');
  bg.addColorStop(1, '#1d1839');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Highway floor
  const [lx0, ly0] = P(m, rowBottom + 10, 0);
  const [rx0] = P(W - m, rowBottom + 10, 0);
  const [lx1, ly1] = P(m, rowBottom + 10, 1);
  const [rx1] = P(W - m, rowBottom + 10, 1);
  g.fillStyle = 'rgba(122,92,242,0.07)';
  g.beginPath(); g.moveTo(lx0, ly0); g.lineTo(rx0, ly0); g.lineTo(rx1, ly1); g.lineTo(lx1, ly1); g.closePath(); g.fill();

  // Loop region tint
  if (st.loop) {
    const za = Math.max(0, zOf(st.loop.from)), zb = Math.min(1.05, zOf(st.loop.to));
    if (zb > 0 && za < 1.05) {
      const [ax, ay] = P(m, rowTop, za), [bx] = P(W - m, rowTop, za), [cx1, cy] = P(m, rowTop, zb), [dx] = P(W - m, rowTop, zb);
      g.fillStyle = 'rgba(41,184,120,0.06)';
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, ay); g.lineTo(dx, cy); g.lineTo(cx1, cy); g.closePath(); g.fill();
    }
  }

  // Fret wires in perspective, with inlay dots on the floor
  const first = Math.max(0, Math.floor(cam.lo)), last = Math.ceil(cam.hi);
  for (let f = first; f <= last; f++) {
    const x = fx0(f);
    if (x < m * 0.5 || x > W - m * 0.5) continue;
    const [x0, y0] = P(x, rowBottom + 10, 0), [x1, y1] = P(x, rowBottom + 10, 1);
    g.strokeStyle = f === 0 ? 'rgba(239,237,251,0.32)' : 'rgba(167,161,205,0.16)';
    g.lineWidth = f === 0 ? 2.5 : 1;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  g.font = `600 ${Math.round(H * 0.026)}px Poppins, system-ui, sans-serif`;
  g.textAlign = 'center';
  for (let f = Math.max(1, first + 1); f <= last; f++) {
    const x = (fx0(f - 1) + fx0(f)) / 2;
    if (x < m || x > W - m) continue;
    g.fillStyle = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(f) ? '#efedfb' : '#8780b4';
    g.fillText(String(f), x, fretLabelY);
  }

  // Beat lines
  for (const b of song.beats) {
    const z = zOf(b.time);
    if (z < -0.02 || z > 1) continue;
    const [ax, ay] = P(m, rowBottom + 10, z), [bx] = P(W - m, rowBottom + 10, z);
    g.strokeStyle = b.downbeat ? 'rgba(239,237,251,0.28)' : 'rgba(239,237,251,0.1)';
    g.lineWidth = b.downbeat ? 2 : 1;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, ay); g.stroke();
  }

  // String rows (the "now" line)
  for (let s = 0; s < n; s++) {
    const y = rowY(s);
    g.strokeStyle = STRING_COLORS[s % STRING_COLORS.length];
    g.globalAlpha = 0.85;
    g.lineWidth = s < Math.ceil(n / 2) ? 3 : 2; // lower (wound) strings drawn thicker
    g.beginPath(); g.moveTo(m * 0.6, y); g.lineTo(W - m * 0.6, y); g.stroke();
    g.globalAlpha = 1;
  }

  // Notes, far to near so near ones draw on top
  const visible = eventsBetween(song, t - 0.4, t + lookahead).reverse();
  for (const e of visible) {
    const idx = st.indexOf.get(e) ?? -1;
    const status = st.status(idx);
    const notes = e.kind === 'note' ? [e as SongNote] : e.notes;
    const z = zOf(e.time);
    if (e.kind === 'chord' && notes.length > 1) {
      // Chord frame across the fret span and string rows.
      const frs = notes.map((x) => x.fret).filter((f) => f > 0);
      const fl = frs.length ? Math.min(...frs) - 1 : cam.lo, fh = frs.length ? Math.max(...frs) : cam.lo + 1;
      const ys = notes.map((x) => rowY(x.string));
      const xa = Math.min(fx0(fl), fx0(fh)), xb = Math.max(fx0(fl), fx0(fh));
      const [p1x, p1y] = P(xa - 6, Math.min(...ys) - 12, Math.max(z, 0)), [p2x, p2y] = P(xb + 6, Math.max(...ys) + 12, Math.max(z, 0));
      g.strokeStyle = status === 'hit' ? 'rgba(41,184,120,0.9)' : status === 'miss' ? 'rgba(135,128,180,0.5)' : 'rgba(239,237,251,0.55)';
      g.lineWidth = 1.5;
      g.strokeRect(p1x, p1y, p2x - p1x, p2y - p1y);
      if ((e as Extract<SongEvent, { kind: 'chord' }>).name && z > -0.05) {
        g.fillStyle = '#efedfb';
        g.font = `600 ${Math.max(10, Math.round(H * 0.035 * scale(z)))}px Poppins, system-ui, sans-serif`;
        g.fillText((e as Extract<SongEvent, { kind: 'chord' }>).name, (p1x + p2x) / 2, p1y - 6 * scale(z));
      }
    }
    for (const note of notes) drawNote(note, z, status, e.time, idx);
  }

  function drawNote(note: SongNote, z: number, status: string, time: number, idx: number) {
    const color = STRING_COLORS[note.string % STRING_COLORS.length];
    const y = rowY(note.string);
    const flash = st.flashes.get(idx);
    // Sustain tail
    if (note.sustain > 0.05) {
      const z2 = Math.min(1, zOf(time + note.sustain));
      const z1 = Math.max(0, z);
      if (z2 > z1) {
        const x = note.fret === 0 ? cx : (fx0(note.fret - 1) + fx0(note.fret)) / 2;
        const w = note.fret === 0 ? (W - 2 * m) * 0.9 : Math.abs(fx0(note.fret) - fx0(note.fret - 1)) * 0.22;
        const [a1, b1] = P(x - w / 2, y, z1), [a2] = P(x + w / 2, y, z1), [c1, d1] = P(x - w / 2, y, z2), [c2] = P(x + w / 2, y, z2);
        g.fillStyle = color + '66';
        g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b1); g.lineTo(c2, d1); g.lineTo(c1, d1); g.closePath(); g.fill();
      }
    }
    if (z < -0.12) return;
    const zz = Math.max(z, 0);
    const s = scale(zz);
    let fill = color;
    let alpha = 1;
    if (status === 'miss') { fill = '#5f5696'; alpha = 0.6; }
    if (status === 'hit') alpha = Math.max(0, 1 - Math.max(0, t - time) * 3);
    if (z < 0 && status === 'pending') alpha = 0.7;
    g.globalAlpha = alpha;
    if (note.fret === 0) {
      // Open string: a bar across the visible frets.
      const [ax, ay] = P(m + 4, y, zz), [bx] = P(W - m - 4, y, zz);
      const h = Math.max(3, H * 0.022 * s);
      g.fillStyle = fill;
      roundRect(g, ax, ay - h / 2, bx - ax, h, h / 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = `700 ${Math.max(9, Math.round(H * 0.03 * s))}px Poppins, system-ui, sans-serif`;
      g.fillText('0', (ax + bx) / 2, ay + h * 0.35);
    } else {
      const x = (fx0(note.fret - 1) + fx0(note.fret)) / 2;
      const fw = Math.abs(fx0(note.fret) - fx0(note.fret - 1));
      const rowGap = (rowBottom - rowTop) / Math.max(1, n - 1);
      const w = Math.min(fw * 0.72, W * 0.09) * s;
      const h = Math.max(7, Math.min(H * 0.05, rowGap * 0.86) * s);
      const [px, py] = P(x, y, zz);
      g.fillStyle = fill;
      if (flash !== undefined && t - flash < 0.25) { g.shadowColor = '#29b878'; g.shadowBlur = 24; }
      roundRect(g, px - w / 2, py - h / 2, w, h, Math.min(8, h / 3));
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#ffffff';
      g.font = `700 ${Math.max(9, Math.round(h * 0.55))}px Poppins, system-ui, sans-serif`;
      g.fillText(String(note.fret), px, py + h * 0.2);
      const tag = techniqueTag(note);
      if (tag && s > 0.35) {
        g.fillStyle = '#efedfb';
        g.font = `600 ${Math.max(9, Math.round(H * 0.024 * s))}px Poppins, system-ui, sans-serif`;
        g.fillText(tag, px, py - h * 0.7);
      }
    }
    g.globalAlpha = 1;
  }
}

function techniqueTag(n: SongNote): string {
  const t = n.techniques;
  if (t.includes('bend')) return n.bend ? `b${n.bend === 1 ? '½' : n.bend === 2 ? '1' : (n.bend / 2).toString()}` : 'b';
  if (t.includes('hammer')) return 'H';
  if (t.includes('pull')) return 'P';
  if (t.includes('slideUp') || t.includes('slideDown')) return n.slideTo !== undefined ? `→${n.slideTo}` : '/';
  if (t.includes('palmMute')) return 'PM';
  if (t.includes('dead')) return '×';
  if (t.includes('harmonic') || t.includes('artificialHarmonic')) return '◇';
  if (t.includes('tap')) return 'T';
  if (t.includes('vibrato')) return '~';
  return '';
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
