import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  SCREENSHOT_DIR,
  SCREENSHOT_PNG_HEIGHT,
  SCREENSHOT_PNG_WIDTH,
  SCREENSHOT_RECORD_PATH,
  parsePngSize,
  validateScreenshotRecord,
  type ScreenshotCase,
  type ScreenshotValidation,
} from '../mobile/src/ide/screenshotMatrix.ts';
import { playwrightVersion } from './env.ts';

export function existingBaselines(root: string): string[] {
  const dir = join(root, SCREENSHOT_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith('.png'))
    .map((file) => `${SCREENSHOT_DIR}/${file}`);
}

export function readRecord(root: string): unknown {
  const path = join(root, SCREENSHOT_RECORD_PATH);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function checkRecordAndBaselines(root: string, matrix: readonly ScreenshotCase[]): ScreenshotValidation {
  const existing = existingBaselines(root);
  const validation = validateScreenshotRecord(readRecord(root), matrix, {
    existingBaselines: existing,
    playwrightVersion: playwrightVersion(root),
  });
  const errors = [...validation.errors];
  for (const c of matrix) {
    if (!existing.includes(c.baseline)) continue;
    const size = parsePngSize(readFileSync(join(root, c.baseline)));
    if (!size) errors.push(`${c.baseline} is not a PNG`);
    else if (size.width !== SCREENSHOT_PNG_WIDTH || size.height !== SCREENSHOT_PNG_HEIGHT) {
      errors.push(`${c.baseline} is ${size.width} by ${size.height}, expected ${SCREENSHOT_PNG_WIDTH} by ${SCREENSHOT_PNG_HEIGHT}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
