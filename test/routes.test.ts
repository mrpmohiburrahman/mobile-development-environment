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
  exitReport,
  routesOutOf,
  ROUTE_PROVENANCE,
  ROUTE_PROVENANCES,
  type RouteRow,
} from '../mobile/src/ide/routes.ts';
import { ALL_ROUTER_KEYS } from './helpers/routerListing.ts';
import { screenKeyOf, tabKeys } from '../mobile/src/ide/routerKeys.ts';
import { createSpine, spineReducer, type SpineEntry, type SpineInput } from '../mobile/src/ide/spine.ts';

function observe(...inputs: SpineInput[]): SpineEntry[] {
  return inputs.reduce(spineReducer, createSpine()).entries;
}

test('there are exactly three provenances, and no row can be built without one', () => {
  assert.deepEqual([...ROUTE_PROVENANCES].sort(), ['declared', 'observed', 'unresolved']);
  // The type is a union rather than a string, so this is a compile-time fact —
  // but the type is not enforced in CI, so the runtime table is the real one.
  for (const row of declaredTabRoutes(ALL_ROUTER_KEYS)) {
    assert.ok(row.provenance in ROUTE_PROVENANCE);
  }
});

test('the provenance table carries everything the panel needs to render a section', () => {
  // This is the runtime check the spec asks for. The compiler is not in CI, so a
  // fourth provenance added to the union would type-check, be counted by
  // `routeCounts`, and never appear in the UI unless the table is what the panel
  // renders from. Every entry has to be renderable on its own.
  for (const provenance of ROUTE_PROVENANCES) {
    const copy = ROUTE_PROVENANCE[provenance];
    assert.equal(copy.label, provenance, 'the badge names the provenance it belongs to');
    assert.ok(['ok', 'degraded', 'muted'].includes(copy.tone), `${provenance} has a tone the palette can draw`);
    assert.ok(copy.note.length > 20, `${provenance} explains how its routes were learned`);
    assert.ok(copy.empty.length > 10, `${provenance} says something when it holds nothing`);
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
  assert.deepEqual(routeCounts(rows, [backGap(2)]), { observed: 2, declared: 4, unresolved: 2, listed: 2 });
  assert.deepEqual(routeCounts(rows), { observed: 2, declared: 4, unresolved: 0, listed: 2 });
});

test('the headline observed count can come from somewhere other than the list', () => {
  // A count taken from the list's own length can never disagree with the list, so
  // printing it proves nothing. The seam keeps its own tally, and passing it in is
  // what makes the cross-check capable of failing — which is the only reason to
  // print a cross-check at all.
  const rows = buildRouteList(
    observe({ kind: 'route', from: 'index', to: '/profile', column: 'current' }, { kind: 'flush' }),
    ALL_ROUTER_KEYS,
  );

  assert.equal(routeCounts(rows).observed, 1, 'with no seam the count falls back to the list');
  assert.equal(routeCounts(rows, [], 3).observed, 3, 'the seam’s tally is the headline');
  assert.equal(routeCounts(rows, [], 3).listed, 1, 'and the list’s own length rides along beside it');
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

test('a screen the studio never saw navigate is named, and not called an exit', () => {
  // Otherwise "Where are the app's exits?" has no answer, and an absent row reads
  // as "no data" rather than "no exits".
  //
  // The first version of this reported every screen with no *observed* outgoing
  // route as one of the app's exits, which named `login` — a screen whose only
  // control signs in and navigates to `/` — because nobody had pressed it yet.
  // Absence of evidence is what the list holds, so it is reported as absence of
  // evidence and the panel says which of the two readings is on offer.
  const rows = buildRouteList(
    observe({ kind: 'route', from: 'index', to: '/habit', column: 'current' }, { kind: 'flush' }),
    ALL_ROUTER_KEYS,
  );

  const report = exitReport(rows, ALL_ROUTER_KEYS, 1);
  assert.equal(report.measured, true, 'the seam has seen a route, so the buckets mean something');
  assert.deepEqual(report.observedExits, ['index'], 'only what was watched is claimed as watched');
  assert.ok(!report.unobserved.includes('index'), 'a screen seen navigating away from is not on this list');
  assert.ok(report.unobserved.includes('settings'), 'Settings is pushed to and nothing pushes onward');
  assert.ok(report.unobserved.includes('login'), 'login has not been pressed, so it has not been seen');
});

test('a tab screen is never reported as having no outgoing route', () => {
  // Its exits are declared from the router directory: the tab bar reaches the
  // router behind a guard in a byte-identical file, so the seam never sees them.
  // Reporting those four as the app's exits would contradict the declared section
  // printed a few lines above.
  const report = exitReport([], ALL_ROUTER_KEYS, 0);
  const onTabBar = tabKeys(ALL_ROUTER_KEYS).map(screenKeyOf);

  assert.deepEqual(report.viaTabBar, onTabBar);
  assert.equal(report.measured, false, 'nothing has been observed, and the report says so');
  for (const key of onTabBar) {
    assert.ok(!report.unobserved.includes(key), `${key} is on the tab bar, so it has declared exits`);
  }
  // Every screen on the board is in exactly one bucket, so none can be dropped.
  const buckets = [...report.unobserved, ...report.viaTabBar, ...report.observedExits];
  assert.equal(new Set(buckets).size, buckets.length, 'a screen landed in two buckets');
});

test('highlighting a frame narrows the list to that frame’s connections', () => {
  // Story 30. A list of every route answers "how does the app connect"; the
  // question a reader arrives with is usually "what can I reach from *here*".
  const rows = buildRouteList(
    observe(
      { kind: 'route', from: 'index', to: '/habit', column: 'current' },
      { kind: 'flush' },
      { kind: 'route', from: 'profile', to: '/settings', column: 'current' },
      { kind: 'flush' },
    ),
    ALL_ROUTER_KEYS,
  );

  const fromIndex = routesOutOf(rows, 'index', ALL_ROUTER_KEYS, [backGap(2)]);
  assert.deepEqual(fromIndex.observed.map((r) => r.to), ['/habit'], 'only this frame’s own departures');
  assert.equal(fromIndex.hostsTabBar, true, 'Today is on the tab bar');
  assert.equal(fromIndex.declared.length, tabKeys(ALL_ROUTER_KEYS).length, 'so its declared exits come with it');

  // A frame off the tab bar has no declared exits to show, and the studio says so
  // by showing nothing rather than by borrowing the tab bar's.
  const fromSettings = routesOutOf(rows, 'settings', ALL_ROUTER_KEYS, [backGap(2)]);
  assert.equal(fromSettings.hostsTabBar, false);
  assert.deepEqual(fromSettings.declared, []);
  assert.deepEqual(fromSettings.observed, [], 'never pressed, so never observed leaving');
  // The back control is counted board-wide, so it is passed through unattributed.
  assert.equal(fromSettings.gaps.length, 1);
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