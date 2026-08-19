Type: task
Status: resolved
Blocked by: 03, 05

## Question

Build the left sidebar: one editor per token family — colour picker, spacing stepper, radius stepper, type scale — plus the theme toggle.

## Answer

`src/ide/TokenPanel.tsx`. Colour rows use `<input type="color">` and numeric rows use `<input type="range">`, rendered through `createElement` — the IDE is web-only and the browser already ships both, so a picker library would only re-draw what the platform gives away.

Dragging a type size also updates its `lineHeight` (x1.25), because dragging size alone makes the scale fall apart on screen.

Light/dark is a scheme switch at the top; the colour section edits whichever scheme is active.
