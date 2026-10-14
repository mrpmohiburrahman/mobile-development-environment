import type { ComponentType } from 'react';
import { isRouteFile, screenKeyOf, routeOf } from './routerKeys';

/**
 * The blueprint's screen list, read from the router directory at build time.
 *
 * Metro supports `require.context` (recursive here, because the four main
 * screens live in a `(tabs)/` group), so adding a route file puts it on the
 * artboard automatically. The alternative — a hand-written import list, as in
 * the talk this is modelled on — silently goes stale the first time someone
 * adds a screen and forgets, which is exactly the drift the blueprint exists
 * to catch.
 *
 * What counts as a screen is decided in `routerKeys.ts`, not here: the route panel
 * needs the same answer from the same listing, and a second copy would drift
 * without anything reporting it. `test/routerKeys.test.ts` asserts this file
 * imports those rules rather than keeping private ones.
 */
const ctx = (require as any).context('../app', true, /\.tsx$/);

/**
 * The raw router listing, before any normalisation.
 *
 * Exported because the route panel needs it for something the board does not: the
 * `(tabs)` group is how the four tab destinations are *declared*, and group
 * membership is only visible here, before `screenKeyOf` strips the prefix. The
 * board needs the flattened keys; the route list needs these.
 */
export const routerKeys: string[] = ctx.keys().filter((k: string) => isRouteFile(k));

/** Reading order for the artboard — roughly the order a user meets them. */
const ORDER = ['login', 'index', 'habits', 'habit', 'stats', 'profile', 'settings'];

const LABELS: Record<string, string> = {
  index: 'Today',
  habits: 'All habits',
  habit: 'Habit detail',
};

export type ScreenEntry = {
  key: string;
  label: string;
  route: string;
  Component: ComponentType<any>;
};

export const screens: ScreenEntry[] = routerKeys
  .map((k: string) => {
    const key = screenKeyOf(k);
    return {
      key,
      label: LABELS[key] ?? key[0].toUpperCase() + key.slice(1),
      route: routeOf(k),
      Component: ctx(k).default,
    };
  })
  .filter((s: ScreenEntry) => Boolean(s.Component))
  .sort((a: ScreenEntry, b: ScreenEntry) => {
    const ia = ORDER.indexOf(a.key);
    const ib = ORDER.indexOf(b.key);
    // Unlisted screens sort after listed ones, alphabetically among themselves.
    if (ia === -1 && ib === -1) return a.key.localeCompare(b.key);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });