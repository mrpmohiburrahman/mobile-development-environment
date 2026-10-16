// Browser check for the studio Analytics tab.
//
// Builds two static exports, serves them, and drives the normal /ide entry.
// One export has a test token. The other has none. Neither may call Mixpanel.
//
// Usage: node browser/analytics-tab.mjs

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
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

function exportWeb(dir, extraEnv) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // Metro stores transforms in os.tmpdir()/metro-cache and does not key that cache
  // by EXPO_PUBLIC_* values. A shared cache inlines the first export's empty token
  // into the second. A private TMPDIR keeps the two builds apart, including from
  // any other export running on this machine.
  const tmp = `${dir}.tmp`;
  mkdirSync(tmp, { recursive: true });
  const env = {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
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

async function openStudio(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const hits = [];
  const note = (requestUrl) => {
    const host = new URL(requestUrl).hostname;
    if (host === 'mixpanel.com' || host.endsWith('.mixpanel.com')) hits.push(requestUrl);
  };
  await page.route(
    (requestUrl) => HOSTS.includes(requestUrl.hostname) || requestUrl.hostname.endsWith('.mixpanel.com'),
    async (route) => {
      note(route.request().url());
      await route.abort();
    },
  );
  page.on('request', (request) => note(request.url()));
  await page.goto(`${url}/ide`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'analytics' }).click();
  await page.locator('#analytics-note').waitFor();
  return { page, hits };
}

async function appActions(page) {
  const today = page.locator('#screen-index');
  await today.waitFor();
  // Week marks are also ✓ and are not controls. The completion control is the
  // pressable whose only text is the check, in the same card as the habit name.
  const toggle = today.locator('[tabindex="0"]').filter({ hasText: /^✓$/ }).first();
  if ((await toggle.count()) < 1) throw new Error('Today has no completed habit to toggle');
  await toggle.click();
  await page.waitForFunction(() => {
    const root = document.querySelector('#screen-index');
    const name = [...(root?.querySelectorAll('*') ?? [])].find(
      (el) => el.childNodes.length === 1 && el.textContent === 'Morning run',
    );
    const card = name?.closest('[tabindex="0"]');
    return card != null && !card.textContent.includes('✓');
  });
  await today.getByText('Morning run', { exact: true }).click();
  await page.getByRole('tab', { name: 'state' }).click();
  await page.getByText('→ /habit').first().waitFor();
  await today.getByText('Habits', { exact: true }).click();
  await page.locator('#screen-profile').getByText('Sign out', { exact: true }).click();
  await today.getByText('Sign in', { exact: true }).waitFor();
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
  const { page, hits } = await openStudio(browser, url);
  try {
    await assertBoundary(page, { configured });
    await appActions(page);
    await assertBoundary(page, { configured });
    if (hits.length !== 0) {
      throw new Error(`Mixpanel requests: ${hits.length}`);
    }
  } finally {
    await page.close();
  }
}

const absentDir = resolve(OUT, 'absent');
const configuredDir = resolve(OUT, 'configured');

await exportWeb(absentDir, {
  EXPO_PUBLIC_MIXPANEL_TOKEN: '',
  EXPO_PUBLIC_MIXPANEL_REGION: '',
});
await exportWeb(configuredDir, {
  EXPO_PUBLIC_MIXPANEL_TOKEN: TOKEN,
  EXPO_PUBLIC_MIXPANEL_REGION: 'us',
});

const absent = await listen(absentDir);
const configured = await listen(configuredDir);
const browser = await chromium.launch();
try {
  await check(browser, absent.url, false);
  await check(browser, configured.url, true);
  console.log('analytics tab: studio sent nothing; absent token is visible; actions still work');
} finally {
  await browser.close();
  absent.server.close();
  configured.server.close();
}
