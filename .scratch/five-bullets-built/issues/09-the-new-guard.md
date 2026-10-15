# 09 — What the guard now guards

Type: grilling
Status: open
Blocked by: 07, 08
Map: ../map.md

## Question

`scripts/guard.sh` and `studio-guard.yml` enforce byte-identical
`mobile/src/ui` and `mobile/src/app` (except `ide.tsx`). The owner has
allowed app-code edits for this effort. Tickets 07 and 08 name the files
they must touch. Decide:

- The exact list of guarded-path edits this effort makes, each with its
  reason (font loading in `_layout.tsx`? screen-view instrumentation? a
  `testID` per screen for Playwright?).
- The new guard statement: is the guard narrowed to a list of files, moved
  to "guarded except these named hooks", or replaced by a rule such as "app
  code may import from `ds/` and `ide/designing` only"? The README's claim
  about the app being untouched must be rewritten to match.
- Whether each app-code change could instead be made from studio ground
  (`ds/`, `ide/`) with a documented trade-off, so the guard list stays as
  short as it honestly can.
- How `guard.sh`'s exit codes and messages change, and the test in
  `test/` that covers the new rule.

Resolve with the file list and the new guard wording.
