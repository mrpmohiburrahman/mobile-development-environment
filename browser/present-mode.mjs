import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createStaticServer } from '../scripts/static-files.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = resolve(ROOT, process.argv[2] ?? 'dist');
const basePath = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
assert.ok(existsSync(resolve(exportDir, 'ide.html')), 'Run npm run export:web before the present-mode checks.');

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
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const board = page.getByRole('main', { name: 'Studio board' });
  const ready = () => page.waitForFunction(() => document.querySelector('[data-layout-ready="true"]'));
  const presentBar = page.locator('.mp-presentbar');
  const presented = () => board.getAttribute('data-presented');
  const analyticsRequests = [];
  await page.route(/mixpanel\.com/, async (route) => {
    analyticsRequests.push(route.request().url());
    await route.abort();
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready();
  assert.deepEqual(errors, [], 'The exported board failed to hydrate.');

  // Entry from the overview camera presents the frame nearest its center.
  // Measure that expectation in the browser instead of copying the derivation.
  const overviewKey = await page.evaluate(() => {
    const viewport = document.querySelector('.mp-viewport');
    const world = document.querySelector('.mp-world');
    if (!viewport || !world) return null;
    const transform = getComputedStyle(world).transform;
    const matrix = new DOMMatrixReadOnly(transform);
    const rect = viewport.getBoundingClientRect();
    const centerX = (rect.width / 2 - matrix.e) / matrix.a;
    const centerY = (rect.height / 2 - matrix.f) / matrix.d;
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const frame of document.querySelectorAll('.mp-frame[id^="mp-frame-"]')) {
      const key = frame.id.replace('mp-frame-', '');
      const left = Number.parseFloat(frame.style.left || '0');
      const top = Number.parseFloat(frame.style.top || '0');
      const distance = Math.hypot(left + 195 - centerX, top + 434 - centerY);
      if (distance < bestDistance) { best = key; bestDistance = distance; }
    }
    return best;
  });
  await board.getByRole('button', { name: /Present/ }).click();
  assert.equal(await board.getAttribute('data-presenting'), 'true');
  assert.equal(await presented(), overviewKey);
  await page.keyboard.press('Escape');
  assert.equal(await board.getAttribute('data-presenting'), 'false');

  // The camera's current screen is the presented one; entry never resets.
  await board.getByRole('group', { name: 'Fly to screen' }).getByRole('button', { name: 'Habit detail', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.mp-world')?.dataset.flying === 'false');
  await board.getByRole('button', { name: /Present/ }).click();
  assert.equal(await board.getAttribute('data-presenting'), 'true');
  assert.equal(await presented(), 'habit');
  assert.match(await presentBar.innerText(), /Habit detail/);
  assert.match(await presentBar.innerText(), /4 \/ 7/);

  // Scale fits the board viewport's height, which is shorter than the window.
  const vpHeight = await page.evaluate(() => document.querySelector('.mp-viewport')?.clientHeight ?? 0);
  const scale = Number(await board.getAttribute('data-present-scale'));
  assert.equal(scale, Math.min(1.5, Math.max(0.5, vpHeight / 820)));

  // Board chrome hides; the presented frame and the bar stay. The frame is
  // centered in the viewport at the declared scale.
  assert.equal(await board.locator('.mp-canvas-controls').isVisible(), false);
  assert.equal(await board.locator('.mp-flybar').isVisible(), false);
  assert.equal(await board.locator('.mp-toolbar').isVisible(), false);
  assert.equal(await board.locator('.mp-header').isVisible(), false);
  assert.equal(await board.locator('.mp-status').isVisible(), false);
  assert.equal(await board.locator('.mp-footer').isVisible(), false);
  assert.equal(await page.locator('#screen-habits').isVisible(), false);
  const surface = await page.locator('#screen-habit').boundingBox();
  const viewport = page.viewportSize();
  assert.ok(surface && viewport);
  assert.equal(Math.round(surface.width), Math.round(390 * scale));
  assert.equal(Math.round(surface.height), Math.round(820 * scale));
  // Centered on the board viewport, which sits right of the studio side panel.
  const vpRect = await page.evaluate(() => {
    const r = document.querySelector('.mp-viewport')?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  });
  assert.ok(vpRect);
  assert.ok(Math.abs(surface.x + surface.width / 2 - vpRect.x - vpRect.width / 2) < 3, `Presented app surface x-center ${surface.x + surface.width / 2} != ${vpRect.x + vpRect.width / 2}`);
  assert.ok(Math.abs(surface.y + surface.height / 2 - vpRect.y - vpRect.height / 2) < 3, `Presented app surface y-center ${surface.y + surface.height / 2} != ${vpRect.y + vpRect.height / 2}`);

  // Left and Right step through declared screen order.
  await page.keyboard.press('ArrowRight');
  assert.equal(await presented(), 'stats');
  assert.match(await presentBar.innerText(), /5 \/ 7/);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await presented(), 'habit');

  // L and the present-bar toggle both switch scheme.
  const schemeButton = presentBar.getByRole('button', { name: /Scheme:/ });
  const before = await schemeButton.innerText();
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('l');
  const after = await schemeButton.innerText();
  assert.notEqual(after, before, `L during present should switch scheme (was ${before}, now ${after})`);
  await schemeButton.click();
  assert.equal(await schemeButton.innerText(), before);

  // Token editing stays off: the studio side panel (tokens tab included) is
  // unreachable while presenting -- it sits outside the board and the frame
  // overlay covers it.
  const tabsVisible = await page.getByRole('tab', { name: 'tokens', exact: true }).isVisible().catch(() => false);
  assert.equal(tabsVisible, false, 'tokens tab should not be visible while presenting');

  // Tapping inside the frame is a live app state change. The state log then
  // proves that the demonstration was recorded after the studio returns.
  const habitDetail = page.locator('#screen-habit');
  const countPattern = /(\d+) \/ 5/;
  const countTextBefore = await habitDetail.innerText();
  const countBefore = countTextBefore.match(countPattern)?.[1];
  assert.ok(countBefore);
  const habitStatus = habitDetail.getByText(/Logged for today|Not logged for today/).first();
  await habitStatus.waitFor();
  await habitStatus.click();
  await page.waitForFunction((patternSourceAndBefore) => {
    const [patternSource, before] = patternSourceAndBefore;
    const text = document.querySelector('#screen-habit')?.textContent ?? '';
    const match = text.match(new RegExp(patternSource));
    return match && match[1] !== before;
  }, [countPattern.source, countBefore]);
  assert.equal(await presented(), 'habit');

  // Exit by Escape restores the editor. Open the state tab and require the log
  // to render at all; Current State holds the habits tree reader.
  await page.keyboard.press('Escape');
  assert.equal(await board.getAttribute('data-presenting'), 'false');
  assert.equal(await board.locator('.mp-toolbar').isVisible(), true);
  await page.getByRole('tab', { name: 'state', exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('CURRENT STATE'));

  // P enters and exits; the last scheme survives re-entry. Focus leaves the
  // studio tab before the key fires.
  await board.locator('.mp-canvas-controls').getByRole('button', { name: 'Fit', exact: true }).click();
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('p');
  assert.equal(await board.getAttribute('data-presenting'), 'true');
  await page.keyboard.press('l');
  const darkIn = await presentBar.getByRole('button', { name: /Scheme:/ }).innerText();
  await page.keyboard.press('p');
  assert.equal(await board.getAttribute('data-presenting'), 'false');
  await page.keyboard.press('p');
  assert.equal(await presentBar.getByRole('button', { name: /Scheme:/ }).innerText(), darkIn);
  await presentBar.getByRole('button', { name: 'Exit', exact: true }).click();
  assert.equal(await board.getAttribute('data-presenting'), 'false');
  await page.waitForTimeout(250);
  assert.deepEqual(analyticsRequests, [], 'Present mode sent analytics requests.');

  assert.deepEqual(errors, [], 'Uncaught errors during the present-mode checks.');
  console.log('Present-mode checks passed: entry, exit, stepping, scheme controls, hidden chrome, live app state, and analytics silence.');
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
