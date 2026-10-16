// The analytics sender, run through adapters so nothing native is imported.
//
// The sender is the only thing that keeps the studio silent (ADR 0003), so the
// test asks it the questions a code reader cannot settle by looking: does web
// refuse before touching storage, does a missing token stay quiet, does an
// unknown region refuse rather than guess a host, do two first events share one
// install id, and does a failing transport ever reach the caller.
//
// Run: node --experimental-strip-types --test test/analytics.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAnalytics,
  hostForRegion,
  readConfig,
  uuidFrom,
  type Adapters,
  type Outcome,
  type TrackRequest,
} from '../mobile/src/analytics/mixpanel.ts';

type Harness = {
  adapters: Adapters;
  requests: TrackRequest[];
  storage: Map<string, string>;
  storageReads: number;
};

function harness(over: Partial<Adapters> = {}): Harness {
  const storage = new Map<string, string>();
  const requests: TrackRequest[] = [];
  let uuid = 0;
  const h: Harness = {
    storage,
    requests,
    storageReads: 0,
    adapters: {
      platform: 'ios',
      config: { token: 'tok-123', region: 'us' },
      now: () => 1_760_600_000_123,
      uuid: () => `uuid-${++uuid}`,
      storage: {
        get: async (key) => {
          h.storageReads++;
          return storage.get(key) ?? null;
        },
        set: async (key, value) => {
          storage.set(key, value);
        },
      },
      send: async (req) => {
        requests.push(req);
        return { ok: true, body: '{"error":null,"status":1}' };
      },
      ...over,
    },
  };
  return h;
}

function payload(req: TrackRequest) {
  return JSON.parse(new URLSearchParams(req.body).get('data') ?? 'null');
}

test('the region map refuses an unknown region rather than defaulting to US', () => {
  assert.equal(hostForRegion('us'), 'https://api.mixpanel.com');
  assert.equal(hostForRegion('eu'), 'https://api-eu.mixpanel.com');
  assert.equal(hostForRegion('in'), 'https://api-in.mixpanel.com');
  assert.equal(hostForRegion('uk'), null);
  assert.equal(hostForRegion(''), null);
  assert.equal(hostForRegion(undefined), null);
});

test('readConfig treats absent, empty and whitespace tokens as not configured', () => {
  assert.equal(readConfig({}), null);
  assert.equal(readConfig({ EXPO_PUBLIC_MIXPANEL_TOKEN: '' }), null);
  assert.equal(readConfig({ EXPO_PUBLIC_MIXPANEL_TOKEN: '   ', EXPO_PUBLIC_MIXPANEL_REGION: 'us' }), null);
  assert.deepEqual(readConfig({ EXPO_PUBLIC_MIXPANEL_TOKEN: ' abc ', EXPO_PUBLIC_MIXPANEL_REGION: ' EU ' }), {
    token: 'abc',
    region: 'eu',
  });
  assert.deepEqual(readConfig({ EXPO_PUBLIC_MIXPANEL_TOKEN: 'abc' }), { token: 'abc', region: 'us' });
});

test('web refuses before identity or transport, with or without configuration', async () => {
  for (const config of [{ token: 'tok-123', region: 'us' }, null]) {
    const h = harness({ platform: 'web', config });
    const outcome = await createAnalytics(h.adapters).track('Habit Toggled', { habit_id: 'h1', done: true });
    assert.equal(outcome.kind, 'refused');
    assert.equal(outcome.kind === 'refused' && outcome.reason, 'web');
    assert.equal(h.requests.length, 0);
    assert.equal(h.storageReads, 0, 'the identity must not be initialised for a refused platform');
    assert.equal(h.storage.size, 0);
  }
});

test('a missing token reports not configured and sends nothing', async () => {
  const h = harness({ config: null });
  const outcome = await createAnalytics(h.adapters).track('Signed Out');
  assert.deepEqual(outcome, { kind: 'refused', reason: 'not-configured' });
  assert.equal(h.requests.length, 0);
});

test('an unknown region reports itself and sends nothing', async () => {
  const h = harness({ config: { token: 'tok-123', region: 'mars' } });
  const outcome = await createAnalytics(h.adapters).track('Signed Out');
  assert.deepEqual(outcome, { kind: 'refused', reason: 'unknown-region' });
  assert.equal(h.requests.length, 0);
});

test('a device showing the studio sends nothing, and resumes when the studio closes', async () => {
  let studio = false;
  const h = harness({ onStudioRoute: () => studio });
  const analytics = createAnalytics(h.adapters);
  studio = true;
  assert.deepEqual(await analytics.track('Habit Toggled', { habit_id: 'h1', done: true }), {
    kind: 'refused',
    reason: 'studio-route',
  });
  assert.equal(h.storageReads, 0, 'refusal happens before identity');
  studio = false;
  assert.deepEqual(await analytics.track('Habit Toggled', { habit_id: 'h1', done: true }), { kind: 'accepted' });
  assert.equal(h.requests.length, 1);
});

