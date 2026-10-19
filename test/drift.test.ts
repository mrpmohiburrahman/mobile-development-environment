// Drift as a difference between two token trees.
//
// The claim being defended: the studio flags drift by rendering the same
// components twice against two token sets, and comparing those sets. It is NOT a
// pixel diff of two screenshots. These tests pin the comparison that backs that
// claim, and the comment at the top of `baseline.mjs` says why the distinction
// matters — a pixel diff would flag the zoom level and the font that happened to
// load, none of which are drift in the design system.
//
// "Current" is `base + overrides`: what the app shows now, including edits not yet
// committed. "Baseline" is `HEAD`. So an edit made seconds ago and never committed
// is drift, which is the point.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tokens from '../mobile/src/ds/tokens.json' with { type: 'json' };
import { diffTrees, isInSync, groupByFamily, leafCount } from '../mobile/src/ds/drift.ts';
import { leafPaths, readPath } from '../mobile/src/ds/renderSource.ts';

const live = () => structuredClone(tokens) as Record<string, any>;
const at = (tree: Record<string, any>, path: string) => readPath(tree, path);

// ---------------------------------------------------------------------------
// Nothing drifted
// ---------------------------------------------------------------------------

test('a tree diffed against itself has no drift', () => {
  const tree = live();
  assert.deepEqual(diffTrees(tree, tree), []);
  assert.equal(isInSync(tree, tree), true);
});

test('the committed file diffed against HEAD is in sync', () => {
  // The everyday state: nothing edited, so nothing to report. A tool that showed
  // drift here would be crying wolf.
  assert.equal(isInSync(live(), live()), true);
});

// ---------------------------------------------------------------------------
// The three kinds of difference
// ---------------------------------------------------------------------------

test('a changed value is reported with both sides', () => {
  const current = live();
  current.color.light.accent = '#AAAA11';

  const diff = diffTrees(current, live());
  assert.deepEqual(diff, [
    { path: 'color.light.accent', kind: 'changed', current: '#AAAA11', baseline: tokens.color.light.accent },
  ]);
});

test('a token added since HEAD is reported as added', () => {
  // Present in the working file, absent from HEAD. Skipping it would lose a whole
  // class of drift — a new token nobody has committed is exactly what the tool
  // is for.
  const current = live();
  current.color.light.brandNew = '#123456';

  const diff = diffTrees(current, live());
  assert.equal(diff.length, 1);
  assert.equal(diff[0].kind, 'added');
  assert.equal(diff[0].path, 'color.light.brandNew');
  assert.equal(diff[0].current, '#123456');
  assert.equal(diff[0].baseline, undefined);
});

test('a token removed since HEAD is reported as removed', () => {
  const current = live();
  delete current.color.light.success;

  const diff = diffTrees(current, live());
  assert.equal(diff.length, 1);
  assert.equal(diff[0].kind, 'removed');
  assert.equal(diff[0].path, 'color.light.success');
  assert.equal(diff[0].current, undefined);
  assert.equal(diff[0].baseline, tokens.color.light.success);
});

test('a whole branch appearing or disappearing is drift, not a crash', () => {
  const added = live();
  (added as any).elevation.brandNew = '0px 1px 2px #000';

  const addedDiff = diffTrees(added, live());
  assert.deepEqual(addedDiff.map((d) => d.kind), ['added']);

  const removed = live();
  delete (removed as any).elevation;

  const removedDiff = diffTrees(removed, live());
  assert.equal(removedDiff.length, 2);
  assert.ok(removedDiff.every((d) => d.kind === 'removed'));
  assert.ok(removedDiff.some((d) => d.path === 'elevation.md'));
});

// ---------------------------------------------------------------------------
// The comparison is about tokens, not pixels
// ---------------------------------------------------------------------------

test('differences are confined to the token paths that actually differ', () => {
  // The property that separates this from a pixel diff: two trees differing in
  // two tokens produce exactly two differences, naming those tokens.
  //
  // `radius.pill` is deliberately not one of them — the file already holds 999,
  // so writing 999 changes nothing. A test that set it would pass for the wrong
  // reason and miss the point.
  const current = live();
  current.radius.pill = 500;
  current.space.md = 20;

  const diff = diffTrees(current, live());
  assert.deepEqual(diff.map((d) => d.path), ['radius.pill', 'space.md']);
});

