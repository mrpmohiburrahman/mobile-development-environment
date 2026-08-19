Type: task
Status: resolved
Blocked by: 02

## Question

Build the state tab: live Zustand tree that updates as you interact with screens in the artboard.

## Answer

`src/ide/StatePanel.tsx` — a recursive tree renderer over the Zustand store, on a `state` tab beside `tokens`. Zustand state is a plain object, so this is a subscription and a renderer with no devtools integration, which is what ticket 02 predicted.
