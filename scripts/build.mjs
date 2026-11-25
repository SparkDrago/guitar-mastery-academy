#!/usr/bin/env node
/**
 * Build script: esbuild (TypeScript + React) + Tailwind CSS v4 (programmatic
 * compile) → static site in dist/. Deployable to any static host, including Vercel.
 *
 *   node scripts/build.mjs --production     production build
 *   node scripts/build.mjs --watch --serve  dev server with rebuild on change
 *
 * Environment (from process.env or .env): GMA_SUPABASE_URL, GMA_SUPABASE_ANON_KEY, GMA_SITE_URL.
 * Only the public anon key belongs here; never the service-role key.
 */
import * as esbuild from 'esbuild';
import { compile } from 'tailwindcss';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const args = new Set(process.argv.slice(2));
const production = args.has('--production');
const watch = args.has('--watch');
const require = createRequire(import.meta.url);

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(root, '.env');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  if (/service[_-]?role/i.test(env.GMA_SUPABASE_ANON_KEY ?? '')) {
    throw new Error('Refusing to build: GMA_SUPABASE_ANON_KEY looks like a service-role key. Use the anon/publishable key.');
  }
  return {
    supabaseUrl: env.GMA_SUPABASE_URL ?? '',
    supabaseAnonKey: env.GMA_SUPABASE_ANON_KEY ?? '',
    siteUrl: env.GMA_SITE_URL ?? '',
    version: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? new Date().toISOString().slice(0, 10),
  };
}

function walk(dir, exts) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => p.endsWith(e))) out.push(p);
  }
  return out;
}

async function buildCss() {
  const input = fs.readFileSync(path.join(root, 'src/styles/app.css'), 'utf8');
  const compiler = await compile(input, {
    base: path.join(root, 'src/styles'),
    loadStylesheet: async (id, base) => {
      const resolved = id === 'tailwindcss' ? require.resolve('tailwindcss/index.css') : id.startsWith('.') ? path.resolve(base, id) : require.resolve(id);
      return { content: fs.readFileSync(resolved, 'utf8'), base: path.dirname(resolved), path: resolved };
    },
  });
  const candidates = new Set();
  for (const file of walk(path.join(root, 'src'), ['.ts', '.tsx'])) {
    for (const token of fs.readFileSync(file, 'utf8').split(/[\s"'`{}<>;\\]+/)) if (token && token.length < 120) candidates.add(token);
  }
  let css = compiler.build([...candidates]);
  if (production) css = (await esbuild.transform(css, { loader: 'css', minify: true })).code;
  return css;
}

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

async function buildAll() {
  const started = Date.now();
  const config = loadEnv();
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  // The import worker is its own bundle; the app learns its hashed URL at build time.
  const workerBuild = await esbuild.build({
    entryPoints: [path.join(root, 'src/workers/import.worker.ts')],
    bundle: true,
    format: 'iife',
    target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
    minify: production,
    sourcemap: production ? false : 'inline',
    write: false,
    tsconfig: path.join(root, 'tsconfig.json'),
    logLevel: 'warning',
  });
  const workerJs = workerBuild.outputFiles[0].text;
  const workerName = `assets/import-worker-${hash(workerJs)}.js`;
  fs.writeFileSync(path.join(dist, workerName), workerJs);
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src/main.tsx')],
    bundle: true,
    format: 'esm',
    target: ['es2020', 'chrome90', 'safari15', 'firefox90'],
    jsx: 'automatic',
    minify: production,
    sourcemap: production ? false : 'inline',
    write: false,
    tsconfig: path.join(root, 'tsconfig.json'),
    define: {
      'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development'),
      __GMA_CONFIG__: JSON.stringify(config),
      __GMA_IMPORT_WORKER__: JSON.stringify(`/${workerName}`),
    },
    logLevel: 'warning',
  });
  const js = result.outputFiles[0].text;
  const css = await buildCss();
  const jsName = `assets/app-${hash(js)}.js`;
  const cssName = `assets/app-${hash(css)}.css`;
  fs.writeFileSync(path.join(dist, jsName), js);
  fs.writeFileSync(path.join(dist, cssName), css);
  const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8').replace('%CSS%', `/${cssName}`).replace('%JS%', `/${jsName}`);
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  const pub = path.join(root, 'public');
  if (fs.existsSync(pub)) fs.cpSync(pub, dist, { recursive: true });
  const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
  console.log(`built in ${Date.now() - started} ms: ${jsName} (${kb(js.length)}), ${workerName} (${kb(workerJs.length)}), ${cssName} (${kb(css.length)})${config.supabaseUrl ? ', Supabase configured' : ', local-only mode (no Supabase env)'}`);
}

await buildAll();

if (watch) {
  let timer = null;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildAll().catch((e) => console.error(e.message)), 120);
  };
  for (const dir of ['src', 'packages', 'content']) fs.watch(path.join(root, dir), { recursive: true }, rebuild);
  console.log('watching for changes…');
}
if (args.has('--serve')) serve(dist, Number(process.env.PORT ?? 5173));
