import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createStaticServer } from '../scripts/static-files.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = resolve(ROOT, process.argv[2] ?? 'dist');
const basePath = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const POSITION_KEY = 'streak-studio.midpoints.frame-positions';
assert.ok(existsSync(resolve(exportDir, 'ide.html')), 'Run npm run export:web before the board checks.');

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
  const edge = (id) => board.locator(`[data-connection="${id}"]`);
  const status = board.locator('.mp-status');
  const fit = board.getByRole('button', { name: 'Fit', exact: true });
  const resetLayout = board.getByRole('button', { name: 'Reset layout', exact: true });
  const resetSession = board.getByRole('button', { name: 'Reset session', exact: true });
  const ready = () => page.waitForFunction(() => document.querySelector('[data-layout-ready="true"]'));
  const fly = async (name) => {
    await board.getByRole('group', { name: 'Fly to screen' }).getByRole('button', { name, exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.mp-world')?.dataset.flying === 'false');
  };
  const centeredOn = (key) => page.waitForFunction((key) => {
    const frame = document.getElementById(`screen-${key}`)?.getBoundingClientRect();
    const viewport = document.querySelector('.mp-viewport')?.getBoundingClientRect();
    return frame && viewport &&
      Math.abs(frame.x + frame.width / 2 - viewport.x - viewport.width / 2) < 2 &&
      Math.abs(frame.y + frame.height / 2 - viewport.y - viewport.height / 2) < 2;
  }, key);
  const preview = async (label) => {
    await board.getByRole('combobox', { name: 'Preview route' }).selectOption({ label });
    await board.getByRole('button', { name: 'Preview →', exact: true }).click();
  };
  const position = (key) => page.locator(`#mp-frame-${key}`).evaluate((el) => ({ x: el.style.left, y: el.style.top }));
  const storedPositions = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), POSITION_KEY);
  const camera = () => board.locator('.mp-world').evaluate((el) => el.style.transform);
  const drag = async (handle, dx, dy, cancel = false, shift = false) => {
    const box = await handle.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
  };

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await ready();
  assert.deepEqual(errors, [], 'The exported board failed to hydrate.');
  assert.equal(await edge('login:index').locator('title').textContent(), 'Login → Today: Sign in. Declared.');
  assert.equal(page.url(), url);
  const frameIds = await board.locator('.mp-phone').evaluateAll((els) => els.map((el) => el.id));
  assert.deepEqual(frameIds, ['screen-login', 'screen-index', 'screen-habits', 'screen-habit', 'screen-stats', 'screen-profile', 'screen-settings']);
  assert.equal(await board.locator('[data-connection]').count(), 7);
  assert.equal(await board.locator('[data-evidence="observed"]').count(), 0);
  const geometry = await board.locator('[data-connection]').evaluateAll((els) => els.map((el) => ({
    direct: el.getAttribute('data-direct') === 'true',
    path: el.querySelectorAll('path')[1].getAttribute('d'),
    dash: el.querySelectorAll('path')[1].getAttribute('stroke-dasharray'),
    lane: el.querySelector('text').getAttribute('y'),
  })));
  for (const connection of geometry) {
    assert.equal(connection.dash, '10 10');
    assert.equal(connection.path.includes('Q'), !connection.direct);
  }
  const lanes = geometry.filter((connection) => !connection.direct).map((connection) => connection.lane);
  assert.equal(new Set(lanes).size, lanes.length);
  await page.getByRole('switch', { name: 'Compare current tokens against the tokens at HEAD' }).waitFor();
  await page.getByText('no committed baseline', { exact: true }).waitFor();

  await page.getByRole('tab', { name: 'state', exact: true }).click();
  const logBeforePreview = await page.locator('body').innerText();
  await board.locator('.mp-preview-controls').getByRole('button', { name: 'Back', exact: true }).click();
  assert.match(await status.innerText(), /no back destination/);
  await preview('Today → Habit detail · Open habit');
  assert.equal(await edge('index:habit').getAttribute('data-evidence'), 'declared');
  assert.equal(await edge('index:habit').getAttribute('data-active'), 'true');
  assert.equal((await page.locator('body').innerText()).includes('route index → /habit'), logBeforePreview.includes('route index → /habit'));
  await fly('Habit detail');
  await page.locator('#screen-habit').getByText('Back', { exact: true }).click();
  assert.match(await status.innerText(), /no back destination/);
  assert.equal(await board.locator('[data-active="true"][data-connection]').count(), 0);

  await fly('Today');
  await page.locator('#screen-index').getByText('Morning run', { exact: true }).click();
  await page.getByText('route index → /habit', { exact: true }).waitFor();
  await centeredOn('habit');
  assert.equal(await edge('index:habit').getAttribute('data-evidence'), 'observed');
  assert.equal(await edge('index:habit').locator('path').nth(1).getAttribute('stroke-dasharray'), null);
  await fit.click();
  assert.equal(await edge('index:habit').getAttribute('data-active'), 'true');
  await fly('Habit detail');
  await page.locator('#screen-habit').getByText('Back', { exact: true }).click();
  await page.getByText('route habit → /', { exact: true }).waitFor();
  await centeredOn('index');
  assert.equal(await edge('habit:index').getAttribute('data-active'), 'true');
  assert.equal(await edge('index:habit').getAttribute('data-active'), 'false');

  await fly('All habits');
  await page.locator('#screen-habits').getByText('Morning run', { exact: true }).click();
  await fly('Habit detail');
  await page.locator('#screen-habit').getByText('Back', { exact: true }).click();
  await page.getByText('route habit → /habits', { exact: true }).waitFor();
  assert.equal(await edge('habit:habits').getAttribute('data-direct'), 'true');
  const outgoing = await edge('habits:habit').locator('path').nth(1).getAttribute('d');
  const incoming = await edge('habit:habits').locator('path').nth(1).getAttribute('d');
  assert.notEqual(outgoing, incoming);
  assert.notEqual(await edge('habits:habit').locator('text').getAttribute('y'), await edge('habit:habits').locator('text').getAttribute('y'));

  await fly('Today');
  await page.locator('#screen-index').getByText('Habits', { exact: true }).click();
  await page.getByText('route index → /habits', { exact: true }).waitFor();
  await centeredOn('habits');
  assert.equal(await edge('index:habits').getAttribute('data-evidence'), 'observed');
  assert.equal(await board.getByRole('button', { name: /Include tabs/ }).getAttribute('aria-pressed'), 'true');
  await board.getByRole('button', { name: /App actions/ }).click();
  await resetSession.click();
  await page.waitForFunction(() => document.querySelectorAll('[data-evidence="observed"]').length === 0);
  await page.getByText('route index → /habit', { exact: true }).waitFor();
  await fly('Habit detail');
  await page.locator('#screen-habit').getByText('Back', { exact: true }).click();
  assert.match(await status.innerText(), /no back destination/);
  assert.equal(page.url(), url);

  await resetLayout.click();
  await fly('Today');
  const handle = board.getByRole('button', { name: 'Move Today frame', exact: true });
  const originalPosition = await position('index');
  const pathBeforeDrag = await edge('index:habit').locator('path').nth(1).getAttribute('d');
  await page.mouse.move(1, 1);
  assert.equal(await handle.locator('.mp-grip').evaluate((el) => getComputedStyle(el).opacity), '0');
  await handle.focus();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#mp-frame-index .mp-grip')).opacity) > 0);
  await handle.press('ArrowRight');
  assert.equal((await storedPositions()).index.x, 16);
  await handle.press('Shift+ArrowDown');
  assert.equal((await storedPositions()).index.y, 48);
  await handle.press('Home');
  assert.deepEqual(await position('index'), originalPosition);
  await drag(handle, 80, 25, false, true);
  const movedPosition = await position('index');
  assert.notEqual(movedPosition.x, originalPosition.x);
  assert.equal(movedPosition.y, originalPosition.y);
  assert.notEqual(await edge('index:habit').locator('path').nth(1).getAttribute('d'), pathBeforeDrag);
  await drag(handle, 25, 25, true);
  assert.deepEqual(await position('index'), movedPosition);
  await drag(page.locator('#mp-frame-index .mp-frame-footnote'), 0, 30);
  const afterFooter = await position('index');
  assert.notEqual(afterFooter.y, movedPosition.y);
  const saved = await storedPositions();
  const beforeFit = await camera();
  await fit.click();
  assert.deepEqual(await storedPositions(), saved);
  assert.notEqual(await camera(), beforeFit);
  await resetSession.click();
  assert.deepEqual(await storedPositions(), saved);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready();
  assert.deepEqual(errors, [], 'The exported board failed to hydrate after reload.');
  assert.deepEqual(await storedPositions(), saved);
  assert.deepEqual(await position('index'), afterFooter);
  assert.deepEqual(await board.locator('.mp-phone').evaluateAll((els) => els.map((el) => el.id)), frameIds);
  await fly('Today');
  const centered = await page.locator('#screen-index').boundingBox();
  const viewport = await board.locator('.mp-viewport').boundingBox();
  assert.ok(centered && viewport);
  assert.ok(Math.abs(centered.x + centered.width / 2 - viewport.x - viewport.width / 2) < 2);
  assert.ok(Math.abs(centered.y + centered.height / 2 - viewport.y - viewport.height / 2) < 2);
  assert.equal(await board.locator('.mp-world').evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
  await resetLayout.click();
  await page.waitForFunction((key) => localStorage.getItem(key) === null, POSITION_KEY);
  assert.deepEqual(await position('index'), originalPosition);
  assert.equal(await fit.getAttribute('aria-pressed'), 'true');
  assert.equal(await resetLayout.isDisabled(), true);

  await fly('Today');
  await page.getByRole('tab', { name: 'tokens', exact: true }).click();
  const token = page.locator('input[type="color"]').first();
  await token.fill('#123456');
  await page.waitForFunction(() => [...document.querySelectorAll('#screen-index *')].some((el) => getComputedStyle(el).color === 'rgb(18, 52, 86)' || getComputedStyle(el).backgroundColor === 'rgb(18, 52, 86)'));
  await page.getByRole('tab', { name: 'routes', exact: true }).click();
  await page.getByText('pick a frame to narrow the list and highlight it on the board', { exact: true }).waitFor();
  await page.getByText('Today', { exact: true }).first().click();
  await page.waitForFunction(() => document.querySelector('#mp-frame-index')?.dataset.focused === 'true');
  await page.getByRole('tab', { name: 'baseline', exact: true }).click();
  await page.getByText('no token server, so nothing to compare against', { exact: true }).waitFor();
  await board.locator('summary').filter({ hasText: 'Studio evidence' }).click();
  await page.getByText(/7 of 7 frames read/).first().waitFor();
  await page.getByText(/^measured in this browser, not read from a file:.*on 7 screens/).waitFor();
  await page.locator('#control-inventory').getByText(/Current frames use board navigation/).waitFor();
  await board.locator('summary').filter({ hasText: 'Studio evidence' }).click();
  await page.getByRole('tab', { name: 'state', exact: true }).click();
  const today = page.locator('#screen-index');
  const habit = today.locator('[tabindex="0"]').filter({ has: page.getByText('Morning run', { exact: true }) });
  await habit.getByText('✓', { exact: true }).waitFor();
  await habit.locator('[tabindex="0"]').click();
  await habit.getByText('✓', { exact: true }).waitFor({ state: 'detached' });
  await page.getByText(/habits.*done/).first().waitFor();
  assert.deepEqual(errors, [], 'The exported board reported browser errors.');
  console.log('Exported board checks passed: routes, history, movement, camera, persistence, and studio panels.');
  await context.close();
} finally {
  await browser?.close();
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
}