test('the request goes to the regional host as a form-encoded /track call', async () => {
  const h = harness({ config: { token: 'tok-123', region: 'eu' } });
  await createAnalytics(h.adapters).track('Signed Out');
  const [req] = h.requests;
  assert.equal(req.url, 'https://api-eu.mixpanel.com/track?verbose=1&ip=0');
  assert.equal(req.contentType, 'application/x-www-form-urlencoded');
  assert.match(req.body, /^data=/);
});

test('each event carries the install identity, a fresh insert id and the capture time', async () => {
  const h = harness();
  const analytics = createAnalytics(h.adapters);
  await analytics.track('Habit Toggled', { habit_id: 'h1', done: true });
  await analytics.track('Habit Toggled', { habit_id: 'h1', done: false });
  const [first, second] = h.requests.map(payload);

  assert.equal(first.length, 1);
  assert.deepEqual(first[0], {
    event: 'Habit Toggled',
    properties: {
      token: 'tok-123',
      $device_id: 'uuid-1',
      distinct_id: '$device:uuid-1',
      $insert_id: 'uuid-2',
      time: 1_760_600_000,
      habit_id: 'h1',
      done: true,
    },
  });
  assert.equal(second[0].properties.$device_id, 'uuid-1', 'the install id is stable');
  assert.equal(second[0].properties.$insert_id, 'uuid-3', 'the insert id is fresh');
  assert.equal(second[0].properties.done, false);
});

test('the install id persists through storage and survives a relaunch', async () => {
  const h = harness();
  await createAnalytics(h.adapters).track('Signed Out');
  assert.deepEqual([...h.storage.entries()], [['mixpanel.install_id', 'uuid-1']]);

  // A second sender over the same storage is a relaunch. It must reuse the id and
  // must not mint a new one.
  await createAnalytics(h.adapters).track('Signed Out');
  assert.equal(payload(h.requests[1])[0].properties.$device_id, 'uuid-1');
  assert.equal(h.storage.get('mixpanel.install_id'), 'uuid-1');
});

test('concurrent first events share one identity', async () => {
  const h = harness();
  const analytics = createAnalytics(h.adapters);
  await Promise.all([
    analytics.track('Habit Toggled', { habit_id: 'h1', done: true }),
    analytics.track('Habit Toggled', { habit_id: 'h2', done: true }),
    analytics.track('Signed Out'),
  ]);
  const ids = new Set(h.requests.map((r) => payload(r)[0].properties.$device_id));
  assert.deepEqual([...ids], ['uuid-1']);
  assert.equal(h.storage.get('mixpanel.install_id'), 'uuid-1');
  assert.equal(h.storageReads, 1, 'three first events must share one storage read');
});

test('an accepted response is reported as accepted, never as ingested', async () => {
  const h = harness();
  const outcome = await createAnalytics(h.adapters).track('Signed Out');
  assert.deepEqual(outcome, { kind: 'accepted' });
});

test('a rejected, malformed or failed transport is reported, not thrown', async () => {
  const cases: Array<[Adapters['send'], Outcome]> = [
    [async () => ({ ok: true, body: '{"error":"bad token","status":0}' }), { kind: 'rejected', error: 'bad token' }],
    [async () => ({ ok: true, body: 'not json' }), { kind: 'rejected', error: 'malformed response' }],
    [async () => ({ ok: false, body: '' }), { kind: 'rejected', error: 'http error' }],
    [
      async () => {
        throw new Error('offline');
      },
      { kind: 'unsent', error: 'offline' },
    ],
  ];
  for (const [send, expected] of cases) {
    const h = harness({ send });
    const outcome = await createAnalytics(h.adapters).track('Signed Out');
    assert.deepEqual(outcome, expected);
  }
});

test('a storage failure falls back to a per-launch id and still sends', async () => {
  const h = harness({
    storage: {
      get: async () => {
        throw new Error('storage down');
      },
      set: async () => {
        throw new Error('storage down');
      },
    },
  });
  const analytics = createAnalytics(h.adapters);
  await analytics.track('Signed Out');
  await analytics.track('Signed Out');
  const ids = h.requests.map((r) => payload(r)[0].properties.$device_id);
  assert.deepEqual(ids, ['uuid-1', 'uuid-1']);
});

test('a write failure after a successful read keeps the minted id for the launch', async () => {
  const h = harness({
    storage: {
      get: async () => null,
      set: async () => {
        throw new Error('disk full');
      },
    },
  });
  const analytics = createAnalytics(h.adapters);
  await analytics.track('Signed Out');
  await analytics.track('Signed Out');
  const ids = h.requests.map((r) => payload(r)[0].properties.$device_id);
  assert.deepEqual(ids, ['uuid-1', 'uuid-1']);
});