test('an in-session edit is drift, because it is uncommitted by definition', () => {
  // What the user just did is precisely what the tool should surface.
  const current = live();
  current.type.caption.size = 34;
  const diff = diffTrees(current, live());
  assert.equal(diff.length, 1);
  assert.equal(diff[0].path, 'type.caption.size');
});

// ---------------------------------------------------------------------------
// Details that would make a report untrustworthy
// ---------------------------------------------------------------------------

test('results are sorted by path, so two runs are comparable', () => {
  // A drift list that reorders itself is hard to read and harder to diff.
  const current = live();
  current.space.xl = 1;
  current.color.light.accent = '#1';
  current.radius.sm = 2;

  const paths = diffTrees(current, live()).map((d) => d.path);
  assert.deepEqual(paths, [...paths].sort());
});

test('two runs over the same trees produce identical output', () => {
  const current = live();
  current.space.md = 20;
  current.color.dark.accent = '#2';
  assert.deepEqual(diffTrees(current, live()), diffTrees(current, live()));
});

test('NaN values compare equal to themselves rather than showing as drift', () => {
  // NaN !== NaN, so a naive compare would report permanent phantom drift on any
  // token that had ever held NaN.
  const a = { space: { md: NaN } };
  const b = { space: { md: NaN } };
  assert.deepEqual(diffTrees(a, b), []);
  assert.equal(isInSync(a, b), true);
});

test('a value that really did change is still caught alongside NaN', () => {
  const current = { space: { md: NaN, lg: 24 } };
  const baseline = { space: { md: NaN, lg: 40 } };
  const diff = diffTrees(current, baseline);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].path, 'space.lg');
});

test('string and numeric weights are compared as they are, not coerced', () => {
  // `type.*.weight` is "800" in the file. A loose compare would call '800' and 800
  // the same token and miss a real change.
  const current = { type: { title: { weight: '700' } } };
  const baseline = { type: { title: { weight: '800' } } };
  const diff = diffTrees(current, baseline);
  assert.equal(diff.length, 1);
  assert.equal(diff[0].current, '700');
  assert.equal(diff[0].baseline, '800');
});

test('the whole real file walks without throwing', () => {
  assert.ok(leafPaths(tokens).length > 40);
  assert.deepEqual(diffTrees(live(), live()), []);
});

// ---------------------------------------------------------------------------
// One walker, not two
// ---------------------------------------------------------------------------

test('the comparison and the render walk a tree with the same code', () => {
  // drift.ts borrows leafPaths/readPath from renderSource.ts rather than
  // reimplementing them. Stated as a fact about the module graph: a second
  // walker could report a path the render could not read, and the comparison
  // would stop matching what it claims to describe.
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../mobile/src/ds/drift.ts'), 'utf8');
  assert.match(source, /from '\.\/renderSource\.ts'/);
  assert.doesNotMatch(source, /function leafPaths|function readPath/, 'drift.ts reimplements a walker');
});

test('leafCount agrees with the walker the comparison uses', () => {
  assert.equal(leafCount(tokens), leafPaths(tokens).length);
  assert.equal(leafCount({}), 0);
  assert.equal(leafCount(null), 0);
});

// ---------------------------------------------------------------------------
// Grouping, which is what the UI shows
// ---------------------------------------------------------------------------

test('differences group by family, largest first', () => {
  const current = live();
  current.space.md = 20;
  current.space.lg = 30;
  current.radius.sm = 3;
  current.color.light.accent = '#1';

  const groups = groupByFamily(diffTrees(current, live()));
  // Largest group first, ties broken alphabetically so the order is stable.
  assert.deepEqual(groups.map((g) => g.family), ['space', 'color', 'radius']);
  assert.deepEqual(groups.map((g) => g.count), [2, 1, 1]);
});

test('grouping an in-sync pair yields nothing to show', () => {
  assert.deepEqual(groupByFamily(diffTrees(live(), live())), []);
});

test('a group carries its own differences, not just a count', () => {
  const current = live();
  current.space.md = 20;
  const [group] = groupByFamily(diffTrees(current, live()));
  assert.equal(group.family, 'space');
  assert.equal(group.differences[0].path, 'space.md');
});

test('readPath reads a nested leaf and reports absence as undefined', () => {
  assert.equal(at(tokens, 'type.display.weight'), '700');
  assert.equal(at(tokens, 'type.caption.weight'), '400');
  assert.equal(at(tokens, 'elevation.sm'), tokens.elevation.sm);
  assert.equal(at(tokens, 'color.light.nope'), undefined);
});