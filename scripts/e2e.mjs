#!/usr/bin/env node
/**
 * Browser tests (Playwright + Chrome) against the production build in dist/.
 *   node scripts/e2e.mjs                 # all tests
 *   node scripts/e2e.mjs tuner jam       # only tests whose name contains a filter
 *   E2E_BASE_URL=https://… node scripts/e2e.mjs   # run against a deployment
 * The microphone is faked with synthesised WAV files (Chrome's fake-capture flags),
 * so the tuner and analyzer are exercised end to end on real audio.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filters = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH ?? (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const port = 4190 + Math.floor(Math.random() * 50);
const external = process.env.E2E_BASE_URL;
const BASE = external ?? `http://localhost:${port}`;
const shots = path.join(root, 'test-results');
fs.mkdirSync(shots, { recursive: true });

if (!external && !fs.existsSync(path.join(root, 'dist/index.html'))) {
  console.error('dist/ is missing: run `npm run build` first.');
  process.exit(1);
}
const server = external ? null : serve(path.join(root, 'dist'), port);

// ── synthesised microphone input ─────────────────────────────────────────
function wav(samples, sr = 48000) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  return buf;
}
/** A plucked-string-like tone (harmonics, decay), re-plucked every `every` seconds. */
function guitarTone(freq, seconds = 6, every = 1.5, sr = 48000) {
  const out = new Float32Array(Math.floor(seconds * sr));
  const amps = [1, 0.6, 0.35, 0.2, 0.12];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const local = t % every;
    const env = Math.exp(-local * 1.6) * Math.min(1, local / 0.004);
    let v = 0;
    amps.forEach((a, k) => { v += a * Math.sin(2 * Math.PI * freq * (k + 1) * t); });
    out[i] = 0.25 * env * v;
  }
  return out;
}
function chordTone(freqs, seconds = 6, sr = 48000) {
  const parts = freqs.map((f) => guitarTone(f, seconds, 2, sr));
  return parts[0].map((_, i) => parts.reduce((a, p) => a + p[i], 0) / freqs.length * 1.6);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gma-e2e-'));
const C_CHORD = path.join(tmp, 'c-major.wav');
fs.writeFileSync(C_CHORD, wav(chordTone([130.81, 164.81, 196.0, 261.63, 329.63])));
const A2 = path.join(tmp, 'a2-110hz.wav');
const SHARP_E4 = path.join(tmp, 'e4-sharp.wav');
fs.writeFileSync(A2, wav(guitarTone(110)));
fs.writeFileSync(SHARP_E4, wav(guitarTone(329.63 * Math.pow(2, 18 / 1200))));

// ── tiny harness ─────────────────────────────────────────────────────────
const results = [];
const tests = [];
const test = (name, fn, opts = {}) => tests.push({ name, fn, opts });
function expect(cond, message) { if (!cond) throw new Error(message); }

async function launch(audioFile) {
  const args = ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
  if (audioFile) args.push(`--use-file-for-fake-audio-capture=${audioFile}`);
  return chromium.launch({ executablePath: CHROME, args });
}

async function newPage(browser, { mobile = false, onboard = true } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, permissions: ['microphone'] }
    : { viewport: { width: 1360, height: 900 }, permissions: ['microphone'] });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(`console: ${m.text()}`); });
  await page.goto(BASE + '/');
  if (onboard) await page.getByTestId('onboarding-finish').click();
  return page;
}
const go = (page, route) => page.evaluate((r) => { history.pushState(null, '', r); dispatchEvent(new PopStateEvent('popstate')); }, route);
const stored = (page, collection) => page.evaluate((c) => {
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('gma.') && k.endsWith(`.${c}`)) return JSON.parse(localStorage.getItem(k)); }
  return null;
}, collection);

// ── tests ────────────────────────────────────────────────────────────────

test('every route renders without errors', async (b) => {
  const page = await newPage(b);
  const routes = ['/', '/path', '/lessons', '/lessons/l0-tuning', '/theory', '/tuner', '/metronome', '/fretboard', '/scales', '/chords', '/chord-finder', '/play', '/import', '/practice', '/technique-lab', '/fretboard-trainer', '/ear-training', '/analyzer', '/tab-editor', '/improvisation', '/jam', '/progress', '/settings', '/account'];
  for (const r of routes) {
    await go(page, r);
    await page.waitForTimeout(150);
    const alerts = page.locator('[role=alert]');
    if (await alerts.count()) throw new Error(`error boundary on ${r}: ${await alerts.first().textContent()}`);
    expect((await page.locator('h1').count()) > 0, `no heading on ${r}`);
  }
  await go(page, '/does-not-exist');
  expect(await page.getByText('Page not found').isVisible(), '404 page');
  expect(page.errors.length === 0, page.errors.join('\n'));
});

test('theme switch, site search and dashboard widgets', async (b) => {
  const page = await newPage(b);
  for (const id of ['dash-level', 'dash-skills', 'dash-today', 'dash-progress']) expect(await page.getByTestId(id).count() === 1, `dashboard widget ${id}`);
  await page.getByTestId('theme-switch').first().click();
  expect(await page.evaluate(() => document.documentElement.classList.contains('light')), 'light theme applied');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg === 'rgb(243, 242, 251)', `light background, got ${bg}`);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.classList.contains('light')), 'theme persists across reloads');
  await page.getByTestId('theme-switch').first().click();
  expect(!(await page.evaluate(() => document.documentElement.classList.contains('light'))), 'back to dark');
  await page.getByTestId('site-search').fill('Holding and using');
  await page.getByRole('option').first().click();
  expect(/\/lessons\//.test(page.url()), `search opened a lesson (${page.url()})`);
  await page.getByTestId('site-search').fill('vibrato');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  expect(page.url().includes('/theory') || page.url().includes('/lessons/'), `search result navigated (${page.url()})`);
  expect(page.errors.length === 0, page.errors.join('\n'));
});

test('tuner detects A2 (110 Hz) from the microphone', async () => {
  const b = await launch(A2);
  try {
    const page = await newPage(b);
    await page.getByTestId('header-tuner').click();
    await page.getByTestId('tuner-start').click();
    await page.waitForFunction(() => /^A/.test(document.querySelector('[data-testid=tuner-note]')?.textContent ?? ''), null, { timeout: 8000 });
    await page.waitForTimeout(800);
    const hz = parseFloat((await page.getByTestId('tuner-hz').textContent()) ?? '0');
    const note = await page.getByTestId('tuner-note').textContent();
    expect(Math.abs(hz - 110) < 0.6, `expected ~110 Hz, got ${hz}`);
    expect(/^A/.test(note ?? ''), `expected A, got ${note}`);
    const strings = await page.getByTestId('tuner-strings').textContent();
    expect(/A/.test(strings ?? ''), 'string list rendered');
    await page.screenshot({ path: path.join(shots, 'tuner-a2.png') });
    expect(page.errors.length === 0, page.errors.join('\n'));
  } finally { await b.close(); }
}, { ownBrowser: true });

