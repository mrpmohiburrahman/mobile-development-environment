// Serves the static web export from `dist/` for a local preview.
//
// Usage: node scripts/serve-static.mjs [folder]
//
// The folder defaults to `dist/` at the repository root. A relative folder is
// read from the current directory. Reads HOST (default 127.0.0.1) and PORT
// (default 8080).

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from './static-files.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.argv[2] ? resolve(process.argv[2]) : resolve(REPO, 'dist');
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8080);
const BASE_PATH = process.env.EXPO_BASE_URL ?? '';

if (!existsSync(resolve(ROOT, 'index.html'))) {
  console.error(`no export at ${ROOT}. Run \`npm run export:web\` first.`);
  process.exit(1);
}

createStaticServer(ROOT, BASE_PATH).listen(PORT, HOST, () => {
  console.log(`read-only web  →  http://${HOST}:${PORT}${BASE_PATH.replace(/\/$/, '')}/ide`);
});
