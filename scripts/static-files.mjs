// Finds and sends files from the static web export. Read-only: it answers GET
// and HEAD, and it refuses every other method.
//
// Expo writes one HTML file per route (`ide.html`) plus assets. A request for
// `/ide` must find that file. Node stdlib only, the same rule as the token
// server.

import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
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

const isInside = (root, absolutePath) => absolutePath === root || absolutePath.startsWith(root.endsWith(sep) ? root : root + sep);

/**
 * The file for a request path, or null when the path is missing, has a bad
 * escape, or leaves `root`. `root` must be an absolute path.
 */
export async function resolveStatic(root, urlPath) {
  let decoded;
  let absoluteRoot;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0]);
    absoluteRoot = await realpath(root);
  } catch {
    return null;
  }
  const rel = decoded.replace(/^\/+/, '');
  const base = resolve(absoluteRoot, rel);
  if (!isInside(absoluteRoot, base)) return null;
  const candidates = rel === '' ? [join(absoluteRoot, 'index.html')] : [base, `${base}.html`, join(base, 'index.html')];
  for (const file of candidates) {
    if (!isInside(absoluteRoot, file)) return null;
    try {
      const absoluteFile = await realpath(file);
      if (!isInside(absoluteRoot, absoluteFile)) return null;
      if ((await stat(absoluteFile)).isFile()) return absoluteFile;
    } catch {
      // Not this candidate. Try the next one.
    }
  }
  return null;
}

function normalizeBasePath(basePath) {
  if (basePath === '' || basePath === '/') return '';
  if (typeof basePath !== 'string' || !basePath.startsWith('/') || /[^A-Za-z0-9._~/-]/.test(basePath)) {
    throw new TypeError('Invalid base path.');
  }
  const prefix = basePath.replace(/\/$/, '');
  if (prefix.slice(1).split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new TypeError('Invalid base path.');
  }
  return prefix;
}

const text = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
};

/** An HTTP server that sends files from `root`. The caller starts it. */
export function createStaticServer(root, basePath = '') {
  const absoluteRoot = resolve(root);
  const prefix = normalizeBasePath(basePath);
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      text(res, 405, 'read-only', { Allow: 'GET, HEAD' });
      return;
    }
    const urlPath = (req.url ?? '/').split('?')[0];
    if (prefix && urlPath !== prefix && !urlPath.startsWith(prefix + '/')) {
      text(res, 404, 'not found');
      return;
    }
    const file = await resolveStatic(absoluteRoot, urlPath.slice(prefix.length) || '/');
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
