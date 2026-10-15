// The read-only preview server, tested against a real folder on disk.
//
// The preview serves the static export. Expo writes one HTML file per route,
// so a request for `/ide` must find `ide.html`. The server must also refuse
// every path that leaves the export folder.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { resolveStatic, createStaticServer } from '../scripts/static-files.mjs';

function makeExport() {
  const parent = mkdtempSync(join(tmpdir(), 'static-'));
  const root = join(parent, 'dist');
  mkdirSync(join(root, '(tabs)'), { recursive: true });
  mkdirSync(join(root, '_expo'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<p>home</p>');
  writeFileSync(join(root, 'ide.html'), '<p>studio</p>');
  writeFileSync(join(root, '(tabs)', 'index.html'), '<p>tabs</p>');
  writeFileSync(join(root, '_expo', 'entry.js'), 'void 0;');
  writeFileSync(join(parent, 'secret.txt'), 'outside');
  return { root, cleanup: () => rmSync(parent, { recursive: true, force: true }) };
}

test('the root path finds index.html', async () => {
  const { root, cleanup } = makeExport();
  try {
    assert.equal(await resolveStatic(root, '/'), join(root, 'index.html'));
  } finally {
    cleanup();
  }
});

test('a route path finds its HTML file, with or without a query', async () => {
  const { root, cleanup } = makeExport();
  try {
    assert.equal(await resolveStatic(root, '/ide'), join(root, 'ide.html'));
    assert.equal(await resolveStatic(root, '/ide?x=1'), join(root, 'ide.html'));
  } finally {
    cleanup();
  }
});

test('a folder path finds the index.html inside it', async () => {
  const { root, cleanup } = makeExport();
  try {
    assert.equal(await resolveStatic(root, '/(tabs)'), join(root, '(tabs)', 'index.html'));
    assert.equal(await resolveStatic(root, '/%28tabs%29'), join(root, '(tabs)', 'index.html'));
  } finally {
    cleanup();
  }
});

test('an asset path finds the asset', async () => {
  const { root, cleanup } = makeExport();
  try {
    assert.equal(await resolveStatic(root, '/_expo/entry.js'), join(root, '_expo', 'entry.js'));
  } finally {
    cleanup();
  }
});

test('a path that leaves the export folder is refused', async () => {
  const { root, cleanup } = makeExport();
  try {
    assert.equal(await resolveStatic(root, '/../secret.txt'), null);
    assert.equal(await resolveStatic(root, '/%2e%2e/secret.txt'), null);
    assert.equal(await resolveStatic(root, '/..%2fsecret.txt'), null);
  } finally {
    cleanup();
  }
});

test('a missing file and a bad escape are both refused', async () => {
  const { root, cleanup } = makeExport();
  try {
    assert.equal(await resolveStatic(root, '/nope'), null);
    assert.equal(await resolveStatic(root, '/%E0%A4%A'), null);
  } finally {
    cleanup();
  }
});

async function withServer(root: string, run: (base: string) => Promise<void>) {
  const server = createStaticServer(root);
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((ok) => server.close(ok));
  }
}

test('the server sends a route as HTML and a missing path as 404', async () => {
  const { root, cleanup } = makeExport();
  try {
    await withServer(root, async (base) => {
      const ide = await fetch(`${base}/ide`);
      assert.equal(ide.status, 200);
      assert.equal(ide.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.equal(await ide.text(), '<p>studio</p>');

      const js = await fetch(`${base}/_expo/entry.js`);
      assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
      await js.body?.cancel();

      const missing = await fetch(`${base}/nope`);
      assert.equal(missing.status, 404);
      await missing.body?.cancel();
    });
  } finally {
    cleanup();
  }
});

test('the server refuses every method that is not a read', async () => {
  const { root, cleanup } = makeExport();
  try {
    await withServer(root, async (base) => {
      const post = await fetch(`${base}/ide`, { method: 'POST', body: '{}' });
      assert.equal(post.status, 405);
      assert.equal(post.headers.get('allow'), 'GET, HEAD');
      await post.body?.cancel();
    });
  } finally {
    cleanup();
  }
});
