Type: task
Status: resolved
Blocked by: 04, 05

## Question

Replace commit-scoped revert with session-scoped revert, and add per-token undo on the same mechanism.

`POST /revert` runs `git checkout -- tokens.json`, which throws away uncommitted token work that predates the current session. Half-finished change from yesterday, one colour poked today, revert eats yesterday too. README lists this as a known limit.

Decided in charting:

- **Snapshot lives at module scope in the server, seeded on the first write of a session.** No filesystem writes, no cleanup path, dies with the process. Restarting the server mid-session loses the baseline — which matches the word "session" honestly, and the UI should say so rather than pretend otherwise.
- **Two distinct revert actions in the UI**, never blurred: per-row undo for one token, and a blanket "revert all to session start". `git checkout` stays available as a separate, explicitly destructive action, because "back to my session" and "back to committed" are different intentions.
- Per-token undo folds into this snapshot mechanism. One mechanism, not two.

Scope:

- The client's in-memory `overrides` map is the other half: reverting a token must clear its override entry *and* restore the file value, or the two diverge.
- "First write" needs a precise trigger — a session that has written nothing has no baseline to restore to. Decide what the revert button does in that state.
- `execFile` and `node:child_process` **stay** — baseline mode (ticket 09) needs `git show`. HANDOFF's promise that session revert removes them is superseded; do not remove the import.
- Extend ticket 01's harness for the snapshot semantics.

## Answer

Session revert replaces the old `git checkout` path; per-token undo folds into the same snapshot. 17 new tests (`npm test` 110), guard OK, `tsc --noEmit` clean, lint clean.

**A real bug, found by driving the server rather than by the tests.** The first version seeded the baseline *after* `setPath`, so the session's own first edit was captured inside the snapshot and `POST /revert` left it applied — `radius.sm` came back 14 instead of 10. The unit tests did not catch it, because at that layer the snapshot and the write are separate calls and either order looks right. It took planting uncommitted work in the file, making three writes, and reverting to see it. The fix is `establishBaseline(tokensBeforeWrite)`, deliberately distinct from the idempotent `seedBaseline`: the first write must overwrite any existing baseline, later writes must not. There is now a test named after the bug.

**The scenario the ticket is about, verified end to end.** Planted uncommitted work (`accent=#AAAA11`, `space.xl=48`) to stand in for yesterday's edits, then made three writes this session. After `POST /revert`: the planted values survived untouched, and all three session edits were undone — including the first one, which is what the ordering bug broke.

**"First write" trigger, decided:** the first *accepted* write. The server validates and resolves the path before establishing the baseline, so a 404 or a 422 does not consume the session's one chance to take a snapshot — verified by checking `hasBaseline` after a rejected write. Before that point `GET /session` reports `hasBaseline: false` and `POST /revert` answers **409** rather than a silent success, because the caller asked to undo something and nothing happened.

**Two revert actions, never blurred.** `POST /revert` is session-scoped; `POST /revert-committed` keeps the `git checkout` and is a separate, separately-labelled button in the panel with its own destructive wording. Folding them behind one flag would hide the difference at the call site.

**Per-token undo needed both halves**, which is easy to get half-right. Clearing the override stops the store masking the file but leaves the file holding the session's value; writing the original back fixes the file but the store still shows the edit. Both happen, keyed off `baselineValueFor`. A row shows `undo` only when it was edited this session.

**Honest about the degraded build:** `canRevertToSession` is a tri-state, null until the server has answered. The panel asks once on mount and keeps the button disabled with a reason rather than offering an undo with nothing behind it. With no server it says so — the deployed build's common case, not an edge case. `baselineLost` covers the server-restarted case: the client learns the baseline is gone and says the session has nothing to undo to, instead of dropping an override and leaving the file wrong.

`execFile` and `node:child_process` stay — ticket 09 needs `git show`, exactly as the map says.

One judgement call worth flagging: per-token undo costs a `GET /session` per invocation, which returns the whole token tree each time. That is fine at 14 screens and one undo at a time, and I did not add caching or a narrower endpoint since neither is warranted yet. If undo ever needs to be faster than the round trip, that is the place to change.