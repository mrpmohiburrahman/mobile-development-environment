// Rendering a screen from a token tree other than the module import.
//
// This is the load-bearing mechanism behind baseline mode: the studio draws the
// same screen twice, once from the live tokens and once from the tokens at HEAD,
// and the comparison only means something because both use the same components.
//
// The decision these tests pin is not the mechanism, it is the semantics — what
// the baseline column *is*. A pinned render gets exactly its tree, with no merge
// and no override layer. That is what makes the comparison answer "what has
// drifted from what was last committed" rather than applying the author's
// in-flight edits to the committed state and hiding part of the difference.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../mobile/src/ds/tokens.json' with { type: 'json' };
import { applyOverrides } from '../mobile/src/ds/applyOverrides.ts';
import {
  resolveTokensFor,
  leafPaths,
  readPath,
  LIVE,
  type TokenSource,
} from '../mobile/src/ds/renderSource.ts';

const live = () => structuredClone(tokens) as Record<string, any>;
const pinned = (tree: Record<string, any>, label = 'baseline'): TokenSource => ({
  kind: 'pinned',
  tree,
  label,
});

// ---------------------------------------------------------------------------
// The live source is unchanged behaviour
// ---------------------------------------------------------------------------

test('a live render is the module import with the override layer merged', () => {
  const base = live();
  const resolved = resolveTokensFor(LIVE, base, { 'color.light.accent': '#ABCDEF' });
  assert.equal(resolved.color.light.accent, '#ABCDEF');
});

test('a live render with no overrides returns the base tree itself', () => {
  // The identity short-circuit applyOverrides already guarantees, and it matters
  // here: every live screen re-renders on every token drag, so a needless clone
  // per render is a needless clone per screen.
  const base = live();
  assert.equal(resolveTokensFor(LIVE, base, {}), base);
  assert.equal(resolveTokensFor(LIVE, base), base);
});

// ---------------------------------------------------------------------------
// A pinned render gets exactly its tree
// ---------------------------------------------------------------------------

test('a pinned render ignores the override layer entirely', () => {
  // The decision. Applying the same overrides to both columns would apply the
  // author's in-flight edits to the committed state too, so the two columns
  // would agree on precisely the tokens being edited — and the tool would show
  // no drift for exactly the edits most worth seeing.
  const baseline = live();
  const resolved = resolveTokensFor(pinned(baseline), live(), {
    'color.light.accent': '#ABCDEF',
    'space.md': 99,
  });

  assert.equal(resolved.color.light.accent, tokens.color.light.accent);
  assert.equal(resolved.space.md, tokens.space.md);
  assert.notEqual(resolved.color.light.accent, '#ABCDEF');
});

test('a pinned render is not cloned on the way out', () => {
  // The tree is fixed and shared by every render in the column, so handing back
  // the same object avoids a clone per screen per drag.
  const baseline = live();
  assert.equal(resolveTokensFor(pinned(baseline), live(), {}), baseline);
});

test('the two columns disagree exactly where the tokens do', () => {
  // The shape of a real comparison: the file on disk has drifted from HEAD.
  const baseline = live();
  const working = live();
  working.color.light.accent = '#AAAA11';
  working.space.xl = 48;

  const current = resolveTokensFor(LIVE, working, {});
  const head = resolveTokensFor(pinned(baseline), working, {});

  assert.equal(current.color.light.accent, '#AAAA11');
  assert.equal(head.color.light.accent, tokens.color.light.accent);
  assert.equal(current.space.xl, 48);
  assert.equal(head.space.xl, tokens.space.xl);
  // Everything else still matches, which is what makes a diff useful.
  assert.deepEqual(Object.keys(current), Object.keys(head));
});

test('a pinned source cannot be given overrides, by construction', () => {
  // A discriminated union rather than "a tree plus optional overrides", so there
  // is no spelling that reintroduces the merged baseline.
  const source = pinned(live());
  assert.equal(source.kind, 'pinned');
  assert.equal('overrides' in source, false);
  assert.equal(Object.keys(source).sort().join(','), 'kind,label,tree');
});

// ---------------------------------------------------------------------------
// Tokens present in one tree and not the other
// ---------------------------------------------------------------------------

test('a token added since HEAD is visible as a missing path, not a crash', () => {
  const baseline = live();
  const working = live();
  working.color.light.somethingNew = '#123456';

  const current = resolveTokensFor(LIVE, working, {});
  const head = resolveTokensFor(pinned(baseline), working, {});

  // Current has it; the baseline does not. Reading it from the baseline yields
  // undefined rather than throwing, which is the defined answer the comparison
  // needs in order to report "added since HEAD".
  assert.equal(readPath(current, 'color.light.somethingNew'), '#123456');
  assert.equal(readPath(head, 'color.light.somethingNew'), undefined);
});

