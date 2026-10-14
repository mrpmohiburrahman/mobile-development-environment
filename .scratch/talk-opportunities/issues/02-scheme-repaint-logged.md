# 02 — The scheme repaint, logged

**What to build:** Switching the scheme from the Settings frame repaints **every
frame on the board**. Today the state tab shows nothing when it happens, because
the tab watches one store and the studio has two. After this ticket the loudest
interaction in the studio is also the one it can account for.

**Blocked by:** 01 — the log must exist before it can receive a second source.

**Status:** ready-for-agent

## Why this is not folded into 01

The two stores are not the same risk. The app store is a plain subscription. The
token editor store deliberately sits outside Metro's re-evaluated import graph,
because the server rewrites the token file and every rewrite makes Metro rebuild
anything that imports it — which once silently emptied an entire editing session,
including the unsaved-edit markers and the chosen scheme.

Bundling the two would conflate a plain subscription with a landmine that can
only be verified by writing a token and watching the log survive.

## Verification harness

Same as ticket 01. Additionally start `npm run tokens` in a second background
shell for the server-present mode.

## Acceptance criteria

- [ ] A scheme change writes a row naming the store it landed in, distinct from
      the store a habit change lands in.
- [ ] The subscription does not pull the token file into Metro's re-evaluated
      import graph. A static test asserts the mechanism is absent, following the
      precedent of the chrome test — the bug is silent when it returns, so it
      needs a test that reads the real source rather than a comment about it.
- [ ] Both stores feed one log in one order. A habit change and a scheme change
      in the same moment appear in the order they happened.
- [ ] The log makes no claim about what caused what.

**Browser, planted negative controls:**

- [ ] Switch to Dark in the Settings frame → every frame on the board repaints
      **and** one row appears naming the scheme. Before this ticket that frame
      repainted with a silent state tab.
- [ ] With the token server running, drag any token slider → the log **survives**
      the write and keeps every earlier row. This is the regression that emptied
      a session once; if it returns, the import graph has been breached.
- [ ] With the token server stopped, drag a slider → the log survives that too,
      because the edit is in memory and the log is not tied to the file.
- [ ] `bsk console` shows no page errors after the switch, with the comparison
      column off and with it on.
