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
  const presentBar = page.getByRole('toolbar', { name: 'Present bar' });
  const presented = () => board.getAttribute('data-presented');

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready();
  assert.deepEqual(errors, [], 'The exported board failed to hydrate.');

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
  assert.equal(await page.locator('#screen-habits').isVisible(), false);
  const phone = await page.locator('#screen-habit').boundingBox();
  const viewport = page.viewportSize();
  assert.ok(phone && viewport);
  assert.equal(Math.round(phone.width), Math.round(390 * scale));
  assert.equal(Math.round(phone.height), Math.round(820 * scale));
  // Centered on the board viewport, which sits right of the studio side panel.
  const vpRect = await page.evaluate(() => {
    const r = document.querySelector('.mp-viewport')?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  });
  assert.ok(vpRect);
  assert.ok(Math.abs(phone.x + phone.width / 2 - vpRect.x - vpRect.width / 2) < 3, `Presented phone x-center ${phone.x + phone.width / 2} != ${vpRect.x + vpRect.width / 2}`);
  assert.ok(Math.abs(phone.y + phone.height / 2 - vpRect.y - vpRect.height / 2) < 3, `Presented phone y-center ${phone.y + phone.height / 2} != ${vpRect.y + vpRect.height / 2}`);

  // Left and Right step through declared screen order.
  await page.keyboard.press('ArrowRight');
  assert.equal(await presented(), 'stats');
  assert.match(await presentBar.innerText(), /5 \/ 7/);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await presented(), 'habit');

  // L switches scheme; stepping worked, so the keyboard path is live -- if the
  // scheme does not flip, the failure is real, not focus.
  const schemeButton = presentBar.getByRole('button', { name: /Scheme:/ });
  const before = await schemeButton.getAttribute('aria-pressed');
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('l');
  const after = await schemeButton.getAttribute('aria-pressed');
  assert.notEqual(after, before, `L during present should switch scheme (was ${before}, now ${after})`);
  const afterL = await schemeButton.getAttribute('aria-pressed');
  await schemeButton.click();
  assert.notEqual(await schemeButton.getAttribute('aria-pressed'), afterL);

  // Token editing stays off: the tokens tab is unreachable while presenting.
  assert.equal(await page.getByRole('tab', { name: 'tokens', exact: true }).isVisible(), false);

  // The state log keeps recording: tapping inside the frame navigates, the
  // camera follows, and the pressed action reaches the log.
  await page.locator('#screen-habit').getByText('Back', { exact: true }).click();
  assert.equal(await presented(), 'index');

  // Exit from the bar restores the editor.
  await presentBar.getByRole('button', { name: 'Exit', exact: true }).click();
  assert.equal(await board.getAttribute('data-presenting'), 'false');
  assert.equal(await board.locator('.mp-toolbar').isVisible(), true);

  // P enters, Escape exits, and the last scheme survives exit.
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('p');
  assert.equal(await board.getAttribute('data-presenting'), 'true');
  await page.keyboard.press('l');
  const darkIn = await presentBar.getByRole('button', { name: /Scheme:/ }).getAttribute('aria-pressed');
  await page.keyboard.press('Escape');
  assert.equal(await board.getAttribute('data-presenting'), 'false');
  await page.keyboard.press('p');
  assert.equal(await presentBar.getByRole('button', { name: /Scheme:/ }).getAttribute('aria-pressed'), darkIn);
  await page.keyboard.press('Escape');
  assert.equal(await board.getAttribute('data-presenting'), 'false');

  assert.deepEqual(errors, [], 'Uncaught errors during the present-mode checks.');
  console.log('Present-mode checks passed: entry, exit, stepping, scheme, hidden chrome, live app.');
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
