// Finds and sends files from the static web export. Read-only: it answers GET
// and HEAD, and it refuses every other method.
//
// Expo writes one HTML file per route (`ide.html`) plus assets. A request for
// `/ide` must find that file. Node stdlib only, the same rule as the token
// server.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

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

const isInside = (root, absolutePath) => absolutePath === root || absolutePath.startsWith(root + sep);

/**
 * The file for a request path, or null when the path is missing, has a bad
 * escape, or leaves `root`. `root` must be an absolute path.
 */
export async function resolveStatic(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const rel = decoded.replace(/^\/+/, '');
  const base = resolve(root, rel);
  if (!isInside(root, base)) return null;
  const candidates = rel === '' ? [join(root, 'index.html')] : [base, `${base}.html`, join(base, 'index.html')];
  for (const file of candidates) {
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // Not this candidate. Try the next one.
    }
  }
  return null;
}

const text = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
};

/** An HTTP server that sends files from `root`. The caller starts it. */
export function createStaticServer(root) {
  const absoluteRoot = resolve(root);
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      text(res, 405, 'read-only', { Allow: 'GET, HEAD' });
      return;
    }
    const file = await resolveStatic(absoluteRoot, req.url ?? '/');
    if (!file) {
      text(res, 404, 'not found');
      return;
    }
    let body;
    try {
      body = await readFile(file);
    } catch {
      // The file went away after `stat` found it.
      text(res, 404, 'not found');
      return;
    }
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(body);
  });
}
