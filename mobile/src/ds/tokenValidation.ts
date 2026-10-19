/**
 * Validating a token value against the shape of the leaf it goes into.
 *
 * The server used to check that a dotted path existed and then write whatever it
 * was handed, so a malformed hex in `color.light.accent` landed in `tokens.json`
 * and rendered as garbage on every screen until someone noticed. The fix has to
 * exist on both sides: the client so a drag or a keystroke gets immediate
 * feedback, the server because it must refuse a bad write from anything that is
 * not this client.
 *
 * **The rules are parameters, not logic.** Ranges and patterns live in
 * `tokenRules.json`, which the server reads with `readFile` and Metro imports
 * directly — one file, so the two sides cannot drift by construction. This module
 * is the logic that reads those parameters.
 *
 * It lives beside `tokens.json` under `mobile/src/` because there is no
 * `metro.config.js`: a file outside the app root cannot be resolved by Metro
 * without adding build config, and this one is imported by app code.
 *
 * It has no runtime imports, so `node --test` can load it — the same seam
 * `applyOverrides.ts` and `reachability.ts` exist for.
 */

import rules from './tokenRules.json' with { type: 'json' };

export type TokenValue = string | number;

export type Validation = { ok: true } | { ok: false; error: string };

const ok: Validation = { ok: true };
const fail = (error: string): Validation => ({ ok: false, error });

/**
 * A rule per leaf family, keyed by the first segment of the dotted path.
 *
 * `type.*.weight` is the awkward one and is handled inside the type family
 * rather than given its own entry: it is a string where its siblings are numbers,
 * and the only thing that distinguishes it is which key it is.
 */
type Family = 'color' | 'space' | 'radius' | 'type' | 'elevation';

function familyOf(path: string): Family | null {
  const head = path.split('.')[0];
  return head === 'color' || head === 'space' || head === 'radius' || head === 'type' || head === 'elevation'
    ? head
    : null;
}

/** Finite and inside a closed range. NaN and Infinity are not numbers worth writing. */
function inRange(value: TokenValue, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/**
 * A box-shadow is one or more comma-separated layers; each layer is a run of
 * lengths, an optional colour, and keywords like `inset`.
 *
 * Parsed rather than pattern-matched, because "looks like a shadow" and "is a
 * shadow CSS will accept" are different questions and only the second one is
 * worth writing to a stylesheet.
 */
/**
 * Split a box-shadow into layers on top-level commas only.
 *
 * `rgba(35,25,20,0.05)` contains three commas of its own, and every elevation in
 * `tokens.json` has one. Splitting naively on `,` turns a real shadow into four
 * fragments and rejects a perfectly good value — so paren depth is tracked.
 */
export function splitLayers(value: string): string[] {
  const layers: string[] = [];
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

export function validateBoxShadow(value: TokenValue): Validation {
  const { maxLength, minLayers } = rules.boxShadow;
  if (typeof value !== 'string') return fail(`elevation must be a box-shadow string, got ${typeof value}`);
  if (value.length === 0) return fail('elevation box-shadow is empty');
  if (value.length > maxLength) return fail(`elevation box-shadow is longer than ${maxLength} characters`);

  const layers = splitLayers(value);
  if (layers.length < minLayers) return fail(`elevation box-shadow needs at least ${minLayers} layer`);

  for (const [i, layer] of layers.entries()) {
    const parts = layer.trim().split(/\s+/);
    let lengths = 0;
    let sawColour = false;

    for (const part of parts) {
      if (part === 'inset' || part === 'initial' || part === 'unset') continue;

      // A length: a number with an optional unit, including the unitless zero.
      if (/^-?(?:\d+\.?\d*|\.\d+)(px|rem|em|%)?$/.test(part)) {
        // A bare number in a shadow is only valid as zero.
        if (!/px|rem|em|%$/.test(part) && parseFloat(part) !== 0) {
          return fail(`elevation layer ${i + 1}: "${part}" needs a unit (or be 0)`);
        }
        lengths++;
        continue;
      }

      // A colour: hex, or a functional notation, or a named colour.
      if (/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(part)) {
        sawColour = true;
        continue;
      }
      if (/^(?:rgb|rgba|hsl|hsla|color)\(.+\)$/.test(part)) {
        sawColour = true;
        continue;
      }
      if (/^[a-z]+$/i.test(part)) {
        // A bare word is either a named colour or a keyword. `inset` and friends
        // were handled above; anything left is a named colour.
        sawColour = true;
        continue;
      }

      return fail(`elevation layer ${i + 1}: "${part}" is not a length, a colour, or a keyword`);
    }

    // Two lengths is a blur+spread minimum; a shadow with none cannot render.
    if (lengths < 2) {
      return fail(`elevation layer ${i + 1} needs at least 2 lengths, got ${lengths}`);
    }
    void sawColour; // a layer may legitimately omit its colour
  }

  return ok;
}

function validateType(path: string, value: TokenValue): Validation {
  const key = path.split('.').at(-1);
  const n = rules.number;

  if (path === 'type.family') {
    return typeof value === 'string' && rules.fontFamily.allowed.includes(value)
      ? ok
      : fail(`Font family must be one of: ${rules.fontFamily.allowed.join(', ')}.`);
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
      // A string, deliberately. tokens.json holds "800" and the brief that
      // listed this beside the numeric fields was wrong about it.
      return typeof value === 'string' && new RegExp(rules.fontWeight.pattern).test(value)
        ? ok
        : fail(`type weight must be a string like "700", got ${JSON.stringify(value)}`);
    default:
      return fail(`unknown type key: ${path}`);
  }
}

/**
 * Is this value legal for this dotted path?
 *
 * Returns a message rather than a boolean because the caller is a human holding
 * a slider, or a `curl` holding a path, and "not a number" helps where `false`
 * does not.
 */
export function validateTokenValue(path: string, value: TokenValue): Validation {
  const family = familyOf(path);

  switch (family) {
    case 'color': {
      const { pattern } = rules.color;
      return typeof value === 'string' && new RegExp(pattern).test(value)
        ? ok
        : fail(`colour must be a hex string like "#D9481E", got ${JSON.stringify(value)}`);
    }
    case 'space': {
      const { min, max } = rules.number.space;
      return inRange(value, min, max)
        ? ok
        : fail(`space must be a number ${min}–${max}, got ${String(value)}`);
    }
    case 'radius': {
      // The ceiling is 999 so radius.pill (999) is accepted rather than refused
      // by accident — pill exists precisely to be large.
      const { min, max } = rules.number.radius;
      return inRange(value, min, max)
        ? ok
        : fail(`radius must be a number ${min}–${max}, got ${String(value)}`);
    }
    case 'type':
      return validateType(path, value);
    case 'elevation':
      return validateBoxShadow(value);
    default:
      // Unknown family: no rule to apply. The caller decides whether that is
      // acceptable — the server refuses unknown paths separately.
      return ok;
  }
}

/** Convenience for call sites that only need a yes/no. */
export function isValidTokenValue(path: string, value: TokenValue): boolean {
  return validateTokenValue(path, value).ok;
}