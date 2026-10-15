# Map: Mobile development environment on Expo web

Labels: `wayfinder:map`

## Destination

A public GitHub repo an employer can open and immediately understand: an Expo app whose `/ide` route renders every screen side-by-side as a blueprint and lets you edit design tokens live — colours, spacing, radius, typography, light/dark — with edits landing in the codebase as real git diffs. Plus a README with GIFs and a read-only web deploy so it can be tried in ten seconds.

Done when someone can clone it, run two commands, drag a colour picker, and see `git diff` change.

## Notes

- **This map carries execution.** Wayfinder normally plans only; this effort overrides that. The user's goal is a working artifact for a job search, so tickets here mostly *do* rather than decide.
- Reference for the technique: [`transcripts/ARCHITECTURE.md`](../../transcripts/ARCHITECTURE.md), reconstructed from the RNCK #14 talk transcript + 65 kept frames in `transcripts/frames/keep/`.
- We are building our own app and our own code. The talk supplies the architecture, not the source.
- Layout: `mobile/` (Expo app + IDE route), `token-server/` (the writer), root README ties them together.
- Node: use v22.13.1 via nvm. System default is v26, which Expo is not happy with.

## Decisions so far

- [Demo app subject](issues/01-demo-app.md) — original ~7-screen habit tracker; no API keys, no backend, seeded local data, so a clone runs instantly.
- [Stack](issues/02-stack.md) — Expo Router + Zustand. File-based routing lets the blueprint enumerate screens instead of hand-importing them; Zustand's store renders directly in the state panel.
- [Token scope](issues/03-token-scope.md) — colours + spacing + radius + typography + light/dark themes. The talk shipped colours only and named the rest as future work; doing it is our differentiator.
- [Shareability](issues/04-shareability.md) — GitHub repo + README GIFs + a read-only web deploy whose token edits are in-memory (disk writes are local-only by nature).
- [Token file and server](issues/05-token-file-and-server.md) — dotted paths across all five families; dependency-free Node stdlib server; edits are an override layer, which is what makes one code path serve both the local and deployed modes.
- [Designing prop](issues/06-designing-prop.md) — a context, not a prop. Expo Router owns screen mounting, so there is no call site to thread a prop from.
- [Blueprint view](issues/07-blueprint-view.md) — screens enumerated from the router with `require.context`, so the artboard cannot go stale when a route is added.
- [Token editor panel](issues/08-token-editor-panel.md) — native `<input type="color">` and `type="range"`; no picker dependency.
- [State inspector](issues/09-state-inspector.md) — recursive tree over the Zustand store, no devtools integration needed.
- [Demo app screens](issues/10-demo-app-screens.md) — seven screens on seeded local data, all rendering through token-reading components.
- [README and deploy](issues/11-readme-and-deploy.md) — GIFs of a real colour edit and its one-line diff; `npm run export:web` then `npm run preview` serves the read-only build, with a token-server URL that nothing listens on.

**Verified working end to end** (commit `a247613`): server write → Fast Refresh → every screen repaints at once; an edit produces exactly one line of diff; `POST /revert` returns the file to clean; unknown token paths are rejected.

## Not yet specified

- Whether the state panel needs time-travel/history or just a live tree.
- Visual regression testing on the web build — the talk floated it; may be out of scope for v1.
- Whether typography tokens need a font-loading story or can assume system fonts.
- Whether the deployed build should hide the `state` tab, since Zustand state there is per-visitor and resets on reload.

## Out of scope

- Authentication against a real identity provider. The demo's Login screen is a prop; real auth adds setup friction for anyone cloning it and shows nothing about the idea.
- Publishing to the App Store / Play Store.
