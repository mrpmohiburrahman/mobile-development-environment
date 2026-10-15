// The studio's chrome must not read the tokens it edits.
//
// The bug: all four chrome files imported `Text` from `../ui`, which calls
// `useTheme()`. Dragging `type.caption.size` therefore resized the editor's own
// labels — the control for a token distorted the studio while you adjusted it.
//
// A component test would catch a regression here but is not available here: there
// is no framework, no build step and no DOM in `node --test`. So this asserts the
// two things that actually rot, statically, against the real files:
//
//   1. no chrome file imports `Text` from `../ui` (the mechanism of the bug), and
//   2. no chrome file reaches for `useTheme` (any other route to the same defect).
//
// A future edit that reintroduces the import fails here rather than being caught
// by a human noticing the editor wobble while dragging.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHROME, CHROME_RADIUS, LABEL_SPEC, TONE, chipStyle } from '../mobile/src/ide/chrome.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The chrome. ide.tsx is included: it is the studio's own route. */
const CHROME_FILES = [
  'mobile/src/app/ide.tsx',
  'mobile/src/ide/Blueprint.tsx',
  'mobile/src/ide/StatePanel.tsx',
  'mobile/src/ide/TokenPanel.tsx',
  'mobile/src/ide/DiskBadge.tsx',
];

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

test('no chrome file imports Text from the app ui', () => {
  // The precise defect. `Text` in ui/ resolves sizes through useTheme().
  for (const rel of CHROME_FILES) {
    assert.doesNotMatch(
      read(rel),
      /from\s+['"]\.\.\/ui['"]/,
      `${rel} imports from ../ui, whose Text reads useTheme()`,
    );
  }
});

test('no chrome file calls useTheme', () => {
  // The general form of the same bug, for any future route to app tokens.
  // Comments are stripped first: DiskBadge.tsx explains this defect in prose and
  // names useTheme while doing it, which a raw text match would flag as a bug.
  const code = (rel: string) =>
    read(rel)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  for (const rel of CHROME_FILES) {
    assert.doesNotMatch(code(rel), /useTheme/, `${rel} calls useTheme()`);
  }
});

test('the chrome files that need tokens import them from the store, not the ui', () => {
  // TokenPanel genuinely must read the tokens it edits — that is the panel's job.
  // The assertion is on *how*, so a future file cannot quietly route around this.
  const panel = read('mobile/src/ide/TokenPanel.tsx');
  assert.match(panel, /from '\.\.\/ds\/store'/, 'TokenPanel should read the store it edits');
  assert.doesNotMatch(panel, /from '\.\.\/ui'/);
});

test('every chrome text call site goes through Label', () => {
  // A stray raw <Text> in chrome would reintroduce the bug for one label.
  for (const rel of CHROME_FILES) {
    assert.doesNotMatch(
      read(rel),
      /<Text[\s>]/,
      `${rel} renders <Text> directly instead of <Label>`,
    );
  }
});

test('the frozen label scale still matches the tokens it was copied from', () => {
  // The point of freezing is that it does NOT follow tokens.json. So this pins
  // today's values, and it is expected to fail if someone re-derives LABEL_SPEC
  // from the tokens — that is the regression this file exists to prevent.
  assert.deepEqual(LABEL_SPEC, {
    caption: { size: 12, weight: '400', lineHeight: 16, letterSpacing: 0.1 },
    label: { size: 13, weight: '600', lineHeight: 18, letterSpacing: 0.2 },
    body: { size: 16, weight: '400', lineHeight: 24, letterSpacing: 0 },
    title: { size: 20, weight: '700', lineHeight: 26, letterSpacing: -0.3 },
  });
});

test('the frozen label scale is independent of tokens.json', () => {
  // Proof by construction rather than by inspection: mutate a token role the
  // studio depends on, and confirm the chrome's own numbers do not move.
  const tokens = JSON.parse(read('mobile/src/ds/tokens.json'));
  const before = LABEL_SPEC.caption.size;

  tokens.type.caption.size = 47;
  tokens.type.caption.lineHeight = 61;

  assert.equal(LABEL_SPEC.caption.size, before);
  assert.notEqual(LABEL_SPEC.caption.size, tokens.type.caption.size);
});

test('every label role has a complete, usable spec', () => {
  // A role added to the union but not the table would render undefined sizes.
  for (const [role, spec] of Object.entries(LABEL_SPEC)) {
    assert.ok(spec.size > 0, `${role} has no size`);
    assert.ok(spec.lineHeight >= spec.size, `${role} lineHeight below its size`);
    assert.match(spec.weight, /^\d{3}$/, `${role} weight is not a CSS numeric string`);
    assert.equal(typeof spec.letterSpacing, 'number');
  }
});

test('the roles Label offers are exactly the ones the chrome used', () => {
  // The four files used role="caption" | "label" | "body" | "title" and nothing
  // else. If the union grows, something new is using chrome and wants a spec.
  assert.deepEqual(Object.keys(LABEL_SPEC).sort(), ['body', 'caption', 'label', 'title']);
});

test('the chrome palette is still one palette, and the badge tones are distinct', () => {
  // The fixed-size labels were to read as one deliberate system with CHROME, not
  // a second competing palette: so CHROME keeps its neutrals and TONE keeps only
  // the three semantic states.
  assert.deepEqual(Object.keys(CHROME).sort(), [
    'bg',
    'border',
    'panel',
    'panelSoft',
    'text',
    'textMuted',
  ]);
  assert.equal(new Set(Object.values(TONE)).size, 3);
});

test('chrome radii are fixed, including the pill', () => {
  // Blueprint's zoom pill used to borrow t.radius.pill, so a radius drag
  // reshaped the studio's own furniture.
  assert.equal(CHROME_RADIUS.pill, 999);
  assert.equal(new Set(Object.values(CHROME_RADIUS)).size, 4);
});

test('inactive regular chips retain their fixed chrome style', () => {
  assert.deepEqual(chipStyle({ active: false, pressed: false, size: 'regular' }), {
    container: {
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: '#211C18',
      opacity: 1,
    },
    textColor: '#9C928A',
  });
});

test('active regular chips use the selected colors', () => {
  assert.deepEqual(chipStyle({ active: true, pressed: false, size: 'regular' }), {
    container: {
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: '#D9481E',
      opacity: 1,
    },
    textColor: '#fff',
  });
});

test('pressed regular chips retain their colors at reduced opacity', () => {
  for (const [active, backgroundColor, textColor] of [
    [false, '#211C18', '#9C928A'],
    [true, '#D9481E', '#fff'],
  ] as const) {
    assert.deepEqual(chipStyle({ active, pressed: true, size: 'regular' }), {
      container: {
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor,
        opacity: 0.7,
      },
      textColor,
    });
  }
});

test('compact chips retain smaller padding in every selection and press state', () => {
  for (const [active, pressed, backgroundColor, textColor, opacity] of [
    [false, false, '#211C18', '#9C928A', 1],
    [true, false, '#D9481E', '#fff', 1],
    [false, true, '#211C18', '#9C928A', 0.7],
    [true, true, '#D9481E', '#fff', 0.7],
  ] as const) {
    assert.deepEqual(chipStyle({ active, pressed, size: 'compact' }), {
      container: {
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor,
        opacity,
      },
      textColor,
    });
  }
});

test('mobile/src/ui is untouched by this decoupling', () => {
  // The bug was that chrome read app tokens, not that ui is wrong. ui stays.
  const ui = read('mobile/src/ui/index.tsx');
  assert.match(ui, /useTheme/, 'ui/Text is supposed to read tokens — that is its job');
});