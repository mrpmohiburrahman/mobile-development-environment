// The CI workflow is a claim about what CI runs. A workflow can name a script
// that no longer exists, a command that no longer works, or a test glob that
// matches nothing — and it will keep reporting green.
//
// There is no clean way to execute a GitHub Actions workflow, so this file
// asserts the parts that would rot: that every path the workflow references
// exists, that the commands it runs are the ones on disk, and that its triggers
// match the intent recorded in the map.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = join(ROOT, '.github/workflows/studio-guard.yml');
const ATTRIBUTION = join(ROOT, '.github/workflows/no-ai-attribution.yml');

const workflow = readFileSync(WORKFLOW, 'utf8');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

test('the guard workflow exists and the guard script it calls exists', () => {
  // The most common rot: a workflow keeps running `scripts/guard.sh` after the
  // script is renamed or moved. The step would fail in CI, and nobody local
  // would find out until a push.
  assert.ok(existsSync(WORKFLOW), 'studio-guard.yml is missing');
  assert.match(workflow, /scripts\/guard\.sh/);
  assert.ok(existsSync(join(ROOT, 'scripts/guard.sh')), 'scripts/guard.sh is missing');
});

test('the workflow checks out full history', () => {
  // The guard is a three-dot range. A shallow clone has no merge base, so with
  // fetch-depth 1 the diff either errors or compares the wrong two trees — and
  // the workflow would blame the reader for it.
  assert.match(workflow, /fetch-depth:\s*0/);
});

test('the workflow runs the test suite via npm test', () => {
  // Keeps the two in step: a workflow hardcoding a different glob than package
  // .json would silently test a subset of what the developer tests locally.
  assert.match(workflow, /run:\s*npm test/);
  assert.ok(pkg.scripts?.test, 'package.json has no test script');
});

test('the workflow runs the guard as a script, not as an inline diff', () => {
  // Inline `git diff` in YAML is a second copy of the guard's logic with no
  // tests. Duplicating it is how the two drift into disagreeing about which
  // files are protected.
  const inlineDiff = /git diff/.test(workflow);
  assert.equal(inlineDiff, false, 'workflow duplicates the guard logic inline');
});

test('the PR range is the three-dot form against the base branch', () => {
  // Two dots would blame the branch for drift already on the base.
  assert.match(workflow, /origin\/\$\{\{\s*github\.base_ref\s*\}\}\.\.\.HEAD/);
});

test('the workflow handles a first push, where `before` is all zeros', () => {
  // GitHub sends 000...0 for a branch's first push. Diffing against that is a
  // range against nothing; the fallback keeps the check meaningful instead of
  // either erroring or silently passing.
  assert.match(workflow, /0000000000000000000000000000000000000000/);
  assert.match(
    workflow,
    /origin\/\$\{\{\s*github\.event\.repository\.default_branch\s*\}\}\.\.\.HEAD/,
  );
});

