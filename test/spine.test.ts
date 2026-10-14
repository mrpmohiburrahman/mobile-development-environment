// The spine: one chronological stream of everything the app did.
//
// ## What is being tested
//
// The log's external behaviour. Given a sequence of inputs — a store difference,
// a route change, a press — what does the log say? Not "does it call the right
// function", and not "does it render the right class": nothing here renders.
//
// ## Why each of these is here
//
// This codebase has shipped seven defects that its unit tests could not reach,
// and six of them failed *silently* — plausible output, no error. Three printed a
// benign-looking message while being wrong. Every assertion below exists because
// one of those was invisible from here:
//
//   - **Notifications instead of differences.** A zustand `set` notifies on every
//     call, including one that writes an identical value. A log of notifications
//     fills with no-ops within a minute, which is the crying-wolf failure in its
//     purest form.
//   - **A zero that reads as a quiet app.** A sound decision function fed nothing
//     by a broken reader is a known failure here, so every view distinguishes
//     watching-with-nothing-yet, watching-with-nothing-found, and not watching,
//     and this file pins that all three render differently.
//   - **A truncated history that reads as a complete one.** Hence `dropped`.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSpine,
  spineReducer,
  describeLog,
  formatPath,
  tallyPresses,
  SPINE_CAP,
  type SpineInput,
  type SpineState,
} from '../mobile/src/ide/spine.ts';
import type { Habit } from '../mobile/src/store/habits.ts';

/** Feed a sequence and return the state after the final flush. */
function run(...inputs: SpineInput[]): SpineState {
  return inputs.reduce(spineReducer, createSpine());
}

const app = (state: Partial<{ signedIn: boolean; selectedId: string | null }> = {}) => ({
  signedIn: true,
  selectedId: null,
  habits: [] as Habit[],
  ...state,
});

test('a store difference produces one entry naming the path and both values', () => {
  const state = run(
    { kind: 'store', store: 'app', before: app({ selectedId: null }), after: app({ selectedId: 'h3' }) },
    { kind: 'flush' },
  );

  assert.equal(state.entries.length, 1);
  const entry = state.entries[0];
  assert.equal(entry.changes.length, 1);
  assert.equal(entry.changes[0].store, 'app');
  assert.deepEqual(entry.changes[0].differences, [
    { path: 'selectedId', kind: 'changed', current: 'h3', baseline: null },
  ]);
});

test('a setter that writes an identical value produces no entry at all', () => {
  // The control for the diffing requirement. `login.tsx` signs in while already
  // signed in; if this produced a row, the log records notifications.
  const state = run(
    { kind: 'store', store: 'app', before: app(), after: app() },
    { kind: 'flush' },
  );

  assert.equal(state.entries.length, 0, 'an identical write must not reach the log');
  assert.equal(state.noopWrites, 1);
});

test('a deep-equal pair of snapshots is not a change, even when the objects differ', () => {
  const before = app({ habits: [{ id: 'h1', name: 'Run', category: 'health', target: 5, done: ['2026-08-19'] }] });
  const after = app({ habits: [{ id: 'h1', name: 'Run', category: 'health', target: 5, done: ['2026-08-19'] }] });
  assert.notEqual(before.habits, after.habits, 'a fresh object each, to prove the walk is deep');

  const state = run({ kind: 'store', store: 'app', before, after }, { kind: 'flush' });
  assert.equal(state.entries.length, 0);
  assert.equal(state.noopWrites, 1);
});

test('the path names which habit moved, and reads as one a person can look up', () => {
  // `habits` is six objects holding up to seven date strings each. One toggle
  // rewrites one element of one array, and the tree either side looks equally
  // plausible, so the row has to say *which* one.
  const habit = (done: string[]): Habit => ({
    id: 'h1',
    name: 'Run',
    category: 'health',
    target: 5,
    done,
  });
  const before = app({ habits: [habit([]), habit([])] });
  const after = app({ habits: [habit(['2026-08-19']), habit([])] });

  const state = run({ kind: 'store', store: 'app', before, after }, { kind: 'flush' });
  const differences = state.entries[0].changes[0].differences;

  // The differ is the existing one, untouched, so the row shape is the drift
  // report's row shape rather than a second vocabulary.
  assert.deepEqual(differences.map((d) => d.path), ['habits.0.done.0']);
  assert.equal(differences[0].current, '2026-08-19');

  // What the panel prints. `habits.0.done.0` is machine vocabulary; a reader
  // looking in the tree above is looking for `habits[0]`.
  assert.equal(formatPath('habits.0.done.0'), 'habits[0].done[0]');
  assert.equal(formatPath('selectedId'), 'selectedId');
  assert.equal(formatPath('signedIn'), 'signedIn');
});

