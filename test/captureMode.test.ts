import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED } from '../mobile/src/store/habitSeed.ts';
import {
  CAPTURE_ERRORS,
  CAPTURE_SURFACE_HEIGHT,
  CAPTURE_SURFACE_WIDTH,
  captureFixtureFor,
  evaluateCaptureReadiness,
  expectedMeterScales,
  fixtureMatches,
  parseCaptureSearch,
  type CaptureReadinessInput,
} from '../mobile/src/ide/captureMode.ts';

const SCREENS = ['login', 'index', 'habits', 'habit', 'stats', 'profile', 'settings'];

test('a query without the capture parameter stays inactive', () => {
  assert.deepEqual(parseCaptureSearch('', SCREENS), { kind: 'inactive' });
  assert.deepEqual(parseCaptureSearch('?', SCREENS), { kind: 'inactive' });
  assert.deepEqual(parseCaptureSearch('?unrelated=1', SCREENS), { kind: 'inactive' });
  assert.deepEqual(parseCaptureSearch('?scheme=dark', SCREENS), { kind: 'inactive' });
  assert.deepEqual(parseCaptureSearch('?screen=login&scheme=light&state=populated', SCREENS), { kind: 'inactive' });
});

test('every known screen accepts light and dark in the populated state, and Habit detail accepts empty', () => {
  for (const screen of SCREENS) {
    for (const scheme of ['light', 'dark'] as const) {
      const query = `?capture=1&screen=${screen}&scheme=${scheme}&state=populated`;
      assert.deepEqual(parseCaptureSearch(query, SCREENS), {
        kind: 'valid',
        request: { screen, scheme, state: 'populated' },
      });
    }
  }
  for (const scheme of ['light', 'dark'] as const) {
    const query = `?capture=1&screen=habit&scheme=${scheme}&state=empty`;
    assert.deepEqual(parseCaptureSearch(query, SCREENS), {
      kind: 'valid',
      request: { screen: 'habit', scheme, state: 'empty' },
    });
  }
});

test('unknown or missing capture, screen, scheme, or state is rejected with a diagnostic error', () => {
  for (const [search, expectedError] of [
    ['?capture=0&screen=login&scheme=light&state=populated', CAPTURE_ERRORS.captureFlag],
    ['?capture=true&screen=login&scheme=light&state=populated', CAPTURE_ERRORS.captureFlag],
    ['?capture=&screen=login&scheme=light&state=populated', CAPTURE_ERRORS.captureFlag],
    ['?capture=1&screen=ghost&scheme=light&state=populated', CAPTURE_ERRORS.unknownScreen],
    ['?capture=1&scheme=light&state=populated', CAPTURE_ERRORS.unknownScreen],
    ['?capture=1&screen=login&scheme=sepia&state=populated', CAPTURE_ERRORS.unknownScheme],
    ['?capture=1&screen=login&state=populated', CAPTURE_ERRORS.unknownScheme],
    ['?capture=1&screen=login&scheme=light&state=broken', CAPTURE_ERRORS.unknownState],
    ['?capture=1&screen=login&scheme=light&state=', CAPTURE_ERRORS.unknownState],
    ['?capture=1&screen=login&scheme=light', CAPTURE_ERRORS.unknownState],
  ] as const) {
    assert.deepEqual(parseCaptureSearch(search, SCREENS), {
      kind: 'invalid',
      error: expectedError,
    });
  }
});

test('the empty state is rejected on every screen except Habit detail', () => {
  for (const screen of SCREENS.filter((key) => key !== 'habit')) {
    assert.deepEqual(
      parseCaptureSearch(`?capture=1&screen=${screen}&scheme=light&state=empty`, SCREENS),
      { kind: 'invalid', error: CAPTURE_ERRORS.emptyNotSupported },
    );
  }
});

test('populated Habit detail selects Morning run, empty Habit detail has no selection, and other screens use the signed-in seed', () => {
  assert.deepEqual(captureFixtureFor({ screen: 'habit', scheme: 'light', state: 'populated' }), {
    signedIn: true,
    selectedId: 'h1',
  });
  assert.deepEqual(captureFixtureFor({ screen: 'habit', scheme: 'dark', state: 'empty' }), {
    signedIn: true,
    selectedId: null,
  });
  for (const screen of SCREENS.filter((key) => key !== 'habit')) {
    assert.deepEqual(captureFixtureFor({ screen, scheme: 'light', state: 'populated' }), {
      signedIn: true,
      selectedId: null,
    });
  }
});

