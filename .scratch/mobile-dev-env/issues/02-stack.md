Type: grilling
Status: resolved

## Question

Which router and state library? The talk used React Navigation + Redux + redux-persist, current for early 2024.

## Answer

Expo Router + Zustand.

Expo Router is the current Expo default, and file-based routing actively helps here: the blueprint can enumerate screens from the filesystem instead of maintaining a hand-written import list that silently rots when someone adds a screen. That is a genuine improvement over the talk, not just a version bump.

Zustand's store is a plain object, so the state-inspector panel is a subscription and a tree renderer rather than a devtools integration.

Rejected: React Navigation + Redux Toolkit — faithful to the talk but reads as dated to a reviewer, and the hand-maintained `<Stack.Screen>` list is exactly the fragility we can design out.
