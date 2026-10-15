// The byte-identical guard, tested against real throwaway git repos.
//
// This is the guard for the studio's central claim: app screens and shared
// components stay byte-identical while the studio grows around them. A claim
// checked only by reading the diff does not stay true — someone edits a shared
// component, the diff grows, and nothing objects. `scripts/guard.sh` is what
// objects, and these tests are what keep the script honest about *which* paths
// it protects and *which* it deliberately lets through.
//
// Every case below builds an actual repo, commits actual files, and runs the
// real script. No fixture stands in for git, because the parts most likely to
// be wrong — three-dot vs two-dot ranges, the `:(exclude)` pathspec, the
// merge-base semantics — are exactly the parts a hand-built fixture would
// fake.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = join(ROOT, 'scripts/guard.sh');

/**
 * Build a throwaway repo with a `main` branch holding the app tree, then a
 * `studio` branch on top of it. `commit` lands on `studio`, which is what every
 * test here means by "this branch"; `commitOn` exists for the one case that
 * needs to move main instead.
 */
type Changes = Record<string, string | null>;

function makeRepo(): {
  dir: string;
  commit: (files: Changes) => void;
  commitOn: (branch: string, files: Changes) => void;
  checkout: (branch: string) => void;
} {
  const dir = mkdtempSync(join(tmpdir(), 'guard-test-'));
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  git('init', '--quiet', '--initial-branch=main');
  // Commits need an identity; the host's global config is not this machine's
  // business and must not be relied on inside a temp repo.
  git('config', 'user.email', 'guard@example.invalid');
  git('config', 'user.name', 'Guard Test');
  git('config', 'commit.gpgsign', 'false');

  // The tree the guard protects, present on main.
  const base: Record<string, string> = {
    'mobile/src/ui/Card.tsx': 'export const Card = 1;\n',
    'mobile/src/ui/index.ts': "export * from './Card';\n",
    'mobile/src/app/_layout.tsx': 'export const Layout = 1;\n',
    'mobile/src/app/index.tsx': 'export const Index = 1;\n',
    'mobile/src/app/ide.tsx': 'export const Ide = 1;\n',
    'mobile/src/app/screens/blueprint.tsx': 'export const Blueprint = 1;\n',
    'mobile/src/ds/store.ts': 'export const store = 1;\n',
    'mobile/src/ide/designing.tsx': 'export const Designing = 1;\n',
    'token-server/index.mjs': 'export const server = 1;\n',
    'README.md': '# studio\n',
  };
  writeTree(dir, base);
  git('add', '-A');
  git('commit', '--quiet', '-m', 'main: app tree');
  git('branch', 'studio');

  function checkout(branch: string) {
    git('checkout', '--quiet', branch);
  }

  function commitOn(branch: string, files: Changes) {
    checkout(branch);
    writeTree(dir, files);
    git('add', '-A');
    git('commit', '--quiet', '-m', 'studio: change');
  }

  return {
    dir,
    checkout,
    // `null` means delete. Renames across the guard boundary are the case this
    // test suite most needs to get right, and a helper that cannot delete
    // cannot express one.
    commit: (files) => commitOn('studio', files),
    commitOn,
  };
}

