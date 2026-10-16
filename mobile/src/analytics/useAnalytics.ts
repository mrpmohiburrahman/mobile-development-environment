/**
 * The one hook the root layout calls. Everything it decides lives in
 * `routes.ts`; everything it sends goes through `track.ts`, which refuses on
 * web. This file only joins expo-router's pathname to the observer.
 *
 * The observer is module-level on purpose: `App Opened` must go out once per
 * launch, and the root layout can remount (Fast Refresh, a theme reset) without
 * the JS runtime restarting. One observer per runtime is one launch.
 */

import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { createRouteObserver } from './routes.ts';
import { track } from './track.ts';

const observer = createRouteObserver({ track, platform: Platform.OS });

export function useAnalytics(): void {
  const pathname = usePathname();
  useEffect(() => {
    observer.onPathname(pathname);
  }, [pathname]);
}
