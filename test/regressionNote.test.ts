import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NO_RUN_HEADLINE, regressionNote } from '../mobile/src/ide/regressionNote.ts';
import { buildScreenshotRecord, validateScreenshotRecord } from '../mobile/src/ide/screenshotMatrix.ts';
import { registryMatrix } from '../vr/registry.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const MATRIX = registryMatrix(ROOT);
const committed = buildScreenshotRecord({
  sourceCommit: 'cce6d9c73a29a90927c44d0e1ffb67ec1056d962',
  playwrightVersion: '1.58.0',
  cases: MATRIX.map((screenshot, i) => ({ screenshot, bytes: 1000 + i })),
});

const NONE_HEADLINE = 'No screenshot run on record';

function noteText(note: ReturnType<typeof regressionNote>): string {
  return JSON.stringify(note);
}

test('a record reads approved at the recorded commit', () => {
  const note = regressionNote(committed);
  assert.equal(note.kind, 'approved');
  if (note.kind !== 'approved') return;
  assert.equal(note.sourceCommit, committed.sourceCommit);
  assert.equal(note.headline, `Approved at ${committed.sourceCommit.slice(0, 7)}`);
  assert.ok(note.details.some((line) => line.includes(committed.sourceCommit)));
  assert.ok(note.details.some((line) => line.includes(committed.image)));
  assert.ok(note.details.includes('Capture: 780 by 1640 PNG at DPR 2'));
  assert.ok(note.details.includes('App surface: 390 by 820 CSS pixels'));
  assert.ok(note.details.includes(`Cases: ${MATRIX.length}`));
});

test('a record lists each case with its scheme, state, and baseline path', () => {
  const note = regressionNote(committed);
  assert.equal(note.kind, 'approved');
  if (note.kind !== 'approved') return;
  assert.equal(note.cases.length, committed.cases.length);
  for (const [i, c] of committed.cases.entries()) {
    assert.deepEqual(note.cases[i], {
      id: c.id,
      screen: c.screen,
      scheme: c.scheme,
      state: c.state,
      baseline: c.baseline,
    });
  }
});

test('no record reads no screenshot run on record and is not approved', () => {
  for (const absent of [null, undefined]) {
    const note = regressionNote(absent);
    assert.equal(note.kind, 'none');
    assert.equal(note.headline, NONE_HEADLINE);
    assert.doesNotMatch(noteText(note), /Approved/);
    assert.equal('cases' in note, false);
  }
});

test('an unreadable record reads no screenshot run on record and says why', () => {
  const broken = [
    {},
    'cce6d9c',
    { ...committed, sourceCommit: 'cce6d9c' },
    { ...committed, cases: 'all' },
    { ...committed, cases: [{ id: 'x' }] },
    { ...committed, cases: [] },
    { ...committed, cases: [committed.cases[0], committed.cases[0]] },
  ];
  for (const record of broken) {
    const note = regressionNote(record);
    assert.equal(note.kind, 'none');
    assert.equal(note.headline, NONE_HEADLINE);
    assert.match(note.detail, /not readable/);
  }
});

test('the note never calls the current build a pass', () => {
  for (const record of [committed, null]) {
    const note = regressionNote(record);
    assert.doesNotMatch(note.headline, /pass/i);
    assert.doesNotMatch(noteText(note), /https?:\/\//);
  }
  const approved = regressionNote(committed);
  assert.equal(approved.kind, 'approved');
  if (approved.kind !== 'approved') return;
  assert.match(approved.caveat, /does not show that this build passed/);
  for (const line of approved.details) assert.doesNotMatch(line, /pass/i);
});

test('the note does not depend on HEAD', () => {
  const later = { ...committed, sourceCommit: 'f'.repeat(40) };
  const note = regressionNote(later);
  assert.equal(note.kind, 'approved');
  const current = regressionNote(committed);
  assert.equal(current.kind, 'approved');
  if (current.kind === 'approved') assert.match(current.caveat, /HEAD can be newer/);
});

test('validation of a record from an older commit does not read HEAD', () => {
  const older = { ...committed, sourceCommit: '0'.repeat(40) };
  const result = validateScreenshotRecord(older, MATRIX, {
    existingBaselines: MATRIX.map((c) => c.baseline),
    playwrightVersion: committed.playwrightVersion,
  });
  assert.deepEqual(result.errors, []);
});

test('the committed record reads approved in the tab', () => {
  const record = JSON.parse(read('mobile/src/ide/screenshot-record.json'));
  const note = regressionNote(record);
  if (record === null) {
    assert.equal(note.headline, NO_RUN_HEADLINE);
    return;
  }
  assert.equal(note.kind, 'approved');
  assert.equal(note.headline, `Approved at ${record.sourceCommit.slice(0, 7)}`);
});

test('the studio bundles the record by import and renders it as text only', () => {
  const ide = read('mobile/src/app/ide.tsx');
  const panel = read('mobile/src/ide/RegressionPanel.tsx');
  assert.match(ide, /'regression'/);
  assert.match(ide, /<RegressionPanel \/>/);
  assert.match(panel, /import record from '\.\/screenshot-record\.json'/);
  assert.match(panel, /regressionNote\(record\)/);
  for (const forbidden of [/fetch\(/, /XMLHttpRequest/, /<Image\b/, /<img\b/, /'img'/, /\bhref\b/, /https?:\/\//, /\.png'/]) {
    assert.doesNotMatch(panel, forbidden);
  }
});

test('RenderVerdict stays a fidelity line without the screenshot result', () => {
  const verdict = read('mobile/src/ide/RenderVerdict.tsx');
  assert.doesNotMatch(verdict, /screenshot-record|regressionNote|RegressionPanel|sourceCommit/);
});