test('tuner reports a sharp E4 (+18 cents) as sharp', async () => {
  const b = await launch(SHARP_E4);
  try {
    const page = await newPage(b);
    await go(page, '/tuner');
    await page.getByTestId('tuner-start').click();
    await page.waitForFunction(() => /^E/.test(document.querySelector('[data-testid=tuner-note]')?.textContent ?? ''), null, { timeout: 8000 });
    await page.waitForTimeout(800);
    const body = await page.locator('main').textContent();
    const m = /([+-]\d+)\s*(?:¢|cents)/.exec(body ?? '');
    expect(m && Number(m[1]) >= 12 && Number(m[1]) <= 24, `expected about +18 cents, page shows ${m?.[0]}`);
    expect(/sharp/i.test(body ?? ''), 'shows a sharp/tune-down status');
  } finally { await b.close(); }
}, { ownBrowser: true });

test('tuning presets and custom tuning editor', async (b) => {
  const page = await newPage(b);
  await go(page, '/tuner');
  const opts = await page.locator('[data-testid=tuner-tuning] option').count();
  expect(opts >= 39, `expected all tuning presets, found ${opts}`);
  await go(page, '/settings');
  await page.getByRole('button', { name: /New tuning/ }).first().click();
  await page.getByTestId('tuning-name').fill('Test Baritone');
  await page.getByTestId('tuning-save').click();
  const tunings = await stored(page, 'tunings');
  expect(tunings?.some((t) => t.name === 'Test Baritone'), 'custom tuning stored');
  await go(page, '/fretboard');
  const fbOptions = await page.locator('[data-testid=fb-tuning] option').allTextContents();
  expect(fbOptions.some((o) => o.includes('Test Baritone')), 'custom tuning offered in fretboard tool');
});

