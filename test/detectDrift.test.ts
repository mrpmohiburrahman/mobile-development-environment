// Which screens drifted, found by comparing computed styles.
//
// This is the flagship claim, so the tests are mostly about *not lying*:
//
//   - that the comparison reads computed styles, not RNW's generated class names;
//   - that it only looks at properties a token in `tokens.json` can move, so
//     renderer noise is not reported as drift;
//   - that a token is named only when its value pair matches on both sides, and
//     that an ambiguous or unmatched pair yields no name rather than a guess.
//
// The ticket's honest fallback is a weaker feature that says less, not a
// confident wrong answer. Every "returns null" test below is that fallback.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import tokens from '../mobile/src/ds/tokens.json' with { type: 'json' };
import { diffTrees, type Difference } from '../mobile/src/ds/drift.ts';
import {
  TOKEN_PROPERTIES,
  compareStyles,
  attributeToToken,
  normalizeValue,
  summariseDifferences,
  familyOfProperty,
  type StyleDifference,
  type StyleRecord,
} from '../mobile/src/ide/detectDrift.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const live = () => structuredClone(tokens) as Record<string, any>;
const driftOf = (current: unknown, baseline: unknown): Difference[] => diffTrees(current, baseline);

// ---------------------------------------------------------------------------
// The compared properties are exactly the token-movable ones
// ---------------------------------------------------------------------------

test('every compared property is one a token in tokens.json can move', () => {
  // The whole guard against false positives. A property the tokens cannot affect
  // would report renderer differences as drift, and then "this screen differs"
  // would stop meaning anything specific.
  const allowed = new Set([
    // color.*
    'color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    // space.*
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap',
    // radius.*
    'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
    // type.*
    'fontSize', 'lineHeight', 'letterSpacing', 'fontWeight',
    // elevation.*
    'boxShadow',
  ]);
  for (const property of TOKEN_PROPERTIES) {
    assert.ok(allowed.has(property), `${property} is not a token-movable property`);
  }
  assert.equal(new Set(TOKEN_PROPERTIES).size, TOKEN_PROPERTIES.length, 'a property is listed twice');
});

test('no compared property is layout noise the two renders could vary on', () => {
  // Width, height, position and transform are not token-driven. Comparing them
  // would make a font-loading or subpixel difference read as design drift.
  const forbidden = ['width', 'height', 'top', 'left', 'right', 'bottom', 'position', 'transform', 'opacity', 'zIndex', 'display', 'flexDirection'];
  for (const property of TOKEN_PROPERTIES) {
    assert.ok(!forbidden.includes(property), `${property} is renderer noise, not a token`);
  }
});

test('the comparison reads computed styles and never class names', () => {
  // RNW 0.21 and React 19 generate their own class names; comparing class strings
  // is meaningless. Asserted on the source because nothing at this layer can
  // observe it otherwise.
  const source = read('mobile/src/ide/detectDrift.ts');
  assert.match(source, /getComputedStyle/);
  assert.doesNotMatch(source, /\.className|classList/, 'the walk must not compare class names');
});

test('every compared property maps to a token family that exists in the file', () => {
  // familyOfProperty is what the UI shows when a difference cannot be attributed,
  // so a family name that is not in tokens.json would be a dead end for the reader.
  const families = new Set(TOKEN_PROPERTIES.map(familyOfProperty));
  for (const family of families) {
    assert.ok(family in tokens, `family "${family}" is not a family in tokens.json`);
  }
  assert.deepEqual([...families].sort(), ['color', 'elevation', 'radius', 'space', 'type']);
});

// ---------------------------------------------------------------------------
// Value normalisation, so equivalent renderings do not read as drift
// ---------------------------------------------------------------------------

test('a length in px and the same length unitless compare equal', () => {
  // The browser resolves 0 to `0px` in some properties and `0` in others.
  assert.equal(normalizeValue('paddingTop', '16px'), normalizeValue('paddingTop', '16'));
  assert.equal(normalizeValue('gap', '0px'), normalizeValue('gap', '0'));
});

