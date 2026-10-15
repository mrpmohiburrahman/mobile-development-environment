Type: task
Status: resolved
Blocked by: 07, 08, 09, 10

## Question

README with GIFs of the live loop, and the read-only web deploy.

## Comments

README written, with a still of the studio at `docs/media/studio.png`. Still outstanding: the GIFs of the live edit loop (the part a static deploy structurally cannot show), and the read-only web deploy itself.

A code review found no hosted build. It also found two README claims that did not match the code. The fixes below close both outstanding items.

## Answer

The README embeds two GIFs from a real edit. `docs/media/edit-loop.gif` shows the accent change, every screen repaint, and the badge report the disk write. `docs/media/git-diff.gif` shows that edit as one line in `tokens.json`.

The public deploy is GitHub Pages at `https://mrpmohiburrahman.github.io/mobile-development-environment/ide`. `.github/workflows/pages.yml` builds it on every push to `main`. `mobile/app.config.js` sets the Pages subpath only when the build sets `EXPO_BASE_URL`, so local `expo start` stays at the root.

`npm run export:web` bakes `EXPO_PUBLIC_TOKEN_SERVER=http://127.0.0.1:9`. Browsers block port 9, so every write fails at once. The script fails if the bundle still holds `localhost:3001`. `npm run preview` serves `dist/` locally and refuses all methods except `GET` and `HEAD`. `test/staticFiles.test.ts` covers the preview server.

A browser check of the export showed the badge **in-memory only** and the toggle **no committed baseline**. The check passed at the root and under the Pages subpath.

The map item about the `state` tab on the deployed build stays open. This ticket ships the tab as it is.
