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

`npm run export:web` sets `EXPO_PUBLIC_TOKEN_SERVER=http://127.0.0.1:9`. The client treats that address as read-only and makes no server requests. Metro removes the unused fetch branch. The script rejects incomplete server rendering, missing route assets, and a bundle that still holds `localhost:3001`.

`npm run preview` serves `dist/` locally and refuses all methods except `GET` and `HEAD`. It supports the Pages subpath through `EXPO_BASE_URL`. It refuses paths and symlinks outside the export directory. `test/staticFiles.test.ts` covers the preview server.

The spine hook now supplies the server snapshot that React requires during export. Its absence caused React error 419. The export check rejects that incomplete HTML before deployment.

A browser check of the export showed the badge **in-memory only** and the toggle **no committed baseline**. Token edits changed the browser but not `tokens.json`. The browser reported no application errors or token-server requests.

Clean runners load Expo types from the TypeScript configuration without generated files. The demo date helpers use UTC for the seed and labels. This prevents React error 418 when the build and browser use different timezones. Regression tests compare dates in five timezones.

The README distinguishes the captured GIF font result from the current browser measurement. Neither defines a font baseline for other machines.

The map item about the `state` tab on the deployed build stays open. This ticket ships the tab as it is.
