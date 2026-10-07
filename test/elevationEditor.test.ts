// The elevation editor's reading helpers, and the two claims the control rests on.
//
// Elevation is a composite CSS value, so the studio gives it a text field rather
// than a slider — the ticket ruled a slider out explicitly, because a control
// that pretended elevation was a number would be worse than no control. These
// tests pin the pure half: normalising typed input, and describing a shadow
// without judging it beyond what validation already says.
//
// The second claim is that the two shipped shadows are readable, and that a drag
// cannot reach the studio's own chrome shadow — ticket 04 is what guarantees
// that, so it is asserted here rather than assumed.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tokens from '../mobile/src/ds/tokens.json' with { type: 'json' };
import { validateBoxShadow } from '../mobile/src/ds/tokenValidation.ts';
import {
  normalizeShadow,
  describeShadow,
  SHADOW_PLACEHOLDER,
} from '../mobile/src/ide/elevationEditor.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// ---------------------------------------------------------------------------
// Normalising what a person typed
// ---------------------------------------------------------------------------

test('normalize trims and collapses whitespace', () => {
  // Typed input arrives with stray leading spaces and double gaps. Without this a
  // value differing only in whitespace is refused for a reason the author cannot
  // see in the field.
  assert.equal(normalizeShadow('  0px 2px 4px red  '), '0px 2px 4px red');
  assert.equal(normalizeShadow('0px   2px\t4px\nred'), '0px 2px 4px red');
});

test('normalize leaves a well-formed value byte-identical', () => {
  // It must be idempotent on real values, or every keystroke would look like a
  // change and the field would never go quiet.
  for (const value of Object.values(tokens.elevation)) {
    assert.equal(normalizeShadow(value), value);
    assert.equal(normalizeShadow(normalizeShadow(value)), value);
  }
});

test('normalize does not disturb the commas inside rgba()', () => {
  // The collapse is over whitespace, so `rgba(35,25,20,0.06)` is untouched. A
  // naive "remove all spaces" would corrupt it to `rgba(35,25,20,0.06)`.
  const value = '0px 2px 4px 0px rgba(35,25,20,0.06)';
  assert.equal(normalizeShadow(` ${value} `), value);
});

// ---------------------------------------------------------------------------
// Describing a shadow while it is still being typed
// ---------------------------------------------------------------------------

test('an empty field asks for a shadow rather than complaining about one', () => {
  // The first thing a person does is nothing. "elevation needs at least 1 layer"
  // at an empty field would be scolding.
  const summary = describeShadow('');
  assert.equal(summary.valid, false);
  assert.equal(summary.error, 'enter a box-shadow');
  assert.equal(summary.count, '');
});

test('a partial shadow is described rather than only rejected', () => {
  // Mid-typing, `0px` alone is a single length and cannot render a shadow. The
  // summary shows what has been entered so far and why it is not yet usable.
  //
  // Note `0px 1px` is *not* an example of that: two lengths is offset and blur,
  // which is legal CSS, so the rule accepts it. It is a zero-blur shadow, not an
  // unfinished one.
  const summary = describeShadow('0px');
  assert.equal(summary.valid, false);
  assert.equal(summary.count, '1 layer');
  assert.match(summary.error!, /at least 2 lengths/);
});

test('a zero-blur two-length shadow is legal, because CSS allows it', () => {
  // Guards against "fixing" the layer rule to demand three lengths, which would
  // refuse a valid shadow.
  assert.equal(describeShadow('0px 1px').valid, true);
  assert.equal(describeShadow('0px 1px').count, '1 layer');
});

test('the real shipped shadows read as valid, two layers each', () => {
  for (const [name, value] of Object.entries(tokens.elevation)) {
    const summary = describeShadow(value);
    assert.equal(summary.valid, true, `${name} should be valid`);
    assert.equal(summary.count, '2 layers', name);
  }
});

test('the blur of each layer is reported in order', () => {
  // `elevation.md` is a tight 4px blur under a wide 40px one. Knowing which is
  // which is the point of reading the value back.
  const summary = describeShadow(tokens.elevation.md);
  assert.equal(summary.blurs, '4px · 40px');
});

