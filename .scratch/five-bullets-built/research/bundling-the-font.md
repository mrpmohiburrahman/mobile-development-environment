# Research: bundling the display font

Ticket: `../issues/03-bundling-the-font.md`
Status: answered
Checked against: Expo SDK 57 docs (`expo-font` 57.0.x, `expo-router` static
output), `expo/expo@sdk-57` source, `react-native-web` 0.21.0 source
(0.21.2 installed), `@expo-google-fonts/*` 0.4.2 tarballs, SIL OFL 1.1 FAQ
(1.1-update7). Local files read: `mobile/src/global.css`,
`mobile/src/ds/tokens.json`, `mobile/src/ds/applyOverrides.ts`,
`mobile/src/ds/tokenValidation.ts`, `mobile/src/ui/index.tsx`,
`mobile/src/app/_layout.tsx`, `mobile/src/theme*.ts`, `mobile/package.json`,
`mobile/app.json`, `scripts/guard.sh`, `scripts/export-web.sh`,
`talk-opportunities/decisions/05-measure-the-render-fidelity-assumption.md`.

## 0. A correction to the prior finding

Decision 05 and `renderFidelity.ts` say the stack in `global.css` resolves to
"Inter on this machine, SF Pro elsewhere". That is true for the probe span,
and false for every `<Text>` the app renders.

`react-native-web` 0.21 gives every root `<Text>` its own class with
`font: '14px System'`, and the style compiler rewrites `System` to
`-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`
(`Text/index.js:195`, `createReactDOMStyle.js:37-38,145-156` at tag 0.21.0;
same lines in the installed `dist/exports/Text/index.js:150`). Nested `Text`
gets `font: inherit` from its parent `Text`, not from `#root`. An element
style beats an inherited value, so `font-family: var(--font-display)` on
`html, body, #root` never reaches RN text. The app's visible type today is
`-apple-system` (SF Pro) on macOS, Segoe UI on Windows, Roboto/Helvetica/Arial
or DejaVu on Linux — a different three-way split than the one decision 05
describes, with the same conclusion: three machines, three rasters. The
`--font-display` variable is dead CSS for the app surface.

Consequence: a `@font-face` alone fixes nothing. Something must put
`fontFamily` into the `Text` style, which is `mobile/src/ui/index.tsx`
(guarded; the map relaxes the guard for exactly this).

Sources:
- https://github.com/necolas/react-native-web/blob/0.21.0/packages/react-native-web/src/exports/Text/index.js
- https://github.com/necolas/react-native-web/blob/0.21.0/packages/react-native-web/src/exports/StyleSheet/compiler/createReactDOMStyle.js

## 1. Packages, weights, sizes, licence

### Weights the app uses

`tokens.json` `type.*.weight`: display `800`, title `700`, body `400`,
label `600`, caption `400`. Inline in guarded app code: `fontWeight: '600'`
on body text in `habit.tsx:80`, `(tabs)/habits.tsx:52`, `stats.tsx:67`,
`profile.tsx:66,87`, and in `ui/index.tsx:225,346,385`. Studio chrome
(`ide/`) also uses `800` (`Blueprint.tsx:73`) and `600`, but it is not under
test. Required set for the app: **400, 600, 700, 800**.

### `@expo-google-fonts/spline-sans` 0.4.2

- Licence field `MIT AND OFL-1.1`; unpacked 818 KB (30 files, including a
  PNG preview per weight). Faces shipped: **300, 400, 500, 600, 700 only.**
  `metadata.json` lists `variants: ["300","regular","500","600","700"]`.
  **Spline Sans has no 800.** The `display` token cannot be satisfied by
  this family without synthesis.
- Per-weight static TTF (bytes): 300 → 55,356; 400 → 55,588; 500 → 55,544;
  600 → 55,688; 700 → 55,728. Three needed faces (400/600/700) = **167 KB**.
- Internal names (`fc-scan`): family `Spline Sans`, PostScript
  `SplineSans-Regular` / `-SemiBold` / `-Bold`. Not variable fonts.
