import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { chromium } from 'playwright';
import { createStaticServer } from '../scripts/static-files.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exportDir = resolve(ROOT, process.argv[2] ?? 'dist');
const basePath = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
assert.ok(
  existsSync(resolve(exportDir, 'ide.html')),
  'Run npm run export:web before the capture-mode checks.',
);

const encodeShare = (json) =>
  deflateSync(Buffer.from(JSON.stringify(json)))
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const server = createStaticServer(exportDir, basePath);
let browser;
try {
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(Number(process.env.PORT ?? process.env.PASEO_PORT ?? 0), '127.0.0.1', done);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}${basePath}/ide`;
  browser = await chromium.launch();

  const analyticsRequests = [];
  const attachAnalyticsGuard = async (page) => {
    await page.route(/mixpanel\.com/, async (route) => {
      analyticsRequests.push(route.request().url());
      await route.abort();
    });
  };

  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'reduce',
    });
    await context.addInitScript(() => {
      window.__firstHabitPaintText = null;
      window.__sawEmptyState = false;
      const check = () => {
        const el = document.querySelector('[data-capture-surface="true"]');
        const text = el?.textContent?.trim() ?? '';
        if (text.includes('No habit selected')) {
          window.__sawEmptyState = true;
        }
        if (window.__firstHabitPaintText === null && text.length > 0) {
          window.__firstHabitPaintText = text;
        }
      };
      const start = () => {
        if (!document.documentElement) {
          requestAnimationFrame(start);
          return;
        }
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      };
      start();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await attachAnalyticsGuard(page);

    await page.goto(`${baseUrl}?capture=1&screen=habit&scheme=light&state=populated`, {
      waitUntil: 'domcontentloaded',
    });
    const surface = page.locator('#screen-habit[data-screenshot-ready="true"]');
    await surface.waitFor();

    const firstPaintText = await page.evaluate(() => window.__firstHabitPaintText);
    const sawEmptyState = await page.evaluate(() => window.__sawEmptyState);
    assert.ok(
      firstPaintText && firstPaintText.includes('Morning run'),
      `Expected Morning run on first paint, got: ${firstPaintText}`,
    );
    assert.equal(
      sawEmptyState,
      false,
      'Populated Habit detail must never flash the empty state before first paint.',
    );

    const box = await surface.boundingBox();
    assert.ok(box);
    assert.equal(Math.round(box.width), 390);
    assert.equal(Math.round(box.height), 820);

    const scale = await surface.evaluate((el) => {
      const transform = getComputedStyle(el).transform;
      return !transform || transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a;
    });
    assert.equal(scale, 1);

    assert.equal(await page.locator('[id^="screen-"]').count(), 1);
    assert.equal(await page.locator('.mp-header').count(), 0);
    assert.equal(await page.locator('.mp-footer').count(), 0);
    assert.equal(await page.locator('.mp-toolbar').count(), 0);
    assert.equal(await page.locator('.mp-flybar').count(), 0);
    assert.equal(await page.locator('.mp-canvas-controls').count(), 0);
    assert.equal(await page.locator('[role="tab"]').count(), 0);
    assert.equal(await page.locator('#capture-error').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await attachAnalyticsGuard(page);

    await page.goto(`${baseUrl}?capture=1&screen=habit&scheme=dark&state=empty`, {
      waitUntil: 'domcontentloaded',
    });
    const surface = page.locator('#screen-habit[data-screenshot-ready="true"]');
    await surface.waitFor();
    const text = await surface.innerText();
    assert.match(text, /No habit selected/);
    assert.doesNotMatch(text, /Morning run/);
    assert.equal(await page.locator('#capture-error').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await attachAnalyticsGuard(page);

    const poisonedLink = encodeShare({
      v: 1,
      p: 1,
      s: 'login',
      c: 'light',
      o: { 'color.dark.bg': '#0A1428', 'color.light.bg': '#0A1428' },
    });
    await page.goto(
      `${baseUrl}?capture=1&screen=index&scheme=dark&state=populated#s=${poisonedLink}`,
      { waitUntil: 'domcontentloaded' },
    );
    const surface = page.locator('#screen-index[data-screenshot-ready="true"]');
    await surface.waitFor();

    const hasPoisonedBg = await surface.evaluate((el) => {
      const walk = (node) =>
        getComputedStyle(node).backgroundColor === 'rgb(10, 20, 40)' ||
        [...node.children].some(walk);
      return walk(el);
    });
    assert.equal(hasPoisonedBg, false, 'Capture mode must ignore shared link token overrides.');

    const hasCommittedDarkBg = await surface.evaluate((el) => {
      const walk = (node) =>
        getComputedStyle(node).backgroundColor === 'rgb(25, 21, 18)' ||
        [...node.children].some(walk);
      return walk(el);
    });
    assert.equal(hasCommittedDarkBg, true, 'Capture mode must render committed dark tokens.');

    const meterScales = await surface.evaluate((el) => {
      const scales = [];
      for (const node of el.querySelectorAll('*')) {
        const match = /scaleX\(([^)]+)\)/.exec(node.style.transform || '');
        if (match) scales.push(Number.parseFloat(match[1]));
      }
      return scales;
    });
    assert.deepEqual(meterScales, [0.8, 0.86, 0.5, 0.43, 1, 0.2]);
    assert.deepEqual(errors, []);
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'reduce',
    });
    const errors = [];
    const SCREENS = ['login', 'index', 'habits', 'habit', 'stats', 'profile', 'settings'];
    const METERS = {
      habit: [0.8],
      index: [0.8, 0.86, 0.5, 0.43, 1, 0.2],
      stats: [0.8, 0.86, 0.5, 0.43, 1, 0.2],
      habits: [0.8, 0.43, 0.86, 1, 0.5, 0.2],
    };
    const matrix = [
      ...SCREENS.flatMap((screen) =>
        ['light', 'dark'].map((scheme) => ({ screen, scheme, state: 'populated' })),
      ),
      { screen: 'habit', scheme: 'light', state: 'empty' },
      { screen: 'habit', scheme: 'dark', state: 'empty' },
    ];
    assert.equal(matrix.length, 16);
    for (const { screen, scheme, state } of matrix) {
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', (error) => errors.push(`${screen}/${scheme}/${state}: ${error.message}`));
      await attachAnalyticsGuard(page);
      await page.goto(`${baseUrl}?capture=1&screen=${screen}&scheme=${scheme}&state=${state}`, {
        waitUntil: 'domcontentloaded',
      });
      const surface = page.locator(`#screen-${screen}[data-screenshot-ready="true"]`);
      await surface.waitFor();
      const box = await surface.boundingBox();
      assert.ok(box);
      assert.equal(Math.round(box.width), 390);
      assert.equal(Math.round(box.height), 820);
      const scales = await surface.evaluate((el) =>
        [...el.querySelectorAll('*')].flatMap((node) => {
          const match = /scaleX\(([^)]+)\)/.exec(node.style.transform || '');
          return match ? [Number.parseFloat(match[1])] : [];
        }),
      );
      const expected = state === 'empty' ? [] : (METERS[screen] ?? []);
      assert.deepEqual(scales, expected, `${screen}/${scheme}/${state} Meter scales`);
      assert.equal(await page.locator('#capture-error').count(), 0);
      await page.close();
    }
    assert.deepEqual(errors, []);
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1100 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await attachAnalyticsGuard(page);
    await page.goto(`${baseUrl}?scheme=dark&screen=habit`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('[data-layout-ready="true"]'));
    assert.equal(await page.locator('[data-capture-mode]').count(), 0);
    assert.equal(await page.locator('#capture-error').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  const invalidCases = [
    {
      query: '?capture&screen=habit&scheme=light&state=populated',
      pattern: /capture=1/,
    },
    {
      query: '?capture=0&screen=habit&scheme=light&state=populated',
      pattern: /capture=1/,
    },
    {
      query: '?capture=1&screen=unknown&scheme=light&state=populated',
      pattern: /does not know the requested screen/,
    },
    {
      query: '?capture=1&screen=habit&scheme=sepia&state=populated',
      pattern: /does not know the requested colour scheme/,
    },
    {
      query: '?capture=1&screen=habit&scheme=light&state=half',
      pattern: /does not know the requested state/,
    },
    {
      query: '?capture=1&screen=stats&scheme=light&state=empty',
      pattern: /only for the Habit detail screen/,
    },
  ];

  for (const testCase of invalidCases) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await attachAnalyticsGuard(page);

    await page.goto(`${baseUrl}${testCase.query}`, { waitUntil: 'domcontentloaded' });
    const alert = page.locator('#capture-error[role="alert"]');
    await alert.waitFor();
    assert.match(await alert.innerText(), testCase.pattern);
    assert.equal(await page.locator('[data-screenshot-ready="true"]').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await attachAnalyticsGuard(page);

    await page.goto(`${baseUrl}?capture=1&screen=habit&scheme=light&state=populated`, {
      waitUntil: 'domcontentloaded',
    });
    const alert = page.locator('#capture-error[role="alert"]');
    await alert.waitFor();
    assert.match(await alert.innerText(), /prefers-reduced-motion/);
    assert.equal(await page.locator('[data-screenshot-ready="true"]').count(), 0);
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await attachAnalyticsGuard(page);
    await page.route(/SplineSans/i, (route) => route.abort());

    await page.goto(`${baseUrl}?capture=1&screen=habit&scheme=light&state=populated`, {
      waitUntil: 'domcontentloaded',
    });
    const alert = page.locator('#capture-error[role="alert"]');
    await alert.waitFor();
    assert.match(await alert.innerText(), /Spline Sans/);
    assert.equal(await page.locator('[data-screenshot-ready="true"]').count(), 0);
    await context.close();
  }

  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await attachAnalyticsGuard(page);

    await page.goto(`${baseUrl}?capture=1&screen=habit&scheme=light&state=populated`, {
      waitUntil: 'domcontentloaded',
    });
    await page.locator('#screen-habit[data-screenshot-ready="true"]').waitFor();
    await page.evaluate(() => {
      const broken = document.createElement('img');
      broken.src = 'data:image/gif;base64,invalid';
      document.querySelector('#screen-habit')?.appendChild(broken);
    });
    const alert = page.locator('#capture-error[role="alert"]');
    await alert.waitFor();
    assert.match(await alert.innerText(), /failed image/);
    assert.equal(await page.locator('[data-screenshot-ready="true"]').count(), 0);
    await context.close();
  }

  assert.deepEqual(analyticsRequests, [], 'Capture mode sent analytics requests.');
  console.log(
    'Capture-mode checks passed: all 16 matrix cases ready, first-paint fixture, 390x820 scale-1 surface, hash/override isolation, inactive query, invalid request diagnostics, font/image/reduced-motion gates, and analytics silence.',
  );
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