test('fretboard engine: 7- and 8-string tunings and left-handed view', async (b) => {
  const page = await newPage(b);
  await go(page, '/fretboard');
  const select = page.locator('[data-testid=fb-tuning]');
  const values = await select.locator('option').evaluateAll((os) => os.map((o) => ({ v: o.value, t: o.textContent })));
  const eight = values.find((o) => /8-string|F#/.test(o.t ?? '') && /8/.test(o.t ?? ''));
  expect(eight, 'an 8-string tuning is listed');
  await select.selectOption(eight.v);
  await page.waitForTimeout(150);
  const label = await page.locator('[data-testid=fretboard-main] svg').getAttribute('aria-label');
  expect(/8 strings/.test(label ?? ''), `fretboard shows 8 strings (${label})`);
});

test('scale explorer and Pillitiere builder', async (b) => {
  const page = await newPage(b);
  await go(page, '/scales?root=G&scale=major');
  await page.waitForTimeout(150);
  expect((await page.getByTestId('scale-notes').textContent())?.trim() === 'G A B C D E F#', 'G major spelled correctly');
  await go(page, '/scales?root=Eb&scale=dorian');
  await page.waitForTimeout(150);
  expect((await page.getByTestId('scale-notes').textContent())?.trim() === 'Eb F Gb Ab Bb C Db', 'Eb Dorian spelled correctly');
  await go(page, '/scales?root=A&scale=aeolian&view=pillitiere');
  await page.waitForTimeout(200);
  const text = await page.locator('main').textContent();
  expect(/X|Y|Z/.test(text ?? '') && /Rule/i.test(text ?? ''), 'Pillitiere view shows shape letters and rules');
});

test('chord explorer finds voicings', async (b) => {
  const page = await newPage(b);
  await go(page, '/chords');
  await page.locator('select[aria-label="Chord root"]').selectOption('C');
  await page.getByRole('button', { name: /^Minor 7th\b/ }).click();
  await page.waitForTimeout(150);
  expect(/C/.test((await page.getByTestId('chord-symbol').textContent()) ?? ''), 'chord symbol shown');
  const notes = (await page.getByTestId('chord-notes').textContent())?.trim();
  expect(notes === 'C Eb G Bb', `Cm7 notes: ${notes}`);
  expect((await page.locator('main svg').count()) >= 3, 'voicing diagrams drawn');
});

test('metronome starts, ticks and taps tempo', async (b) => {
  const page = await newPage(b);
  await go(page, '/metronome');
  await page.getByTestId('metro-toggle').click();
  await page.waitForTimeout(1200);
  expect(/Stop/.test((await page.getByTestId('metro-toggle').textContent()) ?? ''), 'running');
  const lit = await page.locator('[aria-label="Beat indicator"] [data-active="true"]').count();
  await page.getByTestId('metro-toggle').click();
  for (let i = 0; i < 5; i++) { await page.getByTestId('metro-tap').click(); await page.waitForTimeout(500); }
  const bpm = Number(await page.getByTestId('metro-bpm').textContent());
  expect(bpm >= 110 && bpm <= 130, `tap tempo at 500 ms should give ~120 bpm, got ${bpm} (beat lights: ${lit})`);
});

test('fretboard trainer: correct answer, feedback and stored attempt', async (b) => {
  const page = await newPage(b);
  await go(page, '/fretboard-trainer');
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const OPEN = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  for (let round = 0; round < 3; round++) {
    const prompt = await page.getByTestId('trainer-prompt').textContent();
    const m = /fret (\d+) on string (\d)/.exec(prompt ?? '');
    expect(m, `unexpected prompt: ${prompt}`);
    const pc = (OPEN[Number(m[2])] + Number(m[1])) % 12;
    const options = await page.locator('[data-testid=trainer-options] button').allTextContents();
    const idx = options.findIndex((o) => o.replace(/^\d/, '').trim() === NAMES[pc]);
    expect(idx >= 0, `answer ${NAMES[pc]} not among ${options.join(',')}`);
    await page.locator('[data-testid=trainer-options] button').nth(idx).click();
    expect(/Correct/.test((await page.getByTestId('trainer-feedback').textContent()) ?? ''), 'marked correct');
    await page.waitForTimeout(800);
  }
  const attempts = await stored(page, 'trainer');
  expect(attempts?.length === 3 && attempts.every((a) => a.correct), 'three correct attempts stored');
  await page.reload();
  const after = await stored(page, 'trainer');
  expect(after?.length === 3, 'attempts persist across reloads');
});

test('ear training round', async (b) => {
  const page = await newPage(b);
  await go(page, '/ear-training');
  await page.getByTestId('ear-play').click();
  await page.locator('[data-testid=ear-options] button').first().click();
  expect(/Correct|Not quite/.test((await page.locator('main').textContent()) ?? ''), 'feedback shown');
  await page.getByTestId('ear-next').click();
  const ear = await stored(page, 'ear');
  expect(ear?.length === 1, 'attempt stored');
});

test('tab editor: enter notes, techniques, save, export, import, play', async (b) => {
  const page = await newPage(b);
  await go(page, '/tab-editor');
  await page.getByTestId('tab-title').fill('E2E riff');
  await page.locator('[data-cell="0-0-0"]').click();
  await page.keyboard.press('5');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(750);
  await page.keyboard.press('7');
  await page.keyboard.press('h');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(750);
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  const ascii = await page.locator('pre.tab-text').first().textContent();
  expect(/5/.test(ascii ?? '') && /h7/.test(ascii ?? '') && /12/.test(ascii ?? ''), `ASCII preview reflects entry:\n${ascii}`);
  await page.getByTestId('tab-add-measure').click();
  await page.screenshot({ path: path.join(shots, 'tab-editor.png') });
  await page.getByTestId('tab-play').click();
  await page.waitForTimeout(400);
  await page.getByTestId('tab-play').click();
  await page.getByTestId('tab-save').click();
  const ex = await stored(page, 'exercises');
  expect(ex?.length === 1 && ex[0].title === 'E2E riff' && ex[0].score.measures.length === 2, 'exercise saved with two measures');
  expect((await page.getByTestId('tab-library').textContent())?.includes('E2E riff'), 'listed in library');
  await page.getByTestId('tab-export').click();
  expect(/h7/.test((await page.getByTestId('tab-export-ascii').textContent()) ?? ''), 'export ASCII');
  await page.keyboard.press('Escape');
  // Undo/redo
  await page.locator('[data-cell="0-0-0"]').click();
  await page.keyboard.press('Delete');
  expect(!/-5-/.test((await page.locator('pre.tab-text').first().textContent()) ?? ''), 'delete removes the note');
  await page.keyboard.press('Control+z');
  expect(/-5-/.test((await page.locator('pre.tab-text').first().textContent()) ?? ''), 'undo restores deleted note');
  // Import ASCII
  await page.getByTestId('tab-import').click();
  await page.getByTestId('tab-import-text').fill('e|-----------------|\nB|-----------------|\nG|-----------------|\nD|-------5-7-------|\nA|---5-7-----7-5---|\nE|-5-------------8-|');
  await page.waitForTimeout(150);
  await page.getByTestId('tab-import-confirm').click();
  const imported = await page.locator('pre.tab-text').first().textContent();
  expect(/5-7/.test(imported?.replace(/-+/g, '-') ?? '') || /7/.test(imported ?? ''), 'imported tab shown');
  // Saved exercise is usable in Technique Lab and the Analyzer
  await go(page, `/technique-lab?exercise=${ex[0].id}`);
  await page.waitForTimeout(200);
  expect((await page.locator('main').textContent())?.includes('E2E riff'), 'available in Technique Lab');
  await go(page, `/analyzer?exercise=${ex[0].id}`);
  await page.waitForTimeout(200);
  expect((await page.locator('[data-testid=analyzer-exercise]').inputValue()) === ex[0].id, 'available in Analyzer');
  expect(page.errors.length === 0, page.errors.join('\n'));
});

test('lesson: quiz, completion, mastery assessment', async (b) => {
  const page = await newPage(b);
  await go(page, '/lessons/l0-tuning');
  await page.getByTestId('start-quiz').click();
  // Answer every question (whatever is picked) until the result appears.
  for (let i = 0; i < 12; i++) {
    if (await page.getByTestId('quiz-result').count()) break;
    await page.getByTestId('quiz-option').first().click();
    const finish = page.getByTestId('quiz-finish');
    if (await finish.count()) await finish.click(); else await page.getByRole('button', { name: 'Next' }).click();
  }
  expect(await page.getByTestId('quiz-result').isVisible(), 'quiz result');
  await page.getByTestId('mark-complete').click();
  const lessons = await stored(page, 'lessons');
  expect(lessons?.['l0-tuning']?.status === 'completed', 'lesson marked completed');
  const srs = await stored(page, 'srs');
  expect(srs && Object.keys(srs).length === 1, 'review card scheduled');
  await page.getByTestId('start-mastery').click();
  expect((await page.getByTestId('quiz-option').count()) > 0, 'mastery questions shown');
  const ach = await stored(page, 'achievements');
  expect(ach?.['first-lesson'] && ach?.['in-tune'], 'achievements unlocked');
});

test('practice studio builds and runs a routine', async (b) => {
  const page = await newPage(b);
  await go(page, '/practice');
  await page.getByTestId('build-routine').click();
  expect((await page.locator('[data-testid=routine-blocks] li').count()) >= 2, 'routine has blocks');
  await page.getByTestId('start-session').click();
  await page.getByTestId('block-done').click();
  await page.getByTestId('finish-session').click();
  const sessions = await stored(page, 'sessions');
  expect(sessions?.length === 1 && sessions[0].blocks.some((x) => x.completed), 'session stored with a completed block');
});

test('theory academy: circle of fifths and diatonic chords', async (b) => {
  const page = await newPage(b);
  await go(page, '/theory');
  await page.locator('[data-testid=circle-of-fifths] [aria-label^="D major"] circle').first().click();
  const chords = await page.getByTestId('diatonic-chords').textContent();
  expect(/D/.test(chords ?? '') && /Em/.test(chords ?? '') && /F#m/.test(chords ?? '') && /C#dim|C#°/.test(chords ?? ''), `D major diatonic chords: ${chords}`);
  await page.getByRole('radio', { name: 'Glossary' }).click().catch(async () => page.getByText('Glossary', { exact: true }).click());
  await page.getByTestId('glossary-search').fill('vibrato');
  expect((await page.getByTestId('glossary-list').textContent())?.toLowerCase().includes('vibrato'), 'glossary search');
});

test('jam room: plays, follows the chords, saves the jam', async (b) => {
  const page = await newPage(b);
  await go(page, '/jam');
  await page.getByTestId('jam-style').selectOption('pop');
  await page.getByTestId('jam-play').click();
  await page.waitForTimeout(500);
  const first = await page.locator('[data-testid=jam-theory]').textContent();
  await page.waitForTimeout(2600); // one bar at 100 bpm = 2.4 s
  const second = await page.locator('[data-testid=jam-theory]').textContent();
  await page.screenshot({ path: path.join(shots, 'jam-playing.png') });
  expect(first !== second, 'theory panel follows the chord change');
  // Custom progression is validated
  await page.getByTestId('jam-progression').selectOption('custom');
  await page.getByTestId('jam-custom').fill('I | Q');
  expect(/not a Roman numeral/.test((await page.locator('main').textContent()) ?? ''), 'invalid numeral reported');
  await page.getByTestId('jam-custom').fill('ii7 V7 Imaj7 Imaj7');
  await page.waitForTimeout(29000);
  await page.getByTestId('jam-stop').click();
  const jams = await stored(page, 'jams');
  expect(jams?.length === 1 && jams[0].progressionId === 'custom', 'jam saved');
  expect(page.errors.length === 0, page.errors.join('\n'));
}, { slow: true });

test('improvisation lab: note-over-chord explanation', async (b) => {
  const page = await newPage(b);
  await go(page, '/improvisation');
  await page.locator('[data-testid=improv-fretboard] [data-pos="5-5"]').click();
  expect((await page.getByTestId('improv-explain').textContent())?.length > 20, 'explanation shown');
});

test('analyzer: honest result on a take without clear attacks', async () => {
  const b = await launch(A2);
  try {
    const page = await newPage(b);
    await go(page, '/analyzer');
    await page.getByTestId('analyzer-record').click();
    await page.getByTestId('analyzer-result').waitFor({ timeout: 60000 });
    const txt = await page.getByTestId('analyzer-result').textContent();
    await page.getByTestId('analyzer-result').screenshot({ path: path.join(shots, 'analyzer-result.png') });
    expect(/Confidence: (low|medium|high)/.test(txt ?? ''), 'confidence label');
    expect(/Notes matched/.test(txt ?? ''), 'measured metrics shown');
    await page.getByTestId('analyzer-save').click();
    const recs = await stored(page, 'exerciseRecords');
    expect(recs?.length === 1 && recs[0].source === 'analyzer' && recs[0].analyzer, 'analyzer record stored with measurements');
    await page.getByTestId('analyzer-calibrate').click();
    await page.getByTestId('analyzer-calib-message').waitFor({ timeout: 15000 });
    await page.waitForFunction(() => /Measured|heard/.test(document.querySelector('[data-testid=analyzer-calib-message]')?.textContent ?? ''), null, { timeout: 15000 });
    await page.getByTestId('analyzer-manual-save').click();
    expect((await stored(page, 'exerciseRecords'))?.length === 2, 'manual self-assessment stored');
  } finally { await b.close(); }
}, { ownBrowser: true, slow: true });

test('progress page reflects activity; review session runs', async (b) => {
  const page = await newPage(b);
  // Seed a due review card through the real lesson flow, then make it due.
  await go(page, '/lessons/l0-tuning');
  await page.getByTestId('mark-complete').click();
  await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gma.') && k.endsWith('.srs')) { const v = JSON.parse(localStorage.getItem(k)); for (const c of Object.values(v)) c.due = new Date(Date.now() - 1000).toISOString(); localStorage.setItem(k, JSON.stringify(v)); }
    }
  });
  await page.reload();
  await go(page, '/progress');
  await page.getByTestId('start-review').click();
  for (let i = 0; i < 8; i++) {
    if (await page.getByTestId('review-results').count()) break;
    await page.getByTestId('quiz-option').first().click();
    const finish = page.getByTestId('quiz-finish');
    if (await finish.count()) await finish.click(); else await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.getByTestId('review-results').waitFor();
  const srs = await stored(page, 'srs');
  const card = Object.values(srs)[0];
  expect(card.reps + card.lapses === 1 && new Date(card.due).getTime() > Date.now(), 'review rescheduled the card');
  await go(page, '/progress');
  expect((await page.getByTestId('achievements').textContent())?.includes('First steps'), 'achievements listed');
});

