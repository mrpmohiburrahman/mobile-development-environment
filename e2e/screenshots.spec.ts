import { test, expect } from 'playwright/test';
import {
  CAPTURE_CONTEXT,
  CAPTURE_SCREENSHOT,
  DIFF_OPTIONS,
  SCREENSHOT_CSS_HEIGHT,
  SCREENSHOT_CSS_WIDTH,
  SKIP_MESSAGE,
  captureUrlFor,
} from '../mobile/src/ide/screenshotMatrix.ts';
import { checkRecordAndBaselines } from '../vr/baselines.ts';
import { currentPin } from '../vr/env.ts';
import { registryMatrix } from '../vr/registry.ts';

process.env.TZ = 'UTC';

const ROOT = process.env.VR_ROOT ?? process.cwd();
const BASE_URL = process.env.VR_BASE_URL;
const matrix = registryMatrix(ROOT);

test.beforeAll(() => {
  expect(BASE_URL, 'Run the suite through npm run vr, which serves the static export.').toBeTruthy();
  expect(currentPin(ROOT).reasons, SKIP_MESSAGE).toEqual([]);
  expect(matrix.length, 'The screen registry produced no screenshot cases.').toBeGreaterThan(0);
  const check = checkRecordAndBaselines(ROOT, matrix);
  expect(check.errors, check.errors.join('; ')).toEqual([]);
});

for (const c of matrix) {
  test(c.id, async ({ browser }) => {
    const context = await browser.newContext({ ...CAPTURE_CONTEXT, viewport: { ...CAPTURE_CONTEXT.viewport } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto(`${BASE_URL}/ide${captureUrlFor(c)}`, { waitUntil: 'domcontentloaded' });
    const surface = page.locator(`#screen-${c.screen}[data-screenshot-ready="true"]`);
    await expect(surface).toBeVisible();
    const box = await surface.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(SCREENSHOT_CSS_WIDTH);
    expect(Math.round(box?.height ?? 0)).toBe(SCREENSHOT_CSS_HEIGHT);
    await expect(surface).toHaveScreenshot(`${c.id}.png`, { ...CAPTURE_SCREENSHOT, ...DIFF_OPTIONS });
    await context.close();
  });
}
