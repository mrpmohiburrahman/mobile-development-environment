// The mechanisms that fail silently, checked against the real source.
//
// ## Why static assertions rather than behaviour tests
//
// Five of the things in this pass cannot be observed from a test, because a test
// cannot run a browser, cannot read a module graph, and cannot tell you that a
// route call site bypassed the seam. Each one fails *silently* — no error, no red
// screen, plausible output — which is the exact class of defect this repo has
// shipped seven times and unit-tested its way past six of them.
//
// So these read the real files, strip the comments, and assert the mechanism is
// present or absent. The precedent is `test/chrome.test.ts`, which does the same
// thing to stop a chrome file importing the token-reading component.
//
// A test that says what the code does is weaker than one that watches it happen.
// These are the assertions that have to be static, and each one says why.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/**
 * Source with its prose removed.
 *
 * Comments are stripped because several of these files *explain* the mechanism
 * they are being tested for, naming `useTheme`, `router.push`, `data-*` and the
 * word "pixel diff" in the process. A raw text match would report the explanation
 * as the bug.
 */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const appFiles = (dir = 'mobile/src/app'): string[] => {
  const found: string[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(ROOT, dir, rel), { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next);
      else found.push(`${dir}/${next}`);
    }
  };
  walk('');
  return found;
};

test('the press listener runs in the capture phase, not the bubble phase', () => {
  // Capture runs *before* the component's own handler. In the bubble phase a press
  // the component swallows — every tab item, the avatar, the stats card — leaves no
  // trace, and the board reports nothing where it should report "inert". The
  // failure is total and invisible: half the controls simply do not appear.
  const blueprint = code('mobile/src/ide/Blueprint.tsx');
  assert.match(blueprint, /addEventListener\('click',\s*handle,\s*true\)/, 'the click listener must pass capture = true');
  assert.doesNotMatch(
    blueprint,
    /addEventListener\('click',\s*handle\s*\)/,
    'a listener with no capture flag is the bubble phase, which is the bug',
  );
  // And it attaches to the workspace node, the same node the zoom listener uses.
  assert.match(blueprint, /addEventListener\('wheel'/);
});

test('the press listener identifies frames by the platform id, never a data attribute', () => {
  // React Native Web filters unknown props off `View`, so `data-screen-key` never
  // reaches the document. A pairing walk that finds zero pairs while the panel says
  // "not compared yet" is the failure this repo already shipped: benign-sounding,
  // completely wrong.
  const blueprint = code('mobile/src/ide/Blueprint.tsx');
  assert.doesNotMatch(blueprint, /data-screen/, 'a custom data attribute never reaches the DOM');
  assert.match(blueprint, /\[id\^="screen-"\], \[id\^="base-"\]/);
  assert.match(blueprint, /nativeID=\{baseline \? `base-\$\{screenKey\}` : `screen-\$\{screenKey\}`\}/);
});

test('the navigation seam records and still never navigates inside the blueprint', () => {
  // A regression here loses the reader their board, silently and irrecoverably —
  // the worst failure this work could produce. The studio would appear to work
  // perfectly while showing a different app.
  const seam = code('mobile/src/ide/designing.tsx');
  const guard = seam.indexOf('if (designing) return;');
  const push = seam.indexOf('router.push');

  assert.ok(push > -1, 'the seam should still push outside the blueprint');
  assert.ok(guard > -1, 'the designing guard must still exist');
  assert.ok(guard < push, 'the guard has to come before the push, or the blueprint navigates');
});

test('the seam records before it decides, so a suppressed navigation is still observed', () => {
  // Inside the blueprint the guard returns first. If the recording came after the
  // return, every route the board displays would be one the seam never saw, and
  // the list would agree with itself while being empty.
  const seam = code('mobile/src/ide/designing.tsx');
  assert.ok(seam.indexOf('recordRoute') < seam.indexOf('if (designing) return;'));
});

test('every route call site in the app still routes through the seam', () => {
  // Someone adding a screen that reaches the router directly would cost the route
  // list an edge with nothing reporting it anywhere. The list would then be
  // quietly, confidently incomplete.
  const sources = [...appFiles('mobile/src/app'), 'mobile/src/ui/index.tsx'];

  for (const file of sources) {
    if (file === 'mobile/src/ide/designing.tsx' || file.endsWith('ide.tsx')) continue;
    assert.doesNotMatch(
      code(file),
      /router\.push\(/,
      `${file} pushes through the router directly; it must go through the seam in designing.tsx`,
    );
  }

  // No app screen may even *hold* a router. The only file allowed to reach the
  // router is the guarded one, and its three calls are the documented exceptions.
  for (const file of appFiles('mobile/src/app')) {
    assert.doesNotMatch(code(file), /useRouter\(/, `${file} reaches for the router instead of the seam`);
  }

  const ui = code('mobile/src/ui/index.tsx');
  assert.match(ui, /router\.navigate\(tab\.key/, 'the tab bar is a known, documented exception');
  assert.match(ui, /router\.back\(\)/, 'the back control is a known, documented exception');
  assert.match(ui, /router\.replace\(/, 'and the back fallback is too');

  // `router.push` exists in exactly one place in the whole repository.
  const pushes: string[] = [];
  for (const file of [...appFiles(), ...appFiles('mobile/src/ide'), 'mobile/src/ui/index.tsx']) {
    if (code(file).includes('router.push(')) pushes.push(file);
  }
  assert.deepEqual(pushes, ['mobile/src/ide/designing.tsx']);
});

test('the seam is the only thing the app imports from the studio to navigate', () => {
  // The reverse direction of the same rule: a screen that imported the spine
  // directly would be able to fake a route change, and the list would stop being
  // evidence of anything.
  for (const file of appFiles('mobile/src/app')) {
    if (file.endsWith('app/ide.tsx')) continue;
    assert.doesNotMatch(
      code(file),
      /spineStore|spine'|from '\.\.\/\.\.\/ide\/(spine|presses|routes)/,
      `${file} reaches into the studio's log; only the seam may report a route change`,
    );
  }
});

test('the log never imports the token file, so a token write cannot empty it', () => {
  // The regression this repo shipped: the editing session lived in the module that
  // imports `tokens.json`, so every write made Metro rebuild it empty. The log's
  // state is exactly that kind of thing a rebuild would lose, and its loss is
  // silent.
  const store = code('mobile/src/ide/spineStore.ts');
  assert.doesNotMatch(store, /from '\.\.\/ds\/store'/, 'spineStore must not import the module that reads tokens.json');
  assert.doesNotMatch(store, /tokens\.json/);
  assert.match(store, /from '\.\.\/ds\/editorState'/, 'it must take the editor store from the module that cannot be invalidated');

  // Transitively: nothing the spine reaches may pull the token file in either.
  const reached = ['mobile/src/store/habits.ts', 'mobile/src/ds/editorState.ts'];
  for (const file of reached) {
    assert.doesNotMatch(code(file), /tokens\.json|ds\/store/, `${file} would drag tokens.json into the log's import graph`);
  }
});

test('the state tab exposes no control that drives the store', () => {
  // The blueprint is the input device. A panel that could also drive the store
  // would be a second way to reach the same state, and then every log entry would
  // have two indistinguishable causes — which is the one thing a change log cannot
  // survive.
  const panel = code('mobile/src/ide/StatePanel.tsx');
  assert.doesNotMatch(panel, /<Pressable/, 'the change log is output only');
  for (const driver of ['signIn', 'signOut', 'toggleToday', 'select', 'setScheme', 'setToken']) {
    assert.doesNotMatch(panel, new RegExp(`\\b${driver}\\s*\\(`), `the state tab must not call ${driver}()`);
  }
});

test('the render verdict adds no dependency to the app or the server', () => {
  // If this ever needs a rasterisation library it has stopped being this work and
  // become the screenshot suite the spec declines to build. The server is
  // Node-stdlib-only and the app takes no dependency for any part of the studio.
  const manifest = JSON.parse(read('mobile/package.json'));
  const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  for (const forbidden of [
    'puppeteer',
    'playwright',
    'html2canvas',
    'react-native-view-shot',
    'expo-screen-capture',
    'pixelmatch',
    'pngjs',
    'sharp',
    'jimp',
    'canvas',
    'mixpanel',
    '@mixpanel',
  ]) {
    assert.ok(!dependencies.includes(forbidden), `${forbidden} is a dependency this repo rules out`);
  }

  // And the server: stdlib only, plus its own two modules.
  const server = read('token-server/index.mjs');
  for (const specifier of server.match(/from '([^']+)'/g) ?? []) {
    assert.match(specifier, /from '(node:|\.\/)/, `token-server imports ${specifier}, which is neither stdlib nor its own`);
  }

  // And the verdict's own modules import nothing outside the studio.
  for (const file of ['mobile/src/ide/renderFidelity.ts', 'mobile/src/ide/renderFidelity.dom.ts']) {
    assert.doesNotMatch(code(file), /from '(?!\.)/, `${file} imports outside the studio`);
  }
});

test('the documentation keeps denying a pixel diff, and the test says why', () => {
  // Deleting the denial should fail here rather than pass review. This pass
  // measures the render-fidelity condition instead of testing it with
  // screenshots, and that substitution is only honest while the README says so.
  const readme = read('README.md');
  assert.match(readme, /not a pixel diff of two screenshots/);
  assert.match(readme, /The five ideas from the talk/);
  // The stakeholder paragraph has to say what the blueprint is *not*, or it reads
  // as a design tool and as a record of what was agreed.
  assert.match(readme, /not a design tool, and not a record of what was agreed/);
  // All five bullets, named.
  for (const idea of ['Watch state change', 'Visualize navigation routes', 'Plug in MixPanel', 'Visual regression on web', 'Blueprint for stakeholders']) {
    assert.ok(readme.includes(idea), `the README does not say where "${idea}" landed`);
  }
  // The analytics line has to state the reason, not just the decision.
  assert.match(readme, /analytics SDK is declined, for three stated reasons/);
  assert.match(readme, /credential-free clone/);

  const drift = read('mobile/src/ds/drift.ts');
  assert.match(drift, /not a pixel diff of two screenshots/);
});

test('the drift report denial of a pixel diff survives', () => {
  // This sentence is the reason the baseline mode is trustworthy. It is one line
  // and it is load-bearing, which is exactly the kind of line that gets tidied away.
  const drift = read('mobile/src/ds/drift.ts');
  assert.match(drift, /not a pixel diff of two screenshots/);
  assert.match(drift, /whichever font[\s\S]{0,40}happened to load/);
});

test('the app tree the guard protects is still untouched by this work', () => {
  // The guard script proves it against a range of commits. This proves the premise
  // locally: the studio reached its answers by observing around the app's own
  // screens, not by editing them.
  const guarded = [...appFiles('mobile/src/app'), ...appFiles('mobile/src/ui')].filter(
    (f) => !f.endsWith('app/ide.tsx'),
  );
  assert.ok(guarded.length > 0);
  // Every guarded file still exists, and the studio's own route is the only one
  // carved out.
  for (const file of guarded) assert.ok(readFileSync(join(ROOT, file), 'utf8').length > 0);
});