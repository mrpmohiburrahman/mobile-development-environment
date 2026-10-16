// The studio Analytics tab copy. The tab is a note, not a sender.
//
// Run: node --experimental-strip-types --test test/analyticsNote.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyticsNote, MIXPANEL_PROJECT_URL } from '../mobile/src/ide/analyticsNote.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const BOUNDARY = 'Analytics come from the app on a device or simulator. This studio sends nothing.';
const NOT_CONFIGURED = 'Mixpanel: not configured';
const PROJECT = 'https://mixpanel.com/project/4074212';

test('the note always says the studio sends nothing and links to the Mixpanel project', () => {
  assert.equal(MIXPANEL_PROJECT_URL, PROJECT);
  for (const configured of [false, true]) {
    const note = analyticsNote(configured);
    assert.equal(note.boundary, BOUNDARY);
    assert.equal(note.projectUrl, PROJECT);
    assert.equal(JSON.stringify(note).includes('send log'), false);
  }
});

test('an absent token adds Mixpanel: not configured', () => {
  const note = analyticsNote(false);
  assert.equal(note.status, NOT_CONFIGURED);
  assert.equal(note.configured, false);
});

test('a present token does not add the not-configured note and the note cannot carry a token', () => {
  const secret = 'test-token-not-for-display-19';
  const note = analyticsNote(true);
  assert.equal(note.configured, true);
  assert.equal(note.status, null);
  assert.equal(JSON.stringify(note).includes(secret), false);
  assert.equal(JSON.stringify(note).includes(NOT_CONFIGURED), false);
  assert.match(note.caveat, /does not prove/);
});

test('the studio tab renders the note and never the token', () => {
  const ide = read('mobile/src/app/ide.tsx');
  const panel = read('mobile/src/ide/AnalyticsPanel.tsx');
  assert.match(ide, /'analytics'/);
  assert.match(panel, /analyticsNote\(/);
  assert.doesNotMatch(panel, /\{process\.env\.EXPO_PUBLIC_MIXPANEL_TOKEN\}/);
  assert.doesNotMatch(panel, /<iframe/);
  assert.doesNotMatch(panel, /api\.mixpanel\.com/);
});
