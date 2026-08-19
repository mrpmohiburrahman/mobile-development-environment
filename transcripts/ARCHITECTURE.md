# The technique, reconstructed

Source: Rafael Mendiola, _"Build yourself a mobile development environment with Expo web"_ (React Native Connection #14). Reconstructed from the talk transcript plus 65 screen-capture frames in `frames/keep/`.

This documents **how his setup works**, as reference for building our own. We are not shipping his code — his app (`itsumo`, a Japanese study app) is his. What's reusable is the architecture, which he presented publicly for exactly that purpose.

## The core claim

An Expo app already compiles to web. So add **one more route** to the mobile app that renders every screen side by side, plus a token editor. No separate project, no static analysis, no Figma round-trip. Because it's the same codebase, the blueprint is guaranteed faithful to what ships.

Design tokens live in a **plain JSON file**, not TypeScript — that is the whole trick. JSON is trivially machine-writable, so a tiny server can patch it, and Fast Refresh picks the change up in web *and* the simulator simultaneously. Edits land as real git diffs, so `git checkout .` reverts a design session.

## Pieces

**1. The IDE route.** A normal screen registered alongside the real ones:

```
<Stack.Screen name="IDE" component={IDE} />
```

Reached at `localhost:8081/?screen=IDE`. Drop the query param and you get the actual mobile app — same bundle.

**2. IDE shell** (`src/ide/index.tsx`, 35 lines). Tab state over a couple of panels. Trivial.

**3. ScreenDesigner** (`src/ide/ScreenDesigner/index.tsx`, 181 lines). The real component. Two columns:

- **Left** — tab bar (`tokens` / `redux`) over a panel rendering either the token list or a live state tree.
- **Right** — a `Workspace` holding an `ArtBoard` that scales, with each screen wrapped in a `ScreenContainer label="…">` that constrains it to a phone aspect ratio.

Zoom is ctrl+wheel on the workspace ref, clamped 0.3–2.0, stepping 0.03 — a raw `addEventListener("wheel")` because RN Web doesn't surface wheel events.

**4. The `designing` prop.** Each screen in the artboard is rendered as `<LoginScreen designing />`. Screens read it and suppress navigation, so clicking a list item renders inline instead of navigating the whole artboard away. This is the one invasive bit: every screen must honour the prop.

**5. Token file** (`src/ds/tokens.json`, 18 lines). Only base colours — a flat name→hex map under a `baseColors` key. Semantic tokens (`buttonColor: gray2`, `appBackgroundColor: gray1`) are indirections resolved elsewhere, not in this file.

**6. Token server** (`token-server/`, ~69 lines). Separate from Metro, on port 3001, run under `nodemon` + `ts-node`. Two endpoints:

- `GET /get-tokens` → the parsed JSON
- `POST /update-token` with `{ tokenPath, tokenValue }` → read file, `set(tokens, tokenPath, tokenValue)` (lodash-style dotted path, so `"baseColors.gray1"` works), write back with `JSON.stringify(tokens, null, 2)`

That's the entire server. Read, set, write.

**7. The loop.** Colour picker → POST → file written → Fast Refresh → web and simulator both repaint → `git diff` shows the change.

## What he did not build

He said so explicitly on stage: only colours are editable. Spacing, corner radius, and typography were named as the obvious next step and left undone. He also floated web-based visual regression testing as an opportunity.

## Notes for our build

- Bugs visible in his own demo: `writeTokensFile` is not awaited in the POST handler, and the written file has no trailing newline (every diff shows `\ No newline at end of file`). Worth not copying.
- A stale root-level `token-update.js` points at port 3000 while the server listens on 3001 — evidence this grew organically.
- His stack was React Navigation + Redux + redux-persist + styled-components, current for early 2024.