test('settings: backup export/import round trip', async (b) => {
  const page = await newPage(b);
  await go(page, '/settings');
  await page.getByTestId('settings-name').fill('Ada');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('settings-export').click()]);
  const file = path.join(tmp, 'backup.json');
  await dl.saveAs(file);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(JSON.stringify(json).includes('Ada'), 'backup contains profile');
  await page.getByTestId('settings-name').fill('Changed');
  await page.getByTestId('settings-import').setInputFiles(file);
  await page.waitForTimeout(300);
  expect((await page.getByTestId('settings-name').inputValue()) === 'Ada', 'import restored profile');
});

test('mobile layout: navigation, tuner access, no horizontal overflow', async (b) => {
  const page = await newPage(b, { mobile: true });
  for (const r of ['/', '/tuner', '/fretboard', '/scales', '/tab-editor', '/jam', '/fretboard-trainer', '/practice', '/progress', '/lessons/l3-major-scale', '/play', '/chord-finder']) {
    await go(page, r);
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow <= 1, `horizontal overflow of ${overflow}px on ${r}`);
  }
  await go(page, '/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Jam Room' }).last().click();
  expect((await page.locator('h1').textContent())?.includes('Jam Room'), 'menu navigation');
  await page.getByTestId('header-tuner').click();
  expect((await page.locator('h1').textContent())?.includes('Tuner'), 'tuner reachable from header on mobile');
  await page.screenshot({ path: path.join(shots, 'mobile-tuner.png') });
  expect(page.errors.length === 0, page.errors.join('\n'));
});


test('chord finder: fretboard shape, typed notes and listening', async () => {
  const b = await launch(C_CHORD);
  try {
    const page = await newPage(b);
    await go(page, '/chord-finder');
    for (const pos of ['1-3', '2-2', '3-0', '4-1', '5-0']) await page.locator(`[data-testid=finder-fretboard] [data-pos="${pos}"]`).click();
    expect((await page.getByTestId('finder-best').textContent()) === 'C', `x32010 should be C, got ${await page.getByTestId('finder-best').textContent()}`);
    await page.locator('[data-testid=finder-fretboard] [data-pos="0-0"]').click();
    expect((await page.getByTestId('finder-best').textContent()) === 'C/E', 'adding low E gives C/E');
    await page.getByRole('radio', { name: 'Type notes' }).click();
    await page.getByTestId('finder-notes').fill('C E G A');
    expect((await page.getByTestId('finder-best').textContent()) === 'C6', 'C E G A → C6');
    expect((await page.getByTestId('finder-result').textContent())?.includes('Am7/C'), 'alternative Am7/C listed');
    await page.getByRole('radio', { name: 'Listen' }).click();
    await page.getByTestId('finder-listen').click();
    await page.waitForFunction(() => document.querySelector('[data-testid=finder-best]')?.textContent === 'C', null, { timeout: 8000 });
    expect(page.errors.length === 0, page.errors.join('\n'));
  } finally { await b.close(); }
}, { ownBrowser: true });

