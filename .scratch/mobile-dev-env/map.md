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

## Not yet specified

- How screens declare themselves to the blueprint under Expo Router — filesystem enumeration vs an explicit manifest. Depends on how `designing` ends up being threaded (see ticket 06).
- Whether the state panel needs time-travel/history or just a live tree.
- Visual regression testing on the web build — the talk floated it; may be out of scope for v1.
- Whether typography tokens need a font-loading story or can assume system fonts.

## Out of scope

- Authentication against a real identity provider. The demo's Login screen is a prop; real auth adds setup friction for anyone cloning it and shows nothing about the idea.
- Publishing to the App Store / Play Store.
