/**
 * Present mode is the studio board's read-only exhibition skin. The actor is
 * the presenter, not the editor: the camera's current screen fills the
 * viewport, the other frames and all board chrome hide, and token editing is
 * off. The app inside the presented frame stays live and the state log keeps
 * recording, so a demonstration is a demonstration, not a slideshow.
 *
 * This module is the pure layer: it decides *what* happens for an effect --
 * which screen stepping lands on, what scale fits, whether the keyboard may
 * answer, what the center translation is -- and leaves the platform calls
 * (state updates, fly-to-camera) to `MidpointPrototype.tsx`. Effect messages
 * and state live there; decision logic lives here, where Node tests can reach
 * it without a browser.
 *
 * Enter through the Present button or the `P` key. Exit through Escape or the
 * present bar's Exit button. Shareable-URL entry belongs to ticket 22 and is
 * not implemented here; nothing in this module reads the URL.
 */

export const FRAME_HEIGHT = 820;
export const SCALE_MIN = 0.5;
export const SCALE_MAX = 1.5;

/** Scale that shows the presented frame at viewport height or the clamp. */
export function presentScale(viewportHeight: number): number {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return SCALE_MIN;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, viewportHeight / FRAME_HEIGHT));
}

/**
 * Declared screen order is the reading order the presenter steps through: the
 * index of the current key, stepped by `delta`, clamped to the row. Not
 * window-sizes-never-match aware; the row is seven screens, not a viewport.
 */
export function stepDeclaredScreen(keys: readonly string[], currentKey: string, delta: number): string | null {
  const i = keys.indexOf(currentKey);
  if (i < 0) return null;
  const next = Math.min(keys.length - 1, Math.max(0, i + delta));
  return keys[next] ?? null;
}

/** `1 / N` indicator: current declared position and total. */
export function declaredPosition(keys: readonly string[], key: string): { current: number; total: number } {
  return { current: keys.indexOf(key) + 1, total: keys.length };
}

export type PresentKeyAction =
  | { type: 'exit' }
  | { type: 'step'; delta: number }
  | { type: 'toggleScheme' }
  | { type: 'enter' };

export type KeyContext = {
  key: string;
  targetEditable: boolean;
  targetControl: boolean;
  presenting: boolean;
};

export type PresentKeyResult =
  | { action: 'exit'; prevent: false }
  | { action: 'step'; delta: number }
  | { action: 'toggleScheme' }
  | { action: 'enter' };

/**
 * Keyboard contract. Global shortcuts do nothing while the user edits text or
 * another control holds focus; board chrome such as the exit button stays its
 * own button. Escape exits because there is no mode to escape into.
 * The present bar's scheme toggle and Exit are ordinary buttons; while
 * presenting, focus sits on the frame the presenter came from, so clicking
 * them refocuses rather than firing -- the keyboard contract is therefore the
 * operative one, and the bar labels it.
 */
export function presentKeyboardDecision(ctx: KeyContext): PresentKeyResult | null {
  if (ctx.targetEditable || ctx.targetControl) return null;
  if (!ctx.presenting) {
    return ctx.key === 'p' || ctx.key === 'P' ? { action: 'enter' } : null;
  }
  switch (ctx.key) {
    case 'Escape':
      return { action: 'exit', prevent: false };
    case 'ArrowLeft':
      return { action: 'step', delta: -1 };
    case 'ArrowRight':
      return { action: 'step', delta: 1 };
    case 'l':
    case 'L':
      return { action: 'toggleScheme' };
    default:
      return null;
  }
}

/**
 * Center translation that keeps the presented phone dead-center in the
 * viewport, independent of the board camera. The frame box is the phone plus
 * its 48px caption, so centering the frame would leave the phone `48 * scale`
 * pixels low; this centers on the phone box. The frame lives inside the board
 * world at its board position; this maps that position to the viewport center.
 */
export function presentTransform(
  frameLeft: number,
  phoneTop: number,
  phoneWidth: number,
  phoneHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  scale: number,
): { x: number; y: number; k: number } {
  const x = viewportWidth / 2 - (frameLeft + phoneWidth / 2) * scale;
  const y = viewportHeight / 2 - (phoneTop + phoneHeight / 2) * scale;
  return { x, y, k: scale };
}