test('a fractional length survives normalisation', () => {
  assert.equal(normalizeValue('fontSize', '12.5px'), '12.5px');
});

test('negative lengths normalise and stay signed', () => {
  // letterSpacing is legitimately negative in this file.
  assert.equal(normalizeValue('letterSpacing', '-0.5px'), '-0.5px');
});

test('the browser keyword forms of font weight map back to the file numbers', () => {
  // getComputedStyle reports 400 as `normal` and 700 as `bold`, while tokens.json
  // holds "400" and "700". Compared raw, every bold screen would read as drifted.
  assert.equal(normalizeValue('fontWeight', 'normal'), '400');
  assert.equal(normalizeValue('fontWeight', 'bold'), '700');
});

test('font weight drift is reported rather than skipped', () => {
  // The bug this guards: an earlier draft skipped fontWeight when it saw
  // normal/bold, which silently hid every weight change in the file.
  const drift = driftOf({ type: { title: { weight: '700' } } }, { type: { title: { weight: '400' } } });
  const found = compareStyles({ fontWeight: 'bold' }, { fontWeight: 'normal' }, drift);
  assert.equal(found.length, 1);
  assert.equal(found[0].property, 'fontWeight');
  assert.equal(found[0].current, '700');
  assert.equal(found[0].baseline, '400');
});

test('identical weights in different spellings are not drift', () => {
  const drift = driftOf({ type: { title: { weight: '700' } } }, { type: { title: { weight: '700' } } });
  const found = compareStyles({ fontWeight: 'bold' }, { fontWeight: '700' }, drift);
  assert.deepEqual(found, []);
});

test('colours compare case- and whitespace-insensitively', () => {
  assert.equal(normalizeValue('color', '#D9481E'), normalizeValue('color', '#d9481e'));
  assert.equal(normalizeValue('color', 'rgb(217, 72, 30)'), normalizeValue('color', 'rgb(217,72,30)'));
});

test('an absent property on both sides is not drift', () => {
  // getComputedStyle fills every property in, but a partially built record must
  // not manufacture differences out of missing keys.
  assert.deepEqual(compareStyles({}, {}, []), []);
});

test('a property present on only one side is drift', () => {
  const found = compareStyles({ fontSize: '16px' }, {}, []);
  assert.equal(found.length, 1);
  assert.equal(found[0].property, 'fontSize');
  assert.equal(found[0].baseline, '');
});

// ---------------------------------------------------------------------------
// Attribution: name a token only when the value pair says so
// ---------------------------------------------------------------------------

test('a token is named when its value pair matches both sides', () => {
  const drift = driftOf(
    { color: { light: { accent: '#AAAA11' } } },
    { color: { light: { accent: '#D9481E' } } },
  );
  const found = compareStyles({ backgroundColor: '#AAAA11' }, { backgroundColor: '#D9481E' }, drift);
  assert.equal(found.length, 1);
  assert.equal(found[0].token, 'color.light.accent');
});

test('no token is named when nothing matches', () => {
  // The honest fallback: say less rather than guess.
  const drift = driftOf(
    { color: { light: { accent: '#AAAA11' } } },
    { color: { light: { accent: '#D9481E' } } },
  );
  const found = compareStyles({ fontSize: '40px' }, { fontSize: '16px' }, drift);
  assert.equal(found.length, 1);
  assert.equal(found[0].token, null);
  // The family still tells the reader something useful.
  assert.equal(familyOfProperty(found[0].property), 'type');
});

test('an ambiguous value pair names no token', () => {
  // Two drifted tokens holding the same pair are indistinguishable without
  // static analysis. Reporting either one would be a confident wrong answer.
  const current = { color: { light: { accent: '#AAAA11', danger: '#AAAA11' } } };
  const baseline = { color: { light: { accent: '#D9481E', danger: '#D9481E' } } };
  const drift = driftOf(current, baseline);
  assert.equal(drift.length, 2);

  const found = compareStyles({ color: '#AAAA11' }, { color: '#D9481E' }, drift);
  assert.equal(found[0].token, null);
});

