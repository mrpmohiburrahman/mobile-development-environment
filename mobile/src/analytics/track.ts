/**
 * The sender the app imports, wired to the real platform.
 *
 * `mixpanel.ts` holds every decision; this file only supplies the adapters it
 * asks for. Keep it that thin: anything added here is something
 * `test/analytics.test.ts` cannot see.
 *
 * This module is in the web bundle too, because `store/habits.ts` imports it and
 * the studio imports the store. That is deliberate: `Platform.OS` is passed
 * through so the sender, not this file and not a Metro platform split, refuses
 * web. One rule, one place.
 *
 * The env variables are read as literal `process.env.EXPO_PUBLIC_*` member
 * expressions, which is the only form Expo inlines at build time.
 *
 * UUIDs: Hermes has no `crypto.randomUUID`. Expo installs a native generator at
 * `globalThis.expo.uuidv4` on iOS and Android, and web has `crypto`. The pure
 * fallback covers any runtime with neither; these ids label an anonymous
 * install, so a `Math.random` v4 is acceptable there.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createAnalytics, readConfig, uuidFrom } from './mixpanel.ts';

function uuid(): string {
  const expoUuid = globalThis.expo?.uuidv4;
  if (expoUuid) return expoUuid();
  const webCrypto = globalThis.crypto;
  if (webCrypto?.randomUUID) return webCrypto.randomUUID();
  return uuidFrom(Math.random);
}

export const analytics = createAnalytics({
  platform: Platform.OS,
  config: readConfig({
    EXPO_PUBLIC_MIXPANEL_TOKEN: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN,
    EXPO_PUBLIC_MIXPANEL_REGION: process.env.EXPO_PUBLIC_MIXPANEL_REGION,
  }),
  now: () => Date.now(),
  uuid,
  storage: {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
  },
  send: async (request) => {
    const res = await fetch(request.url, {
      method: 'POST',
      headers: { 'Content-Type': request.contentType },
      body: request.body,
    });
    return { ok: res.ok, body: await res.text() };
  },
});

/** Fire-and-forget. The outcome is dropped on purpose; nothing in the app blocks on it. */
export function track(...args: Parameters<typeof analytics.track>): void {
  void analytics.track(...args);
}
