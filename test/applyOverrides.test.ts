// The override layer: dotted-path writes and the merge over the token tree.
//
// These are the functions that decide whether a token edit lands, so they are
// pinned against the real `tokens.json` rather than a fixture. If a token is
// renamed or removed upstream, a test here fails — which is the point.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import tokens from '../mobile/src/ds/tokens.json' with { type: 'json' };
import { applyOverrides, setPath } from '../mobile/src/ds/applyOverrides.ts';
import { setPath as serverSetPath } from '../token-server/tokens.mjs';

test('no overrides returns the same object, not a copy', () => {
  // Identity matters: useTokens memoises on this, and a needless clone on every
  // render of every screen is the kind of cost that hides in a blueprint.
  assert.equal(applyOverrides(tokens, {}), tokens);
});

test('an override is readable at the dotted path it was written to', () => {
  const next = applyOverrides(tokens, { 'color.light.accent': '#FF0000' });
  assert.equal(next.color.light.accent, '#FF0000');
});

test('an override does not mutate the imported base tokens', () => {
  const before = tokens.color.light.accent;
  applyOverrides(tokens, { 'color.light.accent': '#00FF00' });
  assert.equal(tokens.color.light.accent, before);
});

test('schemes are independent — editing light leaves dark alone', () => {
  const next = applyOverrides(tokens, { 'color.light.text': '#000000' });
  assert.equal(next.color.light.text, '#000000');
  assert.equal(next.color.dark.text, tokens.color.dark.text);
});

test('a dotted path reaches a nested leaf, not just the top level', () => {
  const next = applyOverrides(tokens, { 'type.caption.size': 14 });
  assert.equal(next.type.caption.size, 14);
  // The sibling leaves of the same role must survive.
  assert.equal(next.type.caption.lineHeight, tokens.type.caption.lineHeight);
  assert.equal(next.type.caption.weight, tokens.type.caption.weight);
});

test('several overrides in one pass all land', () => {
  const next = applyOverrides(tokens, {
    'color.light.accent': '#123456',
    'space.md': 20,
    'radius.lg': 30,
  });
  assert.equal(next.color.light.accent, '#123456');
  assert.equal(next.space.md, 20);
  assert.equal(next.radius.lg, 30);
});

test('the client setPath creates unknown keys — the documented asymmetry', () => {
  // Unreachable from the UI today: the panel derives paths from the token tree,
  // so they always exist. Recorded because it differs from the server.
  const obj: any = { color: { light: { accent: '#fff' } } };
  setPath(obj, 'color.light.brandNew', '#000');
  assert.equal(obj.color.light.brandNew, '#000');
});

test('the server setPath refuses unknown keys', () => {
  const obj: any = { color: { light: { accent: '#fff' } } };
  assert.equal(serverSetPath(obj, 'color.light.brandNew', '#000'), false);
  assert.equal(obj.color.light.brandNew, undefined);
});

test('the server setPath accepts an existing leaf', () => {
  const obj: any = { color: { light: { accent: '#fff' } } };
  assert.equal(serverSetPath(obj, 'color.light.accent', '#000'), true);
  assert.equal(obj.color.light.accent, '#000');
});

test('the server setPath refuses to traverse a non-object', () => {
  const obj: any = { color: { light: 'not-an-object' } };
  assert.equal(serverSetPath(obj, 'color.light.accent', '#000'), false);
});

test('both setPath implementations agree on every real token path', () => {
  // The asymmetry above is intentional, but only for paths that do not exist.
  // On real paths the two must be indistinguishable.
  for (const scheme of ['light', 'dark'] as const) {
    for (const name of Object.keys(tokens.color[scheme])) {
      const path = `color.${scheme}.${name}`;
      const a: any = structuredClone(tokens);
      const b: any = structuredClone(tokens);
      setPath(a, path, '#ABCDEF');
      serverSetPath(b, path, '#ABCDEF');
      assert.deepEqual(a, b, `disagreement at ${path}`);
    }
  }

  for (const role of Object.keys(tokens.type)) {
    const path = `type.${role}.size`;
    const a: any = structuredClone(tokens);
    const b: any = structuredClone(tokens);
    setPath(a, path, 99);
    serverSetPath(b, path, 99);
    assert.deepEqual(a, b, `disagreement at ${path}`);
  }
});

test('a write to a real token path does not disturb any other token', () => {
  const before = structuredClone(tokens);
  const next = applyOverrides(tokens, { 'space.md': 99 });
  for (const scheme of ['light', 'dark'] as const) {
    for (const name of Object.keys(tokens.color[scheme])) {
      assert.equal(next.color[scheme][name], before.color[scheme][name]);
    }
  }
  assert.equal(next.radius.pill, tokens.radius.pill);
  assert.equal(next.elevation.md, tokens.elevation.md);
});