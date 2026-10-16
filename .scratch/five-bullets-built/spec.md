# All five bullets: implementation spec

Type: spec
Status: ready-for-agent
Labels: ready-for-agent
Source: [Decision map](map.md)

## Problem Statement

The developer needs a studio that runs the real app screens, explains navigation, and supports stakeholder reviews. The state log already works. The accepted navigation board exists behind a development-only entry. Present mode, shareable URL state, screenshot checks, and native analytics still need implementation.

The app must send analytics from a native device or the iOS Simulator. The browser studio must send no analytics events. Shared screen components must not blur that boundary.

The current guard blocks required app edits. Font research and screenshot examples do not establish working fonts or repeatable screenshots. A resolved decision does not prove a completed feature.

## Solution

Complete the five features as one coherent studio and native-app workflow:

1. Preserve the existing state log.
2. Integrate the accepted navigation board into the normal studio and static export.
3. Send four analytics events from the native app only.
4. Compare deterministic web captures with reviewed Linux screenshot baselines.
5. Add Present mode and shareable URL state for stakeholder reviews.

Use explicit empty, missing, and failed states. Never equate no measurement with a pass. Keep all real analytics reports in Mixpanel. The studio Analytics tab explains the native-only boundary and links to the project.

## User Stories

### State and navigation

1. As a developer, I want the existing state log preserved, so that I can inspect real app changes.
2. As a developer, I want the accepted board in the normal studio, so that deployment includes its navigation features.
3. As a developer, I want real app screens on the board, so that the studio cannot drift into screen copies.
4. As a developer, I want declared routes visible before interaction, so that an empty history does not imply missing routes.
5. As a developer, I want declared and observed routes distinguished, so that I know the evidence behind each route connection.
6. As a developer, I want the latest active connection accented, so that I can follow a navigation action.
7. As a developer, I want detours outside intervening frames, so that route connections remain readable.
8. As a developer, I want Back to use board-local history, so that the board reflects the current journey.
9. As a developer, I want an explicit empty-history state, so that the board does not invent a Back destination.
10. As a developer, I want movable screen frames, so that I can arrange a review without changing declared screen order.
11. As a keyboard user, I want accessible drag handles, so that I can move and center screen frames without a mouse.
12. As a developer, I want Fit and Reset layout separated, so that camera changes do not unexpectedly remove frame positions.

### Native analytics

13. As an app developer, I want events from the native app, so that Mixpanel measures app activity rather than studio activity.
14. As an app developer, I want Simulator verification, so that I can test analytics before publishing the app.
15. As a developer, I want zero browser analytics requests, so that shared screen code cannot contaminate product analytics.
16. As an app developer, I want launch and screen events, so that I can understand usage and navigation.
17. As an app developer, I want habit-toggle and sign-out events, so that I can inspect meaningful app actions.
18. As an app developer, I want a persistent anonymous install identity, so that relaunches do not create new identities.
19. As an app user, I want analytics failures isolated, so that network problems do not prevent app actions.
20. As a developer, I want explicit missing configuration, so that silence does not imply successful analytics.
21. As a developer, I want a direct Mixpanel project link, so that I can inspect events in the correct service.

### Fonts and screenshot checks

22. As a developer, I want bundled fonts across text components, so that host font choices do not determine the intended typeface.
23. As an app user, I want correct weekday labels, so that my timezone does not change the meaning of a demo date.
24. As a developer, I want one capture per app surface, so that studio controls do not affect product screenshot baselines.
25. As a developer, I want both schemes and populated screens, so that screenshot checks cover the normal app appearance.
26. As a developer, I want empty Habit detail covered, so that its fallback appearance remains intentional.
27. As a developer, I want Capture mode independent of shared links, so that token overrides cannot change the test fixture.
28. As a developer, I want readiness checks instead of sleeps, so that screenshots do not capture unfinished content.
29. As a reviewer, I want Linux-only baseline updates, so that updates use the same rendering environment as CI.
30. As a reviewer, I want exact comparison and diagnostic images, so that visible regressions fail with inspectable evidence.
31. As a developer, I want new screens to require baselines, so that the screenshot matrix cannot silently omit routes.
32. As a developer, I want skipped comparisons labelled, so that a Mac run cannot appear to pass.
33. As a stakeholder, I want baseline provenance in the Regression tab, so that I know which source produced the recorded screenshots.
34. As a reviewer, I want a planted token change to fail, so that the suite proves it can detect differences.

### Present mode and sharing

