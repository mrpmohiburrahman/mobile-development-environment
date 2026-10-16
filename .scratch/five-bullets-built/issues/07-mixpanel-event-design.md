# 07 — What the app tells Mixpanel

Type: grilling
Status: resolved
Blocked by: 01, 04
Map: ../map.md

## Question

With the ingestion API measured (01) and a project in hand (04), decide the
integration end to end:

- **Transport**: browser `fetch` straight to `api.mixpanel.com` from the
  studio and the deployed build, vs. relaying through the token server
  (stdlib `fetch` exists in Node 22) when it is running. Probably both, with
  the studio choosing by `client.ts`'s existing reachability check.
- **Token path**: `EXPO_PUBLIC_MIXPANEL_TOKEN` at build time; how the Pages
  workflow gets the secret; what the studio shows when the token is absent
  (honest zero: "Mixpanel: not configured" — never a silent no-op).
- **Event taxonomy**: which spine entries become events, with names and
  properties. Candidates: `Screen Viewed`, `Pressed`, `Navigated`,
  `State Changed`, `Scheme Changed`, `Token Edited`, `Session Started`.
  Decide `distinct_id` for an anonymous local user (per-browser UUID in
  localStorage?) and whether studio events are tagged `studio: true` so a
  real product rollout could filter them.
- **Where instrumentation lives**: the spine is one chokepoint and the
  obvious tap. If anything needs app code (`mobile/src/ui`, `mobile/src/app`)
  — e.g. screen-view events from screens themselves — name the exact files,
  for ticket 09.
- **Analytics tab**: what it shows — the queue, per-event send status from
  `verbose=1`, failures, the token's project id (not the token) — and the
  planted negative control: a button that sends a known event and the test
  that asserts it appears in Mixpanel (manual, with a screenshot) and in the
  tab (automated).
- **Native**: does the mobile build send too, or web only for now? The
  talk's framing is the studio; decide and record.

Resolve with a spec the implementation ticket can execute.

## Constraint added after ticket 04 (owner decision, 2026-10-16)

Only the native app emits Mixpanel events. The studio on web emits none,
even though it renders the same screens. This applies in dev and on the
GitHub Pages build. The app is unpublished, so verification runs it in the
iOS Simulator. See ADR 0003.

This changes the question above:

- **Transport**: browser `fetch` from the studio is out. The token server
  relay is out. Decide the native transport only: raw `/track` from the app
  through `fetch`, or the official SDK.
- **Token path**: `EXPO_PUBLIC_MIXPANEL_TOKEN` reaches the native build
  from `mobile/.env.local`. The Pages workflow needs no secret.
- **Event taxonomy**: studio-only events (`Token Edited`, `Scheme Changed`
  from the panel) are out. Decide the app events only. The `studio: true`
  tag is no longer needed, but a guard that refuses to send on web is.
- **Where instrumentation lives**: app code, not the studio spine. Name the
  exact files for ticket 09.
- **Analytics tab**: decide what the studio can honestly show when it is not
  the sender. Options: nothing, a static "sent from the app, view in
  Mixpanel" note with the project link, or a log the simulator build writes
  to the token server. Honest zero still applies.
- **Native**: resolved. The native build sends. Web never sends.
- **Negative control**: a planted event sent from the Simulator must appear
  on the Mixpanel Events page, and the same action in the studio must send
  nothing (assert no request to `api.mixpanel.com`).

## Answer

Decisions made for the owner, who asked for the best implementation and
stated no knowledge of Mixpanel. Each decision is one sentence with the
reason. ADR 0003 stands.

### Transport

Raw `fetch` to `/track`, not the official SDK. The SDK is a runtime
dependency inside the app, and the map prefers zero runtime deps. Ticket
01 already measured the raw API, so the SDK buys nothing here. The sender
is one new module, `mobile/src/analytics/mixpanel.ts`, with no React and
no store imports, so `node --test` can import it.

### Token and region

The native build reads `EXPO_PUBLIC_MIXPANEL_TOKEN` and
`EXPO_PUBLIC_MIXPANEL_REGION` from `mobile/.env.local`. The region map is
`us` → `api.mixpanel.com`, `eu` → `api-eu.mixpanel.com`,
`in` → `api-in.mixpanel.com`. An absent or empty token means the sender
does nothing and reports "not configured". It never fails the screen.

### The web guard

The sender refuses when `Platform.OS === 'web'`. This is the only rule
that keeps the studio silent, so it lives in the sender, not in each call
site. A screen added later cannot bypass it by accident.

### Identity

One UUID per install, stored with `AsyncStorage` (the React Native store
for small values that survive an app restart). It becomes
`distinct_id: $device:<uuid>` and `$device_id`. `$insert_id` is a fresh
UUIDv4 per event. No user accounts exist, so there is nothing else to
identify.

### Events

Four events. Names are Title Case, matching Mixpanel's own examples.

| Event | When | Properties |
|---|---|---|
| `App Opened` | once per launch | `platform` |
| `Screen Viewed` | the visible route changes | `screen` |
| `Habit Toggled` | a habit's today state flips | `habit_id`, `done` |
| `Signed Out` | the user signs out | none |

Out: every press (too noisy to read), `Scheme Changed` and `Token Edited`
(studio actions, not user actions), `Navigated` (the route change is
already `Screen Viewed`).

### Where it lives

- `mobile/src/analytics/mixpanel.ts` — the sender. New file, unguarded.
- `mobile/src/store/habits.ts` — call the sender inside `toggleToday` and
  `signOut`.
- `mobile/src/app/_layout.tsx` — `App Opened`, once, after the first
  render.
- `Screen Viewed` — resolved in ticket 09: `useAnalytics()` in
  `mobile/src/analytics/useAnalytics.ts`, called once from
  `mobile/src/app/_layout.tsx`. It also sends `App Opened`.

Correction (2026-10-16): `habits.ts` and `designing.tsx` are outside the
guarded tree. `_layout.tsx` is inside it. Ticket 09 decides how that edit
passes the guard.

### Studio Analytics tab

A static note, not a log. The studio is not the sender, so a log of "what
this session sent" would always be empty and would teach the wrong thing.
The tab says: "Analytics come from the app on a device or simulator. This
studio sends nothing." It links to
`https://mixpanel.com/project/4074212`. When the token is absent it says
"Mixpanel: not configured" instead. It never shows the token.

### Negative controls

1. **Simulator sends.** Run the app in the iOS Simulator, toggle one
   habit, and check that `Habit Toggled` appears on the Mixpanel Events
   page within about 2 minutes. Screenshot the page. This is manual,
   because the Events page needs the account login.
2. **Studio sends nothing.** Automated: render a screen in the designing
   context, fire the toggle, and assert zero requests to any
   `api*.mixpanel.com` host.
3. **No token is visible.** Automated: boot with the token unset and
   assert the screen renders and the tab reads "Mixpanel: not
   configured".

### README paragraph

The app sends four events to Mixpanel from the native build only. The
studio renders the same screens and sends nothing. A missing token is
shown as "not configured", never as silence. You view the results on
Mixpanel.com, not in the studio.
