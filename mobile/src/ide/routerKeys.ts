/**
 * How a router key becomes a screen, in one place.
 *
 * ## Why this is its own module
 *
 * Two features now read the router directory and they must not disagree.
 * `screens.ts` decides what appears on the blueprint; the route panel decides
 * which destinations the tab bar can reach. The tab bar's own presses are *not*
 * observable — it calls `router.navigate` behind a guard, in a file that has to
 * stay byte-identical — but its **membership** is knowable for free from the
 * directory listing, and only before `normalize` has stripped the group prefix.
 *
 * So the second view has to be derived from the same predicates as the first.
 * Written twice they drift apart silently: a screen reaches the board and the
 * route list has never heard of it, and nothing anywhere reports the loss.
 *
 * ## Why it is here and not inside `screens.ts`
 *
 * `screens.ts` calls `require.context`, which Metro provides and `node --test`
 * does not. A module a test cannot load cannot be tested, and this is precisely
 * the kind of rule that rots quietly. Everything here is pure and importable by
 * both — no `node:fs`, which the browser bundle could not resolve — and
 * `test/routerKeys.test.ts` asserts both that the rules behave and that
 * `screens.ts` actually imports them rather than keeping a private copy.
 */

/**
 * The group the tab bar lives in. The directory on disk is `(tabs)`; the
 * parentheses are the directory grouping syntax and are not part of the name, so
 * `groupOf` returns the bare name and this is what it matches against.
 */
export const TAB_GROUP = 'tabs';

/**
 * Not routes we want on the artboard: layouts, and the IDE itself.
 *
 * A layout is not a screen, and the studio is a route of this app rather than a
 * screen of it — drawing the editor inside the editor is not useful.
 */
export const isRouteFile = (key: string): boolean => !/[\\/]_layout\.tsx$|ide\.tsx$/.test(key);

/**
 * The stable key a route file is known by: `./(tabs)/stats.tsx` → `stats`.
 *
 * The group prefix goes away so a group member is addressable the same way a
 * top-level route is. It is also embedded in the blueprint frame's DOM id, so
 * this function is what makes frame identity stable across a re-render.
 */
export const screenKeyOf = (key: string): string =>
  key.replace(/^\.\//, '').replace(/^\(tabs\)\//, '').replace(/\.tsx$/, '');

/** The href a screen key routes to. Expo Router maps `index` to `/`. */
export const routeOf = (key: string): string => {
  const k = screenKeyOf(key);
  return k === 'index' ? '/' : `/${k}`;
};

/**
 * The group a raw key belongs to, or null when it is not in one.
 *
 * Read from the **raw** key, before `screenKeyOf` throws the prefix away. That is
 * the only point at which group membership is still visible, and it is the whole
 * basis for declaring the tab routes the studio cannot watch.
 */
export const groupOf = (key: string): string | null => {
  const match = /^\.\/\(([^)]+)\)\//.exec(key);
  return match ? match[1] : null;
};

/**
 * The routes the tab bar can reach, from the directory listing.
 *
 * Sorted, because a list whose order follows directory-read order reorders
 * itself when the bundler changes its traversal, and a report that reshuffles
 * between reloads cannot be compared with a report taken before the reload.
 */
export const tabKeys = (keys: string[], group: string = TAB_GROUP): string[] =>
  keys.filter((key) => isRouteFile(key) && groupOf(key) === group).sort();