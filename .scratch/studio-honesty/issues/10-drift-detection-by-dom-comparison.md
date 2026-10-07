Type: prototype
Status: open
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