// The badge's reactivity, against real sockets.
//
// The mapping from flag to label is a pure function and trivially testable. The
// part that actually rots is subtler: `reachable` is a module-level `let`, so a
// component that reads it without subscribing renders once, correctly, and then
// goes stale — the badge would sit on "not checked yet" after an edit had already
// proved where it goes. These tests drive real requests so that failure mode
// cannot be reintroduced silently.
//
// The token server is never involved: `client.ts` reads its address from
// `EXPO_PUBLIC_TOKEN_SERVER` at module scope, so each scenario points that at a
// stub (or at a port that refuses) before importing. Pointing it at the real
// localhost:3001 here would let a "successful" push rewrite `tokens.json`.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/** A fresh module instance per scenario: `reachable` is module state. */
const fresh = (scenario: string) => import(`../mobile/src/ds/client.ts?${scenario}`);

/** Port 1 is reserved and refuses, so the fetch throws without a listener. */
const DEAD = 'http://127.0.0.1:1';

let server: Server;
let live: string;

before(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  live = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server?.close();
});

test('a fresh load reports not-yet-tried, not a working server', async () => {
  // The state the deployed static build ships in. If this ever became `false`
  // the badge would open by claiming writes are broken on a build that has not
  // attempted one.
  process.env.EXPO_PUBLIC_TOKEN_SERVER = live;
  const { serverIsReachable } = await fresh('pristine');
  assert.equal(serverIsReachable(), null);
});

test('a refused connection moves the flag to false and wakes subscribers', async () => {
  process.env.EXPO_PUBLIC_TOKEN_SERVER = DEAD;
  const { serverIsReachable, subscribeServerStatus, pushToken } = await fresh('refused');

  const seen: Array<boolean | null> = [];
  const unsubscribe = subscribeServerStatus(() => seen.push(serverIsReachable()));

  const ok = await pushToken('color.light.accent', '#FF0000');

  assert.equal(ok, false, 'a refused connection is not a successful push');
  assert.equal(serverIsReachable(), false);
  // The reactivity assertion: a subscriber is told, so the badge can repaint.
  assert.deepEqual(seen, [false]);

  unsubscribe();
});

test('an answered push moves the flag to true and wakes subscribers', async () => {
  process.env.EXPO_PUBLIC_TOKEN_SERVER = live;
  const { serverIsReachable, subscribeServerStatus, pushToken } = await fresh('answered');

  const seen: Array<boolean | null> = [];
  const unsubscribe = subscribeServerStatus(() => seen.push(serverIsReachable()));

  const ok = await pushToken('color.light.accent', '#FF0000');

  assert.equal(ok, true);
  assert.equal(serverIsReachable(), true);
  assert.deepEqual(seen, [true]);

  unsubscribe();
});

test('unsubscribing stops the notifications', async () => {
  // A badge that keeps a listener after unmount would re-render a dead component
  // for the rest of the session.
  process.env.EXPO_PUBLIC_TOKEN_SERVER = live;
  const { serverIsReachable, subscribeServerStatus, pushToken } = await fresh('unsub');

  let calls = 0;
  const unsubscribe = subscribeServerStatus(() => calls++);

  await pushToken('color.light.accent', '#FF0000');
  assert.equal(calls, 1);

  unsubscribe();
  await pushToken('color.light.accent', '#00FF00');
  assert.equal(calls, 1, 'an unsubscribed listener was still notified');
  // The flag itself still tracks reality — only the notification stopped.
  assert.equal(serverIsReachable(), true);
});

test('revert reports reachability too, so a server that dies on revert is caught', async () => {
  // The badge reads one flag for both paths. If only pushToken wrote it, a revert
  // that failed would leave the badge still claiming "writes to disk".
  process.env.EXPO_PUBLIC_TOKEN_SERVER = DEAD;
  const { serverIsReachable, subscribeServerStatus, revertTokens } = await fresh('revert-dead');

  const seen: Array<boolean | null> = [];
  const unsubscribe = subscribeServerStatus(() => seen.push(serverIsReachable()));

  assert.equal(await revertTokens(), false);
  assert.equal(serverIsReachable(), false);
  assert.deepEqual(seen, [false]);

  unsubscribe();
});

test('the snapshot is a primitive, so it is safe to compare by identity', async () => {
  // `useSyncExternalStore` compares snapshots with `Object.is` and re-reads on
  // every render. A fresh object each read would spin the component; `boolean |
  // null` cannot, because both are `Object.is`-stable.
  process.env.EXPO_PUBLIC_TOKEN_SERVER = live;
  const { serverIsReachable, pushToken } = await fresh('primitive');

  assert.equal(serverIsReachable(), null);
  assert.equal(Object.is(serverIsReachable(), serverIsReachable()), true);

  await pushToken('color.light.accent', '#FF0000');

  // `typeof null` is 'object', so the meaningful check is after a write: the
  // value is a real primitive, not a rebuilt object.
  assert.equal(typeof serverIsReachable(), 'boolean');
  assert.equal(Object.is(serverIsReachable(), serverIsReachable()), true);
});