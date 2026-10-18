// Shareable URL state on the static export (ticket 22).
//
// Covers the three acceptance cases in a real browser against the read-only
// build: a round trip (a link applies, the URL re-encodes to the same state,
// and Copy link publishes it), a partial payload (unknown screen + unknown
// token warn, valid parts apply), and a malformed payload (banner, no crash).
//
// The links here are built with Node's zlib — an independent second
// implementation of the documented format — so agreement proves the wire
// format, not just that the app round-trips its own encoder.
//
// Usage: node browser/share-link.mjs [exportDir]
// Run `npm run export:web` first.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import { createStaticServer } from '../scripts/static-files.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = resolve(ROOT, process.argv[2] ?? 'dist');
const basePath = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
assert.ok(existsSync(resolve(exportDir, 'ide.html')), 'Run npm run export:web before the share-link checks.');

const encode = (json) =>
  deflateSync(Buffer.from(JSON.stringify(json)))
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const decode = (payload) => {
  const base64 = payload.replaceAll('-', '+').replaceAll('_', '/');
  return JSON.parse(inflateSync(Buffer.from(base64, 'base64')).toString('utf8'));
};

const KNOWN_SCREENS = ['login', 'index', 'habits', 'habit', 'stats', 'profile', 'settings'];
const SYNC_DEBOUNCE_MS = 400;

