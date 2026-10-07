Type: task
Status: resolved
Blocked by: 04, 05

## Question

Give `elevation.sm` and `elevation.md` an editor control.

`tokens.json` ships two elevation tokens, they are consumed at four call sites (`mobile/src/ui/index.tsx` lines 197, 293, 339, and `mobile/src/app/settings.tsx` line 52), and `TokenPanel.tsx` has no control for them. Two live shadows exist in the app that the studio cannot touch.

Decided in charting: **free-text input per elevation token, validated against a real `box-shadow` shape.** Honest that elevation is a composite value, not a scalar. A slider that pretends elevation is a number is explicitly ruled out.

Scope:

- Validation comes from ticket 05's shared rules file — the shadow-shape rule belongs beside the hex and number rules, not inline in `TokenPanel.tsx`.
- Both shipped values are two-layer `box-shadow` strings with `rgba()` colours and `0px` units. Match that shape; do not accept a single-layer shadow the file has never contained without deciding to.
- `type.*.weight` being a string is a live precedent for non-numeric leaves — check how the panel should render it too, or note it.
- The studio's own chrome uses hardcoded `boxShadow` strings in `Blueprint.tsx`. A dragged elevation token must not disturb them — that is what ticket 04 fixes, so build on top of it.
- Coordinate with ticket 03: the badge and this control both land in `TokenPanel.tsx`.

## Follow-up: 09 and 10 landed on top of this

The elevation control now feeds ticket 09's baseline column directly: a drifted `elevation.sm` is what made 6 of 7 screens flag, and the attribution names the token by matching the value pair on both sides.

The gap this closes is the studio's own: it offers live controls for every token family *except* the one that is a CSS string.

## Answer

Both elevation tokens get a text field with live shape feedback. 18 new tests (`npm test` 128), guard OK, `tsc --noEmit` clean, lint clean. Verified in Chromium that a typed shadow reaches a rendered screen.

**Draft-and-commit, not write-per-keystroke.** Mid-typing, a shadow is legitimately incomplete — `0px` is one length and cannot render — so committing on every keystroke would either spam the store's refusal or land a broken shadow in the file. The field keeps a draft, shows whether it is currently valid, and commits on blur or Enter; Escape discards. The field refuses a bad draft itself as well as in the store, so it just stays put with its reason.

**Two bugs found by driving it, neither reachable from the tests:**

- **Escape committed the draft instead of discarding it.** Blurring is what runs `commit`, and React had not applied `setDraft(value)` by the time that handler fired, so the discard path committed the value it was meant to throw away. Fixed by resetting the draft in place *without* blurring — the later blur then finds `draft === value`. A ref flag also worked but tripped `react-hooks/refs`, since the rule cannot tell `commit` is an event handler; the no-blur version is simpler and has no timing hazard at all.
- **`rgba(` was not recognised as a colour** by the summary helper, because the pattern required `rgb` immediately followed by `(`. Every elevation in the file uses `rgba()`, so the summary would have reported "no colour" on the real values. Caught by the test asserting layer summaries against `elevation.md`.

**Validation is ticket 05's rule, unchanged.** `ShadowInput` calls `validateBoxShadow` from the same module the server mirrors; nothing about elevation is re-decided here. `splitLayers` is now exported so the summary and the validator parse identically rather than agreeing by luck.

**Two small notes on the shape.** `describeShadow('0px 1px')` is reported as *valid*, and it should be: two lengths is offset and blur, which is legal CSS — a zero-blur shadow, not an unfinished one. There is a test saying so, to stop a future reader "fixing" the layer rule to demand three lengths and refusing a valid shadow. And the placeholder is `elevation.md` verbatim rather than an invented example, so the field advertises a value the app has proven renders. A single-layer shadow parses fine and is deliberately *not* what the placeholder suggests.

**`type.*.weight` — the ticket asked me to check or note it, so: noted, not built.** It is still a string leaf with no control. Now that a text field for a non-numeric leaf exists, wiring one up is small, but it belongs with a decision about whether weights are a select or free text, and no ticket claims it. Recorded rather than half-done.

**Ticket 04 is what protects the chrome, and that is asserted rather than assumed.** A test reads `Blueprint.tsx`, finds its hardcoded `boxShadow`, and checks it is none of the token values and still a valid shadow — so a future change that quietly wired the chrome to `elevation` fails there rather than at some point during a demo.

Two config-visible notes: `elevationEditor.ts` imports with an explicit `.ts` extension, which needed `allowImportingTsExtensions` in `mobile/tsconfig.json` (not a guarded path). Without it only modules with *no* runtime imports can be loaded by `node --test` — the same extensionless-specifier wall ticket 01 hit, now on the client side. And `react-hooks/set-state-in-effect` rejected the effect-based "adopt the store's value" sync, so it uses React's documented adjust-during-render pattern instead, which costs one fewer render pass per keystroke.