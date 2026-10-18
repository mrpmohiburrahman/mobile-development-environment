# 06 — Present mode and the shareable URL

Type: grilling
Status: resolved
Blocked by: —
Map: ../map.md

## Question

"Blueprint view for easier conversations with stakeholders" becomes code as
two things chosen at charting: a **Present mode** and **shareable URL
state**. Grill until each is specified tightly enough to build:

## Answer

### Present mode

Present mode is a read-only view of the studio for demos to stakeholders.
It shows one screen frame large and hides everything else.

- **Entry and exit.** Three ways in: a "Present" button in the board
  header, the `P` key, and a `present` flag in the URL. `Esc` exits. The
  Exit control also lives in the present bar.
- **What is hidden.** The 300px left panel with the tabs, the badge row,
  the zoom pill, the baseline toggle, and every other screen frame. Only
  the presented frame and the present bar stay on screen.
- **Present bar.** A small strip with three items: the screen label with
  its position (`n / 7`), the scheme toggle (also the `L` key), and the
  Exit control.
- **Which screen is large.** The screen the camera is looking at when the
  user presses `P` or clicks Present. In overview, use the screen frame whose
  center is nearest the viewport center. No jump to screen 01.
- **Sizing.** The frame fits the viewport height: scale = viewport height
  ÷ 820, clamped to [0.5, 1.5], centered. A projector gets a readable
  screen. A large monitor does not get a giant phone.
- **Screen changes.** Two ways: tap a control inside the presented frame
  (the app is live — presses navigate exactly as on the board, and the
  camera follows), or press the Left and Right arrow keys to step through
  the declared screen order.
- **Read-only.** No token edits inside Present mode. To edit live during a
  demo, exit Present mode — the studio already repaints frames as the
  user drags a slider.
- **Scheme.** Present mode keeps the scheme the studio was in. The `L`
  key and the toggle change it live. Exiting keeps the last scheme.
- **Spine.** The change log keeps recording during a presentation. When
  the user exits Present mode, the log shows everything that happened
  during the demo.

### Shareable URL state

Decision: [ADR 0001 — URL format](../../../docs/adr/0001-shareable-url-in-hash-fragment.md).

A link reproduces an exact studio view on the deployed static build, with
no server.

- **What is encoded.** Four fields: the `present` flag, the screen key
  (presented or focused), the scheme, and the token overrides. Board
  scale, scroll, active tab, and the comparing flag are not encoded — a
  stakeholder link reproduces a view of a screen, not the designer's desk.
- **Where it lives.** The hash fragment, as `#s=<payload>`. Expo Router
  owns the path and parses the query, so the hash is the one part of the
  URL that never conflicts with router navigation or typed-routes
  validation.
- **Overrides encoding.** The store's `overrides` map is already the diff
  from the bundled `tokens.json` — at most 55 keys of hex, numbers, or
  shadow strings, under 1KB of JSON. Compress with `CompressionStream`
  (deflate), encode as base64url into the hash. No server-held snapshot
  ids: the Pages build cannot create them, and that would make the
  honest-zero case the default.
- **When the URL updates.** Live, with a debounced `history.replaceState`
  — no history entries pile up. Plus a "Copy link" button in the chrome,
  because the button is what makes the feature discoverable. Cmd+C in the
  address bar is the fallback.
- **Honest zero.** The static build applies every valid override. The
  remaining failure cases are a malformed payload, an unknown token path
  (a link from a newer build), and a schema version mismatch. On any of
  these: apply the valid part, refuse the rest, and show a dismissible
  banner — "This link's token overrides could not be fully applied (3 of
  12). Showing committed values for the rest." An unknown screen key
  shows screen 01 with a banner: "This link pointed to a screen that no
  longer exists. Showing the first screen." Never drop silently, never
  crash the route. A `v` field versions the payload schema so a future
  format change degrades to the same banner.

### Open questions for implementation

- Where the URL-state encode/decode module lives (`mobile/src/ide/` is
  the natural home) and what it is called.
- Whether the debounce interval is a fixed constant or tied to the spine
  flush cadence.
- Whether "Copy link" shows a confirmation (toast or label swap).
