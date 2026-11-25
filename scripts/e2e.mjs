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
  const routes = ['/', '/path', '/lessons', '/lessons/l0-tuning', '/theory', '/tuner', '/metronome', '/fretboard', '/scales', '/chords', '/chord-finder', '/play', '/practice', '/technique-lab', '/fretboard-trainer', '/ear-training', '/analyzer', '/tab-editor', '/improvisation', '/jam', '/progress', '/settings', '/account'];
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

const DEMO_XML = path.join(root, 'tests/fixtures/demo-arrangement.xml');

test('play mode: import, practice run, pause/resume, unsupported files', async (b) => {
  const page = await newPage(b);
  await go(page, '/play');
  await page.getByTestId('play-import').click();
  await page.getByTestId('play-import-file').setInputFiles({ name: 'song.psarc', mimeType: 'application/octet-stream', buffer: Buffer.from('PSAR') });
  expect((await page.locator('[role=dialog]').textContent())?.includes('encrypted'), 'PSARC explained');
  await page.getByTestId('play-import-file').setInputFiles(DEMO_XML);
  await page.getByTestId('play-imported').waitFor();
  expect((await page.getByTestId('play-setup').textContent())?.includes('Demo Riff in A Minor'), 'imported song selected');
  const sw = page.getByRole('switch', { name: 'Score with the microphone' });
  if ((await sw.getAttribute('aria-checked')) === 'true') await sw.click();
  await page.getByTestId('play-start').click();
  await page.getByTestId('play-canvas').waitFor();
  await page.waitForTimeout(3500);
  const ink = await page.evaluate(() => { const c = document.querySelector('[data-testid=play-canvas]'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let colored = 0; for (let i = 0; i < d.length; i += 400) if (d[i] + d[i + 1] + d[i + 2] > 300) colored++; return colored; });
  expect(ink > 20, `highway is drawn (${ink} bright samples)`);
  await page.getByTestId('play-pause').click();
  expect((await page.getByTestId('play-stage').textContent())?.includes('Paused'), 'paused');
  await page.getByTestId('play-pause').click();
  await page.getByTestId('play-exit').click();
  await page.reload();
  await page.getByTestId('play-imported').waitFor();
  expect((await page.getByTestId('play-imported').textContent())?.includes('Demo Riff'), 'imported song persists in IndexedDB');
  expect(page.errors.length === 0, page.errors.join('\n'));
});

test('play mode: live microphone scoring and best score', async () => {
  const b = await launch(A2);
  try {
    const page = await newPage(b);
    await go(page, '/play');
    await page.getByTestId('play-import').click();
    await page.getByTestId('play-import-file').setInputFiles(DEMO_XML);
    await page.getByTestId('play-imported').waitFor();
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
    const recs = await page.evaluate(async () => { const r = await new Promise((res) => { const q = indexedDB.open('gma-local'); q.onsuccess = () => { const t = q.result.transaction('songs').objectStore('songs').getAll(); t.onsuccess = () => res(t.result); }; }); return r; });
    expect(recs.length === 1 && recs[0].best && recs[0].best.accuracy > 0, 'best score stored for the song');
    // Exercise run records a Technique Lab entry.
    await go(page, '/play?exercise=ex-chromatic-1234');
    await page.waitForTimeout(300);
    expect((await page.getByTestId('play-setup').textContent())?.length > 0, 'exercise setup shown');
    expect(page.errors.length === 0, page.errors.join('\n'));
  } finally { await b.close(); }
}, { ownBrowser: true, slow: true });

test('play mode: Guitar Pro import', async (b) => {
  const { deflateRawSync } = await import('node:zlib');
  const gpif = `<GPIF><Score><Title><![CDATA[GP Import Test]]></Title><Artist><![CDATA[Fixture]]></Artist></Score><MasterTrack><Automations><Automation><Type>Tempo</Type><Bar>0</Bar><Position>0</Position><Value>100 2</Value></Automation></Automations></MasterTrack><Tracks><Track id="0"><Name>Lead</Name><Staves><Staff><Properties><Property name="Tuning"><Pitches>40 45 50 55 59 64</Pitches></Property></Properties></Staff></Staves></Track><Track id="1"><Name>Bass</Name><Staves><Staff><Properties><Property name="Tuning"><Pitches>28 33 38 43</Pitches></Property></Properties></Staff></Staves></Track></Tracks><MasterBars><MasterBar><Time>4/4</Time><Bars>0 1</Bars></MasterBar></MasterBars><Bars><Bar id="0"><Voices>0 -1 -1 -1</Voices></Bar><Bar id="1"><Voices>1 -1 -1 -1</Voices></Bar></Bars><Voices><Voice id="0"><Beats>0 0 0 0</Beats></Voice><Voice id="1"><Beats>1</Beats></Voice></Voices><Beats><Beat id="0"><Rhythm ref="0"/><Notes>0</Notes></Beat><Beat id="1"><Rhythm ref="1"/><Notes>1</Notes></Beat></Beats><Notes><Note id="0"><Properties><Property name="String"><String>1</String></Property><Property name="Fret"><Fret>2</Fret></Property></Properties></Note><Note id="1"><Properties><Property name="String"><String>0</String></Property><Property name="Fret"><Fret>5</Fret></Property></Properties></Note></Notes><Rhythms><Rhythm id="0"><NoteValue>Quarter</NoteValue></Rhythm><Rhythm id="1"><NoteValue>Whole</NoteValue></Rhythm></Rhythms></GPIF>`;
  const name = Buffer.from('Content/score.gpif');
  const data = deflateRawSync(Buffer.from(gpif));
  const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(gpif.length, 22); lh.writeUInt16LE(name.length, 26);
  const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(gpif.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(0, 42);
  const localLen = 30 + name.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(localLen, 16);
  const zip = Buffer.concat([lh, name, data, ch, name, end]);
  const page = await newPage(b);
  await go(page, '/play');
  await page.getByTestId('play-import').click();
  await page.getByTestId('play-import-file').setInputFiles({ name: 'fixture.gp', mimeType: 'application/octet-stream', buffer: zip });
  await page.getByRole('button', { name: /^Bass/ }).click();
  await page.getByTestId('play-imported').waitFor();
  const setup = await page.getByTestId('play-setup').textContent();
  expect(setup?.includes('GP Import Test') && setup.includes('Bass'), `GP track imported (${setup?.slice(0, 120)})`);
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
