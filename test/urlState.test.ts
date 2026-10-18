// Shareable URL state: the codec and its failure behavior.
//
// A link reproduces a studio view on the deployed static build with no server
// (ADR 0001, ticket 22). These tests pin the wire format against the real
// `tokens.json` and the real screen list, and pin the honest-zero contract:
// every invalid part of a link degrades to a warning, never a crash, and the
// valid part still applies.
//
// Run: node --experimental-strip-types --test test/*.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, deflateRawSync, gzipSync } from 'node:zlib';
import tokens from '../mobile/src/ds/tokens.json' with { type: 'json' };
import {
  base64urlDecode,
  base64urlEncode,
  decodeSharePayload,
  defaultShareState,
  encodeShareState,
  interpretShareJson,
  isDefaultShareState,
  MAX_PAYLOAD_CHARS,
  shareJsonOf,
  sharePayloadFromHash,
  overridesWarning,
  SHARE_WARNINGS,
  type ShareState,
} from '../mobile/src/ide/urlState.ts';

const SCREENS = ['login', 'index', 'habits', 'habit', 'stats', 'profile', 'settings'];
const COMMITTED = tokens as unknown as Record<string, unknown>;

/** An independent encoder: the format is zlib deflate + base64url of JSON. */
function linkFor(json: unknown): string {
  const bytes = deflateSync(Buffer.from(JSON.stringify(json)));
  return bytes.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

const decode = (payload: string) => decodeSharePayload(payload, SCREENS, COMMITTED);

test('a full state survives a round trip', async () => {
  const state: ShareState = {
    present: true,
    screen: 'habit',
    scheme: 'dark',
    overrides: { 'color.light.accent': '#123456', 'space.md': 20 },
  };
  const payload = await encodeShareState(state);
  assert.ok(payload);
  const outcome = await decode(payload);
  assert.deepEqual(outcome.warnings, []);
  assert.deepEqual(outcome.state, state);
});

test('the wire document holds exactly v, p, s, c, o — no board or app state', () => {
  const full = shareJsonOf({
    present: true,
    screen: 'stats',
    scheme: 'dark',
    overrides: { 'radius.md': 8 },
  });
  assert.deepEqual(Object.keys(full).sort(), ['c', 'o', 'p', 's', 'v']);
  const quiet = shareJsonOf(defaultShareState());
  assert.deepEqual(Object.keys(quiet), ['v']);
  assert.ok(isDefaultShareState(defaultShareState()));
  assert.ok(!isDefaultShareState({ ...defaultShareState(), scheme: 'dark' }));
});

test('base64url round-trips and uses no hash-hostile characters', () => {
  const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255, 63]);
  const encoded = base64urlEncode(bytes);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(base64urlDecode(encoded), bytes);
  assert.equal(base64urlDecode('not valid!'), null);
});

test('sharePayloadFromHash reads s among other fragment params', () => {
  assert.equal(sharePayloadFromHash('#s=abc'), 'abc');
  assert.equal(sharePayloadFromHash('#x=1&s=a-b_c'), 'a-b_c');
  assert.equal(sharePayloadFromHash(''), null);
  assert.equal(sharePayloadFromHash('#other=1'), null);
});

test('a malformed payload warns and shows the studio defaults', async () => {
  for (const payload of ['!!!not-base64!!!', base64urlEncode(new Uint8Array([1, 2, 3]))]) {
    const outcome = await decode(payload);
    assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.malformed]);
    assert.deepEqual(outcome.state, defaultShareState());
  }
  const notJson = base64urlEncode(deflateSync(Buffer.from('this is not json')));
  assert.deepEqual((await decode(notJson)).warnings, [SHARE_WARNINGS.malformed]);
  const rawDeflate = base64urlEncode(deflateRawSync(Buffer.from('{"v":1}')));
  assert.deepEqual((await decode(rawDeflate)).warnings, [SHARE_WARNINGS.malformed]);
  const gzip = base64urlEncode(gzipSync(Buffer.from('{"v":1}')));
  assert.deepEqual((await decode(gzip)).warnings, [SHARE_WARNINGS.malformed]);
});

test('an oversized payload is rejected safely', async () => {
  const outcome = await decode('a'.repeat(MAX_PAYLOAD_CHARS + 1));
  assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.tooLarge]);
  assert.deepEqual(outcome.state, defaultShareState());
});

