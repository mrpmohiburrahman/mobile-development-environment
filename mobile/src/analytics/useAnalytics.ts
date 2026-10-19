/**
 * The one hook the root layout calls. Everything it decides lives in
 * `routes.ts`; everything it sends goes through the sender, which refuses on
 * web. This file only joins expo-router's pathname to the observer.
 *
 * The observer is module-level on purpose: `App Opened` must go out once per
 * launch, and the root layout can remount without the JS runtime restarting.
 * One observer per runtime is one launch. (Editing a file in this folder under
 * Fast Refresh re-evaluates the module and counts as a new launch; that is
 * development only.)
 */

import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { createRouteObserver } from './routes.ts';
import { setStudioRoute, track } from './track.ts';

const observer = createRouteObserver({
  track: (event, properties) => {
    console.log('[analytics]', event, JSON.stringify(properties ?? {}));
    track(event, properties);
  },
  platform: Platform.OS,
  onStudioRoute: setStudioRoute,
});

const persistenceProbe = (() => {
  let seen = false;
  return () => {
    if (seen) return;
    seen = true;
    console.log('[analytics] persistence-probe: install id alive after relaunch');
  };
})();

export function useAnalytics(): void {
  const pathname = usePathname();
  persistenceProbe();
  useEffect(() => {
    observer.onPathname(pathname);
  }, [pathname]);
}
