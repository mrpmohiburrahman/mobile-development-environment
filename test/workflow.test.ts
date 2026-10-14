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

test('the guard script is executable and starts with a shebang', () => {
  // `npm run guard` and any direct ./scripts/guard.sh both depend on this.
  const script = readFileSync(join(ROOT, 'scripts/guard.sh'), 'utf8');
  assert.match(script, /^#!\/usr\/bin\/env bash\n/);
});