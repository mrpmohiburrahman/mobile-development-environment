// One way to find the board's frames, and one that reports when it found nothing.
//
// ## Why this module exists
//
// Three features need the same thing: the drift walk pairs the two columns, the
// route panel counts the back controls on the board, and the render verdict reads
// computed type styles off them. Each grew its own `querySelector('#screen-' +
// key)` loop, and two of those three were written the same night.
//
// Frames are found by the frame's **own DOM id** — `#screen-<key>` and
// `#base-<key>`, from `nativeID` — and never by a custom `data-*` attribute,
// because React Native Web filters unknown props off `View`. `data-screen-key`
// silently never reaches the document, and a walk that finds zero pairs while the
// panel says the comparison has not run yet is the failure this repo already
// shipped once: benign-sounding and completely wrong.
//
// So the mechanism lives here, once. And it returns what it could **not** find
// alongside what it did, because the zero-count rule is the guard for this
// module's own failure mode: a reader that finds nothing must be distinguishable
// from a reader that was pointed at the wrong node.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  frameId,
  resolveFrames,
  resolveFramePairs,
  FRAME_PREFIX,
  BASELINE_PREFIX,
  type ResolvedFrames,
} from '../mobile/src/ide/boardFrames.ts';

const KEYS = ['index', 'habit', 'settings'];

/**
 * A host that resolves only the ids it was given, like a real `querySelector`.
 *
 * It compares the **unescaped** selector against the id, so a test only passes if
 * the module escaped correctly: `weird key` has to arrive here as `weird\ key`
 * and match the id `screen-weird key`, not as the raw string.
 */
function fakeHost(present: { current: string[]; baseline?: string[] }) {
  const built = new Set(present.current.map((k) => frameId(k)));
  const baseline = new Set((present.baseline ?? []).map((k) => frameId(k, true)));
  return {
    querySelector: (selector: string) => {
      const id = selector.slice(1).replace(/\\(.)/g, '$1');
      return built.has(id) || baseline.has(id) ? { id } : null;
    },
  };
}

test('frame ids are built the one way the board builds them', () => {
  // Blueprint.tsx renders `nativeID={baseline ? \`base-${key}\` : \`screen-${key}\`}`.
  // If these two ever disagree, every frame walk silently finds nothing.
  assert.equal(frameId('habit'), 'screen-habit');
  assert.equal(frameId('habit', true), 'base-habit');
  assert.equal(FRAME_PREFIX, 'screen-');
  assert.equal(BASELINE_PREFIX, 'base-');
});

test('a frame that mounted is found, and keyed by the board own key', () => {
  const resolved: ResolvedFrames = resolveFrames(fakeHost({ current: KEYS }), KEYS);

  assert.deepEqual(resolved.frames.map((f) => f.key), KEYS);
  assert.deepEqual(resolved.missing, []);
  assert.equal(resolved.frames[0].element.id, 'screen-index');
});

test('comparison inventory reads only comparison frames', () => {
  const host = fakeHost({ current: KEYS, baseline: ['habit'] });
  const result = resolveFrames(host, KEYS, 'comparison');
  assert.deepEqual(result.frames.map((frame) => frame.element.id), ['base-habit']);
  assert.deepEqual(result.missing, ['index', 'settings']);
});

test('a frame that did not mount is reported as missing, not skipped', () => {
  // The zero-count rule. A reader that found some frames and silently omitted the
  // rest would let a panel report a complete-looking comparison over a partial
  // board.
  const resolved = resolveFrames(fakeHost({ current: ['index', 'settings'] }), KEYS);

  assert.deepEqual(resolved.frames.map((f) => f.key), ['index', 'settings']);
  assert.deepEqual(resolved.missing, ['habit']);
  assert.equal(resolved.found, 2);
  assert.equal(resolved.asked, 3);
});

test('finding nothing is a distinct answer from finding everything', () => {
  // A broken reader and a quiet board must not look alike, which is the failure
  // this repo has already shipped once.
  const none = resolveFrames(fakeHost({ current: [] }), KEYS);
  const all = resolveFrames(fakeHost({ current: KEYS }), KEYS);

  assert.equal(none.found, 0);
  assert.equal(none.asked, 3);
  assert.deepEqual(none.missing, KEYS);
  assert.notEqual(JSON.stringify(none), JSON.stringify(all));
});

test('a host that is not a DOM node resolves nothing rather than throwing', () => {
  // The panel mounts before the board does, and a null ref is an ordinary state.
  for (const host of [null, undefined, {}, 'nope']) {
    const resolved = resolveFrames(host, KEYS);
    assert.equal(resolved.found, 0);
    assert.deepEqual(resolved.missing, KEYS);
  }
});

test('the baseline column is paired by the same rule, and reports what is absent', () => {
  const both = resolveFramePairs(fakeHost({ current: KEYS, baseline: KEYS }), KEYS);
  assert.deepEqual(both.pairs.map((p) => p.key), KEYS);
  assert.deepEqual(both.unpaired, []);
  assert.equal(both.found, 3);
  assert.equal(both.asked, 3);

  // Both sides absent: nothing to pair.
  assert.deepEqual(resolveFramePairs(fakeHost({ current: [], baseline: [] }), KEYS).pairs, []);
  // One side absent: also nothing to pair, and reported rather than half-drawn.
  // This is the "compares nothing and looks fine" case the drift panel used to
  // have, where a missing frame simply dropped out of the comparison.
  const oneSided = resolveFramePairs(fakeHost({ current: ['index', 'habit'], baseline: ['index'] }), KEYS);
  assert.deepEqual(oneSided.pairs.map((p) => p.key), ['index']);
  assert.deepEqual(oneSided.unpaired, ['habit', 'settings']);
  assert.deepEqual(resolveFramePairs(fakeHost({ current: ['index'], baseline: [] }), KEYS).pairs, []);
  assert.deepEqual(resolveFramePairs(fakeHost({ current: [], baseline: KEYS }), KEYS).pairs, []);
});

test('keys are escaped for the selector rather than pasted in raw', () => {
  // `screens.ts` derives keys from file names, so a key is not guaranteed to be a
  // bare identifier. An unescaped key makes querySelector throw, and a throw here
  // is a blank panel rather than a reported failure.
  const odd = ['weird key', 'a.b', 'x:y'];
  const resolved = resolveFrames(fakeHost({ current: odd }), odd);
  assert.deepEqual(resolved.missing, []);
  assert.deepEqual(resolved.frames.map((f) => f.key), odd);
});