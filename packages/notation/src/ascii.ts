/**
 * ASCII tablature export and import.
 *
 * Export writes a readable tab with an annotation row (PM / LR / TP / >),
 * one line per string (highest pitch at the top), bar lines, and technique
 * symbols. Import reads the same dialect plus common variations found online.
 *
 * Supported symbols (documented in docs/tab-format.md):
 *   5      fret number           x     dead note
 *   5h7    hammer-on             7p5   pull-off
 *   5/7    slide up              7\5   slide down
 *   7b9    bend to fret 9 pitch  7bq   quarter-tone bend   7b alone = full bend
 *   7pb9   pre-bend              9r7   release
 *   7~     vibrato               7tr9  trill
 *   <12>   natural harmonic      [7]   artificial / pinch harmonic
 *   (5)    ghost note            t12   tapped note
 *   Annotation row: PM-- palm mute, LR-- let ring, TP-- tremolo, > accent
 *
 * ASCII tab does not encode rhythm. On import, durations are estimated from
 * horizontal spacing within each bar and the user is warned.
 */
import { beatLength, measureCapacity, type Duration, type TabBeat, type TabMeasure, type TabNote, type TabScore, type Technique } from './model';

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function stringLabel(midi: number, isHighest: boolean): string {
  const n = PC_NAMES[((midi % 12) + 12) % 12];
  return isHighest && n === 'E' ? 'e' : n;
}

function spacingFor(b: TabBeat): number {
  const len = beatLength(b);
  if (len >= 4) return 8;
  if (len >= 2) return 5;
  if (len >= 1) return 3;
  if (len >= 0.5) return 2;
  return 1;
}

function bendSuffix(n: TabNote): string {
  const tech = n.techniques ?? [];
  const steps = n.bend ?? 1;
  const target = n.fret + Math.round(steps * 2);
  let s = '';
  if (tech.includes('prebend')) s += `pb${target}`;
  else if (tech.includes('bend')) s += steps === 0.25 ? 'bq' : `b${target}`;
  if (tech.includes('release')) s += `r${n.fret}`;
  if (tech.includes('trill') && n.trillFret !== undefined) s += `tr${n.trillFret}`;
  if (tech.includes('vibrato')) s += '~';
  return s;
}

function noteToken(n: TabNote, prev: TabNote | undefined): string {
  const tech = n.techniques ?? [];
  let connector = '';
  if (prev) {
    if (tech.includes('hammer')) connector = 'h';
    else if (tech.includes('pull')) connector = 'p';
    else if (tech.includes('slideUp')) connector = '/';
    else if (tech.includes('slideDown')) connector = '\\';
  }
  if (tech.includes('slideIn')) connector = '/';
  let body: string;
  if (tech.includes('dead')) body = 'x';
  else if (tech.includes('harmonic')) body = `<${n.fret}>`;
  else if (tech.includes('artificialHarmonic')) body = `[${n.fret}]`;
  else if (tech.includes('ghost')) body = `(${n.fret})`;
  else body = String(n.fret);
  if (tech.includes('tap')) connector = 't';
  return connector + body + bendSuffix(n) + (tech.includes('slideOut') ? '\\' : '');
}

