Type: task
Status: open
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

The gap this closes is the studio's own: it offers live controls for every token family *except* the one that is a CSS string.