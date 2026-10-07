Type: task
Status: resolved
Blocked by: 01

## Question

Decouple the studio's own chrome from the app's design tokens.

All four IDE chrome files import `Text` from `../ui`, which reads `useTheme()`:

- `mobile/src/app/ide.tsx`
- `mobile/src/ide/Blueprint.tsx`
- `mobile/src/ide/StatePanel.tsx`
- `mobile/src/ide/TokenPanel.tsx`

Dragging `type.caption.size` therefore distorts the editor's own labels. HANDOFF flags this as a bug to fix before filming the type scale.

Scope:

- A studio-local `Label` component over raw `RNText` at fixed sizes, in `mobile/src/ide/`. Swap it into the chrome call sites.
- `mobile/src/app/ide.tsx` is a **named exception** to the byte-identical guard — editing it is deliberate and expected. Confirm against the carve-out pathspec in ticket 02.
- The chrome already hardcodes a palette (`CHROME` in `Blueprint.tsx`: `#16120F`, `#F4EFE9`, `#D9481E`). The fixed-size labels should read as one deliberate system with it, not a second competing palette.
- Do not touch `mobile/src/ui`. The bug is that chrome *reads app tokens*, not that `ui` is wrong.
- This lands before tickets 06 and 09 because both edit the same chrome files. Doing it first avoids retrofitting a Label swap into UI those tickets just wrote.

## Answer

All four chrome files are off `../ui`. `Label` in `mobile/src/ide/Label.tsx` is raw `RNText` at frozen sizes; `npm test` is 60, `tsc --noEmit` clean, lint clean, guard OK.

**The frozen spec lives in `ide/chrome.ts`, not in `Label.tsx`.** `Label.tsx` imports react-native and so cannot be loaded by `node --test`; `LABEL_SPEC` can. That is the whole reason ticket 01's seam pattern keeps paying off — the numbers are testable precisely because they are not next to the component.

**One more token read than the ticket listed.** `Blueprint.tsx`'s zoom pill took `borderRadius: t.radius.pill` from `useTheme()`, so a radius drag reshaped the studio's own furniture — the same defect wearing a border instead of a font. Fixed radii now live in `CHROME_RADIUS`. The `ColorInput` border radius and three `999`s in `TokenPanel`/`ide.tsx` moved onto the same constant while I was in the files.

**One place the hexes are *not* unified, on purpose.** The request was that the fixed labels read as one deliberate system with `CHROME` rather than a second palette. `StatePanel.tsx`'s tree keeps its literal syntax-highlight hues (`#7fb3d5` keys, `#c3e88d` strings, `#f78c6c` numbers). Those are not chrome semantics — a key and a value are a different kind of thing from a section heading — and folding them into `CHROME` would have meant inventing a second palette inside the first. Sizes come from `Label` regardless, which is what the bug was about. Flagging it because it reads as an incomplete sweep of the greps.

**Tests assert the mechanism statically, not the rendered size.** No framework, no DOM, so `test/chrome.test.ts` asserts no chrome file imports `Text` from `../ui`, none calls `useTheme`, none renders a raw `<Text>`, and that mutating `tokens.json` leaves `LABEL_SPEC` unmoved. Reintroducing the `../ui` import into `TokenPanel` fails 3 of them. One test strips comments before matching: `DiskBadge.tsx` *names* `useTheme` while explaining why it does not use it, and a raw grep flagged that documentation as a defect.

**Verified in the browser, because the static assertions cannot show the fix works.** Dragged `type.caption.size` from 12 to 34 in the real studio: `BLUEPRINT` stayed 13px and the header caption stayed 12px, while the largest text inside the phone artboards went 32px → 34px. The chrome held and the screens followed, which is the whole claim. `tokens.json` was restored and the working tree holds only the intended changes.