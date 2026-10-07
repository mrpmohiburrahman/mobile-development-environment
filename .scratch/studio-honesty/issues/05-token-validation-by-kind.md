Type: task
Status: open
Blocked by: 01

## Question

Validate token values against the shape of their leaf, in both the client store and the server, with the rules in one shared file.

The server currently checks that a dotted path exists, then writes whatever it was handed. A malformed hex string in `color.light.accent` renders as garbage and nobody finds out until a screen looks wrong. README lists this as a known limit.

Decided in charting:

- **Both sides.** The client validates so drag-constrained values give immediate feedback while typing or dragging; the server validates independently because it must refuse bad writes from anything that is not this client. Same rules, no drift.
- **One shared JSON rules file** the server reads with `readFile` and Metro imports directly. One source of truth by construction.
- The file **must live under `mobile/src/`** — there is no `metro.config.js`, so Metro cannot resolve a file outside the app root without adding build config. Put it beside `tokens.json`.

Rules by leaf kind:

- `color.*` — hex. Decide whether 3-digit, 4-digit, 8-digit, and `rgb()` forms are accepted; the panel writes 6-digit from `<input type="color">`, but the file is hand-editable.
- `space.*`, `radius.*` — finite number in a sane range. `radius.pill` is `999`; pick a ceiling that does not reject it by accident.
- `type.*.size` / `lineHeight` / `letterSpacing` — finite number. `type.*.weight` is a **string** (`"800"`), despite the brief listing it alongside the numeric fields. Do not type it as a number.
- `elevation.*` — string, validated against a real `box-shadow` shape (see ticket 06).

Scope:

- Reject with a useful message; never write a broken file.
- JSON holds rule *parameters* (ranges, patterns), not functions — the validation logic itself lives in code on each side.
- `applyOverrides` / `setPath` in the store create unknown keys; the server's refuses them. This asymmetry is unreachable from the UI today — note it, do not change it.
- Extend ticket 01's harness. The shared-file design means drift is impossible by construction; the tests exist to pin the rules themselves.