// Session-scoped revert: the baseline semantics.
//
// The old revert was `git checkout -- tokens.json`, which throws away every
// uncommitted token edit — including half-finished work from before the studio
// was opened. Reverting a session must land on the file as it was when this
// session's *first* edit arrived, and nothing earlier.
//
// These run against `token-server/session.mjs` directly: importing index.mjs
// calls server.listen(), so it cannot be loaded by a test.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tokens from '../mobile/src/ds/tokens.json' with { type: 'json' };
import { setPath } from '../token-server/tokens.mjs';
import {
  seedBaseline,
  establishBaseline,
  sessionBaseline,
  hasBaseline,
  resetBaseline,
  restoreBaseline,
} from '../token-server/session.mjs';

/** A small stand-in for the token tree, so failures point at the right line. */
const sample = () => ({
  color: { light: { accent: '#D9481E' } },
  space: { md: 16 },
});

beforeEach(() => resetBaseline());

// ---------------------------------------------------------------------------
// There is a baseline, or there honestly is not
// ---------------------------------------------------------------------------

test('a fresh server has no baseline', () => {
  // The state that matters: a session that has written nothing has nothing to
  // undo to, and saying "no baseline" is the honest answer.
  assert.equal(hasBaseline(), false);
  assert.equal(sessionBaseline(), null);
  assert.equal(restoreBaseline(), null);
});

test('the first write seeds the baseline', () => {
  const before = sample();
  seedBaseline(before);
  assert.equal(hasBaseline(), true);
  assert.deepEqual(sessionBaseline(), before);
});

// ---------------------------------------------------------------------------
// Seeding happens once, and that is the whole point
// ---------------------------------------------------------------------------

test('later writes do not re-seed, so revert lands at session start', () => {
  // The bug this prevents: re-seeding on every write would make "revert to
  // session start" mean "undo the last edit", quietly.
  const start = sample();
  seedBaseline(start);

  const afterFirstWrite = sample();
  setPath(afterFirstWrite, 'color.light.accent', '#111111');
  seedBaseline(afterFirstWrite);

  const afterSecondWrite = sample();
  setPath(afterSecondWrite, 'space.md', 99);
  seedBaseline(afterSecondWrite);

  assert.equal(sessionBaseline().color.light.accent, '#D9481E', 'baseline moved');
  assert.equal(sessionBaseline().space.md, 16, 'baseline moved');
  assert.deepEqual(restoreBaseline(), start);
});

test('seeding twice with the same tree is harmless', () => {
  const tree = sample();
  seedBaseline(tree);
  seedBaseline(tree);
  assert.deepEqual(sessionBaseline(), tree);
});

// ---------------------------------------------------------------------------
// The snapshot is a copy, not a reference
// ---------------------------------------------------------------------------

test('mutating the live tree after seeding does not change the baseline', () => {
  // This is the load-bearing detail. Without the copy, seeding and then writing
  // would leave the baseline pointing at the *edited* tree, and reverting would
  // restore the thing you just tried to undo.
  const live = sample();
  seedBaseline(live);

  setPath(live, 'color.light.accent', '#FF0000');
  setPath(live, 'space.md', 40);

  assert.equal(sessionBaseline().color.light.accent, '#D9481E');
  assert.equal(sessionBaseline().space.md, 16);
});

test('the baseline survives a nested mutation of the original object', () => {
  const live = sample();
  seedBaseline(live);

  live.color.light.accent = '#000000';
  live.color = { light: { accent: '#111111' } };

  assert.equal(sessionBaseline().color.light.accent, '#D9481E');
});

test('restoreBaseline hands back a copy, so a write cannot corrupt it', () => {
  // The caller is about to setPath on whatever it gets. Handing out the live
  // baseline would let one revert destroy the only copy of session start.
  seedBaseline(sample());
  const restored = restoreBaseline();

  setPath(restored, 'color.light.accent', '#ABCDEF');

  assert.equal(sessionBaseline().color.light.accent, '#D9481E');
  assert.notEqual(restored, sessionBaseline());
});

test('restoreBaseline returns equal but distinct objects', () => {
  seedBaseline(sample());
  const a = restoreBaseline();
  const b = restoreBaseline();
  assert.deepEqual(a, b);
  assert.notEqual(a, b, 'two restores shared one object');
});

