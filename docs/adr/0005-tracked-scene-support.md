# The tracked iOS configuration adopts the scene lifecycle

iOS 27 refuses to launch an app that does not adopt the scene lifecycle. The tracked `mobile/app.json` enables the `expo-build-properties` plugin with `ios.enableSceneSupport`. A cold prebuild then writes the scene manifest into the gitignored `mobile/ios/`. This replaces the temporary scene adapter of ticket 14, which lived in generated source only.

## Reason

Ticket 14 kept the workaround out of the tracked configuration, so its native result proved the font after the workaround. The official plugin makes an unmodified cold clone launch on iOS 27, so the tracked configuration can carry it.

## Alternatives

- Keep the adapter in gitignored generated source, as ticket 14 did. A cold clone then crashes at launch until someone rediscovers the adapter.
- Write the scene delegate by hand into tracked native source. Expo regenerates `mobile/ios/` on prebuild, so tracked edits there do not survive.

## Consequences

- A cold clone launches on iOS 27 with no manual native edit.
- The plugin is a no-op on SDK 58 and later, where scene support is the default.
- The "no workaround in tracked configuration" note of ticket 14 is superseded by this decision.
- Native verification now proves an unmodified launch, the bundled fonts, and scheme registration.

See [ticket 23](../../.scratch/five-bullets-built/issues/23-simulator-verification-readme-cleanup.md).
