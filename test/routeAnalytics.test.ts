// Route observation for analytics, pure. The hook in useAnalytics.ts feeds
// pathnames in; this decides which events leave.
//
// Run: node --experimental-strip-types --test test/routeAnalytics.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRouteObserver, normalizePathname } from '../mobile/src/analytics/routes.ts';
import type { EventName, EventProperties } from '../mobile/src/analytics/mixpanel.ts';

type Sent = [EventName, EventProperties | undefined];

function recorder() {
  const sent: Sent[] = [];
  return { sent, track: (event: EventName, properties?: EventProperties) => void sent.push([event, properties]) };
}

test('normalizePathname strips query, hash, trailing slashes and repeated slashes', () => {
  assert.equal(normalizePathname('/'), '/');
  assert.equal(normalizePathname(''), '/');
  assert.equal(normalizePathname('/habits/'), '/habits');
  assert.equal(normalizePathname('//habits//'), '/habits');
  assert.equal(normalizePathname('/habit?id=h1'), '/habit');
  assert.equal(normalizePathname('/habit#top'), '/habit');
  assert.equal(normalizePathname('habits'), '/habits');
  assert.equal(normalizePathname('/Habits'), '/habits');
});

test('the first pathname sends App Opened then Screen Viewed', () => {
  const r = recorder();
  createRouteObserver({ track: r.track, platform: 'ios' }).onPathname('/');
  assert.deepEqual(r.sent, [
    ['App Opened', { platform: 'ios' }],
    ['Screen Viewed', { screen: '/' }],
  ]);
});

test('route changes send one Screen Viewed each; repeats of the same route send nothing', () => {
  const r = recorder();
  const observer = createRouteObserver({ track: r.track, platform: 'ios' });
  observer.onPathname('/');
  observer.onPathname('/');
  observer.onPathname('/habits');
  observer.onPathname('/habits/');
  observer.onPathname('/habit');
  observer.onPathname('/habits');
  observer.onPathname('/login');
  observer.onPathname('/');
  assert.deepEqual(
    r.sent.map(([e, p]) => (e === 'Screen Viewed' ? p?.screen : e)),
    ['App Opened', '/', '/habits', '/habit', '/habits', '/login', '/'],
  );
});

test('App Opened is sent once per observer no matter how often the hook mounts', () => {
  const r = recorder();
  const observer = createRouteObserver({ track: r.track, platform: 'android' });
  observer.onPathname('/');
  observer.onPathname('/');
  observer.onPathname('/stats');
  assert.equal(r.sent.filter(([e]) => e === 'App Opened').length, 1);
});

test('studio-only routes send nothing and do not count as a visible screen', () => {
  const r = recorder();
  const observer = createRouteObserver({ track: r.track, platform: 'ios' });
  observer.onPathname('/ide');
  assert.deepEqual(r.sent, [['App Opened', { platform: 'ios' }]], 'the launch still counts; the studio route does not');
  observer.onPathname('/');
  observer.onPathname('/ide?screen=habits');
  observer.onPathname('/');
  assert.deepEqual(
    r.sent.map(([e, p]) => (e === 'Screen Viewed' ? p?.screen : e)),
    ['App Opened', '/'],
    'returning from the studio to the same route is not a new view',
  );
});

test('a null or undefined pathname is ignored', () => {
  const r = recorder();
  const observer = createRouteObserver({ track: r.track, platform: 'ios' });
  observer.onPathname(null);
  observer.onPathname(undefined);
  assert.deepEqual(r.sent, []);
});

// Static checks: the wiring a Node test cannot run because it needs expo-router.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test('the root layout calls useAnalytics exactly once and nothing else does', () => {
  const layout = source('mobile/src/app/_layout.tsx');
  assert.equal(layout.match(/useAnalytics\(\)/g)?.length, 1);
  assert.match(layout, /from '\.\.\/analytics\/useAnalytics'/);

  const importers = walk(join(ROOT, 'mobile/src'))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('/analytics/'))
    .filter((f) => /analytics\/useAnalytics/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(ROOT, f));
  assert.deepEqual(importers, ['mobile/src/app/_layout.tsx']);
});

test('the hook reads the router pathname and keeps one observer per runtime', () => {
  const hook = source('mobile/src/analytics/useAnalytics.ts');
  assert.match(hook, /usePathname\(\)/);
  assert.match(hook, /^const observer = createRouteObserver\(/m, 'module-level, so a remount cannot repeat App Opened');
  assert.match(hook, /platform:\s*Platform\.OS/);
});

test('no screen reads a demo date in local time', () => {
  const offenders = walk(join(ROOT, 'mobile/src'))
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => /\.getDay\(\)|\.getDate\(\)|\.getMonth\(\)/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(ROOT, f));
  assert.deepEqual(offenders, []);
});
