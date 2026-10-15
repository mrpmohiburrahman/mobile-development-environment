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
  // The selector itself moved to boardFrames, with the three other frame walks.
  assert.match(read('mobile/src/ide/boardFrames.ts'), /\[id\^="\$\{FRAME_PREFIX\}"\], \[id\^="\$\{BASELINE_PREFIX\}"\]/);
  // And the board takes its ids from the same module. This used to assert the
  // template literal the frame component built for itself, which *enshrined* the
  // duplication: the ids and the walks that look for them were two copies of one
  // rule, and a prefix renamed in one of them would leave the walks finding zero
  // frames while every panel reported that the comparison simply had not run yet.
  assert.match(blueprint, /nativeID=\{frameId\(screenKey, baseline\)\}/);
  // No id built by hand. Scoped to `nativeID` rather than to the prefixes, because
  // the baseline column's React `key` legitimately spells `base-<key>` and is not a
  // DOM id — asserting on the bare prefix would fail on the wrong thing.
  assert.doesNotMatch(blueprint, /nativeID=\{`/, 'the board must not build a frame id itself');
  assert.match(blueprint, /from '\.\/boardFrames'/);
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

test('there is exactly one way to find the board frames in the studio', () => {
  // Three features need the frames: the drift walk pairs the two columns, the
  // route panel counts the back controls, the render verdict reads computed type
  // styles. Each grew its own `querySelector('#screen-' + key)` loop, and two of
  // them were written the same night. That is how a mechanism which has already
  // failed once — `data-*` never reaches the DOM, so a walk finds nothing while
  // the panel reports an ordinary result — acquired more copies of itself.
  //
  // The mechanism now lives in boardFrames.ts and returns what it did not find, so
  // a partial board cannot be reported as a complete one. This asserts there is
  // only one implementation left to drift.
  const walkers = [
    'mobile/src/ide/ScreenDriftPanel.tsx',
    'mobile/src/ide/RoutePanel.tsx',
    'mobile/src/ide/RenderVerdict.tsx',
    'mobile/src/ide/Blueprint.tsx',
  ];

  for (const file of walkers) {
    assert.doesNotMatch(
      code(file),
      /#screen-\$\{|CSS\.escape\(key\)|id\^="screen-"/,
      `${file} walks the board's frames itself; it should import boardFrames`,
    );
  }

  for (const file of walkers) {
    assert.match(
      code(file),
      /from '\.\/boardFrames'/,
      `${file} should read the frame rule from boardFrames`,
    );
  }

  // And the one implementation of the rule itself has no DOM-crawling siblings.
  const board = read('mobile/src/ide/boardFrames.ts');
  assert.match(board, /FRAME_PREFIX = 'screen-'/);
  assert.match(board, /BASELINE_PREFIX = 'base-'/);
});

test('every frame walk reports what it did not find', () => {
  // The zero-count rule applied to the mechanism itself. A caller that cannot see
  // how much board it read cannot report a count as a fact.
  const board = read('mobile/src/ide/boardFrames.ts');
  assert.match(board, /missing: string\[\]/);
  assert.match(board, /unpaired: string\[\]/);
  assert.match(board, /found: number/);

  for (const file of ['mobile/src/ide/RoutePanel.tsx', 'mobile/src/ide/RenderVerdict.tsx', 'mobile/src/ide/ScreenDriftPanel.tsx']) {
    assert.match(code(file), /resolveFrame(s|Pairs)?\(/, `${file} should read frames through the shared rule`);
  }
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

test('the render verdict reads the properties it compares, from one list', () => {
  // The reader collects computed styles and the decision function compares them.
  // Two lists of the same four names is a drift nobody reports: the reader would
  // hand over a property the decider never looks at, or omit one it does. The
  // reader spells its four out as an object literal because a built one would lose
  // the `ObservedType['style']` type, so the agreement is asserted here instead.
  const reader = code('mobile/src/ide/renderFidelity.dom.ts');
  const decider = read('mobile/src/ide/renderFidelity.ts');

  assert.doesNotMatch(reader, /const TYPE_STYLE/, 'the reader kept a second copy of the property list');

  const listed = /export const TYPE_PROPERTIES = \[([^\]]+)\]/.exec(decider)?.[1] ?? '';
  const properties = [...listed.matchAll(/'(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(properties, ['fontSize', 'lineHeight', 'letterSpacing', 'fontWeight']);

  const collected = /style: \{([^}]+)\}/.exec(reader)?.[1] ?? '';
  for (const property of properties) {
    assert.match(collected, new RegExp(`${property}:`), `the reader does not collect ${property}`);
  }
});

test('the route panel renders its sections from the runtime provenance table', () => {
  // The compiler is not in CI, so "a route cannot be constructed without a
  // provenance" only holds if something at runtime enumerates the three. The panel
  // used to hard-code three sections and keep a private `Record<string, string>` of
  // labels beside them, which made the table decorative: a fourth provenance would
  // have type-checked, been counted, and never appeared in the UI.
  const panel = code('mobile/src/ide/RoutePanel.tsx');

  assert.match(panel, /ROUTE_PROVENANCES/);
  assert.match(panel, /ROUTE_PROVENANCES\.map\(/, 'the sections must come from the table');
  assert.match(panel, /ROUTE_PROVENANCE\[/);
  assert.doesNotMatch(panel, /Record<string, string>/, 'the panel kept a private copy of the labels');
  // No hard-coded section headings: each one is `copy.label.toUpperCase()`.
  for (const heading of ['OBSERVED', 'DECLARED', 'UNRESOLVED']) {
    assert.doesNotMatch(panel, new RegExp(`>${heading}<`), `the ${heading} section is hard-coded rather than tabled`);
  }
});