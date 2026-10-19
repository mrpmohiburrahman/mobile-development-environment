import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREENSHOT_DIR, SCREENSHOT_RECORD_PATH } from '../mobile/src/ide/screenshotMatrix.ts';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RESULTS_DIR = join(ROOT, 'test-results/vr');
export const RUNNER_OUTPUT_DIR = 'test-results/playwright';
export const STATUS_PATH = join(RESULTS_DIR, 'status.json');

export const CAPTURE_OUTPUTS = [`${SCREENSHOT_DIR}/`, SCREENSHOT_RECORD_PATH];

export function resetResults() {
  rmSync(RESULTS_DIR, { recursive: true, force: true });
  mkdirSync(RESULTS_DIR, { recursive: true });
}

export function writeStatus(status) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(STATUS_PATH, `${JSON.stringify({ ...status, at: new Date().toISOString() }, null, 2)}\n`);
}

export function run(command, args, options = {}) {
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: ROOT, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => (stdout += chunk));
    child.stderr?.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => done({ code: code ?? 1, stdout, stderr }));
  });
}

export async function uncommittedCaptureInputs() {
  const status = await run('git', ['status', '--porcelain', '--untracked-files=all']);
  if (status.code !== 0) throw new Error(`git status failed: ${status.stderr}`);
  return status.stdout
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .filter((line) => !CAPTURE_OUTPUTS.some((output) => line.slice(3).startsWith(output)));
}

export async function headCommit() {
  const head = await run('git', ['rev-parse', 'HEAD']);
  if (head.code !== 0) throw new Error(`git rev-parse HEAD failed: ${head.stderr}`);
  return head.stdout.trim();
}
