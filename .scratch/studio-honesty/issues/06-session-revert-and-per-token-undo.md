Type: task
Status: open
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