test('chord finder: voicings with filters and slash bass, arpeggio positions', async (b) => {
  const page = await newPage(b);
  await go(page, '/chord-finder?tool=voicings');
  await page.getByTestId('finder-root').selectOption({ label: 'F' });
  await page.getByTestId('finder-type').selectOption('maj');
  await page.getByTestId('finder-filter').getByRole('radio', { name: 'Barre' }).click();
  const first = page.getByTestId('finder-voicings').locator('button').first();
  expect((await first.getAttribute('aria-label')) === 'F voicing 1 3 3 2 1 1', `F barre first: ${await first.getAttribute('aria-label')}`);
  await first.click();
  expect(await page.getByTestId('finder-voicing-board').locator('circle').count() > 0, 'selected voicing shown on the neck');
  // Slash chord: C/E keeps E lowest.
  await page.getByTestId('finder-root').selectOption({ label: 'C' });
  await page.getByTestId('finder-filter').getByRole('radio', { name: 'All' }).click();
  await page.getByTestId('finder-bass').selectOption({ label: '/E' });
  expect((await page.getByTestId('finder-voicing-name').textContent()) === 'C/E');
  const labels = await page.getByTestId('finder-voicings').locator('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(labels.length > 0 && labels.includes('C/E voicing 0 3 2 0 1 0'), `C/E voicings: ${labels.slice(0, 4).join(' | ')}`);
  // Arpeggios share the chord; positions follow CAGED.
  await page.getByTestId('finder-tool').getByRole('radio', { name: 'Arpeggios' }).click();
  await page.getByTestId('finder-type').selectOption('maj7');
  await page.getByTestId('arp-position').getByRole('radio', { name: 'E shape' }).click();
  const sweep = await page.getByTestId('arp-sweep').textContent();
  expect(/^Sweep: E\d+/.test(sweep ?? ''), `sweep path starts on the low E string: ${sweep}`);
  await page.getByTestId('arp-play').click();
  // Identify still works and links back to voicings.
  await page.getByTestId('finder-tool').getByRole('radio', { name: 'Identify' }).click();
  await page.getByRole('radio', { name: 'Type notes' }).click();
  await page.getByTestId('finder-notes').fill('A C E G');
  await page.getByRole('link', { name: /More voicings of Am7/ }).click();
  await page.getByTestId('finder-voicings').waitFor();
  expect((await page.getByTestId('finder-voicing-name').textContent()) === 'Am7', 'link opens Am7 voicings');
  expect(page.errors.length === 0, page.errors.join('\n'));
});

const DEMO_XML = path.join(root, 'tests/fixtures/demo-arrangement.xml');
const demoXml = fs.readFileSync(DEMO_XML, 'utf8');
const arrangementXml = (arr) => demoXml.replace('<arrangement>Lead</arrangement>', `<arrangement>${arr}</arrangement>`);

/** A recording that matches the demo chart: plucks at every note/chord time (shifted by `shift` seconds of silence). */
function demoRecording(shift = 0, sr = 22050, seconds = 16) {
  const times = [...demoXml.matchAll(/<(?:note|chord) time="([\d.]+)"/g)].map((m) => Number(m[1]));
  const out = new Float32Array(Math.round(seconds * sr));
  let s = 3;
  const rnd = () => ((s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (const t of times) {
    const at = Math.round((t + shift) * sr);
    for (let k = 0; k < sr * 0.2 && at + k < out.length; k++) out[at + k] += (0.5 * Math.sin(2 * Math.PI * 220 * k / sr) + 0.2 * rnd()) * Math.exp(-k / (sr * 0.04));
  }
  return wav(Array.from(out), sr);
}

const MANIFEST = JSON.stringify({ Entries: { X: { Attributes: { SongName: 'Demo Riff', ArtistName: 'GMA Band', AlbumName: 'Fixtures', SongYear: 2026, ArrangementName: 'Lead', SongKey: 'demoriff', SongLength: 16 } } } });

async function demoPsarc(opts = {}) {
  const { buildPsarc, riffWave } = await import('../tests/helpers/psarc-builder.ts');
  return Buffer.from(buildPsarc([
    { path: 'songs/arr/demoriff_lead.xml', data: arrangementXml('Lead') },
    { path: 'songs/arr/demoriff_bass.xml', data: arrangementXml('Bass') },
    { path: 'songs/arr/demoriff_showlights.xml', data: '<?xml version="1.0"?><showlights count="0"/>' },
    { path: 'manifests/songs_dlc_demoriff/demoriff_lead.json', data: MANIFEST },
    { path: 'audio/windows/demoriff.wav', data: demoRecording(0) },
    { path: 'audio/windows/987654.wem', data: riffWave(0xffff) },
    { path: 'songs/bin/generic/demoriff_lead.sng', data: Buffer.from([0x4a, 0, 0, 0, 3, 0, 0, 0]) },
    { path: 'gfxassets/album_art/album_demoriff_64.dds', data: Buffer.from('DDS 0000') },
  ], opts));
}

const libraryRecords = (page) => page.evaluate(() => new Promise((res) => {
  const q = indexedDB.open('gma-local');
  q.onsuccess = () => { const t = q.result.transaction('library').objectStore('library').getAll(); t.onsuccess = () => res(t.result); };
}));
const audioCount = (page) => page.evaluate(() => new Promise((res) => {
  const q = indexedDB.open('gma-local');
  q.onsuccess = () => { const t = q.result.transaction('audio').objectStore('audio').count(); t.onsuccess = () => res(t.result); };
}));
const canvasInk = (page, id) => page.evaluate((tid) => { const c = document.querySelector(`[data-testid=${tid}]`); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 400) if (d[i] + d[i + 1] + d[i + 2] > 300) n++; return n; }, id);

async function importFiles(page, files, testid = 'import-files') {
  await go(page, '/import');
  await page.getByTestId(testid).setInputFiles(files);
}

test('importer: PSARC package → grouped song, synced preview, saved and reopened', async (b) => {
  const page = await newPage(b);
  await importFiles(page, { name: 'GMA_Band_-_Demo_Riff_p.psarc', mimeType: 'application/octet-stream', buffer: await demoPsarc() });
  const preview = page.getByTestId('import-preview');
  await preview.waitFor({ timeout: 20000 });
  expect(await page.getByTestId('import-title').inputValue() === 'Demo Riff', 'title from the package manifest');
  expect(await page.getByTestId('import-artist').inputValue() === 'GMA Band', 'artist from the manifest');
  const arrs = await page.getByTestId('import-arrangements').textContent();
  expect(arrs.includes('Lead') && arrs.includes('Bass') && !arrs.includes('Showlights'), `lead and bass grouped (${arrs})`);
  expect((await page.getByTestId('import-audio').locator('option:checked').textContent()) === 'demoriff.wav', 'package audio selected');
  await page.waitForFunction(() => /lines up|fits the recording/.test(document.querySelector('[data-testid=import-sync]')?.textContent ?? ''), null, { timeout: 15000 });
  expect((await page.getByTestId('import-sync').textContent()).includes('matches the chart'), 'recording length checked against the chart');
  // Synchronised playback and seeking.
  await page.getByTestId('import-play').click();
  await page.waitForTimeout(1200);
  const t1 = await page.getByTestId('import-time').textContent();
  expect(!t1.startsWith('0:00'), `preview clock advances with the audio (${t1})`);
  await page.getByTestId('import-seek').fill('10');
  await page.waitForTimeout(400);
  const playing = await page.evaluate(() => [...document.querySelectorAll('audio')].length === 0); // detached Audio element, so just check time
  void playing;
  const t2 = await page.getByTestId('import-time').textContent();
  expect(t2.startsWith('0:10') || t2.startsWith('0:11'), `seek moves chart and audio (${t2})`);
  expect(await canvasInk(page, 'import-canvas') > 20, 'notes drawn on the preview highway');
  await page.getByTestId('import-play').click();
  await page.getByTestId('import-arr-bass').click();
  // File report: every entry has a status; component report shown.
  const report = page.getByTestId('import-file-report').first();
  expect(await report.getAttribute('data-status') === 'partial', 'archive partly imported');
  await report.locator('summary').click();
  const rows = await report.getByTestId('import-entries').locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [tr.cells[0].textContent, tr.dataset.status]));
  const st = Object.fromEntries(rows.map(([p, s]) => [p.split('/').pop(), s]));
  expect(Object.keys(st).length === 8, `all 8 entries listed (${JSON.stringify(st)})`);
  expect(st['987654.wem'] === 'unsupported' && st['demoriff_lead.sng'] === 'unsupported' && st['demoriff_lead.json'] === 'metadata' && st['demoriff.wav'] === 'imported', JSON.stringify(st));
  expect(await report.locator('[data-component=toc][data-state=ok]').count() === 1, 'TOC component ok');
  // Save and open in Play mode.
  await page.getByTestId('import-save').click();
  await page.getByTestId('import-open-play').click();
  await page.getByTestId('play-setup').waitFor();
  const setup = await page.getByTestId('play-setup').textContent();
  expect(setup.includes('Demo Riff') && setup.includes('demoriff.wav'), `song with audio selected in Play mode (${setup.slice(0, 160)})`);
  await page.getByTestId('play-arrangement').getByRole('radio', { name: 'Bass' }).click();
  expect((await page.getByTestId('play-setup').textContent()).includes('Bass E Standard'), 'bass arrangement switched');
  // Reopen later without importing again.
  await page.reload();
  await page.getByTestId('play-imported').waitFor();
  expect((await page.getByTestId('play-imported').textContent()).includes('2 arrangements'), 'song persists with both arrangements');
  const recs = await libraryRecords(page);
  expect(recs.length === 1 && recs[0].arrangements.length === 2 && recs[0].audio?.name === 'demoriff.wav' && recs[0].sync.method === 'chart', `library record (${JSON.stringify(recs.map((r) => ({ a: r.arrangements.length, audio: r.audio?.name, sync: r.sync })))})`);
  expect(await audioCount(page) === 1, 'recording stored once');
  expect(page.errors.length === 0, page.errors.join('\n'));
});

