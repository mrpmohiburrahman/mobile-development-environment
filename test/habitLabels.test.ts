import { test } from 'node:test';
import assert from 'node:assert/strict';
import { habitNameForPath } from '../mobile/src/ide/habitLabels.ts';

test('habit paths identify the habit by name without guessing missing indices', () => {
  const habits = [{ name: 'Morning run' }, { name: 'Read 20 pages' }, { name: 'Practice guitar' }];
  assert.equal(habitNameForPath('habits.2.done.0', habits), 'Practice guitar');
  assert.equal(habitNameForPath('habits.0', habits), 'Morning run');
  assert.equal(habitNameForPath('selectedId', habits), null);
  assert.equal(habitNameForPath('signedIn', habits), null);
  assert.equal(habitNameForPath('habitsTotal.0', habits), null);
  assert.equal(habitNameForPath('habits.9.done.0', habits), null);
});
