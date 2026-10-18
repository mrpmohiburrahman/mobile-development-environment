/**
 * The shareable URL state: a link that reproduces a studio view on the
 * deployed static build with no server (ADR 0001, ticket 22).
 *
 * The payload lives in the hash fragment as `#s=<payload>`, because Expo
 * Router owns the path and the query and the hash is the one part of the URL
 * that never conflicts with them. The payload is a versioned JSON document —
 * present flag, screen key, scheme, and token overrides as a diff from the
 * committed `tokens.json` — deflate-compressed and base64url-encoded. Nothing
 * else travels: no app data, no frame positions, no camera, no scroll, no
 * active tab, no baseline-comparison state. A link reproduces a view, not a
 * session.
 *
 * This module is the pure layer. It takes the committed token tree and the
 * known screen keys as parameters and never touches `window`, so `node --test`
 * reaches every decision — validation, versioning, size limits — without a
 * browser. The React glue (reading `location.hash`, `replaceState`, the
 * clipboard) lives in `useShareLink.ts`.
 *
 * Every failure is a warning, never a crash: a malformed payload, an
 * unsupported version, an unknown screen, and unknown or invalid token paths
 * each degrade to the valid part of the link plus a sentence for the banner.
 */

import { validateTokenValue, type TokenValue } from '../ds/tokenValidation.ts';

export type ShareScheme = 'light' | 'dark';

export type ShareState = {
  present: boolean;
  screen: string | null;
  scheme: ShareScheme;
  overrides: Record<string, TokenValue>;
};

export const SHARE_VERSION = 1;
export const SHARE_PARAM = 's';

/**
 * Hard limits, so a hostile or corrupted link costs a fixed, tiny amount of
 * work. The compressed payload of a real link is well under 1KB; the JSON
 * inside is smaller still.
 */
export const MAX_PAYLOAD_CHARS = 16_384;
export const MAX_JSON_CHARS = 65_536;

export const SHARE_WARNINGS = {
  unsupported:
    'This browser cannot read or write shared links. The studio works, but the URL will not track edits and Copy link is unavailable.',
  tooLarge: 'This link is too large to read safely. Showing the studio defaults.',
  malformed: "This link's state could not be read. Showing the studio defaults.",
  version: 'This link comes from a different version of the studio. Showing the studio defaults.',
  unknownScreen: 'This link pointed to a screen that no longer exists. Showing the first screen.',
  overridesUnreadable: "This link's token overrides could not be read. Showing committed values.",
  scheme: "This link's colour scheme value was not recognized. Showing the light scheme.",
  present: "This link's present flag was not recognized. Opening the board instead.",
} as const;

export function overridesWarning(applied: number, total: number): string {
  return `This link's token overrides could not be fully applied (${applied} of ${total}). Showing committed values for the rest.`;
}

export type ShareOutcome = {
  state: ShareState;
  warnings: string[];
  /** True when the browser lacks the compression APIs entirely. */
  unsupported: boolean;
};

export function defaultShareState(): ShareState {
  return { present: false, screen: null, scheme: 'light', overrides: {} };
}

export function isDefaultShareState(state: ShareState): boolean {
  return (
    !state.present &&
    state.screen === null &&
    state.scheme === 'light' &&
    Object.keys(state.overrides).length === 0
  );
}

/**
 * The wire document. Defaults are omitted so a quiet studio produces a short
 * link; the key set is exactly `v, p, s, c, o` and nothing else, which is what
 * keeps app data and board arrangement out of the link by construction.
 */
export function shareJsonOf(state: ShareState): Record<string, unknown> {
  const json: Record<string, unknown> = { v: SHARE_VERSION };
  if (state.present) json.p = 1;
  if (state.screen) json.s = state.screen;
  if (state.scheme !== 'light') json.c = state.scheme;
  const keys = Object.keys(state.overrides).sort();
  if (keys.length > 0) json.o = Object.fromEntries(keys.map((k) => [k, state.overrides[k]]));
  return json;
}

/** The value at a dotted path, but only when it is an own, scalar leaf. */
function committedLeaf(committed: Record<string, unknown>, path: string): TokenValue | undefined {
  let node: unknown = committed;
  for (const key of path.split('.')) {
    if (!node || typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, key)) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === 'string' || typeof node === 'number' ? node : undefined;
}

/**
 * The meaning of a decoded document against *this* build: its screen registry
 * and its committed tokens. Valid fields apply; every rejected field adds a
 * sentence for the banner. An unknown screen falls back to the first declared
 * screen, and a present flag with no usable screen presents that same first
 * screen — Present mode needs a frame and the route must not open on nothing.
 */
