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

test('MidpointPrototype derives tab routes, provenance, and frame ids from the shared studio modules', () => {
  const src = readFileSync(join(ROOT, 'mobile/src/ide/MidpointPrototype.tsx'), 'utf8');
  assert.match(src, /from '\.\/midpointBoard'/);
  assert.match(src, /from '\.\/routes'/);
  assert.match(src, /from '\.\/boardFrames'/);
  assert.doesNotMatch(src, /const TABS =/);
});
