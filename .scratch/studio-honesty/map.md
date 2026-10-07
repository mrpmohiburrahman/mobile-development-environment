# Map: Making the design-token studio's claims demonstrable

Labels: `wayfinder:map`

## Destination

Six extensions shipped to `Streak Studio`, the design-token editor at the `/ide` route: a committed-baseline mode that flags drift against `HEAD`, a visible disk-vs-memory badge, token validation by kind, session-scoped revert with per-token undo, an `elevation` editor, and studio chrome decoupled from app tokens.

Done when all six work in both modes — token server running locally, and server absent on the deployed static build — with `git diff origin/main...HEAD -- mobile/src/ui mobile/src/app ':(exclude)mobile/src/app/ide.tsx'` empty, and the README's claims narrowed to what the code actually does.

## Notes

**Source of truth.** [`extension-build-prompt.md`](../../extension-build-prompt.md) is authoritative. `EXTEND-STUDIO.md` is an untracked earlier draft with a different ranking — ignore it, it stays on disk.

**This map carries execution.** Wayfinder normally plans only; this effort overrides that, as the previous map did. Most tickets build rather than decide. The tickets that do decide are [Render a screen from a token tree other than the module import](issues/08-render-from-alternate-token-tree.md) and [Flag drifted screens by comparing the two renders](issues/10-drift-detection-by-dom-comparison.md).

**Standing constraints — verified against the code, not taken on trust.**

- `mobile/src/ds/` is **editable**. Property 4's git guard covers only `mobile/src/ui` and `mobile/src/app`; the guard is the rule. Items 2, 3, and 4 all need `ds/`. The prose in the prompt listing only `mobile/src/ide/`, the server, and `README.md` as editable does not govern.
- `mobile/src/app/ide.tsx` is a **named exception** to the byte-identical guard. Item 6 edits it. Every other file under `mobile/src/app`, plus all of `mobile/src/ui`, stays byte-identical.
- Token server stays Node-stdlib-only: no dependencies, no build step.
- `execFile` and `node:child_process` **stay**. Baseline mode needs `git show`; session revert is pure in-memory but does not justify removing the import that item 1 depends on. HANDOFF's claim that session revert removes `execFile` entirely is superseded.
- No `metro.config.js` exists. Any file both Metro and the server read must live under `mobile/src/` — otherwise Metro cannot resolve it without adding build config.
- Node is v22.13.1 via nvm; the system default is not it. Call `/Users/mrp/.nvm/versions/node/v22.13.1/bin/node` directly if the lazy loader misbehaves non-interactively.

**Testing.** `test/` and `npm test` do not exist on this branch — they live on the unmerged `feat/drag-on-canvas`. This effort creates them. `node:test` with type stripping, no framework, no build step, no dependency: `node --experimental-strip-types --test test/*.test.ts`.

**Branch.** Starts from `design/polish` (currently `origin/main`). `feat/drag-on-canvas` stays untouched — HANDOFF says do not disturb it, and its value-matching token inference is not needed here.

**Honesty is a deliverable.** The blueprint's central claim is that it cannot lie because it renders the real components. Baseline mode compares two renders of the same components against two token sets — it is not a pixel diff of two screenshots, and neither the UI nor the code comments may imply otherwise.

## Decisions so far

- [Test harness](issues/01-test-harness.md) — `npm test` runs 12 tests on `node:test` with no framework. `store.ts` proved unimportable under `node --test` (Node's resolver rejects the extensionless specifier Metro allows), so the pure logic lives in two import-safe seams: `mobile/src/ds/applyOverrides.ts` and `token-server/tokens.mjs`. Later tickets import from those, never from `store.ts` or `index.mjs`.
- [Byte-identical CI check](issues/02-byte-identical-ci-check.md) — the guard is `scripts/guard.sh`, not inline YAML, so it is testable and runs locally via `npm run guard`; `studio-guard.yml` picks a range and calls it. Three dots, `fetch-depth: 0`, `origin/HEAD` as the default base (this repo's local `main` is stale and its tip contains an app-wide rewrite that would be misattributed). `ide.tsx` carve-out pinned narrow by parsing the reported file list. Triggers on PRs *and* pushes. `npm test` now 33.
- [Disk-vs-memory badge](issues/03-disk-vs-memory-badge.md) — the badge lives in the blueprint header as `ide/DiskBadge.tsx`, reading three states: `not checked yet` / `writes to disk` / `in-memory only`. Reactivity is a subscription in `ds/client.ts` rather than a zustand field: `store.ts` is the module ticket 01 proved unimportable under `node --test`, so the store would have made the required test impossible, and it would hold a second copy of `reachable`. `useSyncExternalStore` needs `getServerSnapshot` here because `output: "static"` prerenders the route. No probe on mount — the flag is only written by a real write attempt, so `not checked yet` means "nothing tried", not "a probe failed"; that is what keeps a running server from earning the badge a claim. The pure mapping is its own import-safe module, `ds/reachability.ts`, mirroring `applyOverrides.ts`. **`CHROME` moved out of `Blueprint.tsx` into `ide/chrome.ts`** — ticket 04 should put its studio-local `Label` there too, and should leave `DiskBadge` alone (already raw fixed-size text, so a badge is not built twice). `npm test` now 49.

## Not yet specified

- How drift detection performs under `reactCompiler: true` (`app.json` experiments) with 14 live screens at reduced scale, and whether the toggle needs a viewport budget.
- Whether `type.*.weight` (a string, `"800"`) gets its own control while elevation is being added. It is a second non-numeric leaf family and the same argument applies, but no ticket claims it.
- Whether `warning` and `radius.sm` should gain readers or be deleted. Out of scope this pass, but they keep two live sliders in the panel wired to nothing.
- Whether baseline mode should compare per-scheme or only the active scheme. Depends on what the token-tree mechanism in ticket 08 makes cheap.
- Whether the deployed static build should hide the compare toggle entirely when no server answers, or show it in a disabled state explaining why.

## Out of scope

- Light and dark side by side. The prompt rules it out for this pass.
- Per-token undo as its own mechanism. Folded into [session-scoped revert](issues/06-session-revert-and-per-token-undo.md); one snapshot mechanism, no second one.
- Navigation arrows. `useNavigate()` in `ide/designing.tsx` is the chokepoint, but four edges across seven screens makes for a thin demo.
- The `#fff` hardcoded for the accent button label — scheme-blind, causes real contrast failures, lives in app code, would break the guard. Record as a known limit.
- Server `setPath` refusing to create unknown keys while the store creates them. Unreachable from the UI today; note it, do not change it.
- Merging `feat/drag-on-canvas`. A separate effort; HANDOFF forbids committing to `main` until the progress video is filmed.