test('importer: loose XML + WAV files, duplicate detection, Play mode run', async (b) => {
  const page = await newPage(b);
  const loose = [
    { name: 'demo_lead.xml', mimeType: 'text/xml', buffer: Buffer.from(arrangementXml('Lead')) },
    { name: 'demo_rhythm.xml', mimeType: 'text/xml', buffer: Buffer.from(arrangementXml('Rhythm')) },
    { name: 'Demo Riff in A Minor.wav', mimeType: 'audio/wav', buffer: demoRecording(0.4) },
    { name: 'demo_preview.wav', mimeType: 'audio/wav', buffer: toneWav(1) },
  ];
  await importFiles(page, loose);
  await page.getByTestId('import-preview').waitFor({ timeout: 20000 });
  expect((await page.getByTestId('import-songs').locator('li').count()) === 1, 'one song from two loose arrangements');
  expect((await page.getByTestId('import-audio').locator('option:checked').textContent()) === 'Demo Riff in A Minor.wav', 'full recording matched by name, preview not chosen');
  await page.waitForFunction(() => /shifted by [−-]0\.(39|40|41) s/.test(document.querySelector('[data-testid=import-sync]')?.textContent ?? ''), null, { timeout: 15000 });
  const offset = Number(await page.getByTestId('import-offset').inputValue());
  expect(Math.abs(offset + 0.4) < 0.015, `offset detected: recording starts 0.4 s late → −0.40 s (${offset})`);
  await page.getByTestId('import-save').click();
  await page.getByTestId('import-open-play').waitFor();
  // Same files again: recognised as a duplicate, can replace.
  await importFiles(page, loose);
  await page.getByTestId('import-duplicate').waitFor({ timeout: 20000 });
  await page.getByTestId('import-replace').click();
  await page.getByTestId('import-open-play').click();
  expect((await libraryRecords(page)).length === 1, 'replacing keeps a single library record');
  expect(await audioCount(page) === 1, 'old recording released on replace');
  // Play it (no mic), pause/resume, exit.
  const sw = page.getByRole('switch', { name: 'Score with the microphone' });
  if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click();
  await page.getByTestId('play-start').click();
  await page.getByTestId('play-canvas').waitFor();
  await page.waitForTimeout(3500);
  expect(await canvasInk(page, 'play-canvas') > 20, 'highway is drawn');
  await page.getByTestId('play-pause').click();
  expect((await page.getByTestId('play-stage').textContent()).includes('Paused'), 'paused');
  await page.getByTestId('play-pause').click();
  await page.getByTestId('play-exit').click();
  expect(page.errors.length === 0, page.errors.join('\n'));
});

test('wwise .wem audio: IMA ADPCM converts on import, PCM attaches in Play mode, Vorbis is explained', async (b) => {
  const { encodeWwiseIma, wem } = await import('../tests/helpers/wem-builder.ts');
  const { riffWave } = await import('../tests/helpers/psarc-builder.ts');
  const rec = demoRecording(0);
  const pcm = new Int16Array(rec.buffer.slice(rec.byteOffset + 44, rec.byteOffset + rec.length));
  const imaWem = Buffer.from(wem(2, 1, 36, 4, encodeWwiseIma([pcm], 36), { sampleRate: 22050 }));
  const page = await newPage(b);
  await importFiles(page, [
    { name: 'demo_lead.xml', mimeType: 'text/xml', buffer: Buffer.from(arrangementXml('Lead')) },
    { name: '555123.wem', mimeType: 'application/octet-stream', buffer: imaWem },
  ]);
  await page.getByTestId('import-preview').waitFor({ timeout: 20000 });
  expect((await page.getByTestId('import-audio').locator('option:checked').textContent()) === '555123.wav', 'converted .wem chosen as the song audio');
  await page.waitForFunction(() => /\d/.test(document.querySelector('[data-testid=import-sync]')?.textContent ?? ''), null, { timeout: 15000 });
  const offset = Number(await page.getByTestId('import-offset').inputValue());
  expect(Math.abs(offset) < 0.02, `decoded ADPCM lines up with the chart (offset ${offset})`);
  expect((await page.getByTestId('import-files-report').textContent()).includes('Wwise IMA ADPCM converted to WAV'), 'report names the conversion');
  await page.getByTestId('import-save').click();
  await page.getByTestId('import-open-play').click();
  // Play mode: a Vorbis .wem is refused with an explanation; a PCM .wem attaches as WAV.
  await page.getByTestId('play-audio').setInputFiles({ name: 'vorbis.wem', mimeType: 'application/octet-stream', buffer: Buffer.from(riffWave(0xffff)) });
  await page.getByText('This .wem file cannot be used').waitFor({ timeout: 5000 });
  const pcmWem = Buffer.from(wem(1, 1, 2, 16, new Uint8Array(pcm.buffer.slice(0)), { sampleRate: 22050 }));
  await page.getByTestId('play-audio').setInputFiles({ name: 'take.wem', mimeType: 'application/octet-stream', buffer: pcmWem });
  await page.getByText('take.wav', { exact: true }).waitFor({ timeout: 5000 });
  const recs = await libraryRecords(page);
  expect(recs[0].audio?.name === 'take.wav' && recs[0].audio?.type === 'audio/wav', 'stored as WAV');
  const sw = page.getByRole('switch', { name: 'Score with the microphone' });
  if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click();
  await page.getByTestId('play-start').click();
  await page.getByTestId('play-canvas').waitFor();
  await page.waitForTimeout(2500);
  expect(await canvasInk(page, 'play-canvas') > 20, 'plays with the converted recording');
  await page.getByTestId('play-exit').click();
  expect(page.errors.length === 0, page.errors.join('\n'));
});