/** Render a score as ASCII tab. */
export function toAscii(score: TabScore, measuresPerLine = 4): string {
  const nStr = score.tuning.strings.length;
  const labels = score.tuning.strings.map((m, i) => stringLabel(m, i === nStr - 1));
  const labelWidth = Math.max(...labels.map((l) => l.length));
  const out: string[] = [];
  out.push(`${score.title}`);
  out.push(`Tuning: ${score.tuning.name} (${[...labels].join(' ')}) | ${score.tempo} bpm | ${score.timeSignature[0]}/${score.timeSignature[1]}`);
  out.push('');
  const prevOnString: (TabNote | undefined)[] = new Array(nStr).fill(undefined);

  for (let start = 0; start < score.measures.length; start += measuresPerLine) {
    const rows: string[] = labels.map((l) => l.padEnd(labelWidth) + '|');
    let annot = ' '.repeat(labelWidth + 1);
    let chords = ' '.repeat(labelWidth + 1);
    const flags = { PM: false, LR: false, TP: false };
    for (const [mi, m] of score.measures.slice(start, start + measuresPerLine).entries()) {
      const absIdx = start + mi;
      if (m.repeatStart) rows.forEach((_, i) => (rows[i] = rows[i].replace(/\|$/, '|:')));
      if (m.repeatStart) { annot += ' '; chords += ' '; }
      rows.forEach((_, i) => (rows[i] += '-'));
      annot += ' ';
      chords += ' ';
      for (const b of m.beats) {
        const tokens: string[] = new Array(nStr).fill('');
        for (const n of b.notes) {
          tokens[n.string] = b.rest ? '' : noteToken(n, prevOnString[n.string]);
          prevOnString[n.string] = n;
        }
        const width = Math.max(1, ...tokens.map((t) => t.length));
        const colW = width + spacingFor(b);
        rows.forEach((_, i) => {
          const tok = tokens[nStr - 1 - i];
          rows[i] += tok + '-'.repeat(colW - tok.length);
        });
        const techs = new Set(b.notes.flatMap((n) => n.techniques ?? []));
        let mark = '';
        for (const key of ['PM', 'LR', 'TP'] as const) {
          const on = techs.has(key === 'PM' ? 'palmMute' : key === 'LR' ? 'letRing' : 'tremolo');
          if (on) mark = flags[key] ? '-' : key;
          flags[key] = on;
        }
        if (techs.has('accent')) mark = '>' + mark;
        annot += (mark + ' '.repeat(colW)).slice(0, colW);
        chords += ((b.chord ?? '') + ' '.repeat(colW)).slice(0, colW);
      }
      const close = m.repeatEnd ? `:|` : '|';
      rows.forEach((_, i) => (rows[i] += close));
      annot += ' '.repeat(close.length);
      chords += m.repeatEnd && m.repeatEnd > 1 ? `x${m.repeatEnd}`.padEnd(close.length) : ' '.repeat(close.length);
      void absIdx;
    }
    if (chords.trim()) out.push(chords.trimEnd());
    if (annot.trim()) out.push(annot.trimEnd());
    out.push(...rows);
    out.push('');
  }
  return out.join('\n').trimEnd() + '\n';
}

// ── Import ───────────────────────────────────────────────────────────────

export interface AsciiImportResult {
  score: TabScore | null;
  warnings: string[];
  errors: string[];
}