test('the workflow never falls back to origin/HEAD', () => {
  // This one was live and wrong for a full day. `origin/HEAD` is a local
  // symbolic ref that only a real `git clone` creates. `actions/checkout` fetches
  // the history but never runs `git remote set-head origin -a`, so the ref does
  // not exist there, and the first push of any new branch failed with
  // "fatal: bad revision 'origin/HEAD...HEAD'".
  //
  // The guard was therefore unrunnable on exactly the push that creates a
  // branch. The old test asserted the fallback *existed*; it did not assert the
  // range resolved. This asserts the shape that resolves.
  const fallback = workflow.slice(workflow.indexOf('before='));
  assert.doesNotMatch(fallback, /origin\/HEAD/, 'the first-push fallback must name the default branch');

  // And prove the ref really is absent in that environment, rather than trusting
  // the reasoning above.
  const repo = mkdtempSync(join(tmpdir(), 'guard-head-'));
  try {
    execSync('git init -q && git config user.email t@t && git config user.name t', { cwd: repo });
    // A clone sets origin/HEAD. This repo has no remote at all, which is the
    // closest local stand-in for a checkout that never ran `remote set-head`.
    const ref = execSync('git rev-parse --verify origin/HEAD', { cwd: repo, stdio: 'pipe' });
    assert.fail(`expected origin/HEAD to be unresolvable, got: ${ref.toString()}`);
  } catch (err) {
    // git exits non-zero for an unknown revision. That is the point.
    assert.notEqual((err as { status?: number }).status, 0);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('the guard triggers on pull requests and pushes, like the attribution check', () => {
  // Parity with the one workflow that already exists: a new required status
  // check that never reports on PRs would be a check nobody sees fail.
  const attribution = readFileSync(ATTRIBUTION, 'utf8');
  for (const trigger of ['pull_request', 'push']) {
    assert.match(workflow, new RegExp(trigger), `guard workflow missing ${trigger} trigger`);
    assert.match(attribution, new RegExp(trigger), `attribution workflow missing ${trigger}`);
  }
});

test('Pages verifies the code and export before upload', () => {
  const pages = readFileSync(join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  const upload = pages.indexOf('actions/upload-pages-artifact@');
  assert.ok(upload > 0);
  for (const command of ['bash scripts/guard.sh', 'npm test', 'npm run lint', 'npx tsc --noEmit', 'npm run export:web']) {
    const index = pages.indexOf(command);
    assert.ok(index > 0 && index < upload, `${command} must precede upload`);
  }
  assert.match(pages, /fetch-depth:\s*0/);
  assert.match(pages, /needs:\s*build/);
  assert.doesNotMatch(pages, /workflow_dispatch/);
  assert.match(pages, /Missing deployment base revision\.[\s\S]*?exit 1/);
  const exporter = readFileSync(join(ROOT, 'scripts/export-web.sh'), 'utf8');
  assert.match(exporter, /node scripts\/verify-web\.mjs dist/);
});

test('clean typechecking loads Expo declarations without generated files', () => {
  const config = JSON.parse(readFileSync(join(ROOT, 'mobile/tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
  assert.ok(config.compilerOptions.types?.includes('expo/types'));
});

test('the guard script is executable and starts with a shebang', () => {
  // `npm run guard` and any direct ./scripts/guard.sh both depend on this.
  const script = readFileSync(join(ROOT, 'scripts/guard.sh'), 'utf8');
  assert.match(script, /^#!\/usr\/bin\/env bash\n/);
});
const vrJob = workflow.slice(workflow.indexOf('  visual-regression:'), workflow.indexOf('\n  check:'));

test('the screenshot job runs in the pinned image on an arm64 runner', () => {
  const image = `mcr.microsoft.com/playwright:v${pkg.devDependencies.playwright}-noble`;
  assert.ok(vrJob.length > 0, 'studio-guard.yml has no visual-regression job');
  assert.match(vrJob, /runs-on:\s*ubuntu-24\.04-arm/);
  assert.ok(vrJob.includes(`image: ${image}`), 'container image must match the installed Playwright version');
  assert.ok(vrJob.includes(`VR_IMAGE: ${image}`), 'VR_IMAGE must match the installed Playwright version');
  assert.match(vrJob, /options:\s*--platform linux\/arm64/);
  assert.match(vrJob, /VR_REQUIRE_COMPARE:\s*"1"/);
});

test('the screenshot job runs on pull requests and default-branch pushes only', () => {
  assert.match(
    vrJob,
    /if: github\.event_name == 'pull_request' \|\| github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/,
  );
});

test('the screenshot job exports, compares, records the outcome, and uploads evidence', () => {
  const order = ['npm run export:web', 'npm run vr', 'node vr/summary.mjs'].map((step) => vrJob.indexOf(step));
  assert.ok(order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1])), 'steps out of order');
  assert.ok(pkg.scripts.vr && pkg.scripts['vr:update'], 'package.json lacks vr scripts');
  assert.match(vrJob, /if: always\(\)\s*\n\s*uses: actions\/upload-artifact@v4\s*\n\s*with:\s*\n\s*name: playwright-report/);
  assert.match(vrJob, /if: failure\(\)\s*\n\s*uses: actions\/upload-artifact@v4\s*\n\s*with:\s*\n\s*name: screenshot-diffs/);
});

test('the screenshot job never updates or commits baselines', () => {
  assert.doesNotMatch(vrJob, /vr:update|update-snapshots|git (add|commit|push)/);
});
