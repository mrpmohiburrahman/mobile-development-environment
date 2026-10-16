// Route observation for analytics, pure. The hook in useAnalytics.ts feeds
// pathnames in; this decides which events leave.
//
// Run: node --experimental-strip-types --test test/routeAnalytics.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouteObserver, isStudioRoute, normalizePathname } from '../mobile/src/analytics/routes.ts';
import type { EventName, EventProperties } from '../mobile/src/analytics/mixpanel.ts';

type Sent = [EventName, EventProperties | undefined];

function recorder() {
  const sent: Sent[] = [];
  const studio: boolean[] = [];
  return {
    sent,
    studio,
    track: (event: EventName, properties?: EventProperties) => void sent.push([event, properties]),
    onStudioRoute: (active: boolean) => void studio.push(active),
  };
}

/** Screen names in order, with `App Opened` kept as a marker. */
const trail = (sent: Sent[]) => sent.map(([e, p]) => (e === 'Screen Viewed' ? p?.screen : e));

test('normalizePathname fixes slash shape and drops a query or hash if one slips through', () => {
  assert.equal(normalizePathname('/'), '/');
  assert.equal(normalizePathname(''), '/');
  assert.equal(normalizePathname('/habits/'), '/habits');
  assert.equal(normalizePathname('//habits//'), '/habits');
  assert.equal(normalizePathname('/habit?id=h1'), '/habit');
  assert.equal(normalizePathname('/habit#top'), '/habit');
  assert.equal(normalizePathname('habits'), '/habits');
  assert.equal(normalizePathname('/Habits'), '/Habits', 'expo-router paths are case-sensitive');
});

test('isStudioRoute matches the studio route and its children only', () => {
  assert.equal(isStudioRoute('/ide'), true);
  assert.equal(isStudioRoute('/ide/'), true);
  assert.equal(isStudioRoute('/ide/anything'), true);
  assert.equal(isStudioRoute('/identity'), false);
  assert.equal(isStudioRoute('/'), false);
  assert.equal(isStudioRoute('/habits'), false);
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
  for (const p of ['/', '/', '/habits', '/habits/', '/habit', '/habits', '/login', '/']) observer.onPathname(p);
  assert.deepEqual(trail(r.sent), ['App Opened', '/', '/habits', '/habit', '/habits', '/login', '/']);
});

test('App Opened is sent once per observer', () => {
  const r = recorder();
  const observer = createRouteObserver({ track: r.track, platform: 'android' });
  for (const p of ['/', '/', '/stats', '/']) observer.onPathname(p);
  assert.equal(r.sent.filter(([e]) => e === 'App Opened').length, 1);
});

test('studio routes send no Screen Viewed and do not count as a visible screen', () => {
  const r = recorder();
  const observer = createRouteObserver({ track: r.track, platform: 'ios' });
  observer.onPathname('/ide');
  assert.deepEqual(r.sent, [['App Opened', { platform: 'ios' }]], 'the launch still counts; the studio route does not');
  for (const p of ['/', '/ide', '/']) observer.onPathname(p);
  assert.deepEqual(trail(r.sent), ['App Opened', '/'], 'returning from the studio to the same route is not a new view');
});

test('the observer reports studio presence on every pathname so the sender can refuse actions', () => {
  const r = recorder();
  const observer = createRouteObserver({ track: r.track, platform: 'ios', onStudioRoute: r.onStudioRoute });
  for (const p of ['/', '/ide', '/ide/frame', '/habits']) observer.onPathname(p);
  assert.deepEqual(r.studio, [false, true, true, false]);
});

// Static checks: the wiring a Node test cannot run because it needs expo-router.
// Comments are stripped first, as in test/mechanisms.test.ts, so a commented-out
// call cannot satisfy an assertion.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) =>
  readFileSync(join(ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sources = (...dirs: string[]) =>
  dirs
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => relative(ROOT, f));

test('the root layout calls useAnalytics exactly once and nothing else does', () => {
  const layout = code('mobile/src/app/_layout.tsx');
  assert.equal(layout.match(/useAnalytics\(\)/g)?.length, 1);
  assert.match(layout, /from '\.\.\/analytics\/useAnalytics'/);

  const importers = sources('mobile/src')
    .filter((f) => !f.includes('/analytics/'))
    .filter((f) => /analytics\/useAnalytics/.test(code(f)));
  assert.deepEqual(importers, ['mobile/src/app/_layout.tsx']);
});

test('the hook follows the router pathname and keeps one observer per runtime', () => {
  const hook = code('mobile/src/analytics/useAnalytics.ts');
  assert.match(hook, /usePathname\(\)/);
  assert.match(hook, /useEffect\([\s\S]*?\[pathname\]\)/, 'an empty dependency list would stop tracking after the first route');
  assert.match(hook, /^const observer = createRouteObserver\(/m, 'module-level, so a remount cannot repeat App Opened');
  assert.match(hook, /platform:\s*Platform\.OS/);
  assert.match(hook, /onStudioRoute:\s*setStudioRoute/, 'the sender must learn when the device shows the studio');
});

test('no app screen or store reads a demo date in local time', () => {
  const offenders = sources('mobile/src/app', 'mobile/src/store').filter((f) =>
    /\.getDay\(\)|\.getDate\(\)|\.getMonth\(\)|\.getFullYear\(\)/.test(code(f)),
  );
  assert.deepEqual(offenders, []);
});
