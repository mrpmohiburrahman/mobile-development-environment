/**
 * Which route changes become `Screen Viewed`, and when `App Opened` goes out.
 *
 * `useAnalytics.ts` feeds every pathname expo-router reports into
 * `onPathname`. This module decides the rest, so `node --test` can check it
 * without React or a router:
 *
 * - `App Opened` leaves once per observer. The hook keeps one observer for the
 *   life of the JS runtime, so a remount of the root layout does not repeat it.
 * - `Screen Viewed` leaves when the normalized pathname differs from the last
 *   one that was sent. The same route rendered twice is one view. The tab bar,
 *   a push, Back, `router.replace` and a native link all move the pathname, so
 *   the hook sees them all without instrumenting each call site.
 * - Studio-only routes are suppressed. The sender already refuses on web, and
 *   on a device `/ide` is the developer's studio, not a screen a user sees.
 *   Leaving the studio back to the same route is not a new view either.
 */

import type { EventName, EventProperties } from './mixpanel.ts';

export type Tracker = (event: EventName, properties?: EventProperties) => void;

export type RouteObserver = {
  /** Call with each pathname the router reports. Null and undefined are ignored. */
  onPathname: (pathname: string | null | undefined) => void;
};

const STUDIO_ROUTES = new Set(['/ide']);

/** Lower-case, no query or hash, no repeated or trailing slashes, always leading `/`. */
export function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0].toLowerCase();
  const segments = path.split('/').filter((s) => s !== '');
  return `/${segments.join('/')}`;
}

export function isStudioRoute(pathname: string): boolean {
  const screen = normalizePathname(pathname);
  return [...STUDIO_ROUTES].some((root) => screen === root || screen.startsWith(`${root}/`));
}

export function createRouteObserver(deps: { track: Tracker; platform: string }): RouteObserver {
  let opened = false;
  let lastScreen: string | null = null;

  return {
    onPathname(pathname) {
      if (pathname === null || pathname === undefined) return;
      if (!opened) {
        opened = true;
        deps.track('App Opened', { platform: deps.platform });
      }
      if (isStudioRoute(pathname)) return;
      const screen = normalizePathname(pathname);
      if (screen === lastScreen) return;
      lastScreen = screen;
      deps.track('Screen Viewed', { screen });
    },
  };
}