const TAB_LINE = /^\s*([A-Ga-g][#b]?)?\s*[|:]?[-|:0-9hpbrtx~<>[\]()\/\\.qa-z*]*-[-|:0-9hpbrtx~<>[\]()\/\\.qa-z*]*\s*$/;

interface RawNote { col: number; note: TabNote; }

const NOTE_RE = /^(h|p|\/|\\|t)?(?:(\d{1,2})|<(\d{1,2})>|\[(\d{1,2})\]|\((\d{1,2})\)|(x))((?:bq|b\d{1,2}|b|pb\d{1,2}|r\d{1,2}|tr\d{1,2}|~|\\)*)/;

function parseLine(line: string, stringIdx: number): { notes: RawNote[]; bars: number[] } {
  const notes: RawNote[] = [];
  const bars: number[] = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '|' || ch === ':') {
      if (ch === '|') bars.push(i);
      i++;
      continue;
    }
    const m = NOTE_RE.exec(line.slice(i));
    if (m && (m[2] || m[3] || m[4] || m[5] || m[6])) {
      const connector = m[1];
      const digitCol = i + (connector ? 1 : 0);
      const techniques: Technique[] = [];
      let fret = 0;
      if (m[2]) fret = Number(m[2]);
      else if (m[3]) { fret = Number(m[3]); techniques.push('harmonic'); }
      else if (m[4]) { fret = Number(m[4]); techniques.push('artificialHarmonic'); }
      else if (m[5]) { fret = Number(m[5]); techniques.push('ghost'); }
      else if (m[6]) { techniques.push('dead'); }
      if (connector === 'h') techniques.push('hammer');
      else if (connector === 'p') techniques.push('pull');
      else if (connector === '/') techniques.push('slideUp');
      else if (connector === '\\') techniques.push('slideDown');
      else if (connector === 't') techniques.push('tap');
      const note: TabNote = { string: stringIdx, fret, techniques };
      const suffix = m[7] ?? '';
      for (const sm of suffix.matchAll(/bq|b\d{1,2}|b|pb\d{1,2}|r\d{1,2}|tr\d{1,2}|~|\\/g)) {
        const t = sm[0];
        if (t === 'bq') { techniques.push('bend'); note.bend = 0.25; }
        else if (t === 'b') { techniques.push('bend'); note.bend = 1; }
        else if (t.startsWith('pb')) { techniques.push('prebend'); note.bend = Math.max(0.25, (Number(t.slice(2)) - fret) / 2); }
        else if (t.startsWith('b')) { techniques.push('bend'); note.bend = Math.max(0.25, (Number(t.slice(1)) - fret) / 2); }
        else if (t.startsWith('r')) techniques.push('release');
        else if (t.startsWith('tr')) { techniques.push('trill'); note.trillFret = Number(t.slice(2)); }
        else if (t === '~') techniques.push('vibrato');
        else if (t === '\\') techniques.push('slideOut');
      }
      // A slide connector right after a bar or at the start is a "slide in".
      if (connector === '/' && !notes.length) {
        techniques.splice(techniques.indexOf('slideUp'), 1, 'slideIn');
      }
      if (!note.techniques!.length) delete note.techniques;
      notes.push({ col: digitCol, note });
      i += m[0].length;
      continue;
    }
    i++;
  }
  return { notes, bars };
}

function quantize(quarters: number): { duration: Duration; dotted: boolean } {
  const options: { duration: Duration; dotted: boolean; len: number }[] = [];
  for (const d of [1, 2, 4, 8, 16, 32] as Duration[]) {
    options.push({ duration: d, dotted: false, len: 4 / d });
    if (d >= 2 && d <= 16) options.push({ duration: d, dotted: true, len: 6 / d });
  }
  let best = options[0];
  for (const o of options) if (Math.abs(Math.log(o.len / quarters)) < Math.abs(Math.log(best.len / quarters))) best = o;
  return { duration: best.duration, dotted: best.dotted };
}

/**
 * Parse ASCII tab. `tuning` supplies MIDI strings (lowest first); if omitted, a
 * standard tuning matching the number of tab lines is assumed.
 */
export function parseAscii(text: string, tuning?: { name: string; strings: number[] }, title = 'Imported tab'): AsciiImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: { lines: string[]; annot?: string }[] = [];
  let cur: string[] = [];
  let pendingAnnot: string | undefined;
  const flush = () => {
    if (cur.length) blocks.push({ lines: cur, annot: pendingAnnot });
    cur = [];
    pendingAnnot = undefined;
  };
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ');
    const looksTab = TAB_LINE.test(line) && (line.match(/-/g)?.length ?? 0) >= 3 && /[|:]/.test(line);
    if (looksTab) cur.push(line);
    else {
      flush();
      if (/\b(PM|LR|TP)\b|^\s*>/.test(line)) pendingAnnot = line;
    }
  }
  flush();
  if (!blocks.length) return { score: null, warnings, errors: ['No tab lines found. Each string line should look like "e|---3---5---|".'] };

  const nStr = blocks[0].lines.length;
  if (blocks.some((b) => b.lines.length !== nStr)) errors.push('Every tab block must have the same number of string lines.');
  const defaults: Record<number, { name: string; strings: number[] }> = {
    4: { name: 'Bass standard (E A D G)', strings: [28, 33, 38, 43] },
    6: { name: 'E Standard', strings: [40, 45, 50, 55, 59, 64] },
    7: { name: '7-string Standard', strings: [35, 40, 45, 50, 55, 59, 64] },
    8: { name: '8-string Standard', strings: [30, 35, 40, 45, 50, 55, 59, 64] },
  };
  const tun = tuning ?? defaults[nStr];
  if (!tun) errors.push(`Unsupported number of strings (${nStr}).`);
  else if (tun.strings.length !== nStr) errors.push(`The tab has ${nStr} string lines but the selected tuning has ${tun.strings.length} strings.`);
  if (!tuning && tun) warnings.push(`No tuning was given, so ${tun.name} was assumed.`);
  if (errors.length) return { score: null, warnings, errors };

  const measures: TabMeasure[] = [];
  let estimated = false;
  for (const block of blocks) {
    // Remove string names so columns line up.
    const stripped = block.lines.map((l) => l.replace(/^\s*[A-Ga-g][#b]?\s*/, ''));
    const parsed = stripped.map((l, row) => parseLine(l, nStr - 1 - row));
    const bars = [...new Set(parsed[0].bars)].sort((a, b) => a - b);
    const all = parsed.flatMap((p) => p.notes).sort((a, b) => a.col - b.col);
    const segments = bars.length >= 2 ? bars.slice(0, -1).map((b, i) => [b, bars[i + 1]] as [number, number]) : [[0, Math.max(...stripped.map((l) => l.length))] as [number, number]];
    for (const [from, to] of segments) {
      const inBar = all.filter((n) => n.col > from && n.col < to);
      const groups: RawNote[][] = [];
      for (const n of inBar) {
        const g = groups.find((gr) => Math.abs(gr[0].col - n.col) <= 1 && !gr.some((x) => x.note.string === n.note.string));
        if (g) g.push(n);
        else groups.push([n]);
      }
      groups.sort((a, b) => a[0].col - b[0].col);
      const cap = measureCapacity([4, 4]);
      const width = to - from;
      const beats: TabBeat[] = groups.map((g, gi) => {
        const nextCol = gi + 1 < groups.length ? groups[gi + 1][0].col : to;
        const gap = nextCol - g[0].col;
        const q = quantize((gap / width) * cap);
        estimated = true;
        return { duration: q.duration, dotted: q.dotted || undefined, notes: g.map((x) => x.note).sort((a, b) => a.string - b.string) };
      });
      if (beats.length) measures.push({ beats });
    }
    if (block.annot) {
      const pmAt = [...block.annot.matchAll(/PM-*/g)];
      if (pmAt.length) {
        // Apply palm-mute marks to notes whose column lies under a PM span.
        const offset = block.lines[0].length - stripped[0].length;
        const spans = pmAt.map((m) => [m.index! - offset, m.index! - offset + m[0].length] as [number, number]);
        for (const p of parsed) for (const n of p.notes) if (spans.some(([a, b]) => n.col >= a && n.col <= b)) n.note.techniques = [...(n.note.techniques ?? []), 'palmMute'];
      }
    }
  }
  if (!measures.length) return { score: null, warnings, errors: ['The tab lines contain no notes.'] };
  if (estimated) warnings.push('ASCII tab does not store rhythm; note lengths were estimated from spacing. Check them in the editor.');
  const score: TabScore = { format: 'gma-tab', version: 1, title, tuning: { name: tun!.name, strings: [...tun!.strings] }, tempo: 90, timeSignature: [4, 4], measures };
  return { score, warnings, errors };
}

/** Serialize the native format. */
export function toJson(score: TabScore): string {
  return JSON.stringify(score, null, 2);
}
