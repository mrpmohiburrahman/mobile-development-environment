// What the board says about the presses on it.
//
// ## The problem this answers
//
// Roughly half the controls on the blueprint dim under your finger and then do
// nothing: the avatar, the stats card, all sixteen tab taps, four toggles that
// were never implemented, two back bars. Nothing on screen says which half, or
// why — so a developer reads a working control as a broken one, or the reverse.
//
// ## The words matter more than the count
//
// A press that changed nothing is reported as **inert in the studio**, never as
// unavailable, missing, or unimplemented. The control is real. The blueprint
// deliberately does not navigate, and the tab bar deliberately does not reach the
// seam. Every one of those would be called a bug if this panel called it one, and
// it would be the panel that is wrong.
//
// A control that is unimplemented everywhere in the app therefore gets no
// stronger a word than one that is inert only in the studio. The studio cannot
// tell them apart, so it does not claim to.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describePresses,
  pressVerdictCopy,
  PRESS_TARGET_MAX,
  clipTarget,
} from '../mobile/src/ide/presses.ts';
import { createSpine, spineReducer, tallyPresses, type SpineInput } from '../mobile/src/ide/spine.ts';

function observe(...inputs: SpineInput[]) {
  return inputs.reduce(spineReducer, createSpine()).entries;
}

const press = (target: string, column: 'current' | 'comparison' = 'current') =>
  ({ kind: 'press', frame: 'index', column, label: 'Today', target }) as SpineInput;

test('a tallied board reports what it saw and nothing more', () => {
  const entries = observe(
    press('Morning run'),
    { kind: 'store', store: 'app', before: { selectedId: null }, after: { selectedId: 'h1' } },
    { kind: 'flush' },
    press('Avatar'),
    { kind: 'flush' },
  );

  const copy = describePresses(tallyPresses(entries));
  assert.equal(copy.live, 1);
  assert.equal(copy.inert, 1);
  assert.equal(copy.presses, 2);
  assert.equal(copy.tone, 'degraded', 'half the board doing nothing is not a clean result');
});

test('the inert wording names the studio, never the app', () => {
  const copy = pressVerdictCopy('inert');
  for (const forbidden of ['unavailable', 'missing', 'unimplemented', 'not implemented', 'broken', 'dead']) {
    assert.doesNotMatch(copy.label, new RegExp(forbidden, 'i'), `"${forbidden}" is not something this studio can know`);
  }
  // It has to say whose limitation this is, or the reader blames the app.
  assert.match(copy.detail, /studio/i);
});

test('every verdict reads differently, and none of them reads as fine by accident', () => {
  const copies = (['live', 'inert', 'unattributed', 'unlocated'] as const).map(pressVerdictCopy);
  assert.equal(new Set(copies.map((c) => c.label)).size, copies.length);

  const byVerdict = copies.map((c) => c.tone);
  // Exactly one verdict may carry the tone that means "nothing is wrong", and it
  // has to be the one for a control that did something.
  assert.equal(byVerdict.filter((t) => t === 'ok').length, 1);
  assert.equal(byVerdict[0], 'ok');
  assert.notEqual(byVerdict[2], byVerdict[3]);
  // "Not attributed" and "not placed" are different failures and must not collapse.
  assert.notEqual(copies[2].label, copies[3].label);
});

test('a press the studio could not place is reported as its own failure', () => {
  const copy = describePresses(tallyPresses(observe({ kind: 'press', frame: null, column: 'current', label: null, target: 'X' }, { kind: 'flush' })));
  assert.equal(copy.uninstrumented, 1);
  assert.match(copy.label, /could not/i);
  assert.equal(copy.tone, 'degraded');
});

test('a board nobody has pressed yet does not claim success', () => {
  const copy = describePresses(tallyPresses([]));
  assert.equal(copy.presses, 0);
  assert.notEqual(copy.tone, 'ok');
  assert.match(copy.label, /no presses/i);
});

test('the panel keeps the attribution and the count apart', () => {
  // "Two of nineteen presses changed something" is a claim. "Inert in the studio"
  // is a caveat on it. Fusing them makes a long list of caveats read as a list of
  // accusations.
  const copy = describePresses(tallyPresses(observe(press('Avatar'), { kind: 'flush' })));
  assert.match(copy.label, /0 of 1/);
  assert.doesNotMatch(copy.label, /inert/);
  assert.match(copy.detail, /inert/i);
});

test('the pressed target is clipped so one row cannot flood the panel', () => {
  const long = 'Practice guitar — a habit with a very long name that keeps going';
  assert.equal(clipTarget(long).length, PRESS_TARGET_MAX);
  assert.ok(clipTarget(long).endsWith('…'));
  // Short targets are untouched, so the common case never gains an ellipsis.
  assert.equal(clipTarget('Avatar'), 'Avatar');
  assert.equal(clipTarget('  Avatar  '), 'Avatar');
  assert.equal(clipTarget(null), null);
});