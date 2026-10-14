// The two views of the router directory must agree.
//
// `screens.ts` reads the router with `require.context` and decides what is a
// screen; the route panel needs the same decision to know which files belong to
// the `(tabs)` group. Two hand-written copies of "strip the group prefix" drift
// apart the first time someone adds a group, and the failure is silent: the board
// grows a screen the route list has never heard of, or the route list declares a
// route for a file that is not on the board.
//
// So the rules live here — one place, importable under `node --test` because
// `screens.ts` itself is not, since it calls `require.context`. This file asserts
// both halves: the rules behave, and `screens.ts` actually uses them rather than
// keeping a private copy.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isRouteFile,
  screenKeyOf,
  routeOf,
  groupOf,
  tabKeys,
} from '../mobile/src/ide/routerKeys.ts';
import { ALL_ROUTER_KEYS } from './helpers/routerListing.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Comments stripped, so prose about a rule is not read as the rule. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

test('layouts and the studio route are not screens', () => {
  assert.equal(isRouteFile('./(tabs)/index.tsx'), true);
  assert.equal(isRouteFile('./habit.tsx'), true);
  assert.equal(isRouteFile('./_layout.tsx'), false);
  assert.equal(isRouteFile('./(tabs)/_layout.tsx'), false);
  assert.equal(isRouteFile('./ide.tsx'), false);
});

test('the group prefix is stripped so group members get plain keys', () => {
  assert.equal(screenKeyOf('./(tabs)/index.tsx'), 'index');
  assert.equal(screenKeyOf('./(tabs)/stats.tsx'), 'stats');
  assert.equal(screenKeyOf('./habit.tsx'), 'habit');
  assert.equal(screenKeyOf('./login.tsx'), 'login');
});

test('the index screen is the root route', () => {
  assert.equal(routeOf('./(tabs)/index.tsx'), '/');
  assert.equal(routeOf('./(tabs)/habits.tsx'), '/habits');
  assert.equal(routeOf('./settings.tsx'), '/settings');
});

test('group membership is read from the raw key, before normalisation', () => {
  // This is the whole reason the rule lives here: the tab bar reaches the router
  // directly, so its presses are not observable, but the group's membership is
  // knowable for free from the directory listing — and only before `normalize`
  // has thrown the group away.
  assert.equal(groupOf('./(tabs)/stats.tsx'), 'tabs');
  assert.equal(groupOf('./habit.tsx'), null);
  assert.deepEqual(tabKeys(ALL_ROUTER_KEYS), [
    './(tabs)/habits.tsx',
    './(tabs)/index.tsx',
    './(tabs)/profile.tsx',
    './(tabs)/stats.tsx',
  ]);
});

test('tab membership uses the same exclusion rule as screen enumeration', () => {
  // A file can only be a tab destination if it is also a screen. Asserting it
  // through one shared predicate is what stops the two lists diverging.
  for (const key of tabKeys(ALL_ROUTER_KEYS)) {
    assert.equal(isRouteFile(key), true, `${key} is excluded from screens but offered as a tab`);
  }
  assert.equal(tabKeys(['./(tabs)/_layout.tsx', './ide.tsx']).length, 0);
});

test('every tab member is on the board, and the board reaches every tab member', () => {
  // The board enumerates `isRouteFile`; the route list enumerates `tabKeys`.
  // Over a real router listing the two sets must nest.
  const board = ALL_ROUTER_KEYS.filter(isRouteFile).map(screenKeyOf);
  const tabs = tabKeys(ALL_ROUTER_KEYS).map(screenKeyOf);
  assert.ok(tabs.length > 0, 'this listing has no tab group at all');
  for (const key of tabs) {
    assert.ok(board.includes(key), `${key} is a tab destination but never reaches the board`);
  }
});

test('screens.ts uses these rules rather than keeping a private copy', () => {
  // The mechanism that rots. A second inline copy of the group-prefix regex would
  // pass every test above and still drift, because only the real file knows.
  const screens = code('mobile/src/ide/screens.ts');
  assert.match(screens, /from '\.\/routerKeys'/, 'screens.ts should import the shared rules');
  assert.match(screens, /isRouteFile\(/, 'screens.ts should filter with isRouteFile');
  assert.match(screens, /screenKeyOf\(/, 'screens.ts should key screens with screenKeyOf');

  // And no private regex left behind.
  assert.doesNotMatch(screens, /\^\\\.\//, 'screens.ts still has its own prefix regex');
  assert.doesNotMatch(screens, /\(tabs\)\\\//, 'screens.ts still strips the group prefix itself');
  assert.doesNotMatch(screens, /_layout\.tsx\$|ide\.tsx\$/, 'screens.ts still has its own exclusion');
});

test('the listing this suite runs against is the real router directory', () => {
  // If a route file is added and these rules need to know about it, this is the
  // test that says so. The listing is computed from disk, so it cannot go stale.
  assert.equal(ALL_ROUTER_KEYS.length, 10, 'seven screens, two layouts, and the studio route');
  assert.ok(ALL_ROUTER_KEYS.includes('./(tabs)/stats.tsx'));
});