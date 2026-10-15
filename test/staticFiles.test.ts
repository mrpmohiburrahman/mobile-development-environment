// The read-only preview server, tested against a real folder on disk.
//
// The preview serves the static export. Expo writes one HTML file per route,
// so a request for `/ide` must find `ide.html`. The server must also refuse
// every path that leaves the export folder.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { resolveStatic, createStaticServer } from '../scripts/static-files.mjs';

function makeExport() {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'static-')));
  const root = join(parent, 'dist');
  mkdirSync(join(root, '(tabs)'), { recursive: true });
  mkdirSync(join(root, '_expo'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<p>home</p>');
  writeFileSync(join(root, 'ide.html'), '<p>studio</p>');
  writeFileSync(join(root, '(tabs)', 'index.html'), '<p>tabs</p>');
  writeFileSync(join(root, '_expo', 'entry.js'), 'void 0;');
  writeFileSync(join(root, '_expo', 'entry.css'), 'body {}');
  writeFileSync(join(parent, 'secret.txt'), 'outside');
  writeFileSync(`${root}.html`, '<p>outside</p>');
  symlinkSync(join(parent, 'secret.txt'), join(root, 'outside.txt'));
  symlinkSync(parent, join(root, 'outside'));
  symlinkSync(join(root, 'ide.html'), join(root, 'inside.html'));
  symlinkSync(join(root, '_expo'), join(root, 'inside-assets'));
  symlinkSync(root, `${root}-alias`);
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

test('the resolver refuses the sibling HTML candidate', async () => {
  const { root, cleanup } = makeExport();
  try {
    assert.equal(await resolveStatic(root, '/%2e%2f'), null);
  } finally {
    cleanup();
  }
});

test('the resolver refuses symlinks outside the export folder', async () => {
  const { root, cleanup } = makeExport();
  try {
    assert.equal(await resolveStatic(root, '/outside.txt'), null);
    assert.equal(await resolveStatic(root, '/outside/secret.txt'), null);
  } finally {
    cleanup();
  }
});

test('the resolver returns canonical paths for symlinks inside the export folder', async () => {
  const { root, cleanup } = makeExport();
  try {
    assert.equal(await resolveStatic(root, '/inside'), join(root, 'ide.html'));
    assert.equal(await resolveStatic(root, '/inside-assets/entry.js'), join(root, '_expo', 'entry.js'));
    assert.equal(await resolveStatic(`${root}-alias`, '/ide'), join(root, 'ide.html'));
  } finally {
    cleanup();
  }
});

async function withServer(root: string, run: (base: string) => Promise<void>, basePath = '') {
  const server = createStaticServer(root, basePath);
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

test('the server returns 404 for outside symlinks and the sibling HTML candidate', async () => {
  const { root, cleanup } = makeExport();
  try {
    for (const prefix of ['', '/preview']) {
      await withServer(root, async (base) => {
        for (const path of ['/outside.txt', '/outside/secret.txt', '/%2e%2f']) {
          const response = await fetch(`${base}${prefix}${path}`);
          assert.equal(response.status, 404, path);
          assert.equal(await response.text(), 'not found');
        }
      }, prefix);
    }
  } finally {
    cleanup();
  }
});

test('the server sends symlinks inside the export folder', async () => {
  const { root, cleanup } = makeExport();
  try {
    await withServer(root, async (base) => {
      const html = await fetch(`${base}/inside`);
      assert.equal(html.status, 200);
      assert.equal(html.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.equal(await html.text(), '<p>studio</p>');

      const js = await fetch(`${base}/inside-assets/entry.js`);
      assert.equal(js.status, 200);
      assert.equal(await js.text(), 'void 0;');
    });
  } finally {
    cleanup();
  }
});

test('a slash base path preserves root routes', async () => {
  const { root, cleanup } = makeExport();
  try {
    await withServer(root, async (base) => {
      const response = await fetch(`${base}/ide`);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), '<p>studio</p>');
    }, '/');
  } finally {
    cleanup();
  }
});

test('the server sends routes and assets under the base path', async () => {
  const { root, cleanup } = makeExport();
  try {
    for (const basePath of ['/preview', '/preview/', '/demo/preview/']) {
      const prefix = basePath.replace(/\/$/, '');
      await withServer(root, async (base) => {
        for (const path of ['/ide', '/ide.html', '/ide?x=1']) {
          const response = await fetch(`${base}${prefix}${path}`);
          assert.equal(response.status, 200, path);
          assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
          assert.equal(await response.text(), '<p>studio</p>');
        }

        const js = await fetch(`${base}${prefix}/_expo/entry.js?x=1`);
        assert.equal(js.status, 200);
        assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
        assert.equal(await js.text(), 'void 0;');

        const css = await fetch(`${base}${prefix}/_expo/entry.css`);
        assert.equal(css.status, 200);
        assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8');
        assert.equal(await css.text(), 'body {}');
      }, basePath);
    }
  } finally {
    cleanup();
  }
});

test('the bare base path and its slash form send index.html', async () => {
  const { root, cleanup } = makeExport();
  try {
    await withServer(root, async (base) => {
      for (const path of ['/preview', '/preview/', '/preview?x=1', '/preview/?x=1']) {
        const response = await fetch(`${base}${path}`);
        assert.equal(response.status, 200, path);
        assert.equal(await response.text(), '<p>home</p>');
      }
    }, '/preview/');
  } finally {
    cleanup();
  }
});

test('the server refuses paths outside the prefix boundary', async () => {
  const { root, cleanup } = makeExport();
  try {
    mkdirSync(join(root, '-other'));
    writeFileSync(join(root, '-other', 'ide.html'), '<p>wrong prefix</p>');
    await withServer(root, async (base) => {
      for (const path of ['/ide', '/_expo/entry.js', '/preview-other/ide', '/preview%2fide', '/']) {
        const response = await fetch(`${base}${path}`);
        assert.equal(response.status, 404, path);
        assert.equal(await response.text(), 'not found');
      }
    }, '/preview');
  } finally {
    cleanup();
  }
});

test('the server removes the prefix only once', async () => {
  const { root, cleanup } = makeExport();
  try {
    mkdirSync(join(root, 'preview'));
    writeFileSync(join(root, 'preview', 'ide.html'), '<p>nested</p>');
    await withServer(root, async (base) => {
      const response = await fetch(`${base}/preview/preview/ide`);
      assert.equal(response.status, 200);
      assert.equal(await response.text(), '<p>nested</p>');
    }, '/preview');
  } finally {
    cleanup();
  }
});

test('the server rejects invalid base paths', () => {
  const { root, cleanup } = makeExport();
  try {
    for (const basePath of [
      'preview', '//preview', '/preview//', '/preview?x=1', '/preview#section',
      '/preview/../other', '/preview/.', '/preview/%2e%2e', '/preview%2fother',
      '/preview/%', '/preview\\other', '/preview other', '/preview\nother',
    ]) {
      assert.throws(() => createStaticServer(root, basePath), {
        name: 'TypeError',
        message: 'Invalid base path.',
      }, basePath);
    }
  } finally {
    cleanup();
  }
});

test('the mounted server supports HEAD and refuses writes', async () => {
  const { root, cleanup } = makeExport();
  try {
    await withServer(root, async (base) => {
      const head = await fetch(`${base}/preview/ide`, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.equal(await head.text(), '');

      const post = await fetch(`${base}/preview/ide`, { method: 'POST', body: '{}' });
      assert.equal(post.status, 405);
      assert.equal(post.headers.get('allow'), 'GET, HEAD');
      assert.equal(await post.text(), 'read-only');
    }, '/preview');
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
