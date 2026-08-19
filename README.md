# Streak Studio

A design-token editor that lives **inside** an Expo app and writes its edits back into the codebase as real git diffs.

Drag a colour picker, and every screen repaints at once — in the browser and on a connected simulator — because the token file on disk actually changed. Don't like it? `git checkout .`

![the studio](docs/media/studio.png)

## Why

Two frictions this removes:

**You can't see the whole app.** A simulator shows one screen at a time. On a real app that hides inconsistency — the button that's 2px off on one screen, the heading that drifted a weight. The studio renders every screen side by side as a blueprint, from the same components that ship, so it can't lie to you.

**Design changes have to be re-typed.** Change a colour in Figma, then change it again in code. The studio removes the second step: the picker writes `tokens.json` and Fast Refresh does the rest. Design work lands as a commit.

The idea comes from Rafael Mendiola's talk *"Build yourself a mobile development environment with Expo web"* (React Native Connection #14). He shipped live colour editing; this goes further — spacing, corner radius, type scale, and light/dark are all editable, which he named on stage as the obvious next step and left undone.

## Run it

Two terminals. Node 22.

```bash
npm run tokens   # the writer, on :3001
npm run web      # Expo web, on :8081
```

Then open **http://localhost:8081/ide**.

Drag anything in the left panel and watch `git diff mobile/src/ds/tokens.json`.

Drop the `/ide` and you get the plain mobile app at `http://localhost:8081` — same bundle, same components. Run `npm run ios` alongside and token edits land there live too.

## How it works

The whole thing is four ideas.

**1. The studio is a route, not a project.** `mobile/src/app/ide.tsx` sits next to the app's other routes. It imports the real screens. There is no parallel implementation to keep in sync, and no static analysis — if a screen renders wrong in the blueprint, it renders wrong in the app.

**2. Tokens live in plain JSON.** [`mobile/src/ds/tokens.json`](mobile/src/ds/tokens.json) — colours per scheme, spacing, radius, type scale. JSON rather than TypeScript is the entire trick: a 90-line server can patch it safely, which is not true of a `.ts` file without a parser.

**3. A tiny server does the writing.** [`token-server/index.mjs`](token-server/index.mjs) exposes `POST /token {path, value}`, sets a dotted path like `color.light.accent`, and writes the file back. Node stdlib only — no dependencies, no build step. Metro sees the file change and Fast Refresh swaps the module into every surface at once.

**4. Screens know when they're being designed.** Inside the blueprint a tap must not navigate, or the whole artboard would sail off to one route. Screens call `useNavigate()` from [`designing.tsx`](mobile/src/ide/designing.tsx), which no-ops under a `DesigningProvider`. Context rather than a `designing` prop, because Expo Router owns screen mounting — there's no single call site to thread a prop from.

Screens are enumerated from the router directory with `require.context`, so adding a route file puts it on the artboard automatically. A hand-written import list goes stale the first time someone forgets — which is exactly the drift the blueprint exists to catch.

## The deployed build

The live demo edits tokens **in memory**. Recolouring feels identical, but nothing is written, because a static web build has no filesystem.

That's not a workaround bolted on — it falls out of the design. Edits are an override layer merged over the JSON file, so with a server running the file converges on the override and the override is a no-op; with no server the override is all there is. One code path, both modes.

The part a deploy structurally cannot show is the `git diff`, which is the actual point. That's what the GIFs are for.

## Layout

```
mobile/
  src/app/          routes — 7 app screens + ide.tsx
  src/ds/           tokens.json, the store, the server client
  src/ide/          blueprint, token panel, state panel, designing context
  src/ui/           token-driven components
token-server/       the writer
```

## Known limits

- The studio is web-only by design; opening `/ide` on a device shows a note saying so.
- `POST /revert` shells out to `git checkout`, so it reverts to the last commit, not to a session start point.
- Token edits are not validated beyond "this path already exists" — a garbage colour string will render as a garbage colour.