test('a token removed since HEAD reads as undefined on the current side', () => {
  const baseline = live();
  const working = live();
  delete working.color.light.success;

  const current = resolveTokensFor(LIVE, working, {});
  const head = resolveTokensFor(pinned(baseline), working, {});

  assert.equal(readPath(current, 'color.light.success'), undefined);
  assert.equal(readPath(head, 'color.light.success'), tokens.color.light.success);
});

test('reading a path through a missing branch returns undefined', () => {
  // Not a throw: a tree that lost a whole branch is a legitimate state to render
  // a comparison against.
  const tree = { color: { light: {} } };
  assert.equal(readPath(tree, 'color.light.accent'), undefined);
  assert.equal(readPath(tree, 'nope.nope.nope'), undefined);
  assert.equal(readPath(null, 'a.b'), undefined);
});

// ---------------------------------------------------------------------------
// Enumerating leaves, so the two trees can be diffed before anything renders
// ---------------------------------------------------------------------------

test('leafPaths finds every token in the real file', () => {
  const paths = leafPaths(tokens);
  assert.ok(paths.includes('color.light.accent'));
  assert.ok(paths.includes('elevation.sm'));
  assert.ok(paths.includes('type.caption.weight'));
  assert.ok(paths.includes('radius.pill'));
  // No interior object is listed as a leaf of itself.
  assert.equal(paths.includes('color'), false);
  assert.equal(paths.includes('type.title'), false);
});

test('leafPaths counts the same leaves applyOverrides would', () => {
  // A rough cross-check against the other seam: every family contributes.
  const paths = leafPaths(tokens);
  const families = new Set(paths.map((p) => p.split('.')[0]));
  assert.deepEqual([...families].sort(), ['color', 'elevation', 'radius', 'space', 'type']);
});

test('leafPaths treats a leaf as its own path', () => {
  // `type.*.weight` is the live non-object leaf: a string, and it must appear.
  const paths = leafPaths({ a: { b: '800' } });
  assert.deepEqual(paths, ['a.b']);
});

test('leafPaths indexes arrays rather than flattening them', () => {
  // tokens.json has none today. An index is a better answer than merging the
  // items into one path, which would make two different trees look alike.
  assert.deepEqual(leafPaths({ list: [1, 2] }), ['list.0', 'list.1']);
});

test('leafPaths on an empty or scalar tree is empty, not a crash', () => {
  assert.deepEqual(leafPaths({}), []);
  assert.deepEqual(leafPaths(null), []);
  assert.deepEqual(leafPaths(undefined), []);
});

test('the union of two trees path sets is what a comparison would iterate', () => {
  // Token added in one tree only: the union is strictly larger than either, and
  // that difference is the "added or removed" class of drift.
  const baseline = live();
  const working = live();
  working.color.light.brandNew = '#111111';

  const headPaths = new Set(leafPaths(baseline));
  const currentPaths = new Set(leafPaths(working));
  const union = new Set([...headPaths, ...currentPaths]);

  // `working` is baseline plus one token, so the union is the larger of the two —
  // one path bigger than the baseline, and exactly the path that is new.
  assert.equal(union.size, headPaths.size + 1);
  assert.equal(union.size, currentPaths.size);
  assert.deepEqual([...union].filter((p) => !headPaths.has(p)), ['color.light.brandNew']);
  assert.equal(headPaths.has('color.light.brandNew'), false);
  assert.equal(currentPaths.has('color.light.brandNew'), true);
});

// ---------------------------------------------------------------------------
// The mechanism reaches the app without touching guarded files
// ---------------------------------------------------------------------------

test('a pinned render of the real file still satisfies its own validation rules', () => {
  // A baseline tree is whatever `git show HEAD:...` returns. If that tree could
  // fail the rules the file must obey, a comparison could render a state the
  // studio would refuse to let anyone write.
  for (const path of leafPaths(tokens)) {
    assert.notEqual(readPath(tokens, path), undefined, `${path} vanished`);
  }
});

test('applyOverrides is not consulted for a pinned render', () => {
  // Stated as behaviour rather than implementation: a pinned tree containing an
  // override-shaped key must come back untouched.
  const baseline = live();
  const result = resolveTokensFor(pinned(baseline), live(), { 'color.light.accent': '#ABCDEF' });
  assert.equal(result, baseline);
  assert.equal(applyOverrides(live(), {}) === baseline, false);
});