// ---------------------------------------------------------------------------
// Reset means "a new session"
// ---------------------------------------------------------------------------

test('resetBaseline returns the server to having no baseline', () => {
  seedBaseline(sample());
  assert.equal(hasBaseline(), true);

  resetBaseline();
  assert.equal(hasBaseline(), false);
  assert.equal(sessionBaseline(), null);
});

test('after a reset the next write seeds from the new tree', () => {
  // Stands in for restarting the server: whatever the file looks like now is the
  // new session start, and the old baseline is gone.
  seedBaseline(sample());
  resetBaseline();

  const afterRestart = sample();
  setPath(afterRestart, 'space.md', 44);
  seedBaseline(afterRestart);

  assert.equal(sessionBaseline().space.md, 44);
  assert.equal(sessionBaseline().color.light.accent, '#D9481E');
});

// ---------------------------------------------------------------------------
// Against the real token tree
// ---------------------------------------------------------------------------

test('the real tokens.json seeds and restores', () => {
  const live = structuredClone(tokens);
  seedBaseline(live);

  setPath(live, 'color.light.accent', '#ABCDEF');
  setPath(live, 'type.caption.size', 40);

  const restored = restoreBaseline();
  assert.equal(restored.color.light.accent, tokens.color.light.accent);
  assert.equal(restored.type.caption.size, tokens.type.caption.size);
});

test('seeding the real tree does not alias it', () => {
  // `structuredClone` rather than a reference, so a caller that keeps mutating
  // the object it passed in cannot reach into the snapshot.
  const live = structuredClone(tokens);
  seedBaseline(live);
  setPath(live, 'space.md', 999);
  assert.equal(sessionBaseline().space.md, tokens.space.md);
});

test('establishBaseline discards an existing one, unlike seedBaseline', () => {
  // The two are deliberately different. `seedBaseline` is idempotent, which is
  // what every later write needs; `establishBaseline` always overwrites, which is
  // what the session's *first* write needs. Without the distinction the first
  // edit gets captured inside the baseline and survives a revert.
  seedBaseline({ note: 'first' });
  establishBaseline({ note: 'second' });
  assert.deepEqual(sessionBaseline(), { note: 'second' });
});

test('establishBaseline snapshots the tree as handed, not a reference', () => {
  const live = sample();
  establishBaseline(live);
  setPath(live, 'space.md', 99);
  assert.equal(sessionBaseline().space.md, 16);
});

test('the first write is not captured inside the baseline', () => {
  // The regression that shipped briefly and was caught by driving the server:
  // `POST /revert` left the session's first edit applied.
  //
  // Models the server's order — read, snapshot, mutate, write — and asserts the
  // snapshot was taken of the pre-mutation tree.
  const readTokens = sample();
  establishBaseline(readTokens); // server does this, before its setPath
  const live = structuredClone(readTokens);
  setPath(live, 'radius.sm', 14); // the first write of the session
  setPath(live, 'space.md', 20); // and a second

  const restored = restoreBaseline();
  assert.equal(restored.color.light.accent, '#D9481E');
  assert.equal('radius' in restored, false, 'first edit leaked into the baseline');
  assert.equal(restored.space.md, 16);
});

test('a rejected write does not consume the baseline', async () => {
  // The server validates before establishing, so a 422 leaves the session able to
  // take its real first write. Stands in for that ordering.
  resetBaseline();
  const rejected = sample();
  setPath(rejected, 'color.light.accent', 'not-a-colour');
  // The server returns here without calling establishBaseline.
  assert.equal(hasBaseline(), false);

  establishBaseline(sample());
  assert.equal(hasBaseline(), true);
});

test('the session module writes nothing to disk', async () => {
  // "Dies with the process, no cleanup path" is the ticket's design. A stray file
  // write would break that claim silently, so assert the surface instead: five
  // pure functions and no fs import.
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../token-server/session.mjs'),
    'utf8',
  );
  assert.doesNotMatch(source, /from 'node:fs/, 'session.mjs must not touch the filesystem');
  assert.doesNotMatch(source, /writeFile|appendFile|mkdir/);

  const mod = await import('../token-server/session.mjs');
  assert.deepEqual(Object.keys(mod).sort(), [
    'establishBaseline',
    'hasBaseline',
    'resetBaseline',
    'restoreBaseline',
    'seedBaseline',
    'sessionBaseline',
  ]);
});