test('a uuid failure during identity is reported once and not cached', async () => {
  let calls = 0;
  const h = harness({
    uuid: () => {
      // The first throw is absorbed by the storage fallback; the second rejects
      // the identity promise itself.
      if (++calls <= 2) throw new Error('entropy');
      return `uuid-${calls}`;
    },
  });
  const analytics = createAnalytics(h.adapters);
  assert.deepEqual(await analytics.track('Signed Out'), { kind: 'unsent', error: 'entropy' });
  assert.deepEqual(await analytics.track('Signed Out'), { kind: 'accepted' });
});

test('no outcome ever carries the token', async () => {
  const token = 'tok-secret-999';
  const sends: Array<Adapters['send']> = [
    async () => ({ ok: true, body: '{"error":null,"status":1}' }),
    async () => ({ ok: true, body: `{"error":"bad ${token}","status":0}` }),
    async () => {
      throw new Error(`refused ${token}`);
    },
  ];
  for (const send of sends) {
    const h = harness({ config: { token, region: 'us' }, send });
    const outcome = await createAnalytics(h.adapters).track('Signed Out');
    // The host may echo the token back in an error; the outcome is diagnostics
    // and must not carry it onward.
    assert.doesNotMatch(JSON.stringify(outcome), new RegExp(token));
  }
});

test('the body never carries anything but the allowed properties', async () => {
  const h = harness();
  await createAnalytics(h.adapters).track('Habit Toggled', { habit_id: 'h1', done: true });
  const keys = Object.keys(payload(h.requests[0])[0].properties).sort();
  assert.deepEqual(keys, ['$device_id', '$insert_id', 'distinct_id', 'done', 'habit_id', 'time', 'token']);
});

test('track() never rejects even when the transport throws synchronously', async () => {
  const h = harness({
    send: () => {
      throw new Error('sync explosion');
    },
  });
  const outcome = await createAnalytics(h.adapters).track('Signed Out');
  assert.deepEqual(outcome, { kind: 'unsent', error: 'sync explosion' });
});

test('the fallback uuid is a well-formed v4 even from a degenerate random source', () => {
  const zero = uuidFrom(() => 0);
  assert.equal(zero, '00000000-0000-4000-8000-000000000000');
  const max = uuidFrom(() => 0.999999);
  assert.match(max, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(uuidFrom(Math.random), uuidFrom(Math.random));
});

// Static checks, in the manner of test/mechanisms.test.ts: the things a Node
// test cannot watch happen because they involve React Native modules.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test('the pure sender imports nothing from React or React Native', () => {
  const pure = source('mobile/src/analytics/mixpanel.ts');
  assert.doesNotMatch(pure, /from ['"](react|react-native|@react-native-async-storage[^'"]*)['"]/);
  assert.doesNotMatch(pure, /\bfetch\(/, 'transport is an adapter');
});

test('the app wiring passes Platform.OS through instead of deciding for itself', () => {
  const native = source('mobile/src/analytics/track.ts');
  assert.match(native, /platform:\s*Platform\.OS/);
  assert.match(native, /process\.env\.EXPO_PUBLIC_MIXPANEL_TOKEN/);
  assert.match(native, /process\.env\.EXPO_PUBLIC_MIXPANEL_REGION/);
  assert.match(native, /@react-native-async-storage\/async-storage/);
});

test('the store is the only importer of the sender, at the two action boundaries', () => {
  const store = source('mobile/src/store/habits.ts');
  assert.match(store, /track\('Signed Out'\)/);
  assert.match(store, /track\('Habit Toggled', \{ habit_id: id, done \}\)/);

  // The studio reaches the sender transitively through the store, and that is
  // fine: silence on web is the runtime `platform === 'web'` guard, not an
  // import boundary. What must not happen is a second call site growing
  // somewhere the guard's tests do not look.
  const importers = walk(join(ROOT, 'mobile/src'))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('/analytics/'))
    .filter((f) => /from ['"][^'"]*analytics\/(track|mixpanel)/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(ROOT, f));
  assert.deepEqual(importers, ['mobile/src/store/habits.ts']);
});

test('AsyncStorage is an explicit dependency pinned to the Expo SDK version', () => {
  const name = '@react-native-async-storage/async-storage';
  const manifest = JSON.parse(source('mobile/package.json'));
  const pinned = manifest.dependencies[name];
  assert.match(pinned, /^\d+\.\d+\.\d+$/, 'expo install pins an exact version');
  const lock = JSON.parse(source('mobile/package-lock.json'));
  assert.equal(lock.packages[`node_modules/${name}`]?.version, pinned, 'the lockfile must carry the same version');
  // node_modules is not present in every CI job; compare with the SDK's list only when it is.
  const bundledPath = join(ROOT, 'mobile/node_modules/expo/bundledNativeModules.json');
  if (existsSync(bundledPath)) {
    assert.equal(JSON.parse(readFileSync(bundledPath, 'utf8'))[name], pinned);
  }
});
