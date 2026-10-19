import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluatePin, type PinFacts, type PinVerdict } from '../mobile/src/ide/screenshotMatrix.ts';

export function playwrightVersion(root: string): string {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).devDependencies.playwright;
}

function osCodename(): string | null {
  try {
    const match = /^VERSION_CODENAME="?([^"\n]+)"?$/m.exec(readFileSync('/etc/os-release', 'utf8'));
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function chromiumInstalled(root: string, browsersPath: string | undefined): boolean {
  if (!browsersPath) return false;
  const manifest = JSON.parse(readFileSync(join(root, 'node_modules/playwright-core/browsers.json'), 'utf8'));
  const shell = manifest.browsers.find((b: { name: string }) => b.name === 'chromium-headless-shell');
  return Boolean(shell) && existsSync(join(browsersPath, `chromium_headless_shell-${shell.revision}`));
}

export function readPinFacts(root: string, env: NodeJS.ProcessEnv = process.env): PinFacts {
  return {
    platform: process.platform,
    arch: process.arch,
    osCodename: osCodename(),
    browsersPath: env.PLAYWRIGHT_BROWSERS_PATH,
    chromiumInstalled: chromiumInstalled(root, env.PLAYWRIGHT_BROWSERS_PATH),
    declaredImage: env.VR_IMAGE,
  };
}

export function currentPin(root: string): PinVerdict {
  return evaluatePin(readPinFacts(root), playwrightVersion(root));
}
