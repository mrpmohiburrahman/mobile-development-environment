import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { SCREENSHOT_DIR, SCREENSHOT_RECORD_PATH, updateRefusal } from '../mobile/src/ide/screenshotMatrix.ts';
import { currentPin } from './env.ts';
import { ROOT, run } from './shared.mjs';

process.env.TZ = 'UTC';

const TOKENS = join(ROOT, 'mobile/src/ds/tokens.json');
const PLANTS = [
  { from: '"accent": "#D9481E"', to: '"accent": "#D8481E"' },
  { from: '"accent": "#FF7A4C"', to: '"accent": "#FE7A4C"' },
];
const PROOF_DIR = join(ROOT, 'test-results/vr-proof');

const refusal = updateRefusal(currentPin(ROOT));
if (refusal) {
  console.error(refusal.replace('vr:update', 'vr:proof'));
  process.exit(1);
}

function fingerprint() {
  const files = [
    SCREENSHOT_RECORD_PATH,
    ...readdirSync(join(ROOT, SCREENSHOT_DIR)).map((file) => `${SCREENSHOT_DIR}/${file}`),
  ].sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update(readFileSync(join(ROOT, file)));
  return hash.digest('hex');
}

const step = async (label, command, args) => {
  console.log(`\n== ${label}`);
  return run(command, args, { stdio: 'inherit', env: { ...process.env, TZ: 'UTC' } });
};

function keepEvidence(from, to) {
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  for (const file of readdirSync(from, { recursive: true }).map(String)) {
    if (!/-(actual|expected|diff)\.png$/.test(file)) continue;
    writeFileSync(join(to, basename(file)), readFileSync(join(from, file)));
  }
}

const original = readFileSync(TOKENS, 'utf8');
for (const plant of PLANTS) {
  if (original.split(plant.from).length !== 2) {
    console.error(`vr:proof needs exactly one ${plant.from} in tokens.json. Restore the committed tokens first.`);
    process.exit(1);
  }
}
const before = fingerprint();
rmSync(PROOF_DIR, { recursive: true, force: true });

let planted;
try {
  writeFileSync(TOKENS, PLANTS.reduce((text, plant) => text.replace(plant.from, plant.to), original));
  if ((await step('Export with the planted accents', 'npm', ['run', 'export:web'])).code !== 0) {
    throw new Error('The planted export failed.');
  }
  planted = await step('Compare with the planted accents (must fail)', 'npm', ['run', 'vr']);
  keepEvidence(join(ROOT, 'test-results/playwright'), join(PROOF_DIR, 'planted'));
} finally {
  writeFileSync(TOKENS, original);
}

const diffs = existsSync(join(PROOF_DIR, 'planted'))
  ? readdirSync(join(PROOF_DIR, 'planted')).filter((file) => file.endsWith('-diff.png'))
  : [];
if ((await step('Export with the committed accents', 'npm', ['run', 'export:web'])).code !== 0) {
  console.error('The restored export failed.');
  process.exit(1);
}
const restored = await step('Compare with the committed accents (must pass)', 'npm', ['run', 'vr']);
const untouched = fingerprint() === before;

const checks = [
  [planted.code !== 0, `planted compare exited ${planted.code}, expected non-zero`],
  [diffs.length > 0, `planted compare wrote ${diffs.length} diff images, expected at least one`],
  [restored.code === 0, `restored compare exited ${restored.code}, expected 0`],
  [untouched, 'baselines and the screenshot record are unchanged'],
];
console.log('\n== vr:proof');
for (const [ok, label] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
console.log(`Diff images: test-results/vr-proof/planted (${diffs.length})`);
process.exit(checks.every(([ok]) => ok) ? 0 : 1);
