# 15 — Analytics sender

Type: task
Status: resolved
Labels: ready-for-agent
Blocked by: None
Map: ../map.md
Spec: ../spec.md

## What to build

The app gains a native-only analytics sender. Node tests cover its payload, region, identity, web refusal, and failure isolation through adapters. Habit toggle and sign-out call it. The browser sends nothing. Screen-change events wait for the layout hook.

## Acceptance criteria

- [x] Payload construction, configuration checks, suppression, and response handling stay independent of React and native modules. Adapters supply platform, storage, UUID generation, time, and transport.
- [x] The sender refuses every web request before identity initialization or transport. Studio routes stay silent with or without configuration.
- [x] An absent or empty token means not configured. An unknown region does not use a default host. The token never appears in committed files, diagnostics, or screenshots.
- [x] One UUID per install persists through AsyncStorage. Concurrent first events share one identity. The identity survives a relaunch. AsyncStorage is added explicitly with an Expo-compatible install and lockfile update.
- [x] Each event carries the device identifier, a device-prefixed distinct identifier, a fresh insert UUID, and a capture-time timestamp. No names, email addresses, habit text, raw state, or token edits leave the app.
- [x] Habit toggle sends `Habit Toggled` with habit id and done state. Sign-out sends `Signed Out` on the transition. Invalid identifiers and repeated sign-out calls send nothing.
- [x] Analytics failures do not block the action or raise an unhandled rejection. An acceptance response is not described as proof of ingestion.
- [x] Node tests cover identity races, platform refusal, missing configuration, regional routing, payloads, and failure isolation without importing native modules.
- [x] `npm test`, lint, and typechecking pass.

## Answer

`mobile/src/analytics/mixpanel.ts` is the sender. It has no React, React Native, storage, or `fetch` import. `createAnalytics(adapters)` takes the platform, the configuration, a clock, a UUID source, a key-value store, and one HTTP transport. It refuses web first, then a missing token, then an unknown region. It never uses a default host for an unknown region. It reads the install id from storage once. It caches that promise, so concurrent first events share one id. When storage fails, it uses one id for the current launch. Each event carries `token`, `$device_id`, `distinct_id: $device:<id>`, a fresh `$insert_id`, and `time` in seconds from the real clock. `track()` never rejects. The outcome is `accepted`, `rejected`, `unsent`, or `refused`. An accepted outcome is an HTTP acceptance only. Outcomes never carry the token.

`mobile/src/analytics/track.ts` wires the adapters: `Platform.OS`, `process.env.EXPO_PUBLIC_MIXPANEL_TOKEN` and `EXPO_PUBLIC_MIXPANEL_REGION`, `Date.now`, Expo's native UUID generator with `crypto.randomUUID` and a pure v4 fallback, AsyncStorage, and `fetch`. The module is in the web bundle through the store. The runtime platform guard keeps web silent.

`mobile/src/store/habits.ts` calls `track('Habit Toggled', { habit_id, done })` after a valid toggle and `track('Signed Out')` on the signed-in to signed-out transition only. An unknown habit id and a repeated sign-out send nothing.

`expo install` pins `@react-native-async-storage/async-storage` at 2.2.0. The lockfile carries the same version. `mobile/.gitignore` now ignores `.env` and `.env.*`.

`test/analytics.test.ts` covers region routing, configuration parsing, and web refusal before storage. It covers the missing token, the unknown region, the request shape, and the payload. It covers persistence across relaunch, the identity race, storage write failure, UUID failure, and redaction. It covers response handling and the static import boundaries.

`App Opened` and `Screen Viewed` wait for ticket 16.
