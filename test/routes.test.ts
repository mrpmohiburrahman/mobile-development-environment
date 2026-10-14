// The route list: what the app can navigate to, and how each fact was learned.
//
// ## Why provenance is mandatory and total
//
// A reader who sees "11 routes" believes the studio watched eleven. It watches
// seven. Four come from reading the router's directory and one control cannot be
// enumerated at all, and every one of those is a *different kind of knowledge*.
// A list that draws all eleven as equal rows is not a small lie; it is the exact
// kind of confident wrong this repo keeps shipping.
//
// So every row carries one of three provenances and there is no fourth state:
//
// - `observed`   — seen at the navigation seam.
// - `declared`   — read off the router's directory listing. Exists; never watched.
// - `unresolved` — known to exist, cannot be enumerated.
//
// ## Why a declared route may not carry a state change
//
// A declared route is inferred from a file on disk. There is no observation
// window around it, so pairing it with a measured difference would be a fabricated
// join — the most confident-looking possible fabrication, because both halves are
// real and the connection between them is invented.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRouteList,
  routeCounts,
  backGap,
  describeBackGap,
  declaredTabRoutes,
  screensWithoutExits,
  ROUTE_PROVENANCE,
  type RouteRow,
} from '../mobile/src/ide/routes.ts';
import { ALL_ROUTER_KEYS } from './helpers/routerListing.ts';
import { tabKeys } from '../mobile/src/ide/routerKeys.ts';
import { createSpine, spineReducer, type SpineEntry, type SpineInput } from '../mobile/src/ide/spine.ts';

function observe(...inputs: SpineInput[]): SpineEntry[] {
  return inputs.reduce(spineReducer, createSpine()).entries;
}

test('there are exactly three provenances, and no row can be built without one', () => {
  assert.deepEqual([...ROUTE_PROVENANCE].sort(), ['declared', 'observed', 'unresolved']);
  // The type is a union rather than a string, so this is a compile-time fact —
  // but the type is not enforced in CI, so the runtime table is the real one.
  for (const row of declaredTabRoutes(ALL_ROUTER_KEYS)) {
    assert.ok(ROUTE_PROVENANCE.includes(row.provenance));
  }
});

test('a route change through the seam is observed, with what it carried', () => {
  const entries = observe(
    { kind: 'store', store: 'app', before: { selectedId: null }, after: { selectedId: 'h2' } },
    { kind: 'route', from: 'index', to: '/habit', column: 'current' },
    { kind: 'flush' },
  );

  const rows = buildRouteList(entries);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    from: 'index',
    to: '/habit',
    provenance: 'observed',
    column: 'current',
    carriedChange: true,
    paths: ['selectedId'],
  });
});

test('a route change with no state change says so explicitly', () => {
  // An empty field reads as missing data. The row has to distinguish "nothing
  // moved" from "the studio did not look".
  const rows = buildRouteList(observe({ kind: 'route', from: 'index', to: '/profile', column: 'current' }, { kind: 'flush' }));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].carriedChange, false);
  assert.deepEqual(rows[0].paths, []);
});

test('the comparison column is marked on its own routes', () => {
  const rows = buildRouteList(observe({ kind: 'route', from: 'index', to: '/habit', column: 'comparison' }, { kind: 'flush' }));
  assert.equal(rows[0].column, 'comparison');
});

test('the tab destinations are declared from the directory, not observed', () => {
  const rows = declaredTabRoutes(ALL_ROUTER_KEYS);
  // Sorted by directory key rather than by the board's reading order: the list's
  // order must not depend on a second hand-maintained sequence.
  assert.deepEqual(rows.map((r) => r.to), ['/habits', '/', '/profile', '/stats']);
  for (const row of rows) {
    assert.equal(row.provenance, 'declared');
    assert.equal(row.from, '(tabs)', 'a tab press has no single source screen');
    assert.equal(row.column, null);
  }
});

test('a declared route never carries a state change', () => {
  // Even when the observer offers one. Pairing a directory reading with a measured
  // difference has no observation window to justify it.
  const rows = buildRouteList(observe({ kind: 'route', from: '(tabs)', to: '/stats', column: 'current' }, { kind: 'flush'}), ALL_ROUTER_KEYS);

  const declared = rows.filter((r) => r.provenance === 'declared');
  assert.ok(declared.length > 0);
  for (const row of declared) {
    assert.equal(row.carriedChange, false, `${row.to} declared a change it never observed`);
    assert.deepEqual(row.paths, []);
  }
});

test('the tab bar declares routes and never reports its presses as route changes', () => {
  // Tapping a tab on the board changes nothing, because the tab bar reaches the
  // router directly and the seam is never entered. The list must say the route
  // exists without claiming to have watched one.
  const rows = buildRouteList(
    observe(
      { kind: 'press', frame: 'index', column: 'current', label: 'Stats', target: 'Stats' },
      { kind: 'flush' },
    ),
    ALL_ROUTER_KEYS,
  );

  assert.equal(rows.filter((r) => r.provenance === 'observed').length, 0);
  assert.equal(rows.filter((r) => r.provenance === 'declared').length, 4);
});