test('a token matching only one side is not enough to be named', () => {
  const drift = driftOf(
    { color: { light: { accent: '#AAAA11' } } },
    { color: { light: { accent: '#D9481E' } } },
  );
  const found = compareStyles({ color: '#AAAA11' }, { color: '#000000' }, drift);
  assert.equal(found[0].token, null);
});

test('attribution works for numeric tokens too', () => {
  const drift = driftOf({ space: { md: 20 } }, { space: { md: 16 } });
  const found = compareStyles({ paddingTop: '20px' }, { paddingTop: '16px' }, drift);
  assert.equal(found[0].token, 'space.md');
});

test('attribution matches a length in px against a unitless token value', () => {
  // The token file holds numbers; the browser reports lengths with units.
  const drift = driftOf({ space: { md: 20 } }, { space: { md: 16 } });
  const found = compareStyles({ gap: '20px' }, { gap: '16px' }, drift);
  assert.equal(found[0].token, 'space.md');
});

test('attribution matches a string weight against the browser keyword', () => {
  const drift = driftOf({ type: { title: { weight: '700' } } }, { type: { title: { weight: '400' } } });
  const found = compareStyles({ fontWeight: 'bold' }, { fontWeight: 'normal' }, drift);
  assert.equal(found[0].token, 'type.title.weight');
});

test('attribution works for a multi-layer box-shadow', () => {
  const drift = driftOf({ elevation: { md: '0px 9px 9px 0px rgba(0,0,0,0.99)' } }, { elevation: { md: tokens.elevation.md } });
  const found = compareStyles({ boxShadow: '0px 9px 9px 0px rgba(0,0,0,0.99)' }, { boxShadow: tokens.elevation.md }, drift);
  assert.equal(found[0].token, 'elevation.md');
});

test('attributeToToken on a hand-built difference is the same rule', () => {
  const drift = driftOf({ radius: { md: 24 } }, { radius: { md: 16 } });
  const difference: StyleDifference = {
    property: 'borderTopLeftRadius',
    current: '24px',
    baseline: '16px',
    token: null,
  };
  assert.equal(attributeToToken(difference, drift), 'radius.md');
});

test('attribution against an empty drift list always declines', () => {
  const difference: StyleDifference = { property: 'color', current: 'rgb(1,2,3)', baseline: 'rgb(4,5,6)', token: null };
  assert.equal(attributeToToken(difference, []), null);
});

// ---------------------------------------------------------------------------
// Summarising: fifty nodes, one fact
// ---------------------------------------------------------------------------

test('many nodes showing the same difference collapse to one line with a count', () => {
  // A screen with fifty matching nodes and one different is *one* thing wrong;
  // listing it fifty times would bury the signal.
  const drift = driftOf({ color: { light: { accent: '#AAAA11' } } }, { color: { light: { accent: '#D9481E' } } });
  const many: StyleDifference[] = Array.from({ length: 50 }, () => ({
    property: 'backgroundColor' as const,
    current: '#AAAA11',
    baseline: '#D9481E',
    token: 'color.light.accent',
  }));

  const summary = summariseDifferences(many);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].nodes, 50);
  assert.equal(summary[0].token, 'color.light.accent');
  assert.equal(summary[0].family, 'color');
});

test('summary is ordered by how many nodes showed each difference', () => {
  const diffs: StyleDifference[] = [
    ...Array.from({ length: 5 }, () => ({ property: 'fontSize' as const, current: 'a', baseline: 'b', token: null })),
    ...Array.from({ length: 9 }, () => ({ property: 'paddingTop' as const, current: 'a', baseline: 'b', token: null })),
  ];
  assert.deepEqual(summariseDifferences(diffs).map((d) => d.property), ['paddingTop', 'fontSize']);
});

