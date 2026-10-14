// `require.context('../app', true, /\.tsx$/)`, done on a filesystem.
//
// The browser gets this listing from Metro. `node --test` cannot, so tests walk
// the directory instead — against the real thing rather than a fixture, because a
// fixture agrees with the rules by construction and proves nothing about them.

import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export const ALL_ROUTER_KEYS: string[] = (() => {
  const found: string[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(ROOT, 'mobile/src/app', rel), { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next);
      else if (next.endsWith('.tsx')) found.push(`./${next}`);
    }
  };
  walk('');
  return found.sort();
})();