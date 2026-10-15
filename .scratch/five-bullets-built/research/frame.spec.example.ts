// Illustrative only. Not run. Would live at e2e/frame.spec.ts.
//
// Screenshots one frame on the /ide board of the static web export and
// compares it with the committed PNG. The waits are the ones
// research/playwright-expo-web.md argues for; nothing here sleeps.

import { test, expect, type Page } from '@playwright/test';
// Pure module, one `import type`, no runtime imports: safe to load in Node.
// Keeps the id rule in one place, the same reason the board imports it.
import { frameId, FRAME_PREFIX } from '../mobile/src/ide/boardFrames';

// `screens.ts` builds this list with Metro's require.context, which Node
// cannot run, so the spec carries its own copy. The count assertion below is
// what catches drift between the two: a frame added to the app and not here
// makes `toHaveCount` fail, and a frame missing from the board does too.
const SCREEN_KEYS = ['login', 'index', 'habits', 'habit', 'stats', 'profile', 'settings'];

// Set after ticket 03 lands. Empty string skips the check with a visible note.
const BUNDLED_FAMILY = '';

async function openBoard(page: Page) {
  await page.goto('/ide');

  // Honest zero: a board that mounted no frames must fail here, not produce
  // seven "snapshot missing" errors that look like a first run.
  const frames = page.locator(`[id^="${FRAME_PREFIX}"]`);
  await expect(frames).toHaveCount(SCREEN_KEYS.length);

  // Fonts: wait for the document's font set, then prove the bundled family
  // is the one in use. Without the second check a missing font would be
  // baselined as the fallback stack and nobody would know.
  await page.evaluate(() => document.fonts.ready);
  if (BUNDLED_FAMILY) {
    const inUse = await page.evaluate((family) => document.fonts.check(`16px "${family}"`), BUNDLED_FAMILY);
    expect(inUse, `font "${BUNDLED_FAMILY}" is not loaded`).toBe(true);
  } else {
    test.info().annotations.push({ type: 'note', description: 'no bundled font yet (ticket 03); fallback stack in use' });
  }

  // Only matters once a screen renders expo-image or any <img>; harmless now.
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));

  // Screenshots capture hover state. Park the pointer off the page.
  // https://playwright.dev/docs/test-snapshots#hover-effects
  await page.mouse.move(-1, -1);
}

async function setScheme(page: Page, scheme: 'light' | 'dark') {
  // TokenPanel renders two Pressables whose only text is "light" / "dark".
  // RNW Pressable does not set role=button by default, so match by text.
  // Ticket 06's URL state is the better hook once it exists.
  await page.getByText(scheme, { exact: true }).first().click();
  await page.mouse.move(-1, -1);
}

test.describe('board frames', () => {
  test('login · light', async ({ page }) => {
    await openBoard(page);

    const frame = page.locator(`#${frameId('login')}`);
    await expect(frame).toBeVisible();

    // Element screenshot: scrolls the frame into view inside the nested
    // ScrollViews, clips to its box, retries until two captures match.
    // Note the board's default transform is scale(0.5), so this PNG is
    // 195x410 CSS px until the scale is pinned to 1 (see research §5).
    await expect(frame).toHaveScreenshot('login-light.png');
  });

  test('login · dark', async ({ page }) => {
    await openBoard(page);
    await setScheme(page, 'dark');

    const frame = page.locator(`#${frameId('login')}`);
    await expect(frame).toHaveScreenshot('login-dark.png');
  });
});

// The full matrix, for when ticket 08 adopts frame-level PNGs:
//
// for (const key of SCREEN_KEYS) {
//   for (const scheme of ['light', 'dark'] as const) {
//     test(`${key} · ${scheme}`, async ({ page }) => {
//       await openBoard(page);
//       if (scheme === 'dark') await setScheme(page, 'dark');
//       await expect(page.locator(`#${frameId(key)}`)).toHaveScreenshot(`${key}-${scheme}.png`);
//     });
//   }
// }

// e2e/screenshot.css — candidate stylePath to neutralise the 0.5 board scale
// during the capture only. `!important` beats the inline transform RNW
// writes. Spike first: confirm the clip box is measured after the style is
// applied. Prefer a `?scale=1` URL param from ticket 06 if it exists.
//
//   :has(> [id^="screen-"]) { transform: none !important; }
