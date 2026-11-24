#!/usr/bin/env node
/** Tiny static server with SPA fallback, used for `npm run preview` and browser tests. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };

export function serve(dir, port = 4173) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Permissions-Policy': 'microphone=(self)' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(port, () => console.log(`serving ${dir} at http://localhost:${port}`));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  serve(process.argv[2] ?? 'dist', Number(process.argv[3] ?? 4173));
}