export function interpretShareJson(
  json: unknown,
  knownScreens: readonly string[],
  committed: Record<string, unknown>,
): ShareOutcome {
  const state = defaultShareState();
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return { state, warnings: [SHARE_WARNINGS.malformed], unsupported: false };
  }
  const doc = json as Record<string, unknown>;
  if (doc.v !== SHARE_VERSION) {
    return { state, warnings: [SHARE_WARNINGS.version], unsupported: false };
  }

  const warnings: string[] = [];
  const first = knownScreens[0] ?? null;

  let screen: string | null = null;
  if ('s' in doc && doc.s !== undefined) {
    if (typeof doc.s === 'string' && knownScreens.includes(doc.s)) {
      screen = doc.s;
    } else {
      warnings.push(SHARE_WARNINGS.unknownScreen);
      screen = first;
    }
  }

  let present = false;
  if ('p' in doc && doc.p !== undefined) {
    if (doc.p === 1 || doc.p === true) present = true;
    else if (doc.p === 0 || doc.p === false || doc.p === null) present = false;
    else warnings.push(SHARE_WARNINGS.present);
  }
  if (present && screen === null) screen = first;

  if ('c' in doc && doc.c !== undefined) {
    if (doc.c === 'light' || doc.c === 'dark') state.scheme = doc.c;
    else warnings.push(SHARE_WARNINGS.scheme);
  }

  if ('o' in doc && doc.o !== undefined) {
    if (!doc.o || typeof doc.o !== 'object' || Array.isArray(doc.o)) {
      warnings.push(SHARE_WARNINGS.overridesUnreadable);
    } else {
      const entries = Object.entries(doc.o as Record<string, unknown>);
      let applied = 0;
      for (const [path, value] of entries) {
        const scalar = typeof value === 'string' || typeof value === 'number';
        if (
          scalar &&
          committedLeaf(committed, path) !== undefined &&
          validateTokenValue(path, value as TokenValue).ok
        ) {
          state.overrides[path] = value as TokenValue;
          applied++;
        }
      }
      if (applied < entries.length) warnings.push(overridesWarning(applied, entries.length));
    }
  }

  state.present = present;
  state.screen = screen;
  return { state, warnings, unsupported: false };
}

/** base64url without padding, the alphabet the hash fragment survives. */
export function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function base64urlDecode(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** The payload out of a location hash, whether or not other params share it. */
export function sharePayloadFromHash(hash: string): string | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  return new URLSearchParams(raw).get(SHARE_PARAM);
}

// The DOM and Node stream typings disagree about `pipeThrough`; the runtime
// contract (a CompressionStream/DecompressionStream transform) is what matters.
type Transform = new (format: string) => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

async function pipeThrough(bytes: Uint8Array, Transform_: Transform): Promise<ReadableStream<Uint8Array>> {
  return new Blob([bytes as BlobPart]).stream().pipeThrough(new Transform_('deflate'));
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  const CS = (globalThis as { CompressionStream?: unknown }).CompressionStream;
  if (typeof CS !== 'function') return null;
  try {
    const stream = await pipeThrough(bytes, CS as unknown as Transform);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Inflate with a size ceiling: the reader cancels the moment the output grows
 * past `limit`, so a zip bomb costs one pass over `limit` bytes, not memory.
 */
async function inflate(bytes: Uint8Array, limit: number): Promise<Uint8Array | null> {
  const DS = (globalThis as { DecompressionStream?: unknown }).DecompressionStream;
  if (typeof DS !== 'function') return null;
  try {
    const stream = await pipeThrough(bytes, DS as unknown as Transform);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const out = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  } catch {
    return null;
  }
}

/** `state` → `#s=` value, or null when this browser cannot compress. */
export async function encodeShareState(state: ShareState): Promise<string | null> {
  if (typeof (globalThis as { CompressionStream?: unknown }).CompressionStream !== 'function') {
    return null;
  }
  const bytes = new TextEncoder().encode(JSON.stringify(shareJsonOf(state)));
  const compressed = await deflate(bytes);
  return compressed ? base64urlEncode(compressed) : null;
}

/**
 * `#s=` value → the state this build can show plus the warnings it must show.
 * Never throws: every rejection path returns the studio defaults and a
 * sentence, so a bad link cannot crash the route.
 */
export async function decodeSharePayload(
  payload: string,
  knownScreens: readonly string[],
  committed: Record<string, unknown>,
): Promise<ShareOutcome> {
  const fallback = (): ShareOutcome => ({
    state: defaultShareState(),
    warnings: [],
    unsupported: false,
  });
  if (typeof (globalThis as { DecompressionStream?: unknown }).DecompressionStream !== 'function') {
    return { ...fallback(), warnings: [SHARE_WARNINGS.unsupported], unsupported: true };
  }
  if (typeof payload !== 'string' || payload.length > MAX_PAYLOAD_CHARS) {
    return { ...fallback(), warnings: [SHARE_WARNINGS.tooLarge] };
  }
  const bytes = base64urlDecode(payload);
  if (!bytes || bytes.length === 0) return { ...fallback(), warnings: [SHARE_WARNINGS.malformed] };
  const jsonBytes = await inflate(bytes, MAX_JSON_CHARS);
  if (!jsonBytes) return { ...fallback(), warnings: [SHARE_WARNINGS.malformed] };
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(jsonBytes));
  } catch {
    return { ...fallback(), warnings: [SHARE_WARNINGS.malformed] };
  }
  return interpretShareJson(json, knownScreens, committed);
}