- Exports `SplineSans_400Regular` etc. as `require()`d assets, plus a
  package-local `useFonts` that calls `loadAsync` inside `useEffect`.

Sources:
- https://github.com/expo/google-fonts/tree/master/font-packages/spline-sans
  (`metadata.json`, `index.js`, `useFonts.js`, per-weight dirs; sizes read via
  `gh api repos/expo/google-fonts/contents/...`)
- `npm view @expo-google-fonts/spline-sans@0.4.2` (version, license, size)

### `@expo-google-fonts/inter` 0.4.2

- Licence `MIT AND OFL-1.1`; unpacked **8.0 MB** (82 files; 18 faces incl.
  italics). Faces 100–900 upright + italic; 800 exists.
- Per-weight static TTF (bytes): 400 → 342,408; 600 → 343,632;
  700 → 344,072; 800 → 344,900. Four faces = **1.37 MB** — about 6× Spline
  Sans per face, because Inter's static cuts carry the full glyph set.
- PostScript `Inter-Regular` / `-SemiBold` / `-Bold` / `-ExtraBold`;
  family `Inter`.

Source: https://github.com/expo/google-fonts/tree/master/font-packages/inter

### OFL 1.1 terms for committing the files

Both packages ship `LICENSE_FONT` (the OFL 1.1 text with the copyright line
— Spline Sans: "Copyright 2021 The Spline Sans Project Authors", Inter:
"Copyright 2020 The Inter Project Authors"). Neither declares a Reserved
Font Name on that line.