test('importer: encrypted and damaged archives report which component is blocking', async (b) => {
  const page = await newPage(b);
  const files = [
    { name: 'Some_Band_-_Some_Song_p.psarc', mimeType: 'application/octet-stream', buffer: await demoPsarc({ encryptedToc: true }) },
    { name: 'broken.psarc', mimeType: 'application/octet-stream', buffer: (await demoPsarc()).subarray(0, 20) },
    { name: 'song.ogg', mimeType: 'audio/ogg', buffer: Buffer.concat([Buffer.from('OggS'), Buffer.alloc(100)]) },
    { name: 'old.gp5', mimeType: 'application/octet-stream', buffer: Buffer.from('FICHIER GUITAR PRO v5.00') },
  ];
  const real = fs.readdirSync('/mnt/user-data/uploads').find?.((f) => f.endsWith('.psarc'));
  if (real) files.push({ name: real.replace(/^[0-9a-f]+-/, ''), mimeType: 'application/octet-stream', buffer: fs.readFileSync(path.join('/mnt/user-data/uploads', real)) });
  await importFiles(page, files);
  await page.getByTestId('import-files-report').waitFor({ timeout: 20000 });
  expect((await page.getByText('No playable songs in this selection').count()) === 1, 'explains that no chart was found');
  const enc = page.getByTestId('import-file-report').nth(0);
  expect(await enc.getAttribute('data-status') === 'unsupported', 'encrypted archive: not supported');
  expect((await enc.textContent()).includes('Blocked by: table of contents'), 'names the blocking component');
  await enc.locator('summary').click();
  const comps = await enc.getByTestId('import-components').locator('li').evaluateAll((ls) => ls.map((l) => `${l.dataset.component}:${l.dataset.state}`));
  expect(JSON.stringify(comps) === JSON.stringify(['header:ok', 'compression:ok', 'toc:unsupported', 'blocks:unavailable', 'manifest:unavailable', 'data:unavailable']), comps.join(' '));
  expect((await enc.textContent()).includes('Some Band — Some Song'), 'title guessed from the file name');
  const broken = page.getByTestId('import-file-report').nth(1);
  expect(await broken.getAttribute('data-status') === 'error' && (await broken.textContent()).includes('header'), 'damaged header attributed to the header');
  expect((await page.getByTestId('import-file-report').nth(3).textContent()).includes('Guitar Pro 7/8'), 'legacy Guitar Pro explained');
  expect((await page.getByText('About encrypted Rocksmith 2014 archives').count()) === 1, 'guidance shown');
  if (real) {
    const r = page.getByTestId('import-file-report').nth(4);
    console.log(`      (uploaded ${real.replace(/^[0-9a-f]+-/, '')}: ${await r.getAttribute('data-status')} — ${(await r.locator('p').first().textContent()).slice(0, 120)})`);
  }
  expect(page.errors.length === 0, page.errors.join('\n'));
});

function toneWav(seconds, sr = 8000) {
  const n = Math.round(seconds * sr), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 110 / sr) * 3000), 44 + i * 2);
  return b;
}

test('importer: folder selection, cancellation and Guitar Pro', async (b) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gma-folder-'));
  const song = path.join(dir, 'DemoSong');
  fs.mkdirSync(path.join(song, 'songs/arr'), { recursive: true });
  fs.mkdirSync(path.join(song, 'audio/windows'), { recursive: true });
  fs.writeFileSync(path.join(song, 'songs/arr/demo_lead.xml'), arrangementXml('Lead'));
  fs.writeFileSync(path.join(song, 'songs/arr/demo_bass.xml'), arrangementXml('Bass'));
  fs.writeFileSync(path.join(song, 'songs/arr/demo_vocals.xml'), '<?xml version="1.0"?><vocals count="0"/>');
  fs.writeFileSync(path.join(song, 'audio/windows/demo.wav'), toneWav(2));
  fs.writeFileSync(path.join(song, 'audio/windows/demo_preview.wav'), toneWav(0.5));
  const page = await newPage(b);
  await importFiles(page, song, 'import-folder');
  await page.getByTestId('import-preview').waitFor({ timeout: 20000 });
  expect((await page.getByTestId('import-songs').locator('li').count()) === 1, 'folder → one song');
  expect((await page.getByTestId('import-audio').locator('option:checked').textContent()) === 'demo.wav', 'full recording chosen over the preview');
  expect((await page.getByTestId('import-files-report').textContent()).includes('Lyrics'), 'vocals file listed with its reason');
  fs.rmSync(dir, { recursive: true, force: true });

  // Cancellation: a large LZMA archive keeps the worker busy long enough to cancel.
  const { buildPsarc } = await import('../tests/helpers/psarc-builder.ts');
  const big = Buffer.alloc(3 * 1024 * 1024);
  for (let i = 0; i < big.length; i++) big[i] = (i * 31 + (i >> 9)) & 0x7f;
  big.write('OggS', 0);
  const slow = Buffer.from(buildPsarc([1, 2, 3, 4].map((n) => ({ path: `audio/big${n}.ogg`, data: big })), { compression: 'lzma' }));
  await go(page, '/import');
  // The archive imports in a fraction of a second, so press Cancel the moment it appears.
  await page.evaluate(() => {
    const mo = new MutationObserver(() => { const btn = document.querySelector('[data-testid=import-cancel]'); if (btn) { mo.disconnect(); btn.click(); } });
    mo.observe(document.body, { childList: true, subtree: true });
  });
  await page.getByTestId('import-files').setInputFiles({ name: 'big.psarc', mimeType: 'application/octet-stream', buffer: slow });
  await page.getByText('Import cancelled').waitFor();
  await page.waitForTimeout(800);
  expect((await page.getByTestId('import-progress').count()) === 0 && (await page.getByTestId('import-preview').count()) === 0, 'nothing left after cancel');

  // Guitar Pro 7/8: every track becomes an arrangement of one song.
  const { deflateRawSync } = await import('node:zlib');
  const gpif = `<GPIF><Score><Title><![CDATA[GP Import Test]]></Title><Artist><![CDATA[Fixture]]></Artist></Score><MasterTrack><Automations><Automation><Type>Tempo</Type><Bar>0</Bar><Position>0</Position><Value>100 2</Value></Automation></Automations></MasterTrack><Tracks><Track id="0"><Name>Lead</Name><Staves><Staff><Properties><Property name="Tuning"><Pitches>40 45 50 55 59 64</Pitches></Property></Properties></Staff></Staves></Track><Track id="1"><Name>Bass</Name><Staves><Staff><Properties><Property name="Tuning"><Pitches>28 33 38 43</Pitches></Property></Properties></Staff></Staves></Track></Tracks><MasterBars><MasterBar><Time>4/4</Time><Bars>0 1</Bars></MasterBar></MasterBars><Bars><Bar id="0"><Voices>0 -1 -1 -1</Voices></Bar><Bar id="1"><Voices>1 -1 -1 -1</Voices></Bar></Bars><Voices><Voice id="0"><Beats>0 0 0 0</Beats></Voice><Voice id="1"><Beats>1</Beats></Voice></Voices><Beats><Beat id="0"><Rhythm ref="0"/><Notes>0</Notes></Beat><Beat id="1"><Rhythm ref="1"/><Notes>1</Notes></Beat></Beats><Notes><Note id="0"><Properties><Property name="String"><String>1</String></Property><Property name="Fret"><Fret>2</Fret></Property></Properties></Note><Note id="1"><Properties><Property name="String"><String>0</String></Property><Property name="Fret"><Fret>5</Fret></Property></Properties></Note></Notes><Rhythms><Rhythm id="0"><NoteValue>Quarter</NoteValue></Rhythm><Rhythm id="1"><NoteValue>Whole</NoteValue></Rhythm></Rhythms></GPIF>`;
  const name = Buffer.from('Content/score.gpif');
  const data = deflateRawSync(Buffer.from(gpif));
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(gpif.length, 22); lh.writeUInt16LE(name.length, 26);
  const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(gpif.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(0, 42);
  const localLen = 30 + name.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(localLen, 16);
  const zip = Buffer.concat([lh, name, data, ch, name, end]);
  await go(page, '/import');
  await page.getByTestId('import-files').setInputFiles({ name: 'fixture.gp', mimeType: 'application/octet-stream', buffer: zip });
  await page.getByTestId('import-preview').waitFor({ timeout: 20000 });
  const arrs = await page.getByTestId('import-arrangements').textContent();
  expect(arrs.includes('Lead') && arrs.includes('Bass'), `GP tracks as arrangements (${arrs})`);
  expect(await page.getByTestId('import-title').inputValue() === 'GP Import Test', 'GP title');
  expect(page.errors.length === 0, page.errors.join('\n'));
});

