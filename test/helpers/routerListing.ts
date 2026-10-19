// `require.context('../app', true, /\.tsx$/)`, done on a filesystem.
//
// The browser gets this listing from Metro. `node --test` cannot, so tests walk
// the directory instead — against the real thing rather than a fixture, because a
// fixture agrees with the rules by construction and proves nothing about them.
//
// The walk lives in `vr/registry.ts` so the screenshot suite reads the same
// listing as the tests.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routerKeysIn } from '../../vr/registry.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

export const ALL_ROUTER_KEYS: string[] = routerKeysIn(join(ROOT, 'mobile/src/app'));
