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

`browser/analytics-tab.mjs` exports two static builds. One has no token. One has the test token `test-token-not-for-display-19`.

Each run creates a temporary directory under `browser/out/`. Each export uses a separate Metro cache. The script clears `EXPO_BASE_URL` and disables dotenv. Concurrent runs do not share output directories. A missing `ide.html` fails the check. The script closes browser contexts and servers in `finally`. It removes the temporary directory after each run.

The browser check covers these steps:

1. Probe `api.mixpanel.com`, `api-eu.mixpanel.com`, and `api-in.mixpanel.com`. Abort each request before it reaches Mixpanel. Check that the interceptors detected all three probes.
2. Clear the probe counts. Open `/ide`. Check the boundary note, project link, token absence, and configuration copy.
3. Toggle Morning run in the studio. Check the changed habit control and detail frame. Check the recorded profile and login routes. Sign out. Check the signed-out screen. Sign in again.
4. Open the ordinary web app. Open Habit detail. Toggle the habit. Use Back. Open Habits and Profile. Sign out to Login. Sign in to Today. Check each actual pathname and screen result. Exclude inactive screens with `aria-hidden` from control locators.
5. Observe requests for one second after each action group. Assert zero app analytics requests. Return to `/ide`. Check the note again. Check for uncaught JavaScript errors.

The absent build shows `Mixpanel: not configured`. The configured build shows the caveat instead. Neither build shows the test token. These checks do not prove native delivery. Present mode and Capture mode remain separate tickets.

Run the browser check with `npm run test:analytics`. It stays separate from `npm test`.

## Verification

- `npm test`: 420 tests passed.
- `npm run lint -- --no-cache` in `mobile/`: passed.
- `npx tsc --noEmit` in `mobile/`: passed.
- `npm run test:analytics`: passed for both token states.
- `EXPO_BASE_URL=/mobile-development-environment npm run test:analytics`: passed concurrently with the ordinary run.
- `npm run guard -- a99debf`: passed. No guarded files changed.
- Standards review: previous findings addressed. The final review found no remaining material issues.
- Spec review: navigation and request-observation gaps addressed. The final review found no remaining issues.
- Local developer preview: `/ide` returned HTTP 200 on `127.0.0.1:57082`. Browser checks opened all five studio tabs.
- The assigned preview proxy returned HTTP 404. The local preview remains available. These results do not establish proxy availability.