35. As a presenter, I want the current screen enlarged, so that entering Present mode does not reset my demonstration.
36. As a stakeholder, I want editor controls hidden, so that I can focus on one app screen.
37. As a presenter, I want live app interactions and keyboard stepping, so that I can demonstrate real journeys and screen order.
38. As a presenter, I want scheme changes without token editing, so that I can compare appearance without changing the design.
39. As a developer, I want presentation actions in the state log, so that I can inspect the demonstration afterwards.
40. As a stakeholder, I want a self-contained shared link, so that the deployed studio needs no token server.
41. As a stakeholder, I want valid shared values applied with visible warnings, so that partial compatibility never silently changes the review.
42. As a developer, I want shared links to exclude app data, so that a link does not claim to preserve a running session.

### Guard and delivery

43. As a reviewer, I want exact-path guard permissions with reasons, so that required edits remain explicit and temporary.
44. As a reviewer, I want old permissions excluded from later branches, so that one approval does not permanently unlock a screen.
45. As a developer, I want one documented cold-clone workflow, so that I can repeat the browser and Simulator checks.

## Implementation Decisions

### 1. Authority and delivery order

Later owner decisions and ADRs override earlier research suggestions. Native-only analytics supersedes browser ingestion and the proposed studio send log. Root route observation supersedes navigation-call tracking. Exact screenshot comparison supersedes the earlier colour threshold proposal.

Implement guard permission before changes to guarded files. Bundle fonts and correct weekday labels before accepting screenshot baselines. Integrate the accepted board before attaching Present mode. Add shareable URL state after Present mode behavior stabilizes. Complete documentation after real verification.

Do not rebuild the accepted board design. Reuse its route model, camera model, screen registry, and history behavior. A working prototype does not satisfy static-export acceptance.

### 2. State and board integration

Preserve the existing spine and its subscription lifecycle. Native analytics must not consume the studio spine.

Make the accepted Contour board with the Guide camera available through the normal studio entry. Include it in the static export. Preserve the existing token editor, baseline comparison, state log, route evidence, and fidelity information.

- Attach route connections to side midpoints.
- Use straight direct connections only for real routes adjacent in declared screen order.
- Route detours through separate parallel lanes above the row with rounded elbows.
- Use dashed declared connections and solid observed connections.
- Keep inactive detours gray and the active connection accented until the next navigation action.
- Separate opposite directions and their action labels.
- Resolve Back from each destination's latest incoming board-local history.
- Keep preview actions separate from observed app journeys.
- Report empty history without inventing a destination.

Allow frame movement through header and footer drag handles. Preserve hover and focus grips, keyboard movement, axis locking, cancellation, and z-order behavior. Keep route connections attached during movement. Preserve collision nudging so another frame cannot hide a drag handle.

Persist frame positions locally. Frame positions never change declared screen order. Derive Fit and camera targets from current positions. Keep the declared board as the lower bound for Fit. Fit changes only the camera. Reset layout restores frame positions and the camera. Reset session retains its separate purpose.

### 3. Fonts and dates

Bundle Spline Sans weights 400, 600, and 700 with the required license. Use weighted web font-face declarations and the native font configuration plugin. Do not rely on installed system fonts or a CSS family variable alone.

Apply the family through shared Text and raw native-text paths, including tabs, Back, buttons, and chips. Add a family token with an allow-list. Reduce the display weight from 800 to 700. Preserve the existing smoothing settings.

Check native font loading in a rebuilt native app. A Metro launch alone does not apply a font plugin change. Web screenshots do not prove identical native rasterization.

Use UTC for the Habit detail weekday label. Preserve the constant demo date helpers. Set the screenshot process and browser timezone to UTC.

### 4. Native analytics boundary

Use raw HTTP tracking without a Mixpanel SDK. Keep payload construction, configuration validation, suppression, and response handling independent of React and native modules. Supply platform, storage, UUID generation, time, and transport through adapters.

The central sender refuses every web request before identity initialization or transport. Also suppress events for studio-only routes. Web development, static deployment, Present mode, and Capture mode all remain silent with or without configuration.

Read EXPO_PUBLIC_MIXPANEL_TOKEN and EXPO_PUBLIC_MIXPANEL_REGION for the native build. Missing tokens mean not configured. Unknown regions must not silently use a default host. Keep the token out of committed files, diagnostics, screenshots, and the Analytics tab. GitHub Pages needs no Mixpanel secret.

Use one UUID per install through AsyncStorage. Add that dependency explicitly with Expo-compatible installation and lockfile updates. Do not assume it is already available. Identity initialization must serialize concurrent first events and preserve the same identity after relaunch.