test('both stores feed one log in the order they arrived', () => {
  // The scheme lives on the other store and repaints the whole board, which is
  // why one store is not enough.
  const state = run(
    { kind: 'store', store: 'app', before: app({ selectedId: null }), after: app({ selectedId: 'h1' }) },
    { kind: 'flush' },
    { kind: 'store', store: 'editor', before: { scheme: 'light' }, after: { scheme: 'dark' } },
    { kind: 'flush' },
  );

  assert.deepEqual(state.entries.map((e) => e.changes[0].store), ['app', 'editor']);
  assert.deepEqual(state.seq, 2);
});

test('a route change rides on one line with the state change it shared a task with', () => {
  // Four of the seven push edges mutate state in the same synchronous task as the
  // navigation. Drawn as two rows they are two things to correlate by hand; the
  // join is the thing the original talk could not show.
  const state = run(
    { kind: 'store', store: 'app', before: app({ selectedId: null }), after: app({ selectedId: 'h2' }) },
    { kind: 'route', from: 'index', to: '/habit', column: 'current' },
    { kind: 'flush' },
  );

  assert.equal(state.entries.length, 1, 'one task must land as one line');
  const entry = state.entries[0];
  assert.deepEqual(entry.route, { from: 'index', to: '/habit', column: 'current' });
  assert.equal(entry.changes.length, 1);
  assert.equal(entry.press, null);
});

test('a route change with no state change says so, and never shows an empty field', () => {
  const state = run({ kind: 'route', from: 'index', to: '/profile', column: 'current' }, { kind: 'flush' });

  const entry = state.entries[0];
  assert.equal(entry.route?.to, '/profile');
  // The panel branches on this. An empty value would read as missing data.
  assert.equal(routeCarriedChange(entry), false);
});

test('a press that changed something is live', () => {
  const state = run(
    { kind: 'press', frame: 'index', column: 'current', label: 'Morning run', target: 'Morning run' },
    { kind: 'store', store: 'app', before: app({ selectedId: null }), after: app({ selectedId: 'h1' }) },
    { kind: 'flush' },
  );

  assert.equal(state.entries[0].press?.frame, 'index');
  assert.equal(state.entries[0].verdict, 'live');
});

test('a press that changed nothing is inert', () => {
  // Roughly half the controls on the board are in this state: the avatar, the
  // stats card, all sixteen tab taps, the back bars.
  const state = run(
    { kind: 'press', frame: 'index', column: 'current', label: 'Avatar', target: 'Avatar' },
    { kind: 'flush' },
  );

  const entry = state.entries[0];
  assert.equal(entry.verdict, 'inert');
  assert.equal(entry.route, null);
  assert.deepEqual(entry.changes, []);
});

test('a press is not credited with a route change in the other column', () => {
  // Two columns render the same screens. A press on the left that moves the
  // comparison column on the right is still not evidence about the left one, so
  // the pairing is scoped to the column the press landed in.
  const state = run(
    { kind: 'press', frame: 'index', column: 'current', label: 'Morning run', target: 'Morning run' },
    { kind: 'route', from: 'index', to: '/habit', column: 'comparison' },
    { kind: 'flush' },
  );

  assert.equal(state.entries[0].verdict, 'inert');
});

test('a second press in one task is unattributed rather than credited', () => {
  // Otherwise the live count inflates: one change, two presses, and both look
  // like they did something.
  const state = run(
    { kind: 'press', frame: 'index', column: 'current', label: 'First', target: 'First' },
    { kind: 'press', frame: 'index', column: 'current', label: 'Second', target: 'Second' },
    { kind: 'store', store: 'app', before: app({ selectedId: null }), after: app({ selectedId: 'h1' }) },
    { kind: 'flush' },
  );

  const entries = state.entries;
  assert.equal(entries.length, 2, 'two presses, two lines — the pairing does not merge them');
  assert.equal(entries[0].verdict, 'live');
  assert.equal(entries[1].verdict, 'unattributed');
});

test('two presses with nothing changed are both inert, not one unattributed', () => {
  // There is nothing to attribute, so "unattributed" would be a false claim of
  // a measurement that did not happen.
  const state = run(
    { kind: 'press', frame: 'index', column: 'current', label: 'A', target: 'A' },
    { kind: 'press', frame: 'index', column: 'current', label: 'B', target: 'B' },
    { kind: 'flush' },
  );

  assert.deepEqual(state.entries.map((e) => e.verdict), ['inert', 'inert']);
});

test('a change with no press still lands, and claims no verdict', () => {
  // The scheme repaint and the token editor's own writes reach the log this way.
  const state = run(
    { kind: 'store', store: 'editor', before: { scheme: 'light' }, after: { scheme: 'dark' } },
    { kind: 'flush' },
  );

  assert.equal(state.entries[0].press, null);
  assert.equal(state.entries[0].verdict, null);
});

