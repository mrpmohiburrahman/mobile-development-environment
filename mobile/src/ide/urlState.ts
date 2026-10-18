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
import type { Scheme } from '../ds/editorState.ts';

export type ShareState = {
  present: boolean;
  screen: string | null;
  scheme: Scheme;
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
    'This browser does not support shared links. The URL does not show your edits. Copy link is not available.',
  tooLarge: 'This link is too large. The studio shows its default view.',
  malformed: 'The studio cannot read this link. The studio shows its default view.',
  version: 'This link is from a different studio version. The studio shows its default view.',
  unknownScreen: 'This link points to a screen that does not exist. The studio shows the first screen.',
  overridesUnreadable: 'The studio cannot read the token overrides in this link. The studio shows the committed values.',
  scheme: 'The studio does not know the colour scheme in this link. The studio shows the light scheme.',
  present: 'The studio does not know the present flag in this link. The studio shows the board.',
} as const;

export function overridesWarning(rejected: number, total: number): string {
  return `The studio cannot apply ${rejected} of ${total} token overrides in this link. It shows the committed values for those tokens.`;
}

export function compressionSupported(): boolean {
  const scope = globalThis as { CompressionStream?: unknown; DecompressionStream?: unknown };
  return typeof scope.CompressionStream === 'function' && typeof scope.DecompressionStream === 'function';
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
      if (applied < entries.length) {
        warnings.push(overridesWarning(entries.length - applied, entries.length));
      }
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

type DeflateCodec = new (format: 'deflate') => {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

function codecOf(name: 'CompressionStream' | 'DecompressionStream'): DeflateCodec {
  return (globalThis as unknown as Record<string, DeflateCodec>)[name];
}

function deflateStream(bytes: Uint8Array, Codec: DeflateCodec): ReadableStream<Uint8Array> {
  return new Blob([bytes as BlobPart]).stream().pipeThrough(new Codec('deflate'));
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const stream = deflateStream(bytes, codecOf('CompressionStream'));
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
  try {
    const reader = deflateStream(bytes, codecOf('DecompressionStream')).getReader();
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

export async function encodeShareState(state: ShareState): Promise<string | null> {
  if (isDefaultShareState(state) || !compressionSupported()) return null;
  const bytes = new TextEncoder().encode(JSON.stringify(shareJsonOf(state)));
  const compressed = await deflate(bytes);
  return compressed ? base64urlEncode(compressed) : null;
}

export function shareHref(base: string, payload: string | null): string {
  return payload ? `${base}#${SHARE_PARAM}=${payload}` : base;
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
  if (!compressionSupported()) {
    return { ...fallback(), warnings: [SHARE_WARNINGS.unsupported], unsupported: true };
  }
  if (payload.length > MAX_PAYLOAD_CHARS) {
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