Use the install UUID as the device identifier and the device-preconstant distinct identifier. Give each event a fresh insert UUID and a capture-time timestamp. Use actual event time, not the constant demo date. Do not send names, email addresses, habit text, raw state, or token edits.

| Event | Trigger | Additional properties |
|---|---|---|
| App Opened | Once per native launch | platform |
| Screen Viewed | Initial visible app route and subsequent route changes | screen |
| Habit Toggled | Successful change of today's completion state | habit_id, done |
| Signed Out | Transition from signed in to signed out | none |

Observe the visible route from one root analytics hook. Include tab changes, pushes, Back, replacements, and native links. Use normalized pathnames as screen values. Repeated renders of the same visible route must not duplicate its event. Remounts must not duplicate App Opened within one launch.

Keep habit and sign-out calls at the app action boundary. Invalid habit identifiers and repeated sign-out calls must not produce state-change events. Analytics must not block an action or create unhandled promise rejections.

Handle network failure, rejection, malformed responses, and missing configuration explicitly. An HTTP acceptance response is not proof of ingestion. Do not describe the raw sender as an SDK-equivalent offline analytics system. No durable offline queue is part of this scope.

The studio Analytics tab contains explanatory text and the existing project link. It is not a send log or an embedded analytics dashboard. It must always state that the studio sends nothing. With no token, also display Mixpanel: not configured. Local web configuration proves neither native configuration nor event arrival.

### 5. Capture mode and readiness

Capture mode is separate from Present mode. Use static-export query parameters for capture, screen, scheme, and state. Do not depend on a development-only gate.

Render one app surface at scale 1 using real screen components. Its CSS size is 390 by 820. Exclude frame headers, footers, route connections, and studio controls. Apply the fixture before mounting visible screen content.

Ignore the shareable hash and all token overrides. Use committed tokens only. Populated Habit detail selects Morning run. Empty Habit detail has no selected habit. Other screens use the signed-in seed.

Reject unknown screens, schemes, and states. Empty state applies only to Habit detail. Invalid requests never become ready and display a diagnostic error.

Expose data-screenshot-ready=true only after all readiness requirements hold:

- The requested fixture and scheme are active.
- The app surface has the required CSS size.
- Committed tokens apply without overrides.
- Font loading completes and the required Spline Sans face is available.
- Images complete successfully before capture.
- Reduced motion applies and animated content reaches its final state.

Check reduced-motion behavior in Chromium, including the Reanimated Meter. Disabling screenshot animations alone is insufficient. Use readiness and stable captures rather than a constant sleep. Missing fonts or failed images must not become a successful capture.

### 6. Screenshot matrix and baselines

Derive the matrix from the runtime screen registry and both schemes. Add the empty Habit detail case in both schemes. The current matrix contains 16 screenshot cases. A new registered screen requires baselines. Do not add other viewport widths or state combinations automatically.

Use Chromium with a 480 by 900 CSS viewport and DPR 2. Capture the app surface element at device scale. Each PNG is 780 by 1640 pixels.

Use Playwright's built-in differ with threshold 0 and maximum differing-pixel ratio 0. Establish repeatability before accepting any baseline. If unchanged captures differ, stop and report the cause. Do not widen the threshold without a new decision.

Pin the Playwright package and matching official Linux image. Pin the container architecture as part of the environment, including local runs on Apple Silicon. Linux alone does not establish a matching image.

Provide separate vr and vr:update commands. The update command requires the pinned image. An off-image comparison reports comparison skipped, never pass. With VR_REQUIRE_COMPARE=1, a skip fails.

A developer reviews and submits baseline changes. CI does not update or commit PNGs. Missing baselines, missing records, incomplete matrices, capture errors, skips, and pixel differences fail CI.

The update command writes the PNGs and screenshot record only after successful generation. Record the tested source commit, environment, image, dimensions, DPR, and case identifiers. Require committed capture inputs before recording a source commit. Generated PNGs and record changes may remain uncommitted for review. Do not invent the future artifact-commit identifier or commit automatically.

The recorded source commit identifies the captured app code, not the later commit containing the artifacts. Current HEAD may be newer without invalidating the record. Human review approves the baseline change. Generation alone does not prove review or a current CI pass.

Represent an absent record explicitly so the studio still builds. CI requires a populated valid record once the full suite is active. The Regression tab imports the bundled record and displays textual provenance. It performs no runtime report fetch, embeds no PNGs, and links to no expiring artifacts. Keep RenderVerdict separate.

