import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { getComparator } from 'playwright-core/lib/utils';
import { createStaticServer } from '../scripts/static-files.mjs';
import {
  CAPTURE_CONTEXT,
  CAPTURE_SCREENSHOT,
  DIFF_OPTIONS,
  SCREENSHOT_CSS_HEIGHT,
  SCREENSHOT_CSS_WIDTH,
  SCREENSHOT_DIR,
  SCREENSHOT_PNG_HEIGHT,
  SCREENSHOT_PNG_WIDTH,
  SCREENSHOT_RECORD_PATH,
  buildScreenshotRecord,
  captureUrlFor,
  compareVerdict,
  parsePngSize,
  samePngBytes,
  updateRefusal,
} from '../mobile/src/ide/screenshotMatrix.ts';
import { checkRecordAndBaselines } from './baselines.ts';
import { currentPin, playwrightVersion } from './env.ts';
import { registryMatrix } from './registry.ts';
import {
  RESULTS_DIR,
  ROOT,
  headCommit,
  resetResults,
  run,
  uncommittedCaptureInputs,
  writeStatus,
} from './shared.mjs';

process.env.TZ = 'UTC';

const mode = process.argv[2];
if (mode !== 'compare' && mode !== 'update') {
  console.error('usage: node --experimental-strip-types vr/run.mjs compare|update');
  process.exit(2);
}

function stop(outcome, message, extra = {}) {
  writeStatus({ mode, outcome, message, ...extra });
  console.error(message);
  process.exit(1);
}

resetResults();
writeStatus({ mode, outcome: 'started' });

const pin = currentPin(ROOT);
if (mode === 'update') {
  const refusal = updateRefusal(pin);
  if (refusal) stop('refused', refusal);
} else {
  const verdict = compareVerdict(pin, process.env.VR_REQUIRE_COMPARE === '1');
  if (verdict.action === 'skip') {
    writeStatus({ mode, outcome: 'skipped', message: verdict.message });
    console.log(verdict.message);
    process.exit(0);
  }
  if (verdict.action === 'fail') stop('skipped', verdict.message);
}

const matrix = registryMatrix(ROOT);
if (matrix.length === 0) stop('failed', 'The screen registry produced no screenshot cases.');

if (mode === 'compare') {
  const check = checkRecordAndBaselines(ROOT, matrix);
  if (!check.ok) stop('failed', `Screenshot comparison failed before capture:\n- ${check.errors.join('\n- ')}`);
}

let sourceCommit = '';
if (mode === 'update') {
  const dirty = await uncommittedCaptureInputs();
  if (dirty.length) {
    stop(
      'refused',
      `vr:update refuses to record a source commit while capture inputs are uncommitted. Commit them first. No baselines were written.\n- ${dirty.join('\n- ')}`,
    );
  }
  sourceCommit = await headCommit();
}

const exportDir = join(ROOT, 'dist');
if (!existsSync(join(exportDir, 'ide.html'))) stop('failed', 'Run npm run export:web before the screenshot suite.');

const server = createStaticServer(exportDir, '');
await new Promise((done, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', done);
});
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

async function captureMatrix(browser) {
  const context = await browser.newContext({ ...CAPTURE_CONTEXT, viewport: { ...CAPTURE_CONTEXT.viewport } });
  const shots = new Map();
  try {
    for (const c of matrix) {
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      await page.goto(`${baseUrl}/ide${captureUrlFor(c)}`, { waitUntil: 'domcontentloaded' });
      const surface = page.locator(`#screen-${c.screen}[data-screenshot-ready="true"]`);
      await surface.waitFor();
      const box = await surface.boundingBox();
      if (!box || Math.round(box.width) !== SCREENSHOT_CSS_WIDTH || Math.round(box.height) !== SCREENSHOT_CSS_HEIGHT) {
        throw new Error(`${c.id}: the app surface is not ${SCREENSHOT_CSS_WIDTH} by ${SCREENSHOT_CSS_HEIGHT} CSS pixels`);
      }
      const shot = await surface.screenshot(CAPTURE_SCREENSHOT);
      const size = parsePngSize(shot);
      if (!size || size.width !== SCREENSHOT_PNG_WIDTH || size.height !== SCREENSHOT_PNG_HEIGHT) {
        throw new Error(`${c.id}: the capture is not ${SCREENSHOT_PNG_WIDTH} by ${SCREENSHOT_PNG_HEIGHT} pixels`);
      }
      shots.set(c.id, shot);
      await page.close();
    }
  } finally {
    await context.close();
  }
  return shots;
}

const compareImages = getComparator('image/png');
let exitCode = 0;
let browser;
try {
  browser = await chromium.launch();
  const first = await captureMatrix(browser);
  const second = await captureMatrix(browser);
  const unstable = [];
  for (const c of matrix) {
    const a = first.get(c.id);
    const b = second.get(c.id);
    if (samePngBytes(a, b)) continue;
    const result = compareImages(b, a, DIFF_OPTIONS);
    const dir = join(RESULTS_DIR, 'repeatability');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${c.id}-first.png`), a);
    writeFileSync(join(dir, `${c.id}-second.png`), b);
    if (result?.diff) writeFileSync(join(dir, `${c.id}-diff.png`), result.diff);
    unstable.push(`${c.id}: ${result?.errorMessage ?? 'the PNG bytes differ but the pixels match'}`);
  }
  if (unstable.length) {
    stop(
      'repeatability-failed',
      `Stop: two captures of an unchanged tree differ. Do not widen the threshold. Cause per case:\n- ${unstable.join('\n- ')}\nImages: test-results/vr/repeatability/`,
      { cases: unstable },
    );
  }

  if (mode === 'update') {
    mkdirSync(join(ROOT, SCREENSHOT_DIR), { recursive: true });
    for (const c of matrix) writeFileSync(join(ROOT, c.baseline), first.get(c.id));
    const record = buildScreenshotRecord({
      sourceCommit,
      playwrightVersion: playwrightVersion(ROOT),
      cases: matrix.map((screenshot) => ({ screenshot, bytes: first.get(screenshot.id).length })),
    });
    writeFileSync(join(ROOT, SCREENSHOT_RECORD_PATH), `${JSON.stringify(record, null, 2)}\n`);
    const message = `vr:update wrote ${matrix.length} baselines and the screenshot record for source commit ${sourceCommit}. Measured PNG weight: ${record.totalBytes} bytes. Review the PNGs and commit them yourself. This command does not commit.`;
    writeStatus({ mode, outcome: 'updated', message, totalBytes: record.totalBytes });
    console.log(message);
  } else {
    await browser.close();
    browser = undefined;
    const runner = await run(join(ROOT, 'node_modules/.bin/playwright'), ['test', '--config', 'playwright.config.ts'], {
      stdio: 'inherit',
      env: { ...process.env, TZ: 'UTC', VR_BASE_URL: baseUrl, VR_ROOT: ROOT },
    });
    exitCode = runner.code;
    const outcome = exitCode === 0 ? 'passed' : 'failed';
    writeStatus({ mode, outcome, message: `Playwright runner exited ${exitCode}.`, cases: matrix.length });
  }
} catch (error) {
  writeStatus({ mode, outcome: 'failed', message: String(error?.message ?? error) });
  console.error(error);
  exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}
process.exit(exitCode);
