# 17 — Capture mode

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: 13 — Board in the normal studio, 14 — Bundled font
Map: ../map.md
Spec: ../spec.md

## What to build

A query on the studio route renders one app surface at scale 1 for screenshot capture. The surface becomes ready only after fonts, fixture, scheme, and size settle. Invalid requests never become ready. Capture mode ignores shared links and token overrides. The static export honors the query.

## Acceptance criteria

- [ ] The static export honors `capture`, `screen`, `scheme`, and `state` query parameters without a development-only gate.
- [ ] Capture mode renders one app surface of 390 by 820 CSS pixels at scale 1, using the real screen components. It excludes the frame header, footer, route connections, and studio controls.
- [ ] The fixture applies before the first paint. Populated Habit detail selects Morning run. Empty Habit detail has no selection. Other screens use the signed-in seed.
- [ ] Capture mode ignores the shareable hash and all token overrides. It renders committed tokens only.
- [ ] An unknown screen, scheme, or state never sets the ready attribute. An empty state on any screen but Habit detail does the same. Each case displays a diagnostic error.
- [ ] The ready attribute appears only after the fixture, scheme, size, committed tokens, font availability, image completion, and reduced-motion final state all hold.
- [ ] Missing fonts or failed images never become a successful capture. A sleep is not the wait.
- [ ] Browser checks cover a valid capture and an invalid request on the static export.
- [ ] `npm test`, lint, and typechecking pass.