test('fixtureMatches checks signed-in state, selected habit, and the seed habits', () => {
  const populatedHabit = { screen: 'habit', scheme: 'light' as const, state: 'populated' as const };
  const emptyHabit = { screen: 'habit', scheme: 'dark' as const, state: 'empty' as const };
  assert.equal(fixtureMatches(populatedHabit, { signedIn: true, selectedId: 'h1', habits: SEED }, SEED), true);
  assert.equal(fixtureMatches(populatedHabit, { signedIn: true, selectedId: null, habits: SEED }, SEED), false);
  assert.equal(fixtureMatches(populatedHabit, { signedIn: false, selectedId: 'h1', habits: SEED }, SEED), false);
  assert.equal(fixtureMatches(emptyHabit, { signedIn: true, selectedId: null, habits: SEED }, SEED), true);
  assert.equal(fixtureMatches(emptyHabit, { signedIn: true, selectedId: 'h1', habits: SEED }, SEED), false);
  const mutated = SEED.map((h, i) => (i === 0 ? { ...h, done: h.done.slice(1) } : h));
  assert.equal(fixtureMatches(populatedHabit, { signedIn: true, selectedId: 'h1', habits: mutated }, SEED), false);
});

test('expectedMeterScales matches the final Meter fill ratios for each screen and state', () => {
  assert.deepEqual(expectedMeterScales({ screen: 'habit', scheme: 'light', state: 'populated' }, SEED), [0.8]);
  assert.deepEqual(expectedMeterScales({ screen: 'habit', scheme: 'light', state: 'empty' }, SEED), []);
  assert.deepEqual(expectedMeterScales({ screen: 'index', scheme: 'light', state: 'populated' }, SEED), [0.8, 0.86, 0.5, 0.43, 1, 0.2]);
  assert.deepEqual(expectedMeterScales({ screen: 'stats', scheme: 'dark', state: 'populated' }, SEED), [0.8, 0.86, 0.5, 0.43, 1, 0.2]);
  assert.deepEqual(expectedMeterScales({ screen: 'habits', scheme: 'light', state: 'populated' }, SEED), [0.8, 0.43, 0.86, 1, 0.5, 0.2]);
  assert.deepEqual(expectedMeterScales({ screen: 'login', scheme: 'light', state: 'populated' }, SEED), []);
  assert.deepEqual(expectedMeterScales({ screen: 'profile', scheme: 'light', state: 'populated' }, SEED), []);
  assert.deepEqual(expectedMeterScales({ screen: 'settings', scheme: 'light', state: 'populated' }, SEED), []);
});

function readyInput(): CaptureReadinessInput {
  return {
    request: { screen: 'habit', scheme: 'dark', state: 'populated' },
    fixtureReady: true,
    activeScheme: 'dark',
    overrideCount: 0,
    committedTokensActive: true,
    surfaceWidth: CAPTURE_SURFACE_WIDTH,
    surfaceHeight: CAPTURE_SURFACE_HEIGHT,
    surfaceScale: 1,
    fontsReady: true,
    splineSansChecked: true,
    splineSansPresent: true,
    failedFontWeights: [],
    images: [],
    reducedMotion: true,
    animationsFinished: true,
    expectedMeterScales: [0.8],
    observedMeterScales: [0.8],
  };
}

test('readiness holds only when fixture, scheme, size, tokens, fonts, images, and reduced-motion final state all hold', () => {
  assert.deepEqual(evaluateCaptureReadiness(readyInput()), { ready: true, error: null });
  assert.deepEqual(
    evaluateCaptureReadiness({
      ...readyInput(),
      images: [{ complete: true, naturalWidth: 120 }],
    }),
    { ready: true, error: null },
  );

  for (const patch of [
    { fixtureReady: false },
    { activeScheme: 'light' as const },
    { overrideCount: 1 },
    { committedTokensActive: false },
    { surfaceWidth: 195 },
    { surfaceHeight: 410 },
    { surfaceScale: 0.5 },
    { fontsReady: false },
    { images: [{ complete: false, naturalWidth: 0 }] },
    { animationsFinished: false },
    { observedMeterScales: [0] },
    { observedMeterScales: [] },
  ]) {
    const verdict = evaluateCaptureReadiness({ ...readyInput(), ...patch });
    assert.equal(verdict.ready, false, `expected ready=false for ${JSON.stringify(patch)}`);
  }
});

test('missing fonts, failed images, and disabled reduced motion never become ready and report a diagnostic error', () => {
  assert.deepEqual(
    evaluateCaptureReadiness({ ...readyInput(), failedFontWeights: [700] }),
    { ready: false, error: CAPTURE_ERRORS.missingFont },
  );
  assert.deepEqual(
    evaluateCaptureReadiness({ ...readyInput(), splineSansChecked: false }),
    { ready: false, error: CAPTURE_ERRORS.missingFont },
  );
  assert.deepEqual(
    evaluateCaptureReadiness({ ...readyInput(), splineSansPresent: false }),
    { ready: false, error: CAPTURE_ERRORS.missingFont },
  );
  assert.deepEqual(
    evaluateCaptureReadiness({
      ...readyInput(),
      images: [{ complete: true, naturalWidth: 0 }],
    }),
    { ready: false, error: CAPTURE_ERRORS.failedImage },
  );
  assert.deepEqual(
    evaluateCaptureReadiness({ ...readyInput(), reducedMotion: false }),
    { ready: false, error: CAPTURE_ERRORS.reducedMotion },
  );
});


