import type { Tone } from '../ds/reachability';

/**
 * The studio's own palette.
 *
 * Moved out of `Blueprint.tsx` so the badge and the chrome it sits in cannot
 * drift into two sets of the same hex. These are the editor's own colours, not
 * the app's design tokens: the studio's chrome must stay legible while a reader
 * is dragging the tokens that would otherwise resize it.
 *
 * A studio-local `Label` over raw `RNText` at fixed sizes belongs here too — see
 * the map's ticket on decoupling the chrome from tokens.
 */
export const CHROME = {
  bg: '#16120F',
  panel: '#211C18',
  panelSoft: '#2B251F',
  border: '#2A231E',
  text: '#F4EFE9',
  textMuted: '#9C928A',
} as const;

/**
 * Colour per badge state.
 *
 * Three distinct values, so no two states can be told apart by hue alone — the
 * text carries the meaning and the colour only reinforces it.
 *
 * `degraded` is amber rather than red on purpose. With no token server running,
 * the deployed static build is the expected case, not a fault, and a red badge
 * would report an error where the honest report is "this build cannot write".
 */
export const TONE: Record<Tone, string> = {
  ok: '#5FBF7F',
  degraded: '#E0A33E',
  muted: '#6E655D',
};