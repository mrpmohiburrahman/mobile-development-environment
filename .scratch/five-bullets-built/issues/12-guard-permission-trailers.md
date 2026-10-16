# 12 — Guard permission trailers

Type: task
Status: resolved
Labels: ready-for-agent
Blocked by: None — can start immediately
Map: ../map.md
Spec: ../spec.md

## What to build

The guard accepts an exact-path permission trailer and nothing else. A commit that edits a guarded file passes only when a trailer in the checked range names that file and gives a reason. A later branch that edits the same file fails without its own trailer. The existing guard tests still pass.

## Acceptance criteria

- [x] A `Guard-Allow: <path> -- <reason>` trailer permits only the named file in the head-side commit range.
- [x] A trailer without a reason fails the guard.
- [x] A trailer for one file does not permit a second file.
- [x] A permission from merged history or base-only commits does not permit a later branch.
- [x] A single-reference worktree check does not treat all historical trailers as permission.
- [x] Rename, deletion, nested-route, default-base, and invalid-range behavior stay as they are.
- [x] Exit 0 lists each permitted file with its reason. Exit 1 covers an unpermitted change, a reasonless trailer, and a bad range.
- [x] The guard message and workflow comment describe guard permission.
- [x] Tests use real throwaway git repos and position branches before every assertion.
- [x] `npm test` passes. The guard range checks used by both workflows pass.

## Answer

`scripts/guard.sh` parses `Guard-Allow: <path> -- <reason>` commit trailers across the head-side commits of a three-dot range (`left..right`). It permits only exact file paths that carry a non-empty reason. Exit 0 lists each permitted file and its reason. Exit 1 covers unpermitted guarded edits, reasonless trailers, and broken ranges. Single-reference worktree checks (`HEAD`) do not read historical trailers. `test/guard.test.ts` covers permitted edits, reasonless trailers, sibling and prefix rejection, merged and base-only history isolation, worktree checks, and `$before...HEAD` push ranges.
