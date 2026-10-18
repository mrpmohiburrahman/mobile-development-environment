import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeControls } from '../mobile/src/ide/controlInventory.ts';
import { readControlInventory } from '../mobile/src/ide/controlInventory.dom.ts';

test('a missing DOM host produces an unread inventory instead of a complete zero', () => {
  const snapshot = readControlInventory(null, ['login', 'index'], 'current');
  assert.deepEqual(snapshot, { controls: [], framesRead: 0, framesExpected: 2 });
});

const tabs = ['Today', 'Habits', 'Stats', 'Profile'];
const control = (id: string, frame: string, label: string, context = '') => ({ id, frame, label, context, siblings: [] });

test('only rendered back controls and declared empty handlers add to the inert inventory', () => {
  const controls = [
    control('settings:back', 'settings', '‹Back'),
    ...['Dark mode follows system', 'Daily nudge', 'Weekly summary', 'Streak at risk'].map((context) =>
      control(context, 'settings', '', context)),
    control('light', 'settings', 'light'),
    control('dark', 'settings', 'dark'),
  ];
  const initial = summarizeControls({ framesRead: 2, framesExpected: 2, controls }, []);
  assert.equal(initial.declaredInert, 5);
  assert.equal(initial.unknown, 2);
  const selected = summarizeControls({ framesRead: 2, framesExpected: 2, controls: [
    ...controls, control('habit:back', 'habit', '‹ Back'), control('habit:toggle', 'habit', 'Done today'),
  ] }, []);
  assert.equal(selected.detected, 9);
  assert.equal(selected.declaredInert, 6);
  assert.equal(selected.unknown, 3);
});
const tabControls = tabs.map((label, i) => ({ id: `index:${i}`, frame: 'index', label, context: '', siblings: tabs }));

test('the initial inventory labels declared inert controls without recording a press', () => {
  const report = summarizeControls({
    framesRead: 1,
    framesExpected: 1,
    controls: [...tabControls, { id: 'index:4', frame: 'index', label: 'MR', context: '', siblings: [] }],
  }, ['index']);
  assert.equal(report.detected, 5);
  assert.equal(report.declaredInert, 4);
  assert.equal(report.unknown, 1);
  assert.match(report.label, /4 of 5 detected controls declared inert in the studio/);
  assert.match(report.detail, /1 unknown/);
  assert.match(report.detail, /not observed behavior/);
});

test('board navigation removes tab and Back controls from the inert declarations', () => {
  const snapshot = { framesRead: 2, framesExpected: 2, controls: [
    ...tabControls,
    control('settings:back', 'settings', '‹Back'),
    control('settings:empty', 'settings', '', 'Daily nudge'),
  ] };
  const live = summarizeControls(snapshot, ['index'], true);
  assert.equal(live.declaredInert, 1);
  assert.equal(live.unknown, 5);
  const comparison = summarizeControls(snapshot, ['index'], false);
  assert.equal(comparison.declaredInert, 6);
});

test('duplicate sightings do not turn a control inventory into a press tally', () => {
  const report = summarizeControls({ framesRead: 1, framesExpected: 1, controls: [
    ...tabControls, ...tabControls,
  ] }, ['index']);
  assert.equal(report.detected, 4);
  assert.equal(report.declaredInert, 4);
});

test('labels without their declared frame and tab group remain unknown', () => {
  const controls = [
    control('fake-tab', 'index', 'Today'),
    { ...control('new-screen', 'new-screen', 'Today'), siblings: tabs },
    control('new-toggle', 'settings', '', 'New reminder'),
    control('fake-back', 'new-screen', '‹Back'),
    control('real-action', 'index', 'MR'),
  ];
  const report = summarizeControls({ framesRead: 3, framesExpected: 3, controls }, ['index']);
  assert.equal(report.detected, 5);
  assert.equal(report.declaredInert, 0);
  assert.equal(report.unknown, 5);
});

test('an unread or partial board never presents a complete zero inventory', () => {
  const unread = summarizeControls({ framesRead: 0, framesExpected: 7, controls: [] }, []);
  assert.equal(unread.label, 'control inventory: not measured');
  assert.equal(unread.tone, 'degraded');
  const empty = summarizeControls({ framesRead: 7, framesExpected: 7, controls: [] }, []);
  assert.equal(empty.label, 'control inventory: no controls detected');
  assert.match(empty.detail, /does not prove/);
  const partial = summarizeControls({ framesRead: 1, framesExpected: 7, controls: tabControls }, ['index']);
  assert.match(partial.label, /partial/);
  assert.match(partial.detail, /1 of 7 frames/);
  assert.equal(partial.declaredInert, 4);
  assert.equal(partial.tone, 'degraded');
});
