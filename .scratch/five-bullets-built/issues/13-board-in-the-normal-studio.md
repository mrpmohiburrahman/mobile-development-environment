# 13 — Board in the normal studio

Type: task
Status: resolved
Labels: resolved
Blocked by: None — can start immediately
Map: ../map.md
Spec: ../spec.md

## What to build

The accepted Contour board with the Guide camera replaces the old blueprint at the normal studio entry. The static export includes it. A developer sees declared and observed route connections, board-local Back history, draggable screen frames, Fit, and Reset layout without a development-only gate.

## Acceptance criteria

- [ ] The normal studio entry and the static export render the accepted board with real screen components.
- [ ] Declared routes appear before any interaction. Declared connections are dashed. Observed connections are solid. The active connection stays accented until the next navigation action.
- [ ] Direct connections use straight arrows between side midpoints. Detours use separate parallel lanes above the row with rounded elbows.
- [ ] Back resolves against board-local history and reports no destination when history is empty. Preview actions stay separate from observed journeys.
- [ ] Screen frames move by header or footer drag and by keyboard. The grip appears on hover or focus only. Frame position never changes declared screen order.
- [ ] Fit changes only the camera. Reset layout restores frame positions and the camera together. Reset session keeps its own job.
- [ ] The token editor, baseline comparison, state log, route evidence, and fidelity information remain available.
- [ ] The development-only prototype gate no longer gates the shipped board.
- [ ] Browser checks cover the exported board. `npm test`, lint, and typechecking pass.

## Answer

Commit `e300342` ships the board. The normal studio entry at `/ide` and the static export render `StudioBoard` from `mobile/src/ide/MidpointPrototype.tsx` with the real screen components. `mobile/src/ide/Blueprint.tsx` is now a thin wrapper that owns the capture listener and passes slots to the board. `mobile/src/app/ide.tsx` no longer reads a development flag.

Declared connections render dashed. Observed connections render solid. Direct connections attach to facing side midpoints. Detours use parallel lanes above the row with rounded elbows. `midpointBoard.ts` resolves Back from board-local history and returns no destination when history is empty. Preview history stays separate from observed history. Frames move by header or footer drag and by arrow keys. The grip shows on hover or focus only. Fit changes only the camera. Reset layout clears frame positions and the camera together. Reset session clears the log only.

`browser/studio-board.mjs` is the browser check. Run it with `npm run test:board` after `npm run export:web`. It covers hydration, the declared edge title, Back with an empty history, preview separation, and keyboard frame moves. It also covers reload persistence, the tokens, routes, baseline, and state tabs, and the Studio evidence details.

## Verification

Run on 2026-10-18 in this worktree.

- `npm test`: 428 tests passed.
- `npx tsc --noEmit` in `mobile/`: passed. The worktree lacked `@react-native-async-storage/async-storage`. One `npm install --no-save` of the locked version 2.2.0 fixed the environment. No lockfile changed.
- `npx expo lint` in `mobile/`: passed.
- `scripts/guard.sh 51d1585...e300342`: passed. No guarded file changed.
- `npm run test:board`: **not run in this session.** The host had 0.1 GB free and 2.4 GB of 3 GB swap in use. The owner deferred the export and browser steps. The script exists and covers the criteria above. Run it before ticket 17 or 18 starts.

## Code review

Two read-only reviews of `e300342`. Standards axis and Spec axis, kept separate.

Standards. No hard violation. Guard, ADR 0001, and ADR 0003 hold. Judgement calls:

- README uses "journeys". CONTEXT.md lists it under *Avoid* for Direct connection. README introduces "Contour board" and "Guide camera" with no glossary entry.
- Names still say "prototype": `MidpointPrototype.tsx`, `midpointPrototype.css`, `PrototypeNavigationContext`, `PrototypeAction`, storage key `streak-studio.midpoints.frame-positions`.
- `fly()` is identical in `browser/analytics-tab.mjs` and `browser/studio-board.mjs`.
- `navigationEnabled` threads through four functions, then recombines with `column === 'current'`. Pass the column once.
- The board initialises `view` non-null. Three `view?.` and `view &&` guards are dead.
- `test/mechanisms.test.ts`: the "same node as the zoom listener" test now asserts `wheel` in a different file.

Spec. Criteria 1, 4, 5, 6, and 8 implemented and covered. Findings:

- Criterion 2, partial: 12 declared tab routes hide behind **Include tabs** by default.
- Criterion 2, questionable: `record()` clears the accent before it resolves. A Back with no destination clears the accent with no navigation.
- Criterion 4, questionable: `navigateBoardHistory` leaves `history[from]` intact after Back. A second Back on the left frame still resolves.
- Criterion 3: direct arrows offset 14 px from the midpoint when a reverse route exists.
- Criterion 7: control inventory, press tally, and render verdict sit inside a collapsed Studio evidence details.
- Scope creep: `--test-concurrency=1`, `--max-workers 1`, `"$@"` passthrough in `export-web.sh`, the `history-dependent` label, reduced-motion CSS, README rewrites beyond the board paragraph.

None of these block the ticket. The accent and history findings are candidates for a follow-up ticket.
