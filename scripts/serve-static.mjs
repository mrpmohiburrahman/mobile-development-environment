// Serves the static web export. Read-only: this process never writes tokens.
//
// Expo's static export emits one HTML file per route (`ide.html`) plus assets.
// A request for `/ide` has to find that file. Node stdlib only, same rule as
// the token server.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.argv[2] ?? 'dist');
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
};

function inside(root, candidate) {
  const rel = normalize(candidate);
  return rel === root || rel.startsWith(root + sep);
}

export async function resolveStatic(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const rel = decoded.replace(/^\/+/, '');
  const base = resolve(root, rel);
  if (!inside(root, base)) return null;
  const candidates = rel === '' ? [join(root, 'index.html')] : [base, `${base}.html`, join(base, 'index.html')];
  for (const file of candidates) {
    if (!inside(root, file)) continue;
    try {
      const info = await stat(file);
      if (info.isFile()) return file;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const server = createServer(async (req, res) => {
  const file = await resolveStatic(ROOT, req.url ?? '/');
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  const body = await readFile(file);
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(body);
});

server.listen(PORT, HOST, () => {
  console.log(`read-only web  →  http://${HOST}:${PORT}/ide`);
});
