import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_ROUTES,
  KEYBOARD_SHIFT_STEP,
  KEYBOARD_STEP,
  bringToFront,
  buildTabConnections,
  mergeSpineRoutes,
  navigateBoardHistory,
  resolveFrameOverlap,
  stepFramePosition,
} from '../mobile/src/ide/midpointBoard.ts';
import { createSpine, spineReducer } from '../mobile/src/ide/spine.ts';
import { ALL_ROUTER_KEYS } from './helpers/routerListing.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LABELS = new Map([
  ['login', 'Login'],
  ['index', 'Today'],
  ['habits', 'All habits'],
  ['habit', 'Habit detail'],
  ['stats', 'Stats'],
  ['profile', 'Profile'],
  ['settings', 'Settings'],
]);

test('tab connections derive from routerKeys and declaredTabRoutes with no self-links', () => {
  const tabs = buildTabConnections(ALL_ROUTER_KEYS, LABELS);
  assert.equal(tabs.length, 12);
  for (const conn of tabs) {
    assert.equal(conn.kind, 'tab');
    assert.notEqual(conn.from, conn.to);
    assert.match(conn.action, /^Tab: /);
  }
});

test('mergeSpineRoutes marks spine-observed routes and adds newly discovered routes', () => {
  let state = createSpine();
  state = spineReducer(state, { kind: 'route', from: 'index', to: '/habit', column: 'current' });
  state = spineReducer(state, { kind: 'route', from: 'settings', to: '/', column: 'current' });
  state = spineReducer(state, { kind: 'flush' });

  const merged = mergeSpineRoutes(APP_ROUTES, state.entries, ALL_ROUTER_KEYS, LABELS);
  assert.ok(merged.spineObserved.has('index:habit'));
  assert.ok(merged.spineObserved.has('settings:index'));
  assert.ok(merged.routes.some((r) => r.from === 'settings' && r.to === 'index'));
});

test('Back has no destination without an incoming board journey', () => {
  const history = {};
  assert.deepEqual(navigateBoardHistory(history, 'habit', null), { history, to: null });
});

test('Back follows each destination latest incoming path', () => {
  const first = navigateBoardHistory({}, 'index', 'habit');
  assert.equal(navigateBoardHistory(first.history, 'habit', null).to, 'index');
  const latest = navigateBoardHistory(first.history, 'habits', 'habit');
  const back = navigateBoardHistory(latest.history, 'habit', null);
  assert.equal(back.to, 'habits');
  assert.equal(navigateBoardHistory(back.history, 'habits', null).to, null);
  assert.equal(navigateBoardHistory(first.history, 'habit', null).to, 'index');
});

test('Back traverses multiple steps without browser history', () => {
  const profile = navigateBoardHistory({}, 'index', 'profile');
  const settings = navigateBoardHistory(profile.history, 'profile', 'settings');
  const back = navigateBoardHistory(settings.history, 'settings', null);
  assert.equal(back.to, 'profile');
  const home = navigateBoardHistory(back.history, 'profile', null);
  assert.equal(home.to, 'index');
  assert.equal(navigateBoardHistory(home.history, 'index', null).to, null);
});

test('preview history does not supply a live Back destination', () => {
  const live = {};
  const preview = navigateBoardHistory({}, 'index', 'habit');
  assert.equal(navigateBoardHistory(preview.history, 'habit', null).to, 'index');
  assert.equal(navigateBoardHistory(live, 'habit', null).to, null);
});

test('the current board excludes comparison routes and unknown screen destinations', () => {
  let state = createSpine();
  for (const route of [
    { from: 'profile', to: '/settings', column: 'comparison' as const },
    { from: 'index', to: '/missing', column: 'current' as const },
    { from: 'missing', to: '/habit', column: 'current' as const },
  ]) {
    state = spineReducer(state, { kind: 'route', ...route });
    state = spineReducer(state, { kind: 'flush' });
  }
  const merged = mergeSpineRoutes(APP_ROUTES, state.entries, ALL_ROUTER_KEYS, LABELS);
  assert.deepEqual(merged.routes, APP_ROUTES);
  assert.equal(merged.spineObserved.size, 0);
});

