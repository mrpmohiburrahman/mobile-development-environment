Type: task
Status: resolved
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

## Answer

33 new tests (`npm test` 93), guard OK, `tsc --noEmit` clean. Both sides refuse bad values; nothing illegal reached `tokens.json` in any run.

**The shared file is `mobile/src/ds/tokenRules.json`** — ranges and patterns only, no functions, exactly as specified. The server reads it with `readFile` and caches the parse; the client imports it directly. A rule cannot differ between the two sides because there is only one copy.

**The part that needed deciding: the logic is mirrored, not shared, and that is a real limit worth naming.** The server cannot import `tokenValidation.ts` — it is Node-stdlib-only with no build step, and plain `node` fails a `.ts` import with `ERR_UNKNOWN_FILE_EXTENSION`. Type stripping would fix it, but that is a flag the server would then need, which is the build step the map forbids. So the *parameters* are one file and the *logic* is written twice: TypeScript in `tokenValidation.ts`, plain JS in `tokens.mjs`. The mirror is the only thing here that can drift, so `test/validation.test.ts` asserts the two functions agree on 49 cases — same verdict **and same error message**, since two sides explaining a rule differently is the drift itself. Mutation-checked: making the server stop policing `type.weight`, and changing one message's capitalisation, both fail it. **A future ticket that needs a new rule must touch both files; the test will say so.**

Two rules the ticket left open, decided against the obvious answer:

- **`rgb()` is refused.** The file is hand-editable and the panel writes 6-digit hex, but nothing in this app parses a colour string — `ColorInput` is `<input type="color">`, and every consumer reads the value straight into a style. Accepting `rgb()` would let `tokens.json` carry a value that renders as garbage, which is the failure this ticket exists to prevent. 3-, 4-, 6- and 8-digit hex are all accepted.
- **`radius.pill`'s ceiling is 999, not "a sane radius".** A cap derived from the visible radii (10/16/24) would reject the one value that exists to be huge. There is a named test for exactly that trap.

**One bug found and fixed while testing the rules:** splitting a `box-shadow` on commas rejected every real elevation in the file. `rgba(35,25,20,0.05)` has three commas of its own, so naive `split(',')` turned one good layer into four. `splitLayers` now tracks paren depth, and a test named after the trap guards it.

`type.*.weight` is validated as a **string** throughout, with a test asserting `800` is refused and `'800'` accepted. Typing it as a number would have rejected every weight in the committed file.

**Worth knowing about reachability.** The client-side refusal is correct but, as the panel stands today, unreachable by hand: every range input is already clamped to `0..64`, `0..60` or `9..48`, and `<input type="color">` cannot emit a non-hex. So in practice the server is what enforces this, and the panel's refusal notice appears for edits arriving from elsewhere. That is fine — the client copy is what makes a future free-text field safe — but I would not claim it is currently doing visible work, and the panel notice is unexercised by the UI as it stands.

The store keeps the refusal as `rejection` state rather than throwing, so the panel can say why a drag stopped where it did, and it clears on the next accepted edit so a stale complaint cannot outlive its cause.

The documented asymmetry stands and was left alone: `applyOverrides`/`setPath` in the store create unknown keys, the server's refuses them. `setPath` still runs before validation, so an unknown path gets 404 and a known path with a bad value gets 422.