test('the buffer is capped and says how much it dropped', () => {
  let state = createSpine(3);
  for (let i = 0; i < 5; i++) {
    state = spineReducer(state, {
      kind: 'store',
      store: 'app',
      before: app({ selectedId: `h${i}` }),
      after: app({ selectedId: `h${i + 1}` }),
    });
    state = spineReducer(state, { kind: 'flush' });
  }

  assert.equal(state.entries.length, 3, 'the cap holds');
  assert.equal(state.dropped, 2, 'and the overflow is reported rather than silently lost');
  assert.equal(state.seq, 5, 'the count of what happened is not the count kept');
  assert.deepEqual(state.entries.map((e) => e.changes[0].differences[0].current), ['h3', 'h4', 'h5']);
});

test('the cap is stated, not implied', () => {
  const state = createSpine();
  assert.ok(SPINE_CAP > 0);
  assert.equal(state.cap, SPINE_CAP);
  assert.equal(state.dropped, 0);
});

test('flushing an empty task records nothing and does not burn a sequence number', () => {
  const once = run({ kind: 'flush' });
  assert.equal(once.entries.length, 0);
  assert.equal(once.seq, 0);
  // A row for a click that hit nothing at all would be a fabricated observation.
  assert.equal(tallyPresses(once.entries).presses, 0);
});

test('the route tally counts events, not rows, so the list can be checked against it', () => {
  // Ticket 03: the count must not be derived from the list's own length, or a
  // list that invented a row would agree with itself.
  const twice = run(
    { kind: 'route', from: 'index', to: '/profile', column: 'current' },
    { kind: 'flush' },
    { kind: 'route', from: 'index', to: '/profile', column: 'current' },
    { kind: 'flush' },
  );
  assert.equal(twice.routeEvents, 2);
  assert.equal(twice.entries.length, 2);

  const once = run({ kind: 'route', from: 'index', to: '/profile', column: 'current' }, { kind: 'flush' });
  assert.equal(once.routeEvents, 1);
});

test('every route event is counted, including one that carries no state change', () => {
  const state = run({ kind: 'route', from: 'profile', to: '/login', column: 'current' }, { kind: 'flush' });
  assert.equal(state.routeEvents, 1);
});

test('the three empty states read differently and never collapse', () => {
  const quiet = run({ kind: 'flush' });
  const watched = run({ kind: 'store', store: 'app', before: app(), after: app() }, { kind: 'flush' });
  const busy = run(
    { kind: 'store', store: 'editor', before: { scheme: 'light' }, after: { scheme: 'dark' } },
    { kind: 'flush' },
  );

  const strings = [
    describeLog(quiet, true),
    describeLog(watched, true),
    describeLog(watched, false),
    describeLog(busy, true),
  ].map((copy) => `${copy.tone}|${copy.label}|${copy.detail}`);

  assert.equal(new Set(strings).size, strings.length, `two states rendered alike: ${strings.join(' // ')}`);
  // Not watching must never read as fine.
  assert.notEqual(describeLog(watched, false).tone, 'ok');
  assert.notEqual(describeLog(quiet, true).tone, 'ok');
});

test('a populated log does not claim to be empty', () => {
  const state = run(
    { kind: 'store', store: 'editor', before: { scheme: 'light' }, after: { scheme: 'dark' } },
    { kind: 'flush' },
  );
  assert.equal(describeLog(state, true).label, '1 change logged');
});

test('the press tally counts every verdict and never double-counts', () => {
  const state = run(
    { kind: 'press', frame: 'index', column: 'current', label: 'A', target: 'A' },
    { kind: 'store', store: 'app', before: app({ selectedId: null }), after: app({ selectedId: 'h1' }) },
    { kind: 'flush' },
    { kind: 'press', frame: 'index', column: 'current', label: 'B', target: 'B' },
    { kind: 'flush' },
    { kind: 'store', store: 'editor', before: { scheme: 'light' }, after: { scheme: 'dark' } },
    { kind: 'flush' },
  );

  const tally = tallyPresses(state.entries);
  assert.deepEqual(tally, { presses: 2, live: 1, inert: 1, unattributed: 0, uninstrumented: 0 });
  assert.equal(tally.live + tally.inert + tally.unattributed + tally.uninstrumented, tally.presses);
});

test('a press the studio could not place is counted apart from an inert press', () => {
  // A press with no event is inert. A press with no *frame* is a measurement the
  // studio failed to make, and folding the two together would report a working
  // reader on a broken one — the failure mode this whole pass exists to prevent.
  const state = run(
    { kind: 'press', frame: null, column: 'current', label: null, target: 'Something' },
    { kind: 'flush' },
  );

  const tally = tallyPresses(state.entries);
  assert.equal(tally.presses, 1);
  assert.equal(tally.uninstrumented, 1);
  assert.equal(tally.inert, 0);
  assert.equal(state.entries[0].verdict, 'unlocated');
});

/** The panel's own question: did a route change bring a state change with it? */
function routeCarriedChange(entry: SpineState['entries'][number]): boolean {
  return entry.route !== null && entry.changes.length > 0;
}