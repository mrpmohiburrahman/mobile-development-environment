Type: prototype
Status: resolved
Blocked by: 09

## Question

Flag the screens that differ, by comparing the two renders' DOM subtrees.

Item 1 of the brief says "flags the ones that differ". You cannot know which tokens a screen consumes without static analysis — which property 1 forbids, correctly. So detection happens at render time.

Decided in charting: **walk both artboards' DOM in parallel and compare computed styles per node.** That yields a precise answer: which screens differ, and which properties. No screenshots, no static analysis, no inference about token usage.

Scope:

- RNW 0.21 / React 19.2.3 generate their own class names; comparing class strings is meaningless. Compare **computed styles**, and only properties that tokens can actually move — colour, background, padding, margin, gap, border radius, font size, line height, letter spacing, box shadow. Ignore layout noise the two renders may produce nondeterministically.
- Both columns render the same components from the same store state, so most of the DOM should match exactly. Find the mismatches, do not reimplement a general differ.
- Pairing nodes across two trees needs a stable identity — screen key plus DOM position within the frame. Screens are already enumerated with stable keys in `screens.ts`.
- The result must be readable at a glance: which screens drifted, and ideally which token changed. Worth showing the offending value pair, since "this screen differs" without "because `color.light.accent` is `#D9481E` vs `#FF7A4C`" is a weak tool.
- This is the flagship claim. If the output cannot be trusted, the honest fallback is a weaker feature that says less — not a confident wrong answer.

`feat/drag-on-canvas` has DOM-climbing instincts for finding a component from a cursor position, but that branch stays untouched; rebuild what is needed here.

Use `/prototype` to raise fidelity — a rough artifact the user can react to beats a confident design described in prose.

## Answer

Each screen's two artboards are walked in parallel and their computed styles compared, on the 24 properties a token in `tokens.json` can actually move. 33 tests; `npm test` 198.

**Pairing uses `nativeID`, not `data-*` — and the first attempt silently found nothing.** The frames carried `data-screen-key` / `data-baseline-key`, and RNW filters unknown props off `View`, so those never reached the DOM. The pairing walked zero pairs and the panel said "turn on the comparison to see which screens drifted" — which reads as "not compared yet" rather than "the comparison is broken". Exactly the confident-wrong-answer failure the ticket warns about, arrived at by the most innocent route. `nativeID` maps to a real DOM id and is the idiomatic RN way to say this.

Pairing also iterates `screens.ts` rather than the DOM, so a frame that failed to mount is reported missing instead of quietly dropping out of the comparison.

**Two bugs in the comparison itself, both found by the new tests:**

- **Lengths were only canonicalised in one direction.** `normalizeValue` turned `16px` into `16px` and `16` into `16`, so the two never matched — which silently defeated attribution for *every* numeric token while still reporting the difference. Now canonicalised to px in both directions.
- **`fontWeight: '700'` was being eaten by the length rule** and turned into `'700px'`. `fontWeight` now has a complete branch that maps the browser's `normal`/`bold` back to `400`/`700` and returns numeric weights untouched.

An earlier draft went further and *skipped* `fontWeight` when it saw `normal`/`bold`. That hid every weight change in the file — the bug the current branch exists to prevent, and there is a test named after it.

**Attribution is value matching, and says so.** A token is named only when one drifted token's current value equals the current render's value *and* its baseline value equals the baseline render's. Ambiguous (two tokens with the same pair) or unmatched yields `null`, and the panel shows the family instead: "color, unattributed". That is the ticket's honest fallback — say less, never guess.

**One more normalisation, because the browser reorders the parts.** `getComputedStyle` serialises `rgba(35, 25, 20, 0.05) 0px 1px 2px 0px` while the file writes `0px 1px 2px 0px rgba(35,25,20,0.05)`. Same shadow, different order, so every elevation difference read as unattributed for a reason unrelated to design drift. Shadows are now split into colour and lengths and re-emitted in one order. The first attempt at that fix used `split(/\s+/)`, which tore the browser's spaced-out `rgba(...)` into four fragments; `splitLayerParts` now splits on whitespace at paren depth 0.

**A shape mismatch is reported, not truncated.** Both columns render the same components, so paired node counts should match; when they do not, that frame's verdict is marked unreliable rather than silently compared up to the shorter length.

**Verified in Chromium, and the precision is real.** With `elevation.sm` planted against `HEAD`, exactly 6 of 7 screens were flagged, each naming the screen, `boxShadow`, both value pairs, and the token `elevation.sm`. The seventh — Habit detail — was a genuine negative: with nothing selected it returns its early "No habit selected" branch, which has no Card and no Button, so it never touches `elevation.sm`. Checked in the source rather than assumed. A tool that flagged all seven would have been no use.

With nothing drifted the panel reports "no screen drifted — 7 screens compared node for node". **Store-state caveat worth knowing:** the answer depends on what each screen renders *in its current store state*, so a screen showing an empty state reports nothing even though its populated state would drift.

**The 14-frame question from the map is answered empirically.** `reactCompiler: true` with 14 live screens ran without page errors throughout, though no viewport budget was needed at this scale. Ticket 09's opt-in toggle is what keeps it affordable; that is why compare is a toggle and not the default.
