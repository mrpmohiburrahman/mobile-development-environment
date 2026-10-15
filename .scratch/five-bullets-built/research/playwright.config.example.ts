// Illustrative only. Not run. Ticket 08 decides the final contract.
//
// Lives at the repo root next to package.json, so `npx playwright test` from
// the root finds it. Tests live in `e2e/`, baselines in `e2e/__screenshots__/`.
//
// Sources for each choice are in research/playwright-expo-web.md.

import { defineConfig } from '@playwright/test';

const PORT = 8080;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ON_LINUX = process.platform === 'linux';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,

  // One worker: the board is one page and screenshots want a quiet machine.
  // https://playwright.dev/docs/ci#workers
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: !!process.env.CI,

  // The run stops itself before the GitHub job limit does, so the report is
  // still written. https://playwright.dev/docs/ci#global-timeout
  globalTimeout: 15 * 60 * 1000,
  timeout: 60 * 1000,

  // Baselines are Linux pixels. On a Mac the suite still drives the page but
  // does not compare, so a developer run is a smoke test, not a false red.
  // Set VR_FORCE=1 to compare anyway (for example inside the Docker image).
  // https://playwright.dev/docs/api/class-testconfig#test-config-ignore-snapshots
  ignoreSnapshots: !ON_LINUX && !process.env.VR_FORCE,

  // No {platform} and no {projectName}: exactly one committed PNG per
  // screenshot name, and it is the Linux one.
  // https://playwright.dev/docs/api/class-testconfig#test-config-snapshot-path-template
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',

  expect: {
    timeout: 10 * 1000,
    toHaveScreenshot: {
      // pixelmatch options. Start strict; loosen with a written reason.
      // https://playwright.dev/docs/test-snapshots#maxdiffpixels-and-threshold
      threshold: 0.2,
      maxDiffPixelRatio: 0,
      // Defaults, written out so the contract is visible:
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Optional: a stylesheet applied only while the screenshot is taken.
      // See e2e/screenshot.css in frame.spec.example.ts for the board-scale
      // override idea. Needs a spike before relying on it.
      // stylePath: './e2e/screenshot.css',
    },
  },

  // 'github' gives failure annotations in the checks UI. The HTML report is
  // what gets uploaded as an artifact and shows expected/actual/diff.
  // https://playwright.dev/docs/test-reporters
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']]
    : [['list'], ['html', { open: 'on-failure' }]],

  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    headless: true,

    // Fixed geometry. DPR 1 + scale 'css' above = one PNG pixel per CSS pixel.
    // For 2x pixels set deviceScaleFactor: 2 AND expect.toHaveScreenshot.scale: 'device'.
    // https://playwright.dev/docs/emulation#viewport
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,

    // Reanimated reads prefers-reduced-motion at module load and then makes
    // withTiming/withSpring jump to their end value. This is what settles
    // the Meter fill without a sleep.
    // https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/
    reducedMotion: 'reduce',

    // The app's light/dark is its own state, not this media query, but pin
    // it so OS defaults never leak into a baseline.
    colorScheme: 'light',
    locale: 'en-GB',
    timezoneId: 'UTC',

    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },

  projects: [
    {
      // No name on purpose: {projectName} is empty in the path template.
      use: {},
    },
  ],

  // Serves dist/ with the repo's own stdlib server. `npm run export:web`
  // must have run first (CI does it as an explicit step; locally run it once).
  // https://playwright.dev/docs/api/class-testconfig#test-config-web-server
  webServer: {
    command: 'npm run preview',
    url: `${BASE_URL}/ide`,
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
    env: { HOST: '127.0.0.1', PORT: String(PORT) },
  },
});
