Type: task
Status: open
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