Run an independent visual-regression job on pull requests and default-branch pushes. Export and serve the static build in the pinned environment. Upload the Playwright report on every completed run. Upload actual, expected, and diff images for comparison failures. Document infrastructure failures when image generation cannot finish.

Measure the actual committed PNG size after generation. The research estimate is not a measured budget.

### 7. Present mode

Enter through Present, P, or shareable URL state. Present the camera's current screen without resetting to the first screen. Exit through Escape or the present bar.

Hide the side panel, badges, zoom controls, baseline controls, and other frames. The present bar contains the screen label, declared position, scheme toggle, and Exit.

Fit the app surface to viewport height divided by 820, clamped from 0.5 to 1.5. Center the result. Preserve real app interactions and camera-follow navigation. Left and Right step through declared screen order. L changes scheme. Ignore global shortcuts while the user edits text or activates another focused control.

Read-only means no token editing, not frozen app state. Keep the spine recording and preserve app changes after exit. Keep the last scheme after exit. Present mode never sends analytics from the browser.

### 8. Shareable URL state

Use a versioned payload in the hash field s. Include the present flag, screen key, scheme, and token overrides. Encode differences from committed tokens, not a full token tree. Compress with deflate and encode as base64url.

Use the receiving build's committed tokens. A link does not preserve an earlier build, app data, frame positions, camera scale, scroll, active tab, or baseline-comparison state.

Apply valid fields from a supported payload. Report rejected override counts visibly. An unknown screen selects the first declared screen with a warning. Reject unreadable data and unsupported versions without crashing the route. Limit decoding work and reject oversized or invalid payloads safely.

Keep the URL current through debounced replacement without adding history entries. Copy link must include the latest edits, not stale debounced state. Display copy success or failure without adding a dependency solely for a toast. Use native browser compression APIs already selected by the decision. Unsupported browsers receive an explicit warning.

### 9. Guard permission and documentation

Retain guarded app routes and shared components. Preserve the permanent exceptions for the studio route and shared-components seam. Extend the seam's stated reason to include the font family.

Allow only exact paths with a nonempty reason in Guard-Allow commit trailers. Permissions apply only within the checked head-side commit range. Do not reuse permissions from merged history or base-only commits. A reasonless permission, invalid range, or unpermitted change exits 1. Successful checks exit 0 and list permitted paths with reasons.

Preserve rename, deletion, nested-route, default-base, and invalid-range behavior. Keep single-reference worktree checks meaningful without treating all historical trailers as permission. Preserve required trailers through merge or squash workflows. Exercise the actual ranges used by both CI workflows.

Two currently guarded files need edits: the root analytics hook and the Habit detail weekday label. Other analytics and capture logic belongs outside guarded route files. Do not broaden permanent exceptions to avoid the permission tests.

Update README claims and obsolete exclusion tests to match implemented behavior. Preserve the standard Node test command and the stdlib-only token server. Include real screenshots or GIFs after verification. Do not present proposed commands or old prototype evidence as a completed run.

## Testing Decisions

### Agreed boundaries

The owner approved three boundaries: existing fast tests, browser checks, and iOS Simulator verification. Prefer observable results at those boundaries. Do not test private functions merely because they exist.

### Existing Node runner

Keep npm test as the existing Node type-stripping runner. Add pure behavioral tests for board history, URL validation, capture parameters, matrix construction, screenshot records, and analytics policy. Reuse existing route-key, board, token-source, date, and spine tests.

Use supplied transport, storage, platform, clock, and UUID adapters for analytics tests. Do not import native modules into Node tests. Exercise identity races, platform refusal, missing configuration, regional routing, payloads, launch deduplication, and failure isolation.

Reuse throwaway Git repositories for guard tests. Check exact-path permission, missing reasons, a second unpermitted path, merged permissions, base-only history, and printed reasons. Position branches correctly before every assertion. A comparison of the default branch with itself is not lifecycle evidence.

### Browser and static export

Use Playwright for actual browser interaction and screenshot checks. Keep it separate from npm test. Exercise normal exported studio entry rather than only the development prototype.

Check route evidence, live versus preview history, empty Back history, drag and keyboard movement, persistence, camera Fit, and Reset layout. Check Present mode controls, hidden editor controls, live app actions, and preserved spine history.

Check shared-link round trips in a fresh browser context. Cover valid overrides, unknown tokens, invalid values, missing screens, malformed compression, and unsupported versions. Check Copy link immediately after an edit.

