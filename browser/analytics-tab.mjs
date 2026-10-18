import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createStaticServer } from '../scripts/static-files.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'browser/out');
const TOKEN = 'test-token-not-for-display-19';
const PROJECT = 'https://mixpanel.com/project/4074212';
const BOUNDARY = 'Analytics come from the app on a device or simulator. This studio sends nothing.';
const NOT_CONFIGURED = 'Mixpanel: not configured';
const HOSTS = ['api.mixpanel.com', 'api-eu.mixpanel.com', 'api-in.mixpanel.com'];
const NETWORK_OBSERVATION_MS = 1000;

function exportWeb(dir, extraEnv) {
  const tmp = `${dir}.tmp`;
  mkdirSync(tmp, { recursive: true });
  const env = {
    ...process.env,
    CI: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_NO_DOTENV: '1',
    EXPO_BASE_URL: '',
    EXPO_PUBLIC_TOKEN_SERVER: 'http://127.0.0.1:9',
    TMPDIR: tmp,
    ...extraEnv,
  };
  return new Promise((done, reject) => {
    const child = spawn('npx', ['expo', 'export', '--platform', 'web', '--output-dir', dir], {
      cwd: resolve(ROOT, 'mobile'),
      env,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`expo export exited ${code} for ${dir}`));
        return;
      }
      if (!existsSync(resolve(dir, 'ide.html'))) {
        reject(new Error(`expo export wrote no ide.html in ${dir}`));
        return;
      }
      done();
    });
  });
}

function listen(dir) {
  const server = createStaticServer(dir);
  return new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('static server has no port'));
        return;
      }
      done({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function studioActions(page) {
  const today = page.locator('#screen-index');
  const habit = today.locator('[tabindex="0"]').filter({
    has: page.getByText('Morning run', { exact: true }),
  });
  const checkmark = habit.getByText('✓', { exact: true });
  await checkmark.waitFor();
  await habit.locator('[tabindex="0"]').click();
  await checkmark.waitFor({ state: 'detached' });
  await today.getByText('Morning run', { exact: true }).click();
  await page.locator('#screen-habit').getByText('Morning run', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'state', exact: true }).click();
  await page.getByText('route index → /habit', { exact: true }).waitFor();
  await today.getByText('MR', { exact: true }).click();
  await page.getByText('route index → /profile', { exact: true }).waitFor();
  await page.locator('#screen-profile').getByText('Sign out', { exact: true }).click();
  await today.getByText('Sign in', { exact: true }).waitFor();
  await page.getByText('route profile → /login', { exact: true }).waitFor();
  await today.getByText('Sign in', { exact: true }).click();
  await today.getByText('Morning run', { exact: true }).waitFor();
}

async function appActions(page, url) {
  const text = (value) => page.getByText(value, { exact: true })
    .and(page.locator(':not([aria-hidden="true"] *)'))
    .filter({ visible: true });
  await page.goto(`${url}/`, { waitUntil: 'domcontentloaded' });
  await text('Morning run').click();
  await page.waitForURL(`${url}/habit`);
  await text('Logged for today · tap to undo').click();
  await text('Mark done today').waitFor();
  await text('Back').click();
  await page.waitForURL(`${url}/`);
  await text('Habits').click();
  await page.waitForURL(`${url}/habits`);
  await text('All habits').waitFor();
  await text('Profile').click();
  await page.waitForURL(`${url}/profile`);
  await text('Sign out').click();
  await page.waitForURL(`${url}/login`);
  await text('Sign in').click();
  await page.waitForURL(`${url}/`);
  await text('Morning run').waitFor();
}

async function assertNoRequests(page, hits) {
  await page.waitForTimeout(NETWORK_OBSERVATION_MS);
  assert.equal(hits.length, 0, 'The browser sent analytics requests.');
}

async function assertBoundary(page, { configured }) {
  await page.getByRole('tab', { name: 'analytics' }).click();
  const note = page.locator('#analytics-note');
  await note.getByText(BOUNDARY).waitFor();
  const link = note.locator(`a[href="${PROJECT}"]`);
  if ((await link.count()) !== 1) throw new Error('Mixpanel project link is missing');
  const text = await note.innerText();
  if (text.includes(TOKEN)) throw new Error('the Analytics tab shows the token');
  const body = await page.locator('body').innerText();
  if (body.includes(TOKEN)) throw new Error('the studio shows the token');
  if ((await note.locator('iframe').count()) !== 0) throw new Error('the Analytics tab embeds a frame');
  if (configured) {
    if (text.includes(NOT_CONFIGURED)) throw new Error('a configured build still says not configured');
    if (!text.includes('does not prove')) throw new Error('a configured web build does not say that it proves nothing');
  } else if (!text.includes(NOT_CONFIGURED)) {
    throw new Error('an absent token does not say Mixpanel: not configured');
  }
}

async function check(browser, url, configured) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const hits = [];
  const errors = [];
  const isMixpanel = (host) => host === 'mixpanel.com' || host.endsWith('.mixpanel.com');
  context.on('request', (request) => {
    const host = new URL(request.url()).hostname;
    if (isMixpanel(host)) hits.push(host);
  });
  context.on('page', (page) => page.on('pageerror', () => errors.push(true)));
  try {
    await context.route((requestUrl) => isMixpanel(requestUrl.hostname), (route) => route.abort());
    const probe = await context.newPage();
    await probe.evaluate(async (hosts) => {
      await Promise.all(hosts.map((host) => fetch(`https://${host}/track`).catch(() => {})));
    }, HOSTS);
    assert.deepEqual([...new Set(hits)].sort(), [...HOSTS].sort(), 'The interception check failed.');
    await probe.close();
    hits.length = 0;

    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${url}/ide`, { waitUntil: 'domcontentloaded' });
    await assertBoundary(page, { configured });
    await studioActions(page);
    await assertBoundary(page, { configured });
    await assertNoRequests(page, hits);
    await appActions(page, url);
    await assertNoRequests(page, hits);
    await page.goto(`${url}/ide`, { waitUntil: 'domcontentloaded' });
    await assertBoundary(page, { configured });
    await assertNoRequests(page, hits);
    assert.equal(errors.length, 0, 'The browser reported JavaScript errors.');
    console.log(`Analytics check passed: ${configured ? 'configured' : 'absent'} token, studio and app actions, zero requests.`);
  } finally {
    await context.close();
  }
}

mkdirSync(OUT, { recursive: true });
const runDir = mkdtempSync(resolve(OUT, 'analytics-'));
const servers = [];
let browser;
try {
  const absentDir = resolve(runDir, 'absent');
  const configuredDir = resolve(runDir, 'configured');
  await exportWeb(absentDir, {
    EXPO_PUBLIC_MIXPANEL_TOKEN: '',
    EXPO_PUBLIC_MIXPANEL_REGION: '',
  });
  await exportWeb(configuredDir, {
    EXPO_PUBLIC_MIXPANEL_TOKEN: TOKEN,
    EXPO_PUBLIC_MIXPANEL_REGION: 'us',
  });
  const absent = await listen(absentDir);
  servers.push(absent.server);
  const configured = await listen(configuredDir);
  servers.push(configured.server);
  browser = await chromium.launch();
  await check(browser, absent.url, false);
  await check(browser, configured.url, true);
} finally {
  try {
    await Promise.all([
      browser?.close(),
      ...servers.map((server) => new Promise((done, reject) => {
        server.close((error) => error ? reject(error) : done());
      })),
    ]);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
}