test('the counts lead the list, and unresolved is a count of gap controls', () => {
  // The count is not derived from the list's own length: a list that drew a row it
  // never observed would otherwise agree with itself and prove nothing.
  const entries = observe(
    { kind: 'route', from: 'index', to: '/profile', column: 'current' },
    { kind: 'flush' },
    { kind: 'route', from: 'profile', to: '/settings', column: 'current' },
    { kind: 'flush' },
  );

  const rows = buildRouteList(entries, ALL_ROUTER_KEYS);
  assert.deepEqual(routeCounts(rows, [backGap(2)]), { observed: 2, declared: 4, unresolved: 2 });
  assert.deepEqual(routeCounts(rows), { observed: 2, declared: 4, unresolved: 0 });
});

test('the back control is unresolved, with a count, and is never drawn as an edge', () => {
  // `router.back()` resolves against history at press time. There is no static
  // edge to draw and no way to enumerate one, so it is a gap with a number.
  const gap = backGap(2);
  assert.equal(gap.control, 'back');
  assert.equal(gap.count, 2);
  assert.equal(gap.provenance, 'unresolved');
});

test('a gap the studio could not measure says so rather than reporting zero', () => {
  // "Zero back routes" is a claim about the app. "Not measured" is a claim about
  // the studio. They are different sentences and the panel must not blur them.
  const measuredZero = describeBackGap(backGap(0));
  const unmeasured = describeBackGap(backGap(null));

  assert.notEqual(measuredZero.label, unmeasured.label);
  assert.equal(measuredZero.measured, true);
  assert.equal(unmeasured.measured, false);
  assert.equal(unmeasured.tone, 'degraded');
  // Zero is not a fault, but it is not a clean bill of health either.
  assert.notEqual(measuredZero.tone, 'ok');
});

test('the declared set is stable across a reload', () => {
  // If it moves, the membership rule is reading something it should not.
  const once = declaredTabRoutes(ALL_ROUTER_KEYS);
  const again = declaredTabRoutes([...ALL_ROUTER_KEYS].reverse());
  assert.deepEqual(once, again);
});

test('the declared set and the board agree, because they come from one rule', () => {
  const declared = declaredTabRoutes(ALL_ROUTER_KEYS).map((r) => r.to);
  for (const key of tabKeys(ALL_ROUTER_KEYS)) {
    const to = key.replace('./(tabs)/', '').replace('.tsx', '');
    assert.ok(declared.includes(to === 'index' ? '/' : `/${to}`), `${key} is declared nowhere`);
  }
});

test('a screen with no outgoing routes is named rather than left as an empty row', () => {
  // Otherwise "Where are the app's exits?" has no answer, and an absent row reads
  // as "no data" rather than "no exits".
  const rows = buildRouteList(
    observe({ kind: 'route', from: 'index', to: '/habit', column: 'current' }, { kind: 'flush' }),
    ALL_ROUTER_KEYS,
  );

  const exits = screensWithoutExits(rows, ALL_ROUTER_KEYS);
  assert.ok(exits.includes('login'), 'the login screen has no outgoing route');
  assert.ok(!exits.includes('index'), 'the Today screen has three');
  assert.equal(exits.includes('settings'), true, 'Settings is pushed to and nothing pushes onward');
});

test('the list is newest first, so the change just caused is the one on screen', () => {
  const rows = buildRouteList(
    observe(
      { kind: 'route', from: 'index', to: '/profile', column: 'current' },
      { kind: 'flush' },
      { kind: 'route', from: 'profile', to: '/settings', column: 'current' },
      { kind: 'flush' },
    ),
  );

  assert.deepEqual(rows.map((r) => r.to), ['/settings', '/profile']);
});

test('a row with an unknown source screen is shown as such, not as blank', () => {
  const rows = buildRouteList(observe({ kind: 'route', from: null, to: '/habit', column: 'current' }, { kind: 'flush' }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].from, null);
});

test('every observed row is also counted, in the same call', () => {
  // The negative control in ticket 03: count the rows, compare with the count.
  const entries = observe(
    { kind: 'route', from: 'index', to: '/profile', column: 'current' },
    { kind: 'route', from: 'profile', to: '/settings', column: 'current' },
    { kind: 'flush' },
    { kind: 'route', from: 'habit', to: '/', column: 'current' },
    { kind: 'flush' },
  );
  const rows = buildRouteList(entries);

  assert.equal(rows.filter((r: RouteRow) => r.provenance === 'observed').length, 3);
  assert.equal(routeCounts(rows).observed, 3);
});