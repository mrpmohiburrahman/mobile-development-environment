# 19 — Analytics tab

Type: task
Status: resolved
Labels: ready-for-agent
Blocked by: 15 — Analytics sender
Map: ../map.md
Spec: ../spec.md

## What to build

The studio gains an Analytics tab that explains the boundary. It states that analytics come from the app on a device or simulator and that the studio sends nothing. It links to the Mixpanel project. Without a token it says Mixpanel: not configured. It never shows the token and never shows a send log.

## Acceptance criteria

- [x] The tab states that the studio sends nothing and links to the existing Mixpanel project.
- [x] With no token the tab also reads Mixpanel: not configured. The token never appears.
- [x] The tab is not a send log and not an embedded dashboard.
- [x] A browser test intercepts every regional ingestion host. It uses a configured test token. It asserts zero requests after habit, sign-out, and navigation actions.
- [x] A separate check covers the absent-token note. App actions still work.
- [x] `npm test`, lint, and typechecking pass.

## Answer

The studio Analytics tab is a note. It is not a sender and not a dashboard.

`mobile/src/ide/analyticsNote.ts` holds the copy. The boundary sentence is always present: analytics come from the app on a device or simulator, and this studio sends nothing. The project link is `https://mixpanel.com/project/4074212`. An absent token adds `Mixpanel: not configured`. A present token adds a caveat that a token in the web build proves neither native configuration nor delivery. The note has no field that can carry a token.

`mobile/src/ide/AnalyticsPanel.tsx` renders that note. On web the project link is a real anchor. The panel reads `process.env.EXPO_PUBLIC_MIXPANEL_TOKEN` only to decide the boolean. It does not import `analytics/mixpanel` or `analytics/track`. The store remains the only importer of the sender.

`mobile/src/app/ide.tsx` adds the `analytics` tab. The chips wrap, so the fifth tab stays visible.

`browser/analytics-tab.mjs` exports two static builds. One has no token. One has the test token `test-token-not-for-display-19`. Each export uses its own Metro cache, because Metro does not key that cache by `EXPO_PUBLIC_*` values. The script fails if `ide.html` is missing. Playwright opens `/ide`, intercepts `api.mixpanel.com`, `api-eu.mixpanel.com`, and `api-in.mixpanel.com`, toggles a completed habit, opens Morning run, opens Habits, and signs out. Both builds send zero Mixpanel requests. The absent build shows the not-configured line. The configured build does not. The token never appears. Run it with `npm run test:analytics`. It is not part of `npm test`.

`npm test` (420), `npx tsc --noEmit`, and `npx expo lint` pass.
