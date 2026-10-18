import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  presentScale,
  presentKeyboardDecision,
  presentTransform,
  stepDeclaredScreen,
  nearestScreenToPoint,
  declaredPosition,
  FRAME_HEIGHT,
  SCALE_MIN,
  SCALE_MAX,
} from '../mobile/src/ide/presentMode.ts';

const KEYS = ['login', 'index', 'habits', 'habit', 'stats', 'profile', 'settings'];

test('presentScale fits the frame to viewport height over 820', () => {
  assert.equal(presentScale(820), 1);
  assert.equal(presentScale(410), 0.5);
  assert.equal(presentScale(1230), 1.5);
  assert.equal(presentScale(2400), SCALE_MAX);
  assert.equal(presentScale(100), SCALE_MIN);
  assert.equal(presentScale(0), SCALE_MIN);
  assert.equal(presentScale(FRAME_HEIGHT), 1);
});

test('presentTransform centers the presented app surface in the viewport', () => {
  const t = presentTransform(100, 200, 390, FRAME_HEIGHT, 1200, 900, 1);
  assert.equal(t.k, 1);
  assert.equal(t.x, 1200 / 2 - (100 + 390 / 2) * 1);
  assert.equal(t.y, 900 / 2 - (200 + FRAME_HEIGHT / 2) * 1);
  const halved = presentTransform(0, 0, 390, FRAME_HEIGHT, 780, 410, 0.5);
  assert.equal(halved.k, 0.5);
  assert.equal(halved.x, 780 / 2 - 195 * 0.5);
  assert.equal(halved.y, 410 / 2 - 410 * 0.5);
});

test('stepDeclaredScreen follows declared order and clamps at the ends', () => {
  assert.equal(stepDeclaredScreen(KEYS, 'index', 1), 'habits');
  assert.equal(stepDeclaredScreen(KEYS, 'index', -1), 'login');
  assert.equal(stepDeclaredScreen(KEYS, 'login', -1), 'login');
  assert.equal(stepDeclaredScreen(KEYS, 'settings', 1), 'settings');
  assert.equal(stepDeclaredScreen(KEYS, 'missing', 1), null);
});

test('nearestScreenToPoint picks the frame nearest the camera center', () => {
  const centers = { login: { x: 0, y: 0 }, index: { x: 100, y: 0 }, habits: { x: 200, y: 100 } };
  assert.equal(nearestScreenToPoint(centers, ['login', 'index', 'habits'], { x: 195, y: 95 }), 'habits');
  assert.equal(nearestScreenToPoint({}, ['login'], { x: 0, y: 0 }), null);
});

test('declaredPosition reports the 1-based declared slot', () => {
  assert.deepEqual(declaredPosition(KEYS, 'index'), { current: 2, total: 7 });
  assert.deepEqual(declaredPosition(KEYS, 'missing'), { current: 0, total: 7 });
});

test('presentKeyboardDecision enters with P only outside Present', () => {
  const base = { targetEditable: false, targetControl: false };
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'p', presenting: false }), { action: 'enter' });
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'P', presenting: false }), { action: 'enter' });
  assert.equal(presentKeyboardDecision({ ...base, key: 'ArrowRight', presenting: false }), null);
  assert.equal(presentKeyboardDecision({ ...base, key: 'Escape', presenting: false }), null);
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'p', presenting: true }), { action: 'exit' });
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'P', presenting: true }), { action: 'exit' });
});

test('presentKeyboardDecision steps, toggles scheme, and exits while presenting', () => {
  const base = { targetEditable: false, targetControl: false, presenting: true };
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'ArrowLeft' }), { action: 'step', delta: -1 });
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'ArrowRight' }), { action: 'step', delta: 1 });
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'l' }), { action: 'toggleScheme' });
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'L' }), { action: 'toggleScheme' });
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'Escape' }), { action: 'exit' });
  assert.deepEqual(presentKeyboardDecision({ ...base, key: 'p' }), { action: 'exit' });
});

test('global shortcuts stay quiet while editing text or another control holds focus', () => {
  const editing = { targetEditable: true, targetControl: false, presenting: true };
  assert.equal(presentKeyboardDecision({ ...editing, key: 'ArrowRight' }), null);
  assert.equal(presentKeyboardDecision({ ...editing, key: 'Escape' }), null);
  const control = { targetEditable: false, targetControl: true, presenting: true };
  assert.equal(presentKeyboardDecision({ ...control, key: 'ArrowRight' }), null);
  assert.equal(presentKeyboardDecision({ ...control, key: 'Escape' }), null);
  assert.equal(presentKeyboardDecision({ ...control, key: 'l' }), null);
  const entering = { targetEditable: true, targetControl: false, presenting: false };
  assert.equal(presentKeyboardDecision({ ...entering, key: 'p' }), null);
  const focusedButton = { targetEditable: false, targetControl: true, presenting: false };
  assert.equal(presentKeyboardDecision({ ...focusedButton, key: 'p' }), null);
});
