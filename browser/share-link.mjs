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

  const openPage = async (hash) => {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce' });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${url}${hash}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('[data-layout-ready="true"]'));
    const board = page.getByRole('main', { name: 'Studio board' });
    return { context, page, errors, board };
  };

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

  // -- Copy link publishes the latest edits, not a stale debounced value ----
  {
    const { context, page, errors, board } = await openPage('');
    assert.equal(await page.evaluate(() => window.location.hash), '');
    // Enter and leave Present. presentedKey survives the exit, and the copy
    // click lands well inside the 400ms debounce window.
    await board.getByRole('button', { name: /Present/ }).click();
    assert.equal(await board.getAttribute('data-presenting'), 'true');
    const presentedKey = await board.getAttribute('data-presented');
    assert.ok(presentedKey && KNOWN_SCREENS.includes(presentedKey));
    await page.keyboard.press('Escape');
    const copyButton = board.getByRole('button', { name: 'Copy link' });
    await copyButton.click();
    await board.getByRole('button', { name: 'Copied' }).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const match = copied.match(/#s=([A-Za-z0-9_-]+)/);
    assert.ok(match, `clipboard holds no payload: ${copied}`);
    const json = decode(match[1]);
    assert.equal(json.s, presentedKey, 'Copy link must encode the screen set moments before the click');
    assert.equal(json.p, undefined, 'not presenting anymore, so no present flag');
    assert.deepEqual(Object.keys(json).sort(), ['s', 'v']);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // -- Partial payload: unknown screen and token warn; valid parts apply ----
  {
    const link = encode({
      v: 1,
      s: 'ghost',
      o: { 'color.light.accent': '#123456', 'color.light.nope': '#FFFFFF' },
    });
    const { context, page, errors } = await openPage(`#s=${link}`);
    const banner = page.locator('.mp-sharebanner');
    await banner.waitFor();
    const text = await banner.innerText();
    assert.match(text, /screen that no longer exists\. Showing the first screen/);
    assert.match(text, /token overrides could not be fully applied \(1 of 2\)/);
    // The normalized URL shows what applied: first screen, valid override only.
    const round = await hashPayload(page);
    assert.ok(round);
    assert.equal(round.s, 'login');
    assert.deepEqual(round.o, { 'color.light.accent': '#123456' });
    // The banner is dismissible.
    await banner.getByRole('button', { name: 'Dismiss' }).click();
    assert.equal(await page.locator('.mp-sharebanner').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // -- Malformed and wrong-version payloads warn and never crash ------------
  {
    const { context, page, errors, board } = await openPage('#s=@@@not-a-payload@@@');
    const banner = page.locator('.mp-sharebanner');
    await banner.waitFor();
    assert.match(await banner.innerText(), /could not be read\. Showing the studio defaults/);
    assert.equal(await board.getAttribute('data-presenting'), 'false');
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    const link = encode({ v: 99, p: 1, s: 'habit' });
    const { context, page, errors, board } = await openPage(`#s=${link}`);
    const banner = page.locator('.mp-sharebanner');
    await banner.waitFor();
    assert.match(await banner.innerText(), /different version of the studio/);
    assert.equal(await board.getAttribute('data-presenting'), 'false');
    assert.deepEqual(errors, []);
    await context.close();
  }

  console.log('Share-link checks passed: round trip, fresh-context apply, Copy link freshness, partial payload, malformed payload, version mismatch, dismissible banner.');
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