Check Capture readiness, invalid requests, fixture isolation, dimensions, font use, image failures, and final animation state. Exercise the full 16-case matrix. Adding a registered screen without baselines must fail.

With a configured test token, intercept all regional Mixpanel ingestion hosts. Perform native-equivalent habit, sign-out, and navigation actions in the browser. Assert zero outgoing analytics requests in normal studio, Present mode, and Capture mode. Check the absent-token note separately.

### iOS Simulator

Use a native build compatible with Expo SDK 57. Check the font plugin through an appropriate rebuild. Do not claim a web test proves native rendering or native storage.

Check one App Opened per launch and one Screen Viewed per actual visible route change. Include initial route, tabs, push, Back, and replacement. Check habit-toggle payloads and sign-out transition behavior. Relaunch the app to check identity persistence.

Send a known Habit Toggled event from the Simulator. Check actual arrival in the existing Mixpanel project and retain redacted evidence. Do not substitute a request sent by Node, a browser, or the token server. Report blocked account access or missing tooling without claiming success.

### Planted failures and acceptance

1. Give a journey empty history. Back must report no destination.
2. Run browser actions with configuration present. Analytics requests must remain zero.
3. Remove the token. App actions must still work with explicit missing configuration.
4. Request an invalid capture. The ready marker must remain absent.
5. Remove a required PNG or record case. CI must fail.
6. Capture unchanged source twice in the pinned environment. Every PNG must match.
7. Reduce the light accent from #D9481E to #D8481E.
8. Reduce the dark accent from #FF7A4C to #FE7A4C.
9. Run vr without updating baselines. The command must fail and produce visible diff evidence.
10. Restore both accents. The unchanged comparison must pass again.
11. Edit a guarded file without permission. The guard must fail.
12. Load an invalid shared link. The studio must display a warning rather than crash.

Run npm test, mobile lint, and mobile typechecking after implementation. Run the web export, browser checks, guard range checks, and Simulator checks for the affected features. This spec creation does not execute the future checks or claim that they pass.

## Out of Scope

- Browser analytics, studio send logs, and token-server analytics relays.
- Mixpanel dashboards, query APIs, service-account credentials, or report embedding inside the studio.
- Production accounts, identity merging, user profiles, or a durable offline analytics queue.
- An App Store release or a claim about real users before release.
- Native screenshot regression or identical web and native pixels.
- Additional screenshot widths, DPR variants, board PNGs, or automatic empty-state coverage for every screen.
- Automatic baseline commits or silent tolerance increases.
- Server-held shared snapshots, historical build preservation, or shared app-state restoration.
- New state-log features, multi-user comments, or the excluded board branch merge.
- Removing the guard or permanently unlocking additional app files.

## Further Notes

### Source decisions

- [Decision map](map.md).
- [01: ingestion research](issues/01-mixpanel-ingestion-api.md).
- [02: screenshot research](issues/02-playwright-on-expo-web.md).
- [03: font research](issues/03-bundling-the-font.md).
- [04: existing project setup](issues/04-create-mixpanel-project.md).
- [05: accepted board](issues/05-edges-on-the-board.md).
- [06: presentation and sharing](issues/06-present-mode-and-url.md).
- [07: native analytics](issues/07-mixpanel-event-design.md).
- [08: screenshot contract](issues/08-visual-regression-contract.md).
- [09: guard contract](issues/09-the-new-guard.md).
- [11: board implementation record](issues/11-board-edges-implementation.md).
- [ADR 0001: URL state](../../docs/adr/0001-shareable-url-in-hash-fragment.md).
- [ADR 0002: Linux baselines](../../docs/adr/0002-linux-only-screenshot-baselines.md).
- [ADR 0003: native-only events](../../docs/adr/0003-native-app-only-mixpanel-events.md).
- [ADR 0004: guard permission](../../docs/adr/0004-guard-permission-per-commit.md).

### Reconciliation and handoff

The older collapse ticket proposes analytics through the spine. That instruction is obsolete. Native app actions and root route observation are authoritative. Browser research does not authorize browser telemetry.

Board implementation record 11 supplies reusable code and historical checks. Normal static-export integration remains required. Font and screenshot research did not run the final suite.

This spec is ready for ticket creation. No implementation tickets or code changes are part of this command. Continue numbering after the existing tickets when producing the implementation backlog. Keep the collapse ticket open until both the spec and backlog exist.

Before native implementation, read the exact Expo SDK 57 documentation required by the repository. Check compatibility of new dependencies rather than copying unverified version claims from older research.