test('play mode: live microphone scoring and best score', async () => {
  const b = await launch(A2);
  try {
    const page = await newPage(b);
    await importFiles(page, DEMO_XML);
    await page.getByTestId('import-save').click();
    await page.getByTestId('import-open-play').click();
    await page.getByTestId('play-setup').waitFor();
    const sw = page.getByRole('switch', { name: 'Score with the microphone' });
    if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
    await page.getByTestId('play-start').click();
    await page.getByTestId('play-summary').waitFor({ timeout: 40000 });
    const txt = await page.getByTestId('play-summary').textContent();
    const acc = Number(/Accuracy(\d+)%/.exec(txt ?? '')?.[1]);
    console.log(`      (accuracy from a steady A2 on the demo riff: ${acc}%)`);
    // The fake microphone plays a steady A2, which matches only the riff's open-A notes.
    expect(acc > 0 && acc < 60, `partial accuracy expected from a constant A2, got ${acc}% (${txt})`);
    await page.getByRole('button', { name: 'Back to songs' }).click();
    await page.waitForTimeout(300);
    const recs = await libraryRecords(page);
    expect(recs.length === 1 && recs[0].arrangements[0].best?.accuracy > 0, 'best score stored on the arrangement');
    // Exercise run records a Technique Lab entry.
    await go(page, '/play?exercise=ex-chromatic-1234');
    await page.waitForTimeout(300);
    expect((await page.getByTestId('play-setup').textContent())?.length > 0, 'exercise setup shown');
    expect(page.errors.length === 0, page.errors.join('\n'));
  } finally { await b.close(); }
}, { ownBrowser: true, slow: true });

test('library: version-1 songs are migrated into the song library', async (b) => {
  const page = await newPage(b);
  const xml = demoXml;
  // Write a v1 database (one record per arrangement), then load the app.
  await page.evaluate(async (x) => {
    await new Promise((r) => { const d = indexedDB.deleteDatabase('gma-local'); d.onsuccess = d.onerror = d.onblocked = () => r(); });
    await new Promise((res) => {
      const q = indexedDB.open('gma-local', 1);
      q.onupgradeneeded = () => { q.result.createObjectStore('songs', { keyPath: 'id' }); q.result.createObjectStore('audio'); };
      q.onsuccess = () => {
        const song = (arr) => ({ format: 'gma-song', version: 1, id: 's-' + arr, title: 'Old Song', artist: 'Someone', arrangement: arr, tuning: { name: 'E Standard', strings: [40, 45, 50, 55, 59, 64] }, capo: 0, duration: 10, averageTempo: 120, beats: [], sections: [], events: [{ kind: 'note', time: 1, string: 0, fret: 3, sustain: 0, techniques: [] }], source: 'rocksmith-xml' });
        const t = q.result.transaction(['songs', 'audio'], 'readwrite');
        t.objectStore('songs').put({ id: 'a', song: song('Lead'), offset: 0.25, addedAt: '2026-01-01T00:00:00Z', fileName: 'Old', group: 'g1', order: 0, audioRef: 'g1', audioName: 'old.wav', best: { accuracy: 0.8, score: 100, at: 'x' } });
        t.objectStore('songs').put({ id: 'b', song: song('Bass'), offset: 0.25, addedAt: '2026-01-01T00:00:00Z', fileName: 'Old', group: 'g1', order: 1, audioRef: 'g1', audioName: 'old.wav' });
        t.objectStore('audio').put(new Blob(['RIFF']), 'g1');
        t.oncomplete = () => { q.result.close(); res(); };
      };
    });
  }, xml);
  await page.reload();
  await go(page, '/play');
  await page.getByTestId('play-imported').waitFor();
  expect((await page.getByTestId('play-imported').textContent()).includes('Old Song') && (await page.getByTestId('play-imported').textContent()).includes('2 arrangements'), 'migrated song listed once with both arrangements');
  const recs = await libraryRecords(page);
  expect(recs.length === 1 && recs[0].sync.offset === 0.25 && recs[0].audio.key === 'g1' && recs[0].arrangements[0].best.accuracy === 0.8, JSON.stringify(recs[0]?.sync));
  expect(page.errors.length === 0, page.errors.join('\n'));
});

test('jam session mode follows the microphone', async () => {
  const b = await launch(A2);
  try {
    const page = await newPage(b);
    await go(page, '/jam');
    await page.getByTestId('jam-session').getByRole('switch').click();
    await page.getByTestId('jam-play').click();
    await page.waitForFunction(() => /A/.test(document.querySelector('[data-testid=jam-trail]')?.textContent ?? ''), null, { timeout: 10000 });
    const card = await page.getByTestId('jam-session').textContent();
    expect(/Listening|waiting/.test(card ?? '') && /notes\/s/.test(card ?? ''), 'session status shown');
    await page.getByTestId('jam-stop').click();
    expect(page.errors.length === 0, page.errors.join('\n'));
  } finally { await b.close(); }
}, { ownBrowser: true });

// ── run ──────────────────────────────────────────────────────────────────
const selected = tests.filter((t) => !filters.length || filters.some((f) => t.name.includes(f)));
const shared = await launch();
const t0 = Date.now();
for (const t of selected) {
  const start = Date.now();
  try {
    await t.fn(shared);
    results.push({ name: t.name, ok: true, ms: Date.now() - start });
    console.log(`  ✓ ${t.name} (${Date.now() - start} ms)`);
  } catch (e) {
    results.push({ name: t.name, ok: false, ms: Date.now() - start, error: e.message });
    console.log(`  ✗ ${t.name}\n      ${e.message.split('\n').join('\n      ')}`);
  }
}
await shared.close();
server?.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed (${((Date.now() - t0) / 1000).toFixed(1)} s) against ${BASE}`);
fs.writeFileSync(path.join(shots, 'e2e-results.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
process.exit(failed.length ? 1 : 0);
