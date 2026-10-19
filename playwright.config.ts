import { defineConfig } from 'playwright/test';
import { CAPTURE_CONTEXT, CAPTURE_SCREENSHOT, DIFF_OPTIONS } from './mobile/src/ide/screenshotMatrix.ts';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  outputDir: './test-results/playwright',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  globalTimeout: 15 * 60 * 1000,
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  ignoreSnapshots: false,
  updateSnapshots: 'none',
  expect: {
    toHaveScreenshot: { ...DIFF_OPTIONS, ...CAPTURE_SCREENSHOT },
  },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    browserName: 'chromium',
    headless: true,
    ...CAPTURE_CONTEXT,
    viewport: { ...CAPTURE_CONTEXT.viewport },
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
});
