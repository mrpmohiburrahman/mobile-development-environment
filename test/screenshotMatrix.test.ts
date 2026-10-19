import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PINNED_ENVIRONMENT,
  SCREENSHOT_PNG_HEIGHT,
  SCREENSHOT_PNG_WIDTH,
  SKIP_MESSAGE,
  buildScreenshotRecord,
  captureUrlFor,
  compareVerdict,
  evaluatePin,
  playwrightImageFor,
  screenshotMatrix,
  updateRefusal,
  validateScreenshotRecord,
  type PinFacts,
} from '../mobile/src/ide/screenshotMatrix.ts';
import { checkRecordAndBaselines } from '../vr/baselines.ts';
import { registryMatrix, registryScreens } from '../vr/registry.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION: string = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).devDependencies.playwright;
const IMAGE = playwrightImageFor(VERSION);
const SHA = 'cce6d9c73a29a90927c44d0e1ffb67ec1056d962';

const PINNED: PinFacts = {
  platform: 'linux',
  arch: 'arm64',
  osCodename: 'noble',
  browsersPath: '/ms-playwright',
  chromiumInstalled: true,
  declaredImage: IMAGE,
};

function recordFor(matrix: ReturnType<typeof screenshotMatrix>) {
  return buildScreenshotRecord({
    sourceCommit: SHA,
    playwrightVersion: VERSION,
    cases: matrix.map((screenshot) => ({ screenshot, bytes: 10 })),
  });
}

test('the matrix derives from the screen registry, both schemes, and the empty Habit detail state', () => {
  const matrix = registryMatrix(ROOT);
  assert.equal(registryScreens(ROOT).length, 7);
  assert.equal(matrix.length, 16);
  assert.equal(new Set(matrix.map((c) => c.id)).size, 16);
  assert.deepEqual(
    matrix.filter((c) => c.state === 'empty').map((c) => c.id),
    ['habit-light-empty', 'habit-dark-empty'],
  );
  assert.equal(captureUrlFor(matrix[0]), `?capture=1&screen=${matrix[0].screen}&scheme=light&state=populated`);
});

test('the empty state follows Habit detail, so a registry without it has no empty cases', () => {
  assert.deepEqual(screenshotMatrix(['login']).map((c) => c.id), ['login-light-populated', 'login-dark-populated']);
});

test('a new registered screen grows the matrix and fails until it has baselines', () => {
  const current = registryMatrix(ROOT);
  const grown = screenshotMatrix([...registryScreens(ROOT), 'new-screen']);
  assert.equal(grown.length, current.length + 2);
  const verdict = validateScreenshotRecord(recordFor(current), grown, {
    existingBaselines: current.map((c) => c.baseline),
    playwrightVersion: VERSION,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.errors.includes('screenshot record is missing case new-screen-light-populated'));
  assert.ok(verdict.errors.includes('missing baseline e2e/__screenshots__/new-screen-dark-populated.png'));
});

test('a built record validates, and a missing record, case, baseline, or commit fails', () => {
  const matrix = registryMatrix(ROOT);
  const record = recordFor(matrix);
  const opts = { existingBaselines: matrix.map((c) => c.baseline), playwrightVersion: VERSION };
  assert.deepEqual(validateScreenshotRecord(record, matrix, opts), { ok: true, errors: [] });
  assert.equal(record.environment, PINNED_ENVIRONMENT);
  assert.equal(record.totalBytes, matrix.length * 10);
  assert.deepEqual(record.png, { width: SCREENSHOT_PNG_WIDTH, height: SCREENSHOT_PNG_HEIGHT });

  assert.deepEqual(validateScreenshotRecord(null, matrix, opts).errors, ['screenshot record is missing']);
  assert.equal(validateScreenshotRecord({ ...record, cases: record.cases.slice(1) }, matrix, opts).ok, false);
  assert.equal(validateScreenshotRecord(record, matrix, { ...opts, existingBaselines: [] }).ok, false);
  assert.equal(validateScreenshotRecord({ ...record, sourceCommit: 'cce6d9c-demo' }, matrix, opts).ok, false);
  assert.equal(validateScreenshotRecord(record, matrix, { ...opts, playwrightVersion: '9.9.9' }).ok, false);
});

test('only the pinned Linux image on arm64 counts as pinned', () => {
  assert.deepEqual(evaluatePin(PINNED, VERSION), { pinned: true, image: IMAGE, reasons: [] });

  const macWithVariables = evaluatePin({ ...PINNED, platform: 'darwin', osCodename: null }, VERSION);
  assert.equal(macWithVariables.pinned, false);
  assert.ok(macWithVariables.reasons.includes('platform is darwin, not linux'));

  for (const patch of [
    { arch: 'x64' },
    { osCodename: 'jammy' },
    { browsersPath: undefined },
    { chromiumInstalled: false },
    { declaredImage: undefined },
    { declaredImage: playwrightImageFor('1.57.0') },
  ]) {
    assert.equal(evaluatePin({ ...PINNED, ...patch }, VERSION).pinned, false, JSON.stringify(patch));
  }
});

test('off the pinned image a comparison is a skip that says it is not a pass, and the flag makes it fail', () => {
  const offImage = evaluatePin({ ...PINNED, platform: 'darwin' }, VERSION);
  const skip = compareVerdict(offImage, false);
  assert.equal(skip.action, 'skip');
  assert.ok(skip.message.startsWith('comparison skipped'));
  assert.match(skip.message, /not a pass/);
  assert.ok(skip.message.includes(SKIP_MESSAGE));
  assert.equal(compareVerdict(offImage, true).action, 'fail');
  assert.equal(compareVerdict(evaluatePin(PINNED, VERSION), true).action, 'compare');
  assert.match(updateRefusal(offImage) ?? '', /refuses to run outside the pinned Linux image/);
  assert.equal(updateRefusal(evaluatePin(PINNED, VERSION)), null);
});

test('the committed screenshot record and baselines cover the live matrix', () => {
  assert.deepEqual(checkRecordAndBaselines(ROOT, registryMatrix(ROOT)), { ok: true, errors: [] });
});