function writeTree(dir: string, files: Changes) {
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    if (body === null) {
      rmSync(abs, { force: true });
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
}

type GuardResult = { code: number; stdout: string };

/** Run the guard the way CI does: `guard.sh <range>`, from inside the repo. */
function runGuard(dir: string, range = 'main...HEAD'): GuardResult {
  try {
    const stdout = execFileSync('bash', [GUARD, range], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout };
  } catch (err: any) {
    // Capture the message the workflow prints on failure — an error nobody can
    // see is barely better than no check at all.
    return { code: err.status ?? 1, stdout: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/**
 * The indented file paths the guard reports as offenders. Parsed rather than
 * regex-matched so a test can assert the exact set of flagged files — which is
 * what actually decides whether the ide.tsx carve-out leaked.
 */
function offendingFiles(output: string): string[] {
  const start = output.indexOf('must not touch:');
  assert.notEqual(start, -1, `no offender list in output:\n${output}`);
  const tail = output.slice(start).split('\n').slice(2);
  const files: string[] = [];
  for (const line of tail) {
    if (!/^ {2}\S/.test(line)) break;
    files.push(line.trim());
  }
  return files;
}

function withRepo(fn: (ctx: ReturnType<typeof makeRepo>) => void) {
  const ctx = makeRepo();
  try {
    fn(ctx);
  } finally {
    rmSync(ctx.dir, { recursive: true, force: true });
  }
}

test('an edit to a shared component in mobile/src/ui fails the guard', () => {
  withRepo(({ dir, commit }) => {
    commit({ 'mobile/src/ui/Card.tsx': 'export const Card = 2;\n' });
    const result = runGuard(dir);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /mobile\/src\/ui\/Card\.tsx/);
  });
});

test('an edit to an app screen fails the guard', () => {
  withRepo(({ dir, commit }) => {
    commit({ 'mobile/src/app/index.tsx': 'export const Index = 2;\n' });
    const result = runGuard(dir);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /mobile\/src\/app\/index\.tsx/);
  });
});

test('an edit to a nested app screen fails the guard', () => {
  // `mobile/src/app` is a directory of 14 screens, not just the two at its
  // root. A guard that only watched top-level files would miss most of the app.
  withRepo(({ dir, commit }) => {
    commit({ 'mobile/src/app/screens/blueprint.tsx': 'export const Blueprint = 2;\n' });
    const result = runGuard(dir);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /blueprint\.tsx/);
  });
});

test('ide.tsx is the named exception and passes on its own', () => {
  withRepo(({ dir, commit }) => {
    commit({ 'mobile/src/app/ide.tsx': 'export const Ide = 2;\n' });
    assert.equal(runGuard(dir).code, 0);
  });
});

test('ide.tsx stays exempt while a sibling app screen is caught', () => {
  // The carve-out must be narrow. `:(exclude)` on a path inside a watched
  // directory is the risky form, so pin the behaviour both ways at once.
  withRepo(({ dir, commit }) => {
    commit({
      'mobile/src/app/ide.tsx': 'export const Ide = 2;\n',
      'mobile/src/app/index.tsx': 'export const Index = 2;\n',
    });
    const result = runGuard(dir);
    assert.equal(result.code, 1);
    // Judge the reported file list, not the whole message: the closing
    // paragraph names ide.tsx to explain the carve-out, and it always will.
    const listed = offendingFiles(result.stdout);
    assert.deepEqual(listed, ['mobile/src/app/index.tsx']);
  });
});

test('ui/index.tsx stays exempt for the designing seam while sibling ui files are caught', () => {
  withRepo(({ dir, commit }) => {
    commit({ 'mobile/src/ui/index.tsx': 'export const TabBar = 2;\n' });
    assert.equal(runGuard(dir).code, 0);

    commit({
      'mobile/src/ui/index.tsx': 'export const TabBar = 3;\n',
      'mobile/src/ui/Card.tsx': 'export const Card = 2;\n',
    });
    const result = runGuard(dir);
    assert.equal(result.code, 1);
    assert.deepEqual(offendingFiles(result.stdout), ['mobile/src/ui/Card.tsx']);
  });
});

test('edits the studio is allowed to make all pass', () => {
  // ds/, ide/, the token server and the README are the studio's own ground.
  withRepo(({ dir, commit }) => {
    commit({
      'mobile/src/ds/store.ts': 'export const store = 2;\n',
      'mobile/src/ide/designing.tsx': 'export const Designing = 2;\n',
      'token-server/index.mjs': 'export const server = 2;\n',
      'README.md': '# studio\n\nNow with six extensions.\n',
      'test/new.test.ts': "import { test } from 'node:test';\n",
    });
    assert.equal(runGuard(dir).code, 0);
  });
});

test('a commit touching nothing guarded passes', () => {
  withRepo(({ dir, commit }) => {
    commit({ 'token-server/index.mjs': 'export const server = 2;\n' });
    assert.equal(runGuard(dir).code, 0);
  });
});

test('the three-dot range ignores drift already on main', () => {
  // The guard answers "did THIS branch change protected files", not "are the
  // protected files on main still in some agreed state". Two-dot would conflate
  // the two and blame a branch for someone else's commit; the merge-base
  // semantics are the whole reason the range is spelled with three dots.
  withRepo(({ dir, commit, commitOn }) => {
    commit({ 'token-server/index.mjs': 'export const server = 2;\n' });
    // main moves on independently; studio never picks this commit up.
    commitOn('main', { 'mobile/src/ui/Card.tsx': 'export const Card = 99;\n' });

    // main is ahead with a guarded-file edit; the studio branch does not
    // contain it, so the studio branch did not break the guard.
    assert.equal(runGuard(dir, 'main...HEAD').code, 0);
  });
});

test('a revert of a guarded edit inside the branch passes again', () => {
  // Guards that cannot be satisfied by fixing the problem are just obstacles.
  withRepo(({ dir, commit }) => {
    commit({ 'mobile/src/ui/Card.tsx': 'export const Card = 2;\n' });
    assert.equal(runGuard(dir).code, 1);
    commit({ 'mobile/src/ui/Card.tsx': 'export const Card = 1;\n' });
    assert.equal(runGuard(dir).code, 0);
  });
});

test('moving a file across the guard boundary fails in both directions', () => {
  // Relocating a component out of ui/ into ds/ is the quiet way to defeat a
  // guard like this: the diff reads like tidying up. It is still an edit to a
  // byte-identical file — git reports the deletion under ui/ — so it must fail.
  withRepo(({ dir, commit }) => {
    commit({
      'mobile/src/ui/Card.tsx': null,
      'mobile/src/ds/Card.tsx': 'export const Card = 1;\n',
    });
    const result = runGuard(dir);
    assert.equal(result.code, 1);
    assert.deepEqual(offendingFiles(result.stdout), ['mobile/src/ui/Card.tsx']);
  });

  // And in: a new file appearing under ui/ is equally a change to a file the
  // guard owns, whether or not git records it as a rename.
  withRepo(({ dir, commit }) => {
    commit({
      'mobile/src/ds/Card.tsx': 'export const Card = 1;\n',
      'mobile/src/ui/Card.tsx': 'export const Card = 2;\n',
    });
    const result = runGuard(dir);
    assert.equal(result.code, 1);
    assert.deepEqual(offendingFiles(result.stdout), ['mobile/src/ui/Card.tsx']);
  });
});

test('a bad range fails loudly instead of silently passing', () => {
  // The failure mode that matters most: a typo'd base ref, or a shallow clone,
  // makes `git diff` error. If that exits 0, the guard is theatre.
  withRepo(({ dir }) => {
    const result = runGuard(dir, 'no-such-ref...HEAD');
    assert.equal(result.code, 1);
    assert.match(result.stdout, /no-such-ref/);
  });
});

test('every offending file is listed, not just the first', () => {
  withRepo(({ dir, commit }) => {
    commit({
      'mobile/src/ui/Card.tsx': 'export const Card = 2;\n',
      'mobile/src/app/index.tsx': 'export const Index = 2;\n',
    });
    const result = runGuard(dir);
    assert.equal(result.code, 1);
    // Sorted output: CI logs are read by people, and a stable order makes the
    // failure message diffable between runs.
    assert.deepEqual(offendingFiles(result.stdout).sort(), [
      'mobile/src/app/index.tsx',
      'mobile/src/ui/Card.tsx',
    ]);
  });
});

test('the guard script exists and is executable via bash', () => {
  withRepo(({ dir }) => {
    // Guards themselves drift. Nothing else here would notice if the script
    // were deleted while the workflow kept calling it.
    const result = runGuard(dir);
    assert.equal(result.code, 0, result.stdout);
  });
});