From the OFL FAQ (https://openfontlicense.org/ofl-faq/):
- Bundling with software, including under FLOSS licences and in app stores,
  is allowed ("Fonts licensed under the OFL can be freely included alongside
  other software"). Fonts may not be sold on their own.
- Distribution (which includes copying files into a git repo that others
  clone, and serving them from a web server) must carry the licence text:
  "include the full font package, including any copyright notices and
  licensing information as available in OFL.txt". A webfont served via
  `@font-face` is "explicitly allowed by the licensing model because it is
  distribution".
- Converting TTF→WOFF/WOFF2 is allowed without renaming only if the font data
  is unchanged apart from WOFF compression. Subsetting is a modification and
  would trigger renaming rules if a Reserved Font Name existed; neither font
  declares one, but the safe practice is to commit the unmodified TTF.

Practical rule for this repo: commit the unmodified `.ttf` files plus the
package's `LICENSE_FONT` as `OFL.txt` next to them (e.g.
`mobile/public/fonts/spline-sans/`), and mention the font in the README.

## 2. `useFonts` vs the `expo-font` config plugin on SDK 57

Facts from https://docs.expo.dev/versions/v57.0.0/sdk/font/ and
https://docs.expo.dev/develop/user-interface/fonts/:

| | config plugin | `useFonts` / `loadAsync` |
|---|---|---|
| Platforms | Android, iOS only. "Config plugins only run on native platforms. For web, use the `useFonts` hook instead." | Android, iOS, web |
| Needs | prebuild → development build. "Doesn't work with Expo Go." | nothing; works in Expo Go |
| Startup | fonts "available immediately when the app starts" | async; the docs gate render on `loaded` behind the splash screen |
| Family name | Android: file name, or `fontFamily` + `fontDefinitions[{path, weight, style}]` object syntax; iOS: name read from the file | the map key |
| Weight selection | object syntax embeds Android XML families, so `fontFamily: 'Inter', fontWeight: '700'` picks the face; iOS matches by file metadata | SDK 57: one key = one face. Multi-face `fontDefinitions` arrays for `useFonts` are **SDK 58+** |

### Web static export (`web.output: "static"`, as in `app.json`)

`expo export --platform web` renders each route to HTML. If `useFonts` from
`expo-font` runs synchronously during that render, Expo "will automatically
extract the font resource and embed it in the page's HTML, enabling
preloading, faster hydration, and reduced layout shift" — a
`<link rel="preload" as="font">` plus
`<style id="expo-generated-fonts">@font-face{...;font-display:auto}</style>`
(https://docs.expo.dev/router/reference/static-rendering/#fonts).

Mechanics in `expo/expo@sdk-57`:
- `FontHooks.ts`: on the server `useFonts` is `useStaticFonts`, which calls
  `loadAsync(map)` synchronously and returns `[true, null]`; in the browser
  the initial state is `isMapLoaded(map)`, which reads the `@font-face` rules
  already present in the static HTML, so the `loaded` gate is true on first
  client render — no null-frame on hydration.
- `ExpoFontLoader.web.ts` `loadAsync` on the server calls `addServerFont`;
  `@expo/router-server/src/static/renderStaticContent.tsx:97-119` wraps the
  render in `Font.withServerContext` and injects `Font.getServerResources()`
  before `</head>`.
- The generated rule is
  `@font-face{font-family:"<key>";src:url(<asset>);font-display:<display|auto>}`
  (`_createWebFontTemplate`). **No `font-weight` or `font-style`
  descriptor.** Per-face `@font-face` with declared weight is SDK 58
  (`expo-font` 58.0.1 changelog: "Web generates one CSS `@font-face` rule
  per face, with the declared `weight` and `style` values").

Two consequences on SDK 57:

1. **Only `expo-font`'s `useFonts` is statically optimised.** The
   `useFonts` exported by `@expo-google-fonts/spline-sans` loads inside
   `useEffect` (`useFonts.js` in the 0.4.2 tarball). The static-rendering
   doc: "Static font optimization requires the font to be loaded
   synchronously. If the font isn't statically optimized, it could be because
   it was loaded inside a `useEffect`…". With the package hook, the static
   HTML has no `@font-face`, the first paint is the system font, and the
   swap happens after hydration — a guaranteed flash of fallback. Import the
   font constants from the package and the hook from `expo-font`.
2. **Faux bold.** A `@font-face` with no `font-weight` descriptor defaults to
   `normal` (= 400) (https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-weight).
   `ui/index.tsx` always sets `fontWeight: spec.weight`. Asking for 600/700
   from a face declared 400 lets the browser synthesize bold on top of the
   already-bold file (`font-synthesis-weight` initial value `auto`,
   https://developer.mozilla.org/en-US/docs/Web/CSS/font-synthesis). The
   `_400Regular` face is unaffected; `_600SemiBold` and `_700Bold` render
   thicker than the design and differently from native. Workarounds: write
   the `@font-face` rules by hand with correct descriptors (section 3), or
   drop `fontWeight` where a per-face family is set, or add
   `font-synthesis: none` on web.

### Flash of fallback

- Plugin route (native): none; fonts are in the binary.
- `useFonts` from `expo-font` on static web: the `@font-face` + preload is in
  the HTML before any JS. With `font-display: auto` Chromium blocks text
  for up to ~3 s then swaps, so a screenshot taken after
  `document.fonts.ready` sees the webfont. `FontResource.display` can set
  `block` or `swap` per key; it is baked into the generated CSS. Dev server
  (`expo start --web`) does not pre-render, so there the hook's `loaded`
  gate is what prevents a fallback frame.
- Package `useFonts`: flash every load, see above.

### Native behaviour of `useFonts` + `fontWeight` on SDK 57

- Android: `expo-font` 58.0.1 changelog, #48129: "Apply `fontWeight` and
  `fontStyle` to fonts loaded with `useFonts`… **Bold and italic text
  previously fell back to a system font.**" On SDK 57 a `useFonts` face with
  `fontWeight: '700'` can render in Roboto on Android.
- iOS: `FontFamilyAliasManager.swift` maps the map key to the real family
  name; React Native then picks "the closest" weight among registered faces
  (https://reactnative.dev/docs/0.86/text-style-props#fontweight). Loading
  only `SplineSans_700Bold` and asking for `800` yields 700, no synthesis.
- So `useFonts` on SDK 57 is deterministic only if `fontWeight` is not set
  alongside a per-face family — which `ui/index.tsx` does on every `Text`.

Sources:
- https://github.com/expo/expo/blob/sdk-57/packages/expo-font/src/FontHooks.ts
- https://github.com/expo/expo/blob/sdk-57/packages/expo-font/src/ExpoFontLoader.web.ts
- https://github.com/expo/expo/blob/sdk-57/packages/expo-font/src/serverContext.web.ts
- https://github.com/expo/expo/blob/sdk-57/packages/@expo/router-server/src/static/renderStaticContent.tsx
- https://github.com/expo/expo/blob/sdk-57/packages/expo-font/ios/FontFamilyAliasManager.swift
- https://github.com/expo/expo/blob/main/packages/expo-font/CHANGELOG.md (58.0.1 entries)

## 3. `fontFamily` on RNW 0.21: is a CSS `@font-face` still needed?

`createReactDOMStyle.js:147-156`: `fontFamily` passes through unchanged
unless it contains `System` (expanded to the system stack) or equals
`monospace` (→ `monospace,monospace`). `fontFamily: 'SplineSans_400Regular'`
becomes `font-family: SplineSans_400Regular` in the atomic class. The name
matches whatever `@font-face` declares that family — RNW adds nothing of its
own.

Where the `@font-face` comes from is a choice:

- **`expo-font`** generates it (section 2), one family per key, no weight
  descriptor.
- **Hand-written in `global.css`** (already imported by `theme.web.ts`, which
  `_layout.tsx` imports): three rules under one family name with
  `font-weight: 400|600|700` and `font-display: block`, `src:
  url(/fonts/spline-sans/SplineSans_400Regular.ttf)`. Files in
  `mobile/public/fonts/` are copied verbatim into `dist/` by `expo export`
  ("Expo CLI supports a root public directory that gets copied to the dist
  directory… images, fonts, and other assets"; avoid `public/assets/`, which
  Metro reserves — https://docs.expo.dev/router/reference/static-rendering/#static-files).
  Then `fontFamily: 'Spline Sans'` + the existing `fontWeight` selects the
  right face with no synthesis. Global CSS lands in the static HTML `<head>`
  (`headNodes`), so there is no post-hydration swap; add a
  `<link rel="preload">` in `+html.tsx` if first-paint timing matters (it
  does not for a screenshot that waits on `document.fonts.ready`).

So: a CSS `@font-face` is needed only if `expo-font` is not used on web. On
SDK 57 the hand-written rule is the one that gets weights right. On SDK 58
`useFonts([{fontFamily, fontDefinitions}])` does the same from JS.

The family-name contract across platforms with the hand-written route: the
TTF's own family name is `Spline Sans` (fc-scan), the plugin's `ios.fonts`
registers it under that name, the plugin's Android object syntax lets you
declare `fontFamily: "Spline Sans"` with per-weight `fontDefinitions`, and
the CSS declares `font-family: "Spline Sans"`. One string, three platforms.

## 4. Where `fontFamily` lives

Options:

**A. `tokens.json` → `type.family` (one value) consumed by `Text` /
`useType`.** The studio can edit it, `applyOverrides` already handles the
path, and the drift differ can report `fontFamily` once `detectDrift.ts`
`TOKEN_PROPERTIES`/`PROPERTY_FAMILY` gain `fontFamily: 'type'`. Cost:
`tokenValidation.ts:171` rejects unknown `type` keys, so a rule is needed —
and it should be an **allow-list of bundled families**, otherwise the studio
lets a user type `Comic Sans` and the screen silently falls back to the
system font, which is the bug this ticket exists to remove.

**B. `type.<role>.family` per role.** Same machinery ×5; lets display use a
different face from body. Nothing in the design asks for that today, and
every extra family is another ~55–345 KB and another plugin entry.

**C. A single root style / CSS rule, no token.** Zero token-surface change
but, per section 0, a root CSS `font-family` does not reach `<Text>`; it
would need `#root * { font-family }` with id specificity, which also
clobbers the IDE's `fontFamily: 'monospace'` labels and is invisible to the
differ and to native.

Recommendation: A. `fontFamily` goes through `ui/index.tsx` `Text` and
`ds/store.ts` `useType` exactly as `size`/`weight` do, so the studio's
"token → screen" verification line (`renderFidelity.ts`) can check it the
same way.

## 5. `-webkit-font-smoothing` / `-moz-osx-font-smoothing` / `text-rendering`

- `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing:
  grayscale` are non-standard and **only work on macOS**
  (https://developer.mozilla.org/en-US/docs/Web/CSS/font-smooth). They switch
  macOS from subpixel to grayscale AA and make glyphs look lighter. On the
  Linux Playwright image they are no-ops. Effect on cross-OS stability:
  they make macOS *closer* to Linux (both grayscale), never further. Removing
  them changes what users on macOS see and buys nothing for a Linux-pinned
  baseline. Keep them; do not add a screenshot-only toggle, because a toggle
  that only acts on the machine you are not baselining on is noise.
- `text-rendering: optimizeLegibility` enables kerning and optional
  ligatures (https://developer.mozilla.org/en-US/docs/Web/CSS/text-rendering).
  Within one pinned Chromium build it is deterministic. Across Chromium
  versions the shaper (HarfBuzz) can move glyphs by sub-pixels, and that
  shows up as diff noise regardless of this property because kerning is on
  by default for most text anyway. The lever is pinning the Playwright
  image, not the CSS. Keep it.
- The real cross-OS instability is rasterisation itself (FreeType vs
  CoreText hinting, gamma). No CSS removes it. Ticket 08's Mac-vs-Linux
  policy should be: baselines are produced and compared **only** inside the
  Playwright Docker image; local Mac runs are advisory.

## 6. Does `_layout.tsx` have to change?

- **`useFonts` route:** yes. The hook must run during render inside the
  route tree so static extraction sees it (`withServerContext` wraps only the
  render in `renderStaticContent.tsx`). A module-level `loadAsync` in
  `theme.ts` runs at import time, outside that context, where
  `addServerFont` → `requireStore()` throws ("accessed outside of
  withServerContext()") on static export. `ds/` can *own* the hook
  (`export function useDisplayFont()` wrapping `expo-font`'s `useFonts` — the
  doc allows synchronous wrappers), but `_layout.tsx` must call it. One line,
  plus `guard.sh` documentation per the map.
- **CSS + plugin route:** no change to `_layout.tsx`. Changes land in
  `global.css` (unguarded), `app.json` (unguarded), `public/fonts/` (new),
  `tokens.json` + `tokenValidation.ts` + `detectDrift.ts` (ds/ide,
  unguarded), and **one line in `ui/index.tsx`** (`fontFamily: t.type.family`
  in `Text`, and in `useType`). The `ui/` edit is unavoidable in every route,
  because of section 0.
- Native caveat: the plugin needs a development build; Expo Go ignores it and
  silently falls back to the system font. That is the platform limit, not a
  defect of the route, and web remains the screenshot surface.

## Recommendation for ticket 08

1. Bundle **Spline Sans 400/600/700** (167 KB of unmodified TTF + `OFL.txt`) in
   `mobile/public/fonts/spline-sans/`; skip Inter (800 only, 1.4 MB, and the
   stack falls to it only when Spline Sans is absent, which it no longer is).
2. Change `type.display.weight` to `"700"` — Spline Sans has no 800, and
   synthesis differs per platform.
3. Web: hand-written `@font-face` ×3 in `global.css` under `"Spline Sans"`
   with `font-weight` descriptors, `font-display: block`, `font-synthesis: none`.
4. Native: `expo-font` plugin, Android object syntax with `fontDefinitions`
   weights, iOS file list; dev build required.
5. Add `type.family: "Spline Sans"` to `tokens.json`, allow-listed in
   `tokenValidation.ts`; `Text`/`useType` emit `fontFamily`; `detectDrift`
   learns `fontFamily`. `_layout.tsx` untouched; `ui/index.tsx` +1 line.
6. Screenshot wait predicate: `document.fonts.ready` **and**
   `document.fonts.check('700 16px "Spline Sans"')`; baselines only from the
   Linux Playwright image; keep the smoothing CSS as is.
