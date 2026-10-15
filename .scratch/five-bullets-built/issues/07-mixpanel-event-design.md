# 07 — What the app tells Mixpanel

Type: grilling
Status: open
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
