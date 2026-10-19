// The server's token path helpers, and its handle on the shared validation rules.
//
// Extracted from index.mjs so `node --test` can import them: importing index.mjs
// runs server.listen() at module scope, which would leave the test runner waiting
// on a live listener.
//
// ## Why validation lives here rather than being imported
//
// The client validates in `mobile/src/ds/tokenValidation.ts`. The obvious design
// would be for this file to import that module, and it cannot: the server is
// Node-stdlib-only with no build step, and a plain `node` cannot import a .ts
// file (ERR_UNKNOWN_FILE_EXTENSION). Type stripping would fix it, but that is a
// flag the server would then need, which is a build step by another name.
//
// So the two sides share the thing that matters and reimplement the thing that
// does not:
//
//   - `mobile/src/ds/tokenRules.json` — ranges and patterns. Read by the server
//     with readFile, imported by the client directly. One file, so a rule cannot
//     differ between the two sides.
//   - the validation logic — small, and mirrored here as `validateTokenValue`.
//
// The mirror is the one thing here that *could* drift, so `test/validation.test.ts`
// asserts these two functions agree on every case, and fails if they don't.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The shared rule parameters.
 *
 * Read with readFile rather than imported, because the server is Node-stdlib
 * only. Cached so a burst of writes parses it once.
 */
let cachedRules = null;
export function rules() {
  if (!cachedRules) {
    cachedRules = JSON.parse(readFileSync(resolve(ROOT, 'mobile/src/ds/tokenRules.json'), 'utf8'));
  }
  return cachedRules;
}

/** Set a dotted path, refusing to create keys that do not exist. */
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let node = obj;
  for (const k of keys) {
    if (typeof node[k] !== 'object' || node[k] === null) return false;
    node = node[k];
  }
  if (!(last in node)) return false;
  node[last] = value;
  return true;
}

const ok = { ok: true };
const fail = (error) => ({ ok: false, error });

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const inRange = (value, min, max) => isFiniteNumber(value) && value >= min && value <= max;

/** Split on top-level commas only: rgba(35,25,20,0.05) has commas of its own. */
function splitLayers(value) {
  const layers = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      layers.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  layers.push(current);
  return layers;
}

const LENGTH = /^-?(?:\d+\.?\d*|\.\d+)(px|rem|em|%)?$/;
const UNITED = /px|rem|em|%/;
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FUNCTIONAL = /^(?:rgb|rgba|hsl|hsla|color)\(.+\)$/;

export function validateBoxShadow(value) {
  const { maxLength, minLayers } = rules().boxShadow;
  if (typeof value !== 'string') return fail(`elevation must be a box-shadow string, got ${typeof value}`);
  if (value.length === 0) return fail('elevation box-shadow is empty');
  if (value.length > maxLength) return fail(`elevation box-shadow is longer than ${maxLength} characters`);

  const layers = splitLayers(value);
  if (layers.length < minLayers) return fail(`elevation box-shadow needs at least ${minLayers} layer`);

  for (const [i, layer] of layers.entries()) {
    const parts = layer.trim().split(/\s+/);
    let lengths = 0;

    for (const part of parts) {
      if (part === 'inset' || part === 'initial' || part === 'unset') continue;

      if (LENGTH.test(part)) {
        if (!UNITED.test(part) && parseFloat(part) !== 0) {
          return fail(`elevation layer ${i + 1}: "${part}" needs a unit (or be 0)`);
        }
        lengths++;
        continue;
      }
      if (HEX.test(part)) continue;
      if (FUNCTIONAL.test(part)) continue;
      if (/^[a-z]+$/i.test(part)) continue;

      return fail(`elevation layer ${i + 1}: "${part}" is not a length, a colour, or a keyword`);
    }

    if (lengths < 2) {
      return fail(`elevation layer ${i + 1} needs at least 2 lengths, got ${lengths}`);
    }
  }

  return ok;
}

function validateType(path, value) {
  const key = path.split('.').pop();
  const n = rules().number;

  if (path === 'type.family') {
    return typeof value === 'string' && rules().fontFamily.allowed.includes(value)
      ? ok
      : fail(`Font family must be one of: ${rules().fontFamily.allowed.join(', ')}.`);
  }

  switch (key) {
    case 'size':
      return inRange(value, n.typeSize.min, n.typeSize.max)
        ? ok
        : fail(`type size must be a number ${n.typeSize.min}–${n.typeSize.max}, got ${String(value)}`);
    case 'lineHeight':
      return inRange(value, n.typeLineHeight.min, n.typeLineHeight.max)
        ? ok
        : fail(
            `type lineHeight must be a number ${n.typeLineHeight.min}–${n.typeLineHeight.max}, got ${String(value)}`,
          );
    case 'letterSpacing':
      return inRange(value, n.typeLetterSpacing.min, n.typeLetterSpacing.max)
        ? ok
        : fail(
            `type letterSpacing must be a number ${n.typeLetterSpacing.min}–${n.typeLetterSpacing.max}, got ${String(value)}`,
          );
    case 'weight':
      // A string, deliberately: tokens.json holds "800".
      return typeof value === 'string' && new RegExp(rules().fontWeight.pattern).test(value)
        ? ok
        : fail(`type weight must be a string like "700", got ${JSON.stringify(value)}`);
    default:
      return fail(`unknown type key: ${path}`);
  }
}

/** The mirror of `validateTokenValue` in mobile/src/ds/tokenValidation.ts. */
export function validateTokenValue(path, value) {
  const head = path.split('.')[0];

  switch (head) {
    case 'color': {
      const { pattern } = rules().color;
      return typeof value === 'string' && new RegExp(pattern).test(value)
        ? ok
        : fail(`colour must be a hex string like "#D9481E", got ${JSON.stringify(value)}`);
    }
    case 'space': {
      const { min, max } = rules().number.space;
      return inRange(value, min, max) ? ok : fail(`space must be a number ${min}–${max}, got ${String(value)}`);
    }
    case 'radius': {
      // Ceiling 999 so radius.pill (999) is accepted rather than refused by accident.
      const { min, max } = rules().number.radius;
      return inRange(value, min, max) ? ok : fail(`radius must be a number ${min}–${max}, got ${String(value)}`);
    }
    case 'type':
      return validateType(path, value);
    case 'elevation':
      return validateBoxShadow(value);
    default:
      // No rule for this family. Unknown paths are refused separately, by setPath.
      return ok;
  }
}