test('inset and colour are detected per layer', () => {
  const summary = describeShadow('inset 0px 2px 4px #000000, 0px 1px 2px rgba(0,0,0,0.1)');
  assert.equal(summary.layers.length, 2);
  assert.equal(summary.layers[0].inset, true);
  assert.equal(summary.layers[0].hasColor, true);
  assert.equal(summary.layers[1].inset, false);
  assert.equal(summary.layers[1].hasColor, true);
});

test('a shadow with no colour anywhere is still valid, and says so', () => {
  // The colour is optional in CSS, and the real rule in ticket 05 allows it.
  const summary = describeShadow('0px 2px 4px 0px');
  assert.equal(summary.valid, true);
  assert.equal(summary.layers[0].hasColor, false);
  assert.equal(summary.layers[0].blur, '4px');
});

test('a layer too short to name a blur reports ? rather than inventing one', () => {
  // Reading a blur out of `0px 2px` would be inventing it.
  const summary = describeShadow('0px 2px');
  assert.equal(summary.blurs, '?');
});

test('describeShadow never disagrees with validateBoxShadow', () => {
  // The summary is a convenience; validation is the rule. If they ever parted,
  // the field would say a shadow was fine while the store refused it.
  for (const text of [
    '',
    '0px',
    '0px 1px',
    '0px 1px 2px',
    '2 4px 6px red',
    'hello',
    tokens.elevation.sm,
    tokens.elevation.md,
    'inset 0px 2px 4px #000000',
  ]) {
    assert.equal(
      describeShadow(text).valid,
      validateBoxShadow(normalizeShadow(text)).ok,
      `disagreed on ${JSON.stringify(text)}`,
    );
  }
});

test('a single layer is not what the file contains, and the rules say so', () => {
  // The ticket asked that the editor match the shape the file actually holds
  // rather than accept anything CSS would parse. A single-layer shadow parses
  // fine but has never been in this file.
  const single = validateBoxShadow('0px 2px 4px rgba(0,0,0,0.1)');
  assert.equal(single.ok, true, 'CSS accepts it — the editor still should not suggest it');

  // So the placeholder, which is what the field advertises, shows two layers.
  assert.match(SHADOW_PLACEHOLDER, /,/);
  assert.equal(describeShadow(SHADOW_PLACEHOLDER).count, '2 layers');
});

test('the placeholder is the shipped value, not an invention', () => {
  // An example the app has proven renders, rather than one written from memory.
  assert.equal(SHADOW_PLACEHOLDER, tokens.elevation.md);
});

// ---------------------------------------------------------------------------
// The chrome is not reachable from an elevation drag
// ---------------------------------------------------------------------------

test('the studio chrome keeps its own hardcoded shadow', () => {
  // Ticket 04 is what guarantees this. Asserted rather than assumed, because the
  // failure would be invisible until someone dragged the control.
  const blueprint = read('mobile/src/ide/Blueprint.tsx');
  const shadows = [...blueprint.matchAll(/boxShadow:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(shadows.length > 0, 'expected the chrome to carry a hardcoded shadow');
  for (const shadow of shadows) {
    // Not one of the token values: the chrome is not reading elevation at all.
    assert.ok(
      !Object.values(tokens.elevation).includes(shadow as any),
      'the chrome shadow came from the elevation tokens',
    );
    assert.equal(validateBoxShadow(shadow).ok, true, 'the chrome shadow should still be a valid shadow');
  }
});

test('no chrome file reads the elevation tokens', () => {
  for (const rel of ['mobile/src/ide/Blueprint.tsx', 'mobile/src/ide/TokenPanel.tsx']) {
    const code = read(rel)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /useTheme/, `${rel} reads app tokens`);
  }
});

test('the panel offers a control for both elevation tokens', () => {
  // The gap this closes: a live control for every token family except the one
  // that is a CSS string.
  const panel = read('mobile/src/ide/TokenPanel.tsx');
  assert.match(panel, /title="Elevation"/);
  assert.match(panel, /ShadowInput/);
  assert.match(panel, /Object\.entries\(tokens\.elevation\)/);
});

test('the elevation control commits through setToken, not around it', () => {
  // Writing straight to the server would skip validation in the store and leave
  // the override layer out of step with the file.
  const panel = read('mobile/src/ide/TokenPanel.tsx');
  assert.match(panel, /onCommit=\{\(next\) => setToken\(`elevation\.\$\{name\}`, next\)\}/);
});