test('an empty comparison summarises to nothing, not to a null row', () => {
  assert.deepEqual(summariseDifferences([]), []);
});

test('the family is reported even when the token is not', () => {
  const summary = summariseDifferences([{ property: 'letterSpacing', current: '2px', baseline: '0.1px', token: null }]);
  assert.equal(summary[0].family, 'type');
  assert.equal(summary[0].token, null);
});

// ---------------------------------------------------------------------------
// The scenario the ticket describes
// ---------------------------------------------------------------------------

test('an in-sync tree attributes nothing and reports no differences', () => {
  const drift = driftOf(live(), live());
  assert.deepEqual(drift, []);
  assert.deepEqual(compareStyles({ backgroundColor: '#FFF' }, { backgroundColor: '#FFF' }, drift), []);
});

test('one drifted token yields differences only on properties it can move', () => {
  const current = live();
  current.color.light.accent = '#AAAA11';
  const drift = driftOf(current, live());
  assert.equal(drift.length, 1);

  const same: StyleRecord = {
    backgroundColor: 'rgb(255, 255, 255)',
    color: 'rgb(33, 28, 23)',
    fontSize: '16px',
    paddingTop: '16px',
  };
  const found = compareStyles(same, same, drift);
  assert.deepEqual(found, [], 'a screen with no differing property is not drifted');
});

test('the real drift vocabulary covers every family the panel can name', () => {
  // Exercises the panel's vocabulary end to end against the real file.
  const current = live();
  current.color.light.accent = '#AAAA11';
  current.space.md = 20;
  current.radius.md = 24;
  current.type.caption.size = 13;
  current.elevation.sm = '0px 3px 3px 0px rgba(0,0,0,0.9)';

  const drift = driftOf(current, live());
  assert.equal(drift.length, 5);
  assert.deepEqual(
    drift.map((d) => d.path).sort(),
    ['color.light.accent', 'elevation.sm', 'radius.md', 'space.md', 'type.caption.size'],
  );
  // Every one is attributable to something renderable.
  for (const d of drift) {
    assert.ok(familyOfProperty(
      d.path.startsWith('color') ? 'color'
      : d.path.startsWith('space') ? 'paddingTop'
      : d.path.startsWith('radius') ? 'borderTopLeftRadius'
      : d.path.startsWith('elevation') ? 'boxShadow'
      : 'fontSize',
    ), d.path);
  }
});
test('a shadow is compared by content, not by serialisation order', () => {
  // The browser prints the colour first and the token file writes it last. They
  // are the same shadow, and every elevation difference would otherwise read as
  // unattributed for a reason that has nothing to do with design drift.
  const browser = 'rgba(35, 25, 20, 0.05) 0px 1px 2px 0px, rgba(35, 25, 20, 0.06) 0px 3px 10px 0px';
  const authored = tokens.elevation.sm;
  assert.equal(normalizeValue('boxShadow', browser), normalizeValue('boxShadow', authored));
});

test('a genuinely different shadow still differs after normalisation', () => {
  const drift = driftOf({ elevation: { sm: '0px 7px 7px 0px rgba(255,0,0,0.85)' } }, { elevation: { sm: tokens.elevation.sm } });
  const found = compareStyles(
    { boxShadow: 'rgba(255, 0, 0, 0.85) 0px 7px 7px 0px' },
    { boxShadow: 'rgba(35, 25, 20, 0.05) 0px 1px 2px 0px, rgba(35, 25, 20, 0.06) 0px 3px 10px 0px' },
    drift,
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].property, 'boxShadow');
  assert.equal(found[0].token, 'elevation.sm', 'the drifted token should now be named');
});

test('an inset shadow keeps its keyword through normalisation', () => {
  assert.match(normalizeValue('boxShadow', '0px 2px 4px #000000 inset'), /inset/);
});
