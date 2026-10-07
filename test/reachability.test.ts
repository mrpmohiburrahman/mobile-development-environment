// What the studio claims about where an edit went.
//
// The badge's job is to be trusted, so the failure mode worth pinning is not "it
// renders the wrong string" — it is "it renders a confident, wrong claim". Every
// test below is about the difference between "we know" and "we don't", especially
// the pull toward treating `null` as `false`.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeReachability, type ReachabilityCopy } from '../mobile/src/ds/reachability.ts';
import { TONE } from '../mobile/src/ide/chrome.ts';

const all = [true, false, null].map(describeReachability);

test('the flag has exactly three states, and each maps to a distinct one', () => {
  // Not a nice-to-have: the deployed static build is the case that has to be
  // representable. A two-state badge would show a reader a wrong answer there.
  assert.deepEqual(
    all.map((c) => c.target).sort(),
    ['disk', 'memory', 'unknown'],
  );
});

test('null is not the same as false — not-yet-tried never reads as a failure', () => {
  // The bug this file exists to prevent. `null` means nothing has tried the
  // server yet. Collapsing it into `false` would have the badge claim the edit
  // could not be saved, at a moment when the studio simply has not found out.
  const unknown = describeReachability(null);
  const memory = describeReachability(false);

  assert.notEqual(unknown.target, memory.target);
  assert.notEqual(unknown.label, memory.label);
  assert.notEqual(unknown.detail, memory.detail);
  assert.notEqual(unknown.tone, memory.tone);
});

test('the three states are distinguishable by text, not only by colour', () => {
  // A colour-blind reader, a screenshot in a README, or a future monochrome
  // chrome all still have to convey the state.
  assert.equal(new Set(all.map((c) => c.label)).size, 3);
  assert.equal(new Set(all.map((c) => c.detail)).size, 3);
});

test('the three states are distinguishable by colour too', () => {
  // Asserted on the palette as well: two states sharing a hue would read as one
  // even though the copy differs.
  assert.equal(new Set(Object.values(TONE)).size, 3);
});

test('the unknown state does not use the degraded tone', () => {
  // `degraded` is amber, not red, but it still reads as something wrong. Nothing
  // has gone wrong when nothing has been tried.
  const unknown = describeReachability(null);
  assert.equal(unknown.tone, 'muted');
  assert.notEqual(unknown.tone, describeReachability(false).tone);
});

test('every state names a consequence, so none of them is just a mood', () => {
  // "in-memory only" on its own is a fact with no stakes. The detail is what turns
  // a state into something a reader can act on.
  for (const copy of all) {
    assert.ok(copy.detail.length > 0, `${copy.target} has no detail`);
    assert.notEqual(copy.detail, copy.label, `${copy.target} repeats its label`);
  }
});

test('the disk state names the file, because that is the claim being made', () => {
  // "writes to disk" is only meaningful next to the file it means.
  assert.match(describeReachability(true).detail, /tokens\.json/);
});

test('the in-memory state does not imply the edit is merely unsaved-looking', () => {
  // It has to say the edit does not reach the file, or a reader could still
  // believe it is on its way there somehow.
  assert.match(describeReachability(false).detail, /do not reach tokens\.json/);
});

test('the mapping is pure, and repeated reads return equal copy', () => {
  // `useSyncExternalStore` re-reads the snapshot on every render, so a mapping
  // that built a fresh object with a new identity each time would be fine here
  // (the snapshot it caches is the raw flag, not this object) but still worth
  // holding to a stable value.
  for (const flag of [true, false, null] as const) {
    assert.deepEqual(describeReachability(flag), describeReachability(flag));
  }
});

test('describeReachability returns every field a badge renders', () => {
  // Guards the type against being loosened by a later edit.
  for (const copy of all as ReachabilityCopy[]) {
    assert.deepEqual(Object.keys(copy).sort(), ['detail', 'label', 'target', 'tone']);
  }
});