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

  const openPage = async (hash, initScript) => {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce' });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    if (initScript) await context.addInitScript(initScript);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${url}${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('[data-layout-ready="true"]'));
    const board = page.getByRole('main', { name: 'Studio board' });
    return { context, page, errors, board };
  };

  // The screen frame nearest the viewport center once the camera settles.
  // Measured in the browser so the check does not copy the board geometry.
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

  // A link applies after the board is ready, so its flight may start later
  // than the first settled frame. Poll until the camera shows `key`.
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

  // -- Copy link right after a token edit, then a copied-link round trip ---
  {
    const { context, page, errors, board } = await openPage('');
    assert.equal(await page.evaluate(() => window.location.hash), '');
    await flyTo(board, 'Stats');
    await expectCamera(page, 'stats');
    // The first range input in the tokens tab is a space token. Edit it and
    // click Copy link at once, well inside the 400ms debounce window.
    const slider = page.locator('input[type="range"]').first();
    await slider.fill('20');
    await board.getByRole('button', { name: 'Copy link' }).click();
    await board.getByRole('button', { name: 'Copied' }).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const match = copied.match(/#s=([A-Za-z0-9_-]+)/);
    assert.ok(match, `clipboard holds no payload: ${copied}`);
    const json = decode(match[1]);
    assert.equal(json.s, 'stats', 'Copy link must encode the focused screen');
    assert.equal(json.p, undefined, 'not presenting, so no present flag');
    const edited = Object.entries(json.o ?? {});
    assert.equal(edited.length, 1, `Copy link must carry the edit made before the click: ${JSON.stringify(json)}`);
    assert.match(edited[0][0], /^space\./);
    assert.equal(edited[0][1], 20);
    assert.deepEqual(Object.keys(json).sort(), ['o', 's', 'v']);
    assert.deepEqual(errors, []);
    await context.close();

    // Open the copied link in a fresh browser context.
    const fresh = await openPage(copied.slice(copied.indexOf('#')));
    await expectCamera(fresh.page, 'stats');
    assert.equal(await fresh.page.locator('.mp-sharebanner').count(), 0);
    assert.deepEqual(await hashPayload(fresh.page), json, 'the copied link must reproduce the same state');
    assert.deepEqual(fresh.errors, []);
    await fresh.context.close();
  }

  // -- The screen key leaves the link when the camera leaves the screen -----
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

  // -- Partial payload: unknown screen, unknown token, invalid value --------
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
    // The camera shows the first declared screen.
    await expectCamera(page, KNOWN_SCREENS[0]);
    // The normalized URL shows what applied: first screen, valid override only.
    const round = await hashPayload(page);
    assert.ok(round);
    assert.equal(round.s, KNOWN_SCREENS[0]);
    assert.deepEqual(round.o, { 'color.light.accent': '#123456' });
    await banner.getByRole('button', { name: 'Dismiss' }).click();
    assert.equal(await page.locator('.mp-sharebanner').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // -- Malformed payloads, a wrong version, and an unsupported browser ------
  const expectBanner = async (hash, pattern, initScript) => {
    const { context, page, errors, board } = await openPage(hash, initScript);
    const banner = page.locator('.mp-sharebanner');
    await banner.waitFor();
    assert.match(await banner.innerText(), pattern);
    assert.equal(await board.getAttribute('data-presenting'), 'false');
    assert.deepEqual(errors, []);
    return { context, board };
  };
  // Characters outside base64url.
  await (await expectBanner('#s=@@@not-a-payload@@@', /cannot read this link/)).context.close();
  // Valid base64url, but the bytes are not a deflate stream.
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
