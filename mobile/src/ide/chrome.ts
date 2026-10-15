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

/**
 * The studio's own type scale, frozen.
 *
 * These are the `type.*` values as they happen to sit in `tokens.json` today,
 * copied rather than derived — the point is that they must not follow when the
 * tokens move. Dragging `type.caption.size` used to resize the editor's own
 * labels, which is the bug this exists to fix.
 *
 * They live here rather than in `Label.tsx` so they stay importable under
 * `node --test`, which `Label.tsx` itself is not: it pulls in react-native.
 * `test/chrome.test.ts` reads this table.
 *
 * Roles are named after the token roles they replace, so swapping a call site
 * over is a rename rather than a redesign.
 */
export const LABEL_SPEC = {
  caption: { size: 12, weight: '400', lineHeight: 16, letterSpacing: 0.1 },
  label: { size: 13, weight: '600', lineHeight: 18, letterSpacing: 0.2 },
  body: { size: 16, weight: '400', lineHeight: 24, letterSpacing: 0 },
  title: { size: 20, weight: '700', lineHeight: 26, letterSpacing: -0.3 },
} as const satisfies Record<string, LabelSpec>;

export type LabelRole = keyof typeof LABEL_SPEC;

export type LabelSpec = {
  size: number;
  weight: string;
  lineHeight: number;
  letterSpacing: number;
};

/**
 * Radii for chrome that used to borrow `radius.*`.
 *
 * `Blueprint.tsx` took its zoom pill from `t.radius.pill`, so a radius drag
 * reshaped the studio's own furniture. `pill` here is the same 999 for
 * appearance, and it stays put when the token moves.
 */
export const CHROME_RADIUS = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

const FRAME_DROP_SHADOW = '0px 24px 60px rgba(0,0,0,0.55)';

export function frameShadow(focused: boolean): string {
  const ring = focused ? '0px 0px 0px 2px rgba(217,72,30,0.35)' : '0px 0px 0px 1px rgba(255,245,235,0.03)';
  return `${ring}, ${FRAME_DROP_SHADOW}`;
}

export function chipStyle({
  active,
  pressed,
  size,
}: {
  active: boolean;
  pressed: boolean;
  size: 'regular' | 'compact';
}) {
  return {
    container: {
      paddingVertical: size === 'compact' ? 3 : 5,
      paddingHorizontal: size === 'compact' ? 8 : 12,
      borderRadius: CHROME_RADIUS.pill,
      backgroundColor: active ? '#D9481E' : CHROME.panel,
      opacity: pressed ? 0.7 : 1,
    },
    textColor: active ? '#fff' : CHROME.textMuted,
  };
}