test('a decompression bomb is cut off at the JSON limit', async () => {
  const huge = `{${'"v":1,"p":1,'}${'"pad":"'.padEnd(1)}${'x'.repeat(200_000)}"}`;
  const outcome = await decode(base64urlEncode(deflateSync(Buffer.from(huge))));
  assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.malformed]);
  assert.deepEqual(outcome.state, defaultShareState());
});

test('an unsupported version warns and applies nothing', async () => {
  const outcome = await decode(linkFor({ v: 99, p: 1, s: 'habit', c: 'dark' }));
  assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.version]);
  assert.deepEqual(outcome.state, defaultShareState());
});

test('an unknown screen shows the first screen with a warning', async () => {
  const outcome = await decode(linkFor({ v: 1, s: 'ghost' }));
  assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.unknownScreen]);
  assert.equal(outcome.state.screen, 'login');
  assert.equal(outcome.state.present, false);
});

test('a present link with an unknown screen presents the first screen', async () => {
  const outcome = await decode(linkFor({ v: 1, p: 1, s: 'ghost' }));
  assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.unknownScreen]);
  assert.deepEqual(outcome.state, { ...defaultShareState(), present: true, screen: 'login' });
});

test('a present flag with no screen presents the first screen without a warning', async () => {
  const outcome = await decode(linkFor({ v: 1, p: 1 }));
  assert.deepEqual(outcome.warnings, []);
  assert.deepEqual(outcome.state, { ...defaultShareState(), present: true, screen: 'login' });
});

test('unknown token paths and invalid values drop out; valid ones apply', async () => {
  const outcome = await decode(
    linkFor({
      v: 1,
      o: {
        'color.light.accent': '#123456',
        'color.light.nope': '#123456',
        'space.md': 'not a number',
        '__proto__.polluted': 1,
      },
    }),
  );
  assert.deepEqual(outcome.warnings, [overridesWarning(1, 4)]);
  assert.deepEqual(outcome.state.overrides, { 'color.light.accent': '#123456' });
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('a value that fails token rules is rejected with the same warning', async () => {
  const outcome = await decode(linkFor({ v: 1, o: { 'color.light.accent': 'red' } }));
  assert.deepEqual(outcome.warnings, [overridesWarning(0, 1)]);
  assert.deepEqual(outcome.state.overrides, {});
});

test('a non-object overrides field warns instead of throwing', async () => {
  const outcome = await decode(linkFor({ v: 1, o: 'broken' }));
  assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.overridesUnreadable]);
});

test('an unrecognized scheme warns and falls back to light', async () => {
  const outcome = await decode(linkFor({ v: 1, c: 'sepia', s: 'stats' }));
  assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.scheme]);
  assert.equal(outcome.state.scheme, 'light');
  assert.equal(outcome.state.screen, 'stats');
});

test('interpretShareJson treats a non-object document as malformed', () => {
  for (const json of [null, 42, 'x', [1, 2]]) {
    const outcome = interpretShareJson(json, SCREENS, COMMITTED);
    assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.malformed]);
  }
});

test('valid parts still apply when other parts warn', async () => {
  const outcome = await decode(
    linkFor({ v: 1, p: 1, s: 'ghost', c: 'dark', o: { 'color.dark.accent': '#abcdef', bad: 1 } }),
  );
  assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.unknownScreen, overridesWarning(1, 2)]);
  assert.equal(outcome.state.present, true);
  assert.equal(outcome.state.screen, 'login');
  assert.equal(outcome.state.scheme, 'dark');
  assert.deepEqual(outcome.state.overrides, { 'color.dark.accent': '#abcdef' });
});

test('a browser without compression APIs gets an explicit warning', async () => {
  const realCS = globalThis.CompressionStream;
  const realDS = globalThis.DecompressionStream;
  try {
    // @ts-expect-error simulating an unsupported browser
    delete globalThis.CompressionStream;
    // @ts-expect-error simulating an unsupported browser
    delete globalThis.DecompressionStream;
    const outcome = await decode(linkFor({ v: 1 }));
    assert.equal(outcome.unsupported, true);
    assert.deepEqual(outcome.warnings, [SHARE_WARNINGS.unsupported]);
    assert.equal(await encodeShareState(defaultShareState()), null);
  } finally {
    globalThis.CompressionStream = realCS;
    globalThis.DecompressionStream = realDS;
  }
});