test('a session boundary excludes earlier evidence without deleting the state log', () => {
  let state = createSpine();
  state = spineReducer(state, { kind: 'route', from: 'index', to: '/habit', column: 'current' });
  state = spineReducer(state, { kind: 'flush' });
  const boundary = state.seq;
  state = spineReducer(state, { kind: 'route', from: 'profile', to: '/settings', column: 'current' });
  state = spineReducer(state, { kind: 'flush' });
  const merged = mergeSpineRoutes(APP_ROUTES, state.entries, ALL_ROUTER_KEYS, LABELS, boundary);
  assert.deepEqual([...merged.spineObserved], ['profile:settings']);
  assert.equal(state.entries.length, 2);
});

test('bringToFront moves the interacted frame to the top of the z-order without duplicating keys', () => {
  const initial = ['login', 'index', 'habits', 'habit'];
  assert.deepEqual(bringToFront(initial, 'index'), ['login', 'habits', 'habit', 'index']);
  assert.deepEqual(bringToFront(['login', 'index'], 'index'), ['login', 'index']);
});

test('resolveFrameOverlap nudges a dropped frame when its header collides with another frame header', () => {
  const keys = ['login', 'index', 'habits'];
  const leftOf = (key: string) => 72 + keys.indexOf(key) * (390 + 196);
  const rowY = 228;

  const nonColliding = resolveFrameOverlap('habit', { x: 100, y: -120 }, {}, keys, leftOf, rowY);
  assert.deepEqual(nonColliding, { x: 100, y: -120 });

  const deltaToIndex = leftOf('index') - leftOf('login');
  const colliding = resolveFrameOverlap('login', { x: deltaToIndex, y: 0 }, {}, keys, leftOf, rowY);
  assert.equal(colliding.x, deltaToIndex);
  assert.equal(colliding.y, 56);
});

test('stepFramePosition moves by 16px, 48px with Shift, and resets on Home', () => {
  assert.deepEqual(stepFramePosition({ x: 10, y: 20 }, 'ArrowRight', false), { x: 10 + KEYBOARD_STEP, y: 20 });
  assert.deepEqual(stepFramePosition({ x: 10, y: 20 }, 'ArrowLeft', true), { x: 10 - KEYBOARD_SHIFT_STEP, y: 20 });
  assert.deepEqual(stepFramePosition({ x: 10, y: 20 }, 'ArrowUp', false), { x: 10, y: 20 - KEYBOARD_STEP });
  assert.deepEqual(stepFramePosition({ x: 10, y: 20 }, 'ArrowDown', true), { x: 10, y: 20 + KEYBOARD_SHIFT_STEP });
  assert.deepEqual(stepFramePosition({ x: 10, y: 20 }, 'Home', false), { x: 0, y: 0 });
  assert.equal(stepFramePosition({ x: 10, y: 20 }, 'a', false), null);
});

test('the normal studio renders the board without a development gate', () => {
  const route = readFileSync(join(ROOT, 'mobile/src/app/ide.tsx'), 'utf8');
  const blueprint = readFileSync(join(ROOT, 'mobile/src/ide/Blueprint.tsx'), 'utf8');
  assert.doesNotMatch(route, /__DEV__|params\.prototype/);
  assert.match(route, /<Blueprint comparing=\{comparing\} focus=\{focus\}/);
  assert.match(blueprint, /<StudioBoard/);
  assert.match(blueprint, /const baseline = comparing \? tree : null/);
});

test('the board derives tab routes, provenance, and frame ids from shared studio modules', () => {
  const src = readFileSync(join(ROOT, 'mobile/src/ide/MidpointPrototype.tsx'), 'utf8');
  assert.match(src, /from '\.\/midpointBoard'/);
  assert.match(src, /from '\.\/routes'/);
  assert.match(src, /from '\.\/boardFrames'/);
  assert.doesNotMatch(src, /const TABS =/);
});
