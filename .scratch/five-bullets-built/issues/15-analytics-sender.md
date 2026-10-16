# 15 — Analytics sender

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: None — can start immediately
Map: ../map.md
Spec: ../spec.md

## What to build

The app gains a native-only analytics sender. Node tests cover its payload, region, identity, web refusal, and failure isolation through adapters. Habit toggle and sign-out call it. The browser sends nothing. Screen-change events wait for the layout hook.

## Acceptance criteria

- [ ] Payload construction, configuration checks, suppression, and response handling stay independent of React and native modules. Adapters supply platform, storage, UUID generation, time, and transport.
- [ ] The sender refuses every web request before identity initialization or transport. Studio routes stay silent with or without configuration.
- [ ] An absent or empty token means not configured. An unknown region does not use a default host. The token never appears in committed files, diagnostics, or screenshots.
- [ ] One UUID per install persists through AsyncStorage. Concurrent first events share one identity. The identity survives a relaunch. AsyncStorage is added explicitly with an Expo-compatible install and lockfile update.
- [ ] Each event carries the device identifier, a device-prefixed distinct identifier, a fresh insert UUID, and a capture-time timestamp. No names, email addresses, habit text, raw state, or token edits leave the app.
- [ ] Habit toggle sends `Habit Toggled` with habit id and done state. Sign-out sends `Signed Out` on the transition. Invalid identifiers and repeated sign-out calls send nothing.
- [ ] Analytics failures do not block the action or raise an unhandled rejection. An acceptance response is not described as proof of ingestion.
- [ ] Node tests cover identity races, platform refusal, missing configuration, regional routing, payloads, and failure isolation without importing native modules.
- [ ] `npm test`, lint, and typechecking pass.
