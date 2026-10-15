import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyWebExport } from '../scripts/verify-web.mjs';

function fixture(prefix = '') {
  const root = mkdtempSync(join(tmpdir(), 'export-check-'));
  mkdirSync(join(root, '_expo'));
  writeFileSync(join(root, '_expo/app.js'), 'void 0;');
  writeFileSync(join(root, '_expo/app.css'), 'body{}');
  const html = `<script src="${prefix}/_expo/app.js"></script><link rel="stylesheet" href="${prefix}/_expo/app.css">`;
  writeFileSync(join(root, 'index.html'), html);
  writeFileSync(join(root, 'ide.html'), `${html}<div id="screen-login">Login</div>`);
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('the export check verifies routes and local script and style assets', async () => {
  const { root, cleanup } = fixture();
  try {
    assert.deepEqual(await verifyWebExport(root), { pages: 2, assets: 2 });
  } finally {
    cleanup();
  }
});

test('the export check verifies a Pages subpath', async () => {
  const { root, cleanup } = fixture('/repository');
  try {
    assert.deepEqual(await verifyWebExport(root, '/repository'), { pages: 2, assets: 2 });
    assert.deepEqual(await verifyWebExport(root, '/repository/'), { pages: 2, assets: 2 });
  } finally {
    cleanup();
  }
});

for (const marker of ['<!--$!-->', '<!--$?-->']) {
  test(`the export check refuses an incomplete server boundary: ${marker}`, async () => {
    const { root, cleanup } = fixture();
    try {
      writeFileSync(join(root, 'ide.html'), `${marker}<template></template><!--/$-->`);
      await assert.rejects(verifyWebExport(root), /Incomplete server render: ide.html/);
    } finally {
      cleanup();
    }
  });
}

test('the export check refuses a studio without server-rendered screen frames', async () => {
  const { root, cleanup } = fixture();
  try {
    writeFileSync(join(root, 'ide.html'), '<div>Loading</div>');
    await assert.rejects(verifyWebExport(root), /no screen frames/);
  } finally {
    cleanup();
  }
});

test('the export check refuses missing route HTML', async () => {
  const { root, cleanup } = fixture();
  try {
    rmSync(join(root, 'ide.html'));
    await assert.rejects(verifyWebExport(root), /ide.html/);
  } finally {
    cleanup();
  }
});

test('the export check refuses missing bundled assets', async () => {
  const { root, cleanup } = fixture();
  try {
    rmSync(join(root, '_expo/app.js'));
    await assert.rejects(verifyWebExport(root), /app.js/);
  } finally {
    cleanup();
  }
});

test('the export check refuses assets outside the configured subpath', async () => {
  const { root, cleanup } = fixture();
  try {
    await assert.rejects(verifyWebExport(root, '/repository'), /Asset has no base path/);
  } finally {
    cleanup();
  }
});
