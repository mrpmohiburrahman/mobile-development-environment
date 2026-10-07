/**
 * Reading a `box-shadow` back to a person.
 *
 * `elevation.sm` and `elevation.md` are composite CSS values, not scalars, and
 * the studio refuses to pretend otherwise — a slider cannot represent
 * `0px 2px 4px 0px rgba(35,25,20,0.06), 0px 16px 40px 0px rgba(35,25,20,0.13)`.
 * The editor is a text field, and these are the helpers that make typing one
 * comprehensible: what you have typed so far, and what it means.
 *
 * Pure, no runtime imports, so `test/elevationEditor.test.ts` can load it.
 */

import { splitLayers, validateBoxShadow } from '../ds/tokenValidation.ts';

/**
 * Trim, and collapse runs of whitespace to single spaces.
 *
 * Typed input arrives with stray leading spaces and double gaps. Normalising
 * before validating means a value that differs from the committed one only in
 * whitespace is accepted and stored tidy, rather than refused for a reason the
 * author cannot see.
 */
export function normalizeShadow(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/** What one layer amounts to, for the summary line under the field. */
export type LayerSummary = {
  /** The blur length, e.g. `16px`. Null when the layer has too little to read. */
  blur: string | null;
  /** Whether this layer names a colour. */
  hasColor: boolean;
  /** Whether the layer carries `inset`. */
  inset: boolean;
};

export type ShadowSummary = {
  /** True when the whole value passes `validateBoxShadow`. */
  valid: boolean;
  /** Why it does not, when it does not. */
  error: string | null;
  layers: LayerSummary[];
  /** "2 layers", "1 layer" — the shape at a glance. */
  count: string;
  /** The blur of each layer, comma-joined. Empty when none could be read. */
  blurs: string;
};

/**
 * Describe a shadow without judging it beyond what validation already says.
 *
 * Works on partial input: typing `0px 1px` shows one layer, blur `1px`, and the
 * validation error about needing two lengths. That is the point — the field
 * explains itself while the value is still being written.
 */
export function describeShadow(text: string): ShadowSummary {
  const normalized = normalizeShadow(text);
  const verdict = validateBoxShadow(normalized);

  if (normalized === '') {
    return { valid: false, error: 'enter a box-shadow', layers: [], count: '', blurs: '' };
  }

  const layers: LayerSummary[] = splitLayers(normalized).map((layer) => {
    const parts = layer.trim().split(/\s+/).filter(Boolean);
    // `rgba?`/`hsla?`, not `rgb`/`hsl`: every shadow in tokens.json uses
    // rgba(), and `rgb` followed by a required "(" does not match "rgba(".
    const hasColor = parts.some(
      (p) =>
        p.startsWith('#') ||
        /^(?:rgba?|hsla?|color)\(/i.test(p) ||
        (/^[a-z]+$/i.test(p) && p !== 'inset'),
    );
    return {
      // blur is the third length in `offset-x offset-y blur [spread]`, so the
      // first two lengths are the offset and the third is the blur.
      blur: parts.find((p, i) => i >= 2 && /px|rem|em|%$/.test(p)) ?? null,
      hasColor,
      inset: parts.includes('inset'),
    };
  });

  return {
    valid: verdict.ok,
    error: verdict.ok ? null : verdict.error,
    layers,
    count: `${layers.length} layer${layers.length === 1 ? '' : 's'}`,
    blurs: layers.map((l) => l.blur ?? '?').join(' · '),
  };
}

/**
 * The shape the file actually contains, for use as the field's placeholder.
 *
 * Taken from the shipped `elevation.md` rather than invented, so the example is
 * one the app has proven renders — including its two layers and its rgba
 * colours. A single-layer example would invite a value the file has never held.
 */
export const SHADOW_PLACEHOLDER =
  '0px 2px 4px 0px rgba(35,25,20,0.06), 0px 16px 40px 0px rgba(35,25,20,0.13)';