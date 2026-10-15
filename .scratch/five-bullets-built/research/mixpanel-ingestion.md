# Mixpanel ingestion API, measured

Answers ticket `01-mixpanel-ingestion-api.md`. Sources are Mixpanel's current docs
(fetched 2026-10-15) plus live probes against `api.mixpanel.com` with a placeholder
token. Probe results are marked **[measured]**; doc claims carry a URL.

## 1. Endpoints

| Region | Ingestion host | `/track` | `/import` | Source |
|---|---|---|---|---|
| US (default) | `api.mixpanel.com` | `https://api.mixpanel.com/track` | `https://api.mixpanel.com/import` | https://docs.mixpanel.com/docs/tracking-best-practices/debugging |
| EU | `api-eu.mixpanel.com` | `https://api-eu.mixpanel.com/track` | `https://api-eu.mixpanel.com/import` | https://docs.mixpanel.com/docs/privacy/eu-residency |
| India | `api-in.mixpanel.com` | `https://api-in.mixpanel.com/track` | `https://api-in.mixpanel.com/import` | https://docs.mixpanel.com/docs/privacy/in-residency |

**The token does not imply region.** Residency is a project-creation choice; the
caller must pick the matching host. "Events sent to the wrong host will not be
ingested in your Mixpanel project" (debugging doc). The EU doc adds that US→EU
forwarding for older EU projects ended in July 2026, so there is no fallback.
**[measured]** `/track?verbose=1` on all three hosts returned `{"status":1}` for
a placeholder token — a success reply from the wrong region looks identical to
the right one. Region must be configured alongside the token.

## 2. `/track` vs `/import`

| | `/track` | `/import` |
|---|---|---|
| Intended for | untrusted clients (browser) | servers / pipelines |
| Auth | project `token` inside each event's `properties` | HTTP Basic: service account (`user:secret` + `?project_id=`) **or** project token as username with empty password |
| Content-Type | `application/json`, or `application/x-www-form-urlencoded` with `data=<JSON or base64 JSON>` | `application/json` or `application/x-ndjson` |
| Batch limit | 2000 events / request | 2000 events, 10 MB uncompressed / request |
| Historical | last 5 days only | any time ≥ 1971-01-01 |
| Gzip | `Content-Encoding: gzip` allowed | allowed |
| Validation reply | `?verbose=1` → `{"status":0|1,"error":...}` | `?strict=1` → `{code, status, num_records_imported, failed_records[]}` |
| Browser CORS | yes (see §5) | **no** — preflight gets 404, no ACAO **[measured]** |

Sources: https://docs.mixpanel.com/reference/track-event ,
https://docs.mixpanel.com/reference/import-events ,
https://docs.mixpanel.com/reference/project-token

Per-event size limits (both endpoints): < 1 MB uncompressed JSON, < 255
properties, nested objects < 255 keys and depth ≤ 3, arrays < 255 elements
(track-event doc).

## 3. Request body

Body is a JSON **array** of event objects (minimum length 1). **[measured]** a bare
object (not wrapped in an array) is rejected on `/track` with
`"data, missing or empty"`, so always send an array.

Three encodings that `/track` accepted **[measured]**:

1. `Content-Type: application/json`, body = the array.
2. `Content-Type: application/x-www-form-urlencoded`, body = `data=<urlencoded JSON array>`.
3. Same as 2 but the JSON is base64-encoded first (`data=<base64>`). This is what
   `mixpanel-js` does by default (`api_payload_format: 'base64'`,
   `Content-Type: application/x-www-form-urlencoded`,
   https://github.com/mixpanel/mixpanel-js/blob/master/src/mixpanel-core.js).
4. `Content-Type: text/plain` with body `data=<...>` also works; `text/plain`
   with a **raw** JSON array body is rejected (`"data, missing or empty"`).

Complete example event (the four fields the ticket names, plus the
Simplified-ID-Merge fields from §7):

```json
[
  {
    "event": "studio_session_started",
    "properties": {
      "token": "YOUR_PROJECT_TOKEN",
      "distinct_id": "$device:4f1c6a2e-9b1d-4e7a-8c3a-2f0b6d9e1a55",
      "$device_id": "4f1c6a2e-9b1d-4e7a-8c3a-2f0b6d9e1a55",
      "time": 1760535000,
      "$insert_id": "7b9e0c2a-3d4f-4a6b-9c8d-1e2f3a4b5c6d",
      "$lib": "studio-raw-http",
      "surface": "web",
      "build": "github-pages"
    }
  }
]
```

Field rules (import-events doc; `/track` shares them except where noted):

- `event` — required string.
- `properties.token` — required on `/track`. Not validated at HTTP time: "`1` …
  does not signify a valid project token" (track-event doc) and **[measured]** a
  placeholder token returns `{"status":1}`.
- `properties.time` — seconds **or** milliseconds since epoch. If omitted, server
  arrival time is used (event-deduplication doc). `/track` rejects events older
  than 5 days: **[measured]** `"time, 6.0 days in the past (max 5.0)"`. Future
  times "more than 1 hour in the future" are rejected per the import doc, but
  **[measured]** `/track` accepted `now+2h` with `status:1` (the doc also says
  future times are overwritten with ingestion time — behaviour is ambiguous at
  the HTTP layer; do not rely on `/track` to flag clock skew).
- `properties.distinct_id` — see §7.
- `properties.$insert_id` — see §8.

## 4. `verbose=1` response shapes — `/track`

HTTP status is **200 in every validation case** **[measured]**; only the body
distinguishes success from rejection.

Success:

```json
{"error":null,"status":1}
```

Rejections observed **[measured]**:

| Cause | Body |
|---|---|
| Malformed JSON / not an array / `text/plain` raw JSON | `{"error":"data, missing or empty","status":0}` |
| No `event` | `{"error":"event, missing","status":0}` |
| No `token` | `{"error":"token, missing or empty","status":0}` |
| `time` > 5 days old | `{"error":"time, 6.0 days in the past (max 5.0)","status":0}` |
| 2001 events | `{"error":"data, max batch size of 2000 exceeded","status":0}` |

Without `verbose=1` the body is the bare integer `1` or `0` (track-event doc,
**[measured]**).

Things `/track` did **not** reject at HTTP time **[measured]**: wrong token;
`distinct_id` = `"anonymous"` (a documented disallowed value); empty-string
`distinct_id`; missing `distinct_id` / `$insert_id` / `time`; a 40-char
`$insert_id` (doc limit is 36 bytes). These are presumably dropped or coerced
downstream. So `status:1` means "well-formed and accepted for processing", not
"will appear in the project". An honest studio label is **"accepted"** /
**"rejected: <error>"**, and the verification step (§9) is the only proof of
ingestion.

`/import?strict=1` responses (import-events doc) carry real HTTP codes:
`200 {"code":200,"num_records_imported":N,"status":"OK"}`;
`400` with `failed_records[{index,$insert_id,field,message}]` (valid rows in the
same batch are still ingested); `401 {"code":401,"error":"Invalid credentials",…}`;
`413 request exceeds max limit of 2097152 bytes`; `429` (see §6).
**[measured]** a placeholder token on `/import` → HTTP 401
`"Unauthorized, invalid project secret…"` — unlike `/track`, `/import` *does*
verify the credential, which makes it the better choice for the token server's
own "is this token real?" check.

## 5. CORS and preflight (browser)

Docs: Mixpanel's default endpoints "are pre-configured to handle CORS correctly"
(https://docs.mixpanel.com/docs/tracking-best-practices/debugging). No header
list is published; the following is **[measured]**.

- `/track` echoes an arbitrary `Origin` back in
  `Access-Control-Allow-Origin` with `Access-Control-Allow-Credentials: true`,
  `Access-Control-Allow-Methods: GET, POST, OPTIONS`,
  `Access-Control-Max-Age: 1728000`, `Access-Control-Expose-Headers: X-MP-CE-Backoff`.
  Tested origins: `https://example.github.io`, `https://mrp.github.io`,
  `https://probe-origin.example`. A GitHub Pages origin is fine.
- Headless Chromium (Playwright `chromium_headless_shell-1223`) from a synthetic
  cross-site origin: `fetch` POST with `Content-Type: application/json` **succeeded**
  (`{"status":1}`); CDP showed the preflight answered `204` with
  `Access-Control-Allow-Headers: content-type`. Form-urlencoded, `text/plain`,
  no-content-type-string-body, and the EU host all succeeded too.
- Ambiguity: a hand-rolled `curl -X OPTIONS` preflight returned `200` **without**
  `Access-Control-Allow-Headers`, on all three regions and with Chrome-like
  headers. The real browser preflight got a different (correct) response. Treat
  JSON-from-browser as "works in Chromium, server behaviour not fully
  characterised".
- **Preflight-free path:** `Content-Type: application/x-www-form-urlencoded`
  with `data=<JSON>` is a CORS-safelisted simple request — no OPTIONS at all,
  one round-trip, and byte-identical to what the official JS SDK sends. This is
  the safest choice for the studio.
- `/import` from the browser is blocked: Chromium logged
  `No 'Access-Control-Allow-Origin' header is present` and `curl OPTIONS /import`
  returns 404. `/import` is server-only.

### `navigator.sendBeacon`

Works **[measured]**: `sendBeacon(url, "data=" + encodeURIComponent(JSON))`
(sent as `text/plain;charset=UTF-8`) and `sendBeacon(url, new Blob([...],
{type:"application/x-www-form-urlencoded"}))` both returned `true` and the
server replied 200. This matches `mixpanel-js`, whose `api_transport:
'sendBeacon'` option does exactly `sendBeacon(url, 'data=' + ...)`. Caveats from
the SDK source: no response is readable, so no `verbose` feedback, no retry, no
batching — "best-effort … page unload" only. Do **not** send a raw JSON array via
`sendBeacon` (rejected as `data, missing or empty`).

## 6. Rate limits and 429

Documented for both endpoints (track-event + import-events docs): **2 GB of
uncompressed JSON per minute or ~30k events/second**, rolling 1-minute window.
On 429: exponential backoff with jitter, start 2 s, double to 60 s, 1–5 s
jitter; same strategy for 502/503; never retry 400s (they count against the
limit). Documented 429 body:

```json
{"code":429,"error":"Project exceeded rate limits. Please retry the request with exponential backoff.","status":"Too Many Requests"}
```

The `/track` 429 body shape is not separately documented; assume the same.
**[measured]** `/track` exposes a non-documented `X-MP-CE-Backoff` response
header via `Access-Control-Expose-Headers`; its semantics are not published —
read it if present, do not depend on it. Studio traffic is orders of magnitude
below the limit; the only realistic 429 source is a shared/abused token.

## 7. `distinct_id` rules for anonymous users

Sources: https://docs.mixpanel.com/reference/import-events ,
https://docs.mixpanel.com/docs/tracking-methods/id-management/identifying-users-simplified

- `distinct_id` is required on every event for behavioural analysis.
- **Missing** `distinct_id`: Mixpanel hashes the request IP into a distinct_id
  (import doc; on `/track` this is tied to `?ip=1`: "compute a distinct_id using
  a hash function if no distinct_id is provided"). All visitors behind one NAT
  collapse into one user — unacceptable for the studio.
- **Empty string** `""`: accepted, but the event is "excluded from all
  behavioral analysis".
- **Disallowed placeholder values** (import doc): `00000000-0000-0000-0000-000000000000`,
  `anon`, `anonymous`, `nil`, `none`, `null`, `n/a`, `na`, `undefined`,
  `unknown`, `<nil>`, `0`, `-1`, `true`, `false`, `[]`, `{}`. **[measured]**
  `/track` still answers `status:1` for `"anonymous"` — rejection is silent.
- **Recommended pattern (Simplified ID Merge):** generate a UUID once per
  browser, persist it (localStorage/cookie), send it as `$device_id`. If no
  `$user_id` is present, Mixpanel sets `distinct_id` to `$device:<uuid>`; you
  may omit `distinct_id` or set it to the same `$device:<uuid>`. When a user
  logs in, add `$user_id` and keep `$device_id`; the first event carrying both
  merges the identities retroactively. Call the local equivalent of `reset()`
  (new UUID) on logout. This page applies to projects on the Simplified ID Merge
  API — check Project Settings; Original ID Merge projects use `$identify`/alias
  instead.

## 8. `$insert_id` and deduplication

Source: https://docs.mixpanel.com/reference/event-deduplication

- Required; ≤ 36 bytes; alphanumeric or `-` only; not in the disallowed list.
  A fresh UUIDv4 per event is the recommendation.
- Dedup key is the 4-tuple (`event`, `distinct_id`, `time`, `$insert_id`). Other
  properties are ignored. If sent without `$insert_id`, one is generated but the
  event "will not qualify for the deduplication process".
- **Two windows:** (a) query-time dedup is immediate and open-ended — identical
  4-tuples show once in reports (but raw exports still contain every copy);
  (b) compaction-time dedup runs "typically after a few hours and again after
  about 20 days", matches on (`event`, `distinct_id`, `$insert_id`) with `time`
  only required to be the same **calendar day**, and is explicitly not
  guaranteed. There is no documented "N-hour" dedup window beyond this.
- Practical consequence: retrying a failed `/track` with the same payload is
  safe; mutating `time` on retry defeats query-time dedup.

## 9. Latency to Events page ("Live View")

- Live View was renamed **Events** (Data → Events). It is the official place to
  "confirm that events are arriving" and supports search by `distinct_id` and a
  JSON mode showing the exact received payload
  (https://docs.mixpanel.com/docs/tracking-best-practices/debugging).
- Mixpanel publishes **no numeric latency SLA** for `/track` → Events. The only
  numbers in the docs: mobile SDK events "may take 1-2 minutes" purely because
  the SDK buffers for 60 s (quickstart FAQ,
  https://docs.mixpanel.com/docs/quickstart/capture-events/track-events), and
  the user Activity Feed is "updated in real-time (less than 1 minute delay)"
  (identifying-users-simplified FAQ). The `/track` path has no client buffer,
  so expect sub-minute in practice; treat anything under ~2 minutes as normal
  and only escalate past that. Could not be measured here without a real token.
- `$device_id → $user_id` merges can take **up to 24 h** to propagate to
  reports; the Activity Feed reflects them within a minute.

## 10. Project token in a browser bundle

"A project's token is not a secret value. In front-end implementation, such as
our javascript library, this token will be available to anyone visiting your
page… a project's token is not a form of authorization. It is an identification"
(https://docs.mixpanel.com/reference/project-token). Every official web/mobile
SDK ships the token to the client. The project **secret** and service-account
credentials are the things that must stay server-side. Shipping the token in
the GitHub Pages bundle is standard practice; the residual risk is spam into the
project, which only a proxy (nginx reference config in the JS SDK doc) or
server-side relay mitigates.

## 11. Working `curl` (placeholder token)

```bash
curl -sS -X POST 'https://api.mixpanel.com/track?verbose=1&ip=0' \
  -H 'Content-Type: application/json' \
  --data "[{\"event\":\"studio_probe\",\"properties\":{\"token\":\"YOUR_PROJECT_TOKEN\",\"\$device_id\":\"4f1c6a2e-9b1d-4e7a-8c3a-2f0b6d9e1a55\",\"distinct_id\":\"\$device:4f1c6a2e-9b1d-4e7a-8c3a-2f0b6d9e1a55\",\"time\":$(date +%s),\"\$insert_id\":\"$(uuidgen | tr 'A-Z' 'a-z')\"}}]"
# → {"error":null,"status":1}
```

Preflight-free form that mirrors the JS SDK (same payload, `data=` encoded):

```bash
curl -sS -X POST 'https://api.mixpanel.com/track?verbose=1&ip=0' \
  --data-urlencode "data=[{\"event\":\"studio_probe\",\"properties\":{\"token\":\"YOUR_PROJECT_TOKEN\",\"distinct_id\":\"probe-1\",\"time\":$(date +%s),\"\$insert_id\":\"$(uuidgen | tr 'A-Z' 'a-z')\"}}]"
```

Swap the host for `api-eu.mixpanel.com` / `api-in.mixpanel.com` per project
residency. `ip=0` disables IP-based geolocation and IP-hash fallback ids.

## Recommendation for ticket 07

1. Browser (studio, incl. GitHub Pages): POST `/{region}/track?verbose=1&ip=0` with `Content-Type: application/x-www-form-urlencoded`, body `data=<JSON array>` — no preflight, SDK-identical, CORS confirmed for arbitrary origins.
2. Token server: use `/import?strict=1` with Basic auth (token as username, empty password); it is the only endpoint that actually validates the credential (401) and returns per-event `failed_records`.
3. Ship the project token to the browser; it is public by Mixpanel's own definition. Ship the **region host** with it — the token does not encode region and the wrong host returns a false `status:1`.
4. Studio status labels: `status:1` → "accepted", `status:0` → "rejected: <error>", network error → "unsent". Never label `status:1` as "in Mixpanel".
5. Identity: persist one UUID per browser as `$device_id`, send `distinct_id: "$device:<uuid>"`; fresh UUIDv4 `$insert_id` per event; `time` in seconds; retry the identical payload on failure.
6. Use `sendBeacon(url, "data=...")` only for unload events; it gives no verbose feedback.
7. Verification step: open Data → Events, search the `$device_id`; allow up to ~2 min before calling it missing.