const server = createStaticServer(exportDir, basePath);
let browser;
try {
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(Number(process.env.PORT ?? process.env.PASEO_PORT ?? 0), '127.0.0.1', done);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}${basePath}/ide`;
  browser = await chromium.launch();

  const openPage = async (hash, initScript, controlledTime = false) => {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce' });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    if (initScript) await context.addInitScript(initScript);
    const page = await context.newPage();
    if (controlledTime) await page.clock.install();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${url}${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('[data-layout-ready="true"]'));
    const board = page.getByRole('main', { name: 'Studio board' });
    return { context, page, errors, board };
  };

  const cameraScreen = async (page) => {
    await page.waitForFunction(() => document.querySelector('.mp-world')?.dataset.flying === 'false');
    return page.evaluate(() => {
      const viewport = document.querySelector('.mp-viewport');
      const world = document.querySelector('.mp-world');
      if (!viewport || !world) return null;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(world).transform);
      const rect = viewport.getBoundingClientRect();
      const centerX = (rect.width / 2 - matrix.e) / matrix.a;
      const centerY = (rect.height / 2 - matrix.f) / matrix.d;
      let best = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const frame of document.querySelectorAll('.mp-frame[id^="mp-frame-"]')) {
        const left = Number.parseFloat(frame.style.left || '0');
        const top = Number.parseFloat(frame.style.top || '0');
        const distance = Math.hypot(left + 195 - centerX, top + 434 - centerY);
        if (distance < bestDistance) { best = frame.id.replace('mp-frame-', ''); bestDistance = distance; }
      }
      return best;
    });
  };

  const expectCamera = async (page, key) => {
    const deadline = Date.now() + 5000;
    let seen = null;
    while (Date.now() < deadline) {
      seen = await cameraScreen(page);
      if (seen === key) return;
      await page.waitForTimeout(100);
    }
    assert.equal(seen, key, 'the camera did not reach the expected screen');
  };

  const flyTo = (board, label) =>
    board.getByRole('group', { name: 'Fly to screen' }).getByRole('button', { name: label, exact: true }).click();

  const hashPayload = async (page) => {
    await page.waitForTimeout(SYNC_DEBOUNCE_MS + 400);
    const hash = await page.evaluate(() => window.location.hash);
    const match = hash.match(/#s=([A-Za-z0-9_-]+)/);
    return match ? decode(match[1]) : null;
  };

  // -- Round trip: a full link applies on a fresh context -------------------
  {
    const darkBg = '#0A1428';
    const link = encode({ v: 1, p: 1, s: 'habit', c: 'dark', o: { 'color.dark.bg': darkBg } });
    const { context, page, errors, board } = await openPage(`#s=${link}`);
    assert.equal(await board.getAttribute('data-presenting'), 'true');
    assert.equal(await board.getAttribute('data-presented'), 'habit');
    const bar = page.locator('.mp-presentbar');
    assert.match(await bar.innerText(), /Habit detail/);
    assert.match(await bar.innerText(), /Dark/);
    // The override applies to this build's committed tokens: the presented
    // screen's background is the linked value, not the committed #191512.
    await page.waitForFunction(
      (expected) => {
        const el = document.querySelector('#screen-habit');
        if (!el) return false;
        const walk = (node) =>
          getComputedStyle(node).backgroundColor === expected ||
          [...node.children].some(walk);
        return walk(el);
      },
      'rgb(10, 20, 40)',
    );
    // The URL re-encodes to the applied state (normalized, same fields).
    const round = await hashPayload(page);
    assert.ok(round, 'the URL did not re-encode the applied state');
    assert.equal(round.v, 1);
    assert.equal(round.p, 1);
    assert.equal(round.s, 'habit');
    assert.equal(round.c, 'dark');
    assert.deepEqual(round.o, { 'color.dark.bg': darkBg });
    assert.equal(await page.locator('.mp-sharebanner').count(), 0, 'a fully valid link must not warn');
    assert.deepEqual(errors, []);
    await context.close();
  }

  {
    const { context, page, errors, board } = await openPage('', undefined, true);
    assert.equal(await page.evaluate(() => window.location.hash), '');
    await flyTo(board, 'Stats');
    await expectCamera(page, 'stats');
    assert.equal((await hashPayload(page))?.s, 'stats');
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
    const beforeEdit = await page.evaluate(() => ({ now: Date.now(), hash: location.hash }));
    await page.locator('input[type="color"]').first().fill('#00ff88');
    assert.equal(await page.evaluate(() => location.hash), beforeEdit.hash, 'The URL changed before the debounce timer ran.');
    await board.getByRole('button', { name: 'Copy link' }).click();
    await board.getByRole('button', { name: 'Copied' }).waitFor();
    assert.equal(await page.evaluate(() => Date.now()), beforeEdit.now, 'The browser clock advanced during Copy link.');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const match = copied.match(/#s=([A-Za-z0-9_-]+)/);
    assert.ok(match, 'The copied link has no payload.');
    const json = decode(match[1]);
    assert.equal(json.s, 'stats', 'The copied link must include the focused screen.');
    assert.equal(json.p, undefined, 'The board is not presenting.');
    assert.deepEqual(json.o, { 'color.light.bg': '#00ff88' }, 'Copy link must include the current token value.');
    assert.deepEqual(Object.keys(json).sort(), ['o', 's', 'v']);
    await page.clock.runFor(SYNC_DEBOUNCE_MS);
    assert.equal(await page.evaluate(() => location.href), copied, 'A pending write changed the copied URL.');
    assert.deepEqual(errors, []);
    await context.close();

    const fresh = await openPage(new URL(copied).hash);
    await expectCamera(fresh.page, 'stats');
    await fresh.page.waitForFunction(() => {
      const el = document.querySelector('#screen-stats');
      if (!el) return false;
      const walk = (node) =>
        getComputedStyle(node).backgroundColor === 'rgb(0, 255, 136)' ||
        [...node.children].some(walk);
      return walk(el);
    });
    assert.equal(await fresh.page.locator('.mp-sharebanner').count(), 0);
    assert.deepEqual(await hashPayload(fresh.page), json, 'The copied link must restore the same state.');
    assert.deepEqual(fresh.errors, []);
    await fresh.context.close();
  }

  {
    const { context, page, errors, board } = await openPage('');
    await flyTo(board, 'Stats');
    await expectCamera(page, 'stats');
    await board.getByRole('button', { name: 'Zoom to 100%', exact: true }).click();
    await expectCamera(page, 'stats');
    assert.equal((await hashPayload(page))?.s, 'stats', 'Zoom must preserve the focused screen.');
    await board.getByRole('button', { name: 'Copy link', exact: true }).click();
    await board.getByRole('button', { name: 'Copied', exact: true }).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const payload = new URL(copied).hash.slice('#s='.length);
    assert.equal(decode(payload).s, 'stats', 'The copied link must include the screen after zoom.');
    assert.deepEqual(errors, []);
    await context.close();
    const fresh = await openPage(new URL(copied).hash);
    await expectCamera(fresh.page, 'stats');
    assert.deepEqual(fresh.errors, []);
    await fresh.context.close();
  }

  {
    const { context, page, errors, board } = await openPage('');
    await flyTo(board, 'Habit detail');
    assert.equal((await hashPayload(page))?.s, 'habit');
    await board.locator('.mp-canvas-controls').getByRole('button', { name: 'Fit', exact: true }).click();
    await hashPayload(page);
    assert.equal(await page.evaluate(() => window.location.hash), '', 'the overview is the default view');
    assert.deepEqual(errors, []);
    await context.close();
  }

  {
    const link = encode({
      v: 1,
      s: 'ghost',
      o: { 'color.light.accent': '#123456', 'color.light.nope': '#FFFFFF', 'space.md': 'wide' },
    });
    const { context, page, errors } = await openPage(`#s=${link}`);
    const banner = page.locator('.mp-sharebanner');
    await banner.waitFor();
    const text = await banner.innerText();
    assert.match(text, /points to a screen that does not exist\. The studio shows the first screen/);
    assert.match(text, /cannot apply 2 of 3 token overrides/);
    await expectCamera(page, KNOWN_SCREENS[0]);
    const round = await hashPayload(page);
    assert.ok(round);
    assert.equal(round.s, KNOWN_SCREENS[0]);
    assert.deepEqual(round.o, { 'color.light.accent': '#123456' });
    await banner.getByRole('button', { name: 'Dismiss' }).click();
    assert.equal(await page.locator('.mp-sharebanner').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  const expectBanner = async (hash, pattern, initScript) => {
    const { context, page, errors, board } = await openPage(hash, initScript);
    const banner = page.locator('.mp-sharebanner');
    await banner.waitFor();
    assert.match(await banner.innerText(), pattern);
    assert.equal(await board.getAttribute('data-presenting'), 'false');
    assert.deepEqual(errors, []);
    return { context, board };
  };
  await (await expectBanner('#s=@@@not-a-payload@@@', /cannot read this link/)).context.close();
  const notDeflate = Buffer.from('these bytes are not deflate data').toString('base64url');
  await (await expectBanner(`#s=${notDeflate}`, /cannot read this link/)).context.close();
  await (await expectBanner(`#s=${encode({ v: 99, p: 1, s: 'habit' })}`, /different studio version/)).context.close();
  {
    const removeStreams = () => {
      delete globalThis.CompressionStream;
      delete globalThis.DecompressionStream;
    };
    const { context, board } = await expectBanner(`#s=${encode({ v: 1, s: 'habit' })}`, /does not support shared links/, removeStreams);
    assert.equal(await board.getByRole('button', { name: 'Copy link' }).isDisabled(), true);
    await context.close();
  }

  console.log('Share-link checks passed: round trip, copied-link round trip in a fresh context, Copy link after a token edit, screen key cleared on Fit, partial payload with camera fallback, malformed text, malformed compression, version mismatch, unsupported browser, dismissible banner.');
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
