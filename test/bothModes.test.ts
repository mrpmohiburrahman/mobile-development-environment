// Both modes, every feature.
//
// ## What the two modes are
//
// The token server running, and the token server absent. The second is not an edge
// case: it is the deployed static build, and it is what a reader who clones the
// repo and opens the studio without launching `npm run tokens` gets. The spec asks
// for both to be tested rather than assumed, because none of this work touches the
// token file — so the static build should be the *same* case, not a degraded one.
//
// ## How that is testable without a browser
//
// Two ways, and they check different halves of the claim.
//
// Statically: no decision module may have a runtime import path to the things that
// differ between the modes. `ds/store` reads `tokens.json` and is rebuilt by every
// token write; `ds/client` talks to the server; `BaselinePanel` is what fetches the
// committed tree and returns null forever when there is no server. A decision that
// reached any of them would produce a different answer in the two modes, and would
// do it silently — the panel would still print something plausible.
//
// Behaviourally: every feature has a state for "the studio is not in a position to
// answer", and each of those states has to be reachable with nothing attached and
// has to read differently from "the studio answered, and the answer was zero". That
// is the honest-zero rule, and it is what makes the server-absent build safe to
// read rather than merely functional: a tool that cannot distinguish its own
// brokenness from a quiet subject will report the second over the first.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSpine, describeLog } from '../mobile/src/ide/spine.ts';
import { describePresses } from '../mobile/src/ide/presses.ts';
import { backGap, describeBackGap } from '../mobile/src/ide/routes.ts';
import { fontVerdictCopy, typeVerdictCopy, verifyTypeTokens } from '../mobile/src/ide/renderFidelity.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The modules that decide things, as opposed to the ones that gather facts. */
const DECISION_MODULES = [
  'mobile/src/ide/spine.ts',
  'mobile/src/ide/routes.ts',
  'mobile/src/ide/presses.ts',
  'mobile/src/ide/renderFidelity.ts',
  'mobile/src/ide/boardFrames.ts',
  'mobile/src/ide/routerKeys.ts',
];

/** What differs between the two modes, and so must not be reachable from a decision. */
const MODE_DEPENDENT = ['ds/store', 'ds/client', 'BaselinePanel'];

/**
 * Source with its prose removed and its type-only imports erased.
 *
 * `import type` is stripped because it is stripped by the bundler and by the
 * type-stripping test runner alike — asserting on it would flag a dependency that
 * does not exist at runtime. `spine.ts` and `routes.ts` both take `Tone` that way,
 * from the module that names the three states without reading any of them.
 */
const runtimeSource = (rel: string): string =>
  readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*import\s+type\s+[^;]+;$/gm, '');

test('no decision module can reach the token file or the server', () => {
  for (const rel of DECISION_MODULES) {
    const source = runtimeSource(rel);
    for (const forbidden of MODE_DEPENDENT) {
      assert.doesNotMatch(
        source,
        new RegExp(`from '[^']*${forbidden.replace('/', '\\/')}`),
        `${rel} reaches ${forbidden}, so its answer would differ between the two modes`,
      );
    }
    assert.doesNotMatch(source, /tokens\.json/, `${rel} would drag the token file into a decision`);
  }
});

test('every feature has a not-in-a-position-to-answer state, and none of them collides', () => {
  // The server-absent build reaches all four of these on a fresh load: nothing has
  // been pressed, no route has been seen, no back control has been counted, no font
  // has been probed. If any two of them printed the same words, a reader could not
  // tell which feature had failed to measure — and "nothing found" over a reader
  // that never ran is the failure this repo has already shipped.
  const states = {
    log: describeLog(createSpine(), false),
    presses: describePresses({ presses: 0, live: 0, inert: 0, unattributed: 0, unlocated: 0 }, false),
    backControls: describeBackGap(backGap(null)),
    typeface: fontVerdictCopy([]),
    // The real function, not a restatement of it. It moved out of the badge's
    // `.tsx` file for exactly this reason: a decision that lives in a React
    // component cannot be loaded by this runner, so it could never be checked.
    typeTokens: typeVerdictCopy(
      verifyTypeTokens({ body: { size: 16, weight: '400', lineHeight: 24, letterSpacing: 0 } }, []),
      false,
    ),
  };

  const labels = Object.values(states).map((s) => s.label);
  assert.equal(new Set(labels).size, labels.length, `two features share a label: ${labels.join(' | ')}`);

  const details = Object.values(states).map((s) => s.detail);
  assert.equal(new Set(details).size, details.length, 'two features share a caveat');

  // None of them may read as a clean result. A degraded or muted tone is an honest
  // "I could not answer"; `ok` would be a pass printed over nothing.
  for (const [name, state] of Object.entries(states)) {
    assert.notEqual(state.tone, 'ok', `${name} reported fine without measuring anything`);
    assert.equal(state.label.length > 0, true);
    assert.equal(state.detail.length > 0, true);
  }
});

test('the same feature reads differently when it is answering than when it is not', () => {
  // The pair that matters most, on both halves. "Watching with nothing yet" against
  // "not watching", and "nothing has been pressed" against "nothing was listening".
  const spine = createSpine();

  assert.notEqual(describeLog(spine, true).label, describeLog(spine, false).label);
  assert.equal(describeLog(spine, true).tone, 'muted', 'an idle log is not a broken one');
  assert.equal(describeLog(spine, false).tone, 'degraded');

  const empty = { presses: 0, live: 0, inert: 0, unattributed: 0, unlocated: 0 };
  assert.notEqual(describePresses(empty, true).label, describePresses(empty, false).label);
  assert.equal(describePresses(empty, true).tone, 'muted');
  assert.equal(describePresses(empty, false).tone, 'degraded');
});

test('a measured zero and an unmeasured subject are still different numbers', () => {
  // The back control is the case where zero is a legitimate answer: no back bar is
  // on the board right now. It has to read differently from "the studio could not
  // count them", or a board that has not mounted reports itself as an app with no
  // back navigation.
  const measuredZero = describeBackGap(backGap(0));
  const unmeasured = describeBackGap(backGap(null));

  assert.equal(measuredZero.measured, true);
  assert.equal(unmeasured.measured, false);
  assert.notEqual(measuredZero.label, unmeasured.label);
  assert.notEqual(measuredZero.detail, unmeasured.detail);
});
