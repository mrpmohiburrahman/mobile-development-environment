Type: task
Status: resolved
Blocked by: 01

## Question

Make the byte-identical guard a fact rather than a claim, by adding a CI check.

Today the only workflow is `.github/workflows/no-ai-attribution.yml`. Nothing enforces the studio's central property: that app screens and shared components stay byte-identical while the studio grows around them.

Add a workflow that fails when the guard breaks, using the carve-out decided in charting:

```
git diff origin/main...HEAD -- mobile/src/ui mobile/src/app ':(exclude)mobile/src/app/ide.tsx'
```

Scope:

- `ide.tsx` is a named exception — ticket 04 edits it deliberately. Every other file under `mobile/src/app`, and all of `mobile/src/ui`, must produce an empty diff.
- Confirm the pathspec `:(exclude)` form works against this repo's git version before relying on it; `git diff --stat` with the full pathspec is a cheap smoke check.
- Decide whether the check runs on `main` too, or only on pull requests.
- Run the test suite here as well, once ticket 01 lands — the rules-parity risk identified in charting has no other guard.

Note it is not yet a required status check; `no-ai-attribution.yml` says to make it one in branch protection settings, which is a manual step for the user.

## Answer

The guard now runs in CI. `.github/workflows/studio-guard.yml`, plus `scripts/guard.sh` (the logic) and `test/guard.test.ts` + `test/workflow.test.ts` (21 tests). `npm test` is 33 tests, 0 failures. Triggers match `no-ai-attribution.yml` exactly — `pull_request` and `push` to any branch.

**The guard's logic went into a script rather than staying inline in the YAML.** The ticket's `git diff` line was verified against git 2.54 and the `:(exclude)` form works, but an inline diff in YAML is a second copy of the rule with nothing testing it — it could rot, and nothing local would notice. `scripts/guard.sh` is testable, and `npm run guard` runs it locally. The workflow now only picks a range and calls the script; `test/workflow.test.ts` asserts it stays that way.

**Answers to the open questions:**

- The `:(exclude)` pathspec works; `git diff --stat origin/main...HEAD -- mobile/src/ui mobile/src/app ':(exclude)mobile/src/app/ide.tsx'` is empty on this branch.
- **Both PRs and pushes**, matching the attribution workflow. PR-only was considered and rejected: a guard that never reports on direct pushes to `main` leaves the default branch unguarded between merges.
- The test suite runs in the same workflow, as a separate step. That covers the ticket's rules-parity worry.

**Three-dot range, deliberately.** Pinned by a test where `main` has an independent edit to `mobile/src/ui/Card.tsx` that the studio branch does not contain — the branch passes. Two dots would blame it for someone else's commit. `fetch-depth: 0` is required and is itself asserted, because the merge base does not exist in a shallow clone.

**`ide.tsx` carve-out is pinned narrow.** `:(exclude)` on a path nested inside a watched directory is the risky form, so two tests assert it: `ide.tsx` alone passes, and `ide.tsx` *plus* a sibling screen fails while naming only the sibling. The second test parses the reported file list rather than regex-matching the whole message, because the failure text mentions `ide.tsx` to explain the exception — a regex over the whole output would have failed for the right reason and looked like a broken guard.

**Two bugs found while testing, both real:**

1. `git rev-parse --verify` rejects the `a...b` range form, so the first version's "does the range resolve" pre-check failed on *every* invocation, valid ones included. Now the guard asks git for the diff directly and relays git's own error on failure. This is the case the ticket cares about most: a typo'd ref or shallow clone must exit 1, not 0. Pinned by a test.
2. The default range was `main...HEAD`. This repo's local `main` is stale — 3 commits behind `origin/main`, which itself contains an app-wide rewrite (`dd56358`, "polish tabs layout") that touched all 14 screens. So `npm run guard` failed on a branch that broke nothing. The default is now `origin/HEAD`, falling back to `origin/main`, then `main`; a stale base would attribute other people's commits to the branch under test.

**One test expectation was wrong, not the guard.** I first asserted that moving a file out of `ui/` into `ds/` passes, expecting `git diff` to see a clean move. It does not — git reports the deletion under `ui/`, and that *is* an edit to a byte-identical file. Relocating a component out of the guarded tree is exactly the quiet way to defeat this guard, so both directions now fail. Test renamed to say so.

Beyond the tests: `npm run guard` clean against the real repo; a real violation reproduced in a throwaway worktree (edited `mobile/src/ui/Card.tsx`, guard failed naming that file, worktree removed); `tsc --noEmit` clean in `mobile/`; token server still serves `GET /tokens`, still 404s an unknown path, `POST /revert` still restores `tokens.json` — verified end to end after the `tokens.mjs` extraction.

Still a manual step for the user: marking `studio-guard` a required status check in branch protection.