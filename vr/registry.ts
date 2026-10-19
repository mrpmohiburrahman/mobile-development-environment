import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isRouteFile, screenKeyOf } from '../mobile/src/ide/routerKeys.ts';
import { screenshotMatrix, type ScreenshotCase } from '../mobile/src/ide/screenshotMatrix.ts';

export function routerKeysIn(appDir: string): string[] {
  const found: string[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(appDir, rel), { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next);
      else if (next.endsWith('.tsx')) found.push(`./${next}`);
    }
  };
  walk('');
  return found.sort();
}

export function registryScreens(root: string): string[] {
  return routerKeysIn(join(root, 'mobile/src/app')).filter(isRouteFile).map(screenKeyOf);
}

export function registryMatrix(root: string): ScreenshotCase[] {
  return screenshotMatrix(registryScreens(root));
}
