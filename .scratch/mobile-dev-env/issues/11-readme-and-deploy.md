Type: task
Status: resolved
Blocked by: 07, 08, 09, 10

## Question

README with GIFs of the live loop, and the read-only web deploy.

## Answer

The README embeds two GIFs taken from a real edit: `docs/media/edit-loop.gif` (accent moves, every screen repaints, the badge says the write landed on disk) and `docs/media/git-diff.gif` (that edit is one line in `tokens.json`). The still at `docs/media/studio.png` stays.

The read-only deploy is `npm run export:web` then `npm run preview`. The export bakes `EXPO_PUBLIC_TOKEN_SERVER=http://127.0.0.1:9`, a port nothing listens on, so the static build cannot write even if a token server is up on the machine that built it. `scripts/serve-static.mjs` serves `dist/` and never writes tokens. Open `/ide`.

## Comments

README written, with a still of the studio at `docs/media/studio.png`. Still outstanding: the GIFs of the live edit loop (the part a static deploy structurally cannot show), and the read-only web deploy itself.

