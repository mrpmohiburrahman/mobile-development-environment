# 01 — Mixpanel ingestion API, measured

Type: research
Status: resolved
Blocked by: —
Map: ../map.md

## Question

What does it take to send events from this app to a real Mixpanel project
with **no SDK** — the raw HTTP ingestion API — from both the browser (studio
on web, including the GitHub Pages build) and the token server?

Surface, with sources from Mixpanel's current docs:

- The `/track` and `/import` endpoints: URL, auth (project token vs. service
  account), body encoding (JSON array vs. base64 `data=`), batch limits,
  and the `/track?verbose=1` response shape so the studio can show an honest
  "sent / rejected" rather than fire-and-forget.
- Required event properties: `token`, `distinct_id`, `time`, `$insert_id`.
  How Mixpanel treats a missing or anonymous `distinct_id`.
- CORS: does `api.mixpanel.com` accept browser `fetch` from an arbitrary
  origin? Which content type avoids a preflight? Does `navigator.sendBeacon`
  work?
- EU/India residency endpoints, and whether the token alone implies region.
- Rate limits and what a 429 looks like.
- Whether a project token exposed in a browser bundle is standard practice
  (it is for every web SDK) — state this plainly so ticket 07 can decide how
  the token reaches the studio.
- How quickly events appear in Mixpanel's Live View / Events page after a
  successful `/track`, for the verification step.

Deliver as `research/mixpanel-ingestion.md` on branch
`research/mixpanel-ingestion`, with a minimal working `curl` that posts one
event and shows the verbose response, using a placeholder token.

## Answer

Full findings: [`research/mixpanel-ingestion.md`](../research/mixpanel-ingestion.md).

- Browser → `/track` works cross-origin with no proxy. `application/x-www-form-urlencoded` with `data=<JSON>` is preflight-free and identical to the official JS SDK. `/import` is server-only. `sendBeacon` works but returns nothing.
- `verbose=1` is shallow: `{"status":1}` means well-formed, not ingested. Placeholder tokens and wrong-region hosts still return `status:1`. Only `/import?strict=1` validates the credential (401). The Analytics tab must say "accepted by Mixpanel", never "delivered".
- The token does not encode region: `api.mixpanel.com` / `api-eu.mixpanel.com` / `api-in.mixpanel.com`. Wrong host silently drops. Ship `{token, host}` together.
- Project token in a browser bundle is officially not a secret. Service accounts stay server-side.
- Identity: one UUID per browser as `$device_id` → `distinct_id` `$device:<uuid>`. Never omit it. `$insert_id` = fresh UUIDv4; dedup key `(event, distinct_id, time, $insert_id)`. Events within 5 days of now only. Allow ~2 min before calling an event missing from Live View.
