# 03 — Bundling the display font

Type: research
Status: resolved
Blocked by: —
Map: ../map.md

## Question

`mobile/src/global.css` asks for `Spline Sans, Inter, ui-sans-serif,
system-ui`. None of the named fonts ship with the app, so three machines
render three different pixels from one tree (see
`talk-opportunities/decisions/05-measure-the-render-fidelity-assumption.md`).
How do we make the typeface deterministic on web **and** on native, so a web
screenshot is a fair proxy for mobile?

Surface, with sources (Expo SDK 57 docs, Google Fonts licensing):

- `@expo-google-fonts/spline-sans` and `@expo-google-fonts/inter`: which
  weights the app actually uses (`tokens.json` `type.*.weight`), package size
  per weight, and the SIL OFL terms for committing the files.
- `expo-font` on SDK 57: `useFonts` vs. the config-plugin
  (`expo-font` plugin in `app.json`) route that embeds fonts at build time
  — which one works on web static export, and whether the plugin route
  avoids a flash of fallback.
- The `fontFamily` story on RNW 0.21: does setting `fontFamily: 'SplineSans_400Regular'`
  in RN styles produce a CSS `font-family` the `@font-face` matches, or does
  the app need a CSS `@font-face` in `global.css` as well?
- Where `fontFamily` should live: in `tokens.json` under `type.*` (so the
  studio can edit it and the drift differ sees it) vs. a single root style.
- What `-webkit-font-smoothing: antialiased` and `text-rendering:
  optimizeLegibility` do to cross-platform pixel stability, and whether to
  drop them for the screenshot run only or always.
- Whether `_layout.tsx` (guarded today) must change to load the font, or the
  `ds/` layer can do it.

Deliver as `research/bundling-the-font.md` on branch
`research/bundling-the-font`.

## Answer

Full findings: [`research/bundling-the-font.md`](../research/bundling-the-font.md).

- RNW 0.21 ignores `global.css` for `<Text>`: each root `Text` carries a `System` font-family class, so `--font-display` never applies. The app renders SF Pro / Segoe / Roboto today. `fontFamily` must go into the `Text` style — one line in guarded `ui/index.tsx` (ticket 09).
- Spline Sans has no 800 weight (300–700, ~55 KB each, OFL 1.1). `type.display.weight: "800"` must drop to 700. Inter has 800 but is ~343 KB per face.
- SDK 57 `useFonts` emits `@font-face` without weight descriptors and loads in `useEffect` → guaranteed flash and faux-bold. Multi-face definitions are SDK 58+.
- Cleanest route: hand-written `@font-face` ×3 under family `"Spline Sans"` in `global.css` + files in `mobile/public/fonts/` for web; `expo-font` config plugin (weights on Android, file list on iOS; dev build only) for native. `_layout.tsx` untouched. `type.family` in `tokens.json` with an allow-list in `tokenValidation.ts`.
- Keep font-smoothing CSS (macOS-only, harmless on Linux CI). Gate screenshots on `document.fonts.ready` + `document.fonts.check('700 16px "Spline Sans"')`.
