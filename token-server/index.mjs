// Patches mobile/src/ds/tokens.json in place. That's the whole job.
//
// Node's stdlib covers all of it, so this has no dependencies and no build step
// — `node token-server/index.mjs` and it's up. Express plus ts-node would be two
// more things to install and keep current for about forty lines of work.

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = resolve(ROOT, 'mobile/src/ds/tokens.json');
const PORT = Number(process.env.PORT ?? 3001);

const readTokens = async () => JSON.parse(await readFile(TOKENS, 'utf8'));

// Trailing newline matters: without it every single `git diff` ends in
// "\ No newline at end of file", which is noise in the exact artifact this
// tool exists to make readable.
const writeTokens = (tokens) => writeFile(TOKENS, JSON.stringify(tokens, null, 2) + '\n');

/** Set a dotted path, e.g. "color.light.accent". Refuses to create new keys. */
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = obj;
  for (const k of keys) {
    if (!Object.hasOwn(node, k) || typeof node[k] !== 'object') return false;
    node = node[k];
  }
  if (!Object.hasOwn(node, last)) return false;
  node[last] = value;
  return true;
}

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
};

const body = async (req) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    if (req.method === 'GET' && req.url === '/tokens') {
      return json(res, 200, await readTokens());
    }

    if (req.method === 'POST' && req.url === '/token') {
      const { path, value } = await body(req);
      if (typeof path !== 'string' || value === undefined) {
        return json(res, 400, { error: 'path and value are required' });
      }
      const tokens = await readTokens();
      if (!setPath(tokens, path, value)) {
        return json(res, 404, { error: `no such token: ${path}` });
      }
      await writeTokens(tokens);
      console.log(`  ${path} → ${value}`);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'POST' && req.url === '/revert') {
      await new Promise((ok, fail) =>
        execFile('git', ['checkout', '--', TOKENS], { cwd: ROOT }, (err) => (err ? fail(err) : ok())),
      );
      console.log('  reverted to last commit');
      return json(res, 200, { ok: true });
    }

    json(res, 404, { error: 'not found' });
  } catch (err) {
    json(res, 500, { error: String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`token server  →  http://localhost:${PORT}`);
  console.log(`writing       →  ${TOKENS}`);
});
