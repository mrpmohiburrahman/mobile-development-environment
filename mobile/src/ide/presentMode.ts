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
 * Enter through the Present button or the `P` key. `Escape`, `P`, and the
 * present bar's Exit button exit. Shareable-URL entry belongs to ticket 22 and
 * is not implemented here; nothing in this module reads the URL.
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
 * index of the current key, stepped by `delta`, clamped to the row.
 */
export function stepDeclaredScreen(keys: readonly string[], currentKey: string, delta: number): string | null {
  const i = keys.indexOf(currentKey);
  if (i < 0) return null;
  const next = Math.min(keys.length - 1, Math.max(0, i + delta));
  return keys[next] ?? null;
}

/** The key nearest a board-space point, used when no camera screen exists. */
export function nearestScreenToPoint(
  centers: Readonly<Record<string, Point>>,
  keys: readonly string[],
  point: Point,
): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const key of keys) {
    const center = centers[key];
    if (!center) continue;
    const distance = Math.hypot(center.x - point.x, center.y - point.y);
    if (distance < bestDistance) {
      best = key;
      bestDistance = distance;
    }
  }
  return best;
}

/** `1 / N` indicator: current declared position and total. */
export function declaredPosition(keys: readonly string[], key: string): { current: number; total: number } {
  return { current: keys.indexOf(key) + 1, total: keys.length };
}

export type Point = { x: number; y: number };

export type KeyContext = {
  key: string;
  targetEditable: boolean;
  targetControl: boolean;
  presenting: boolean;
};

export type PresentKeyResult =
  | { action: 'exit' }
  | { action: 'step'; delta: number }
  | { action: 'toggleScheme' }
  | { action: 'enter' };

/**
 * Keyboard contract. Global shortcuts do nothing while the user edits text or
 * another control holds focus. `P` and `Escape` exit while presenting. Arrow
 * keys step. `L` changes scheme.
 */
export function presentKeyboardDecision(ctx: KeyContext): PresentKeyResult | null {
  if (ctx.targetEditable) return null;
  if (!ctx.presenting) {
    return !ctx.targetControl && (ctx.key === 'p' || ctx.key === 'P') ? { action: 'enter' } : null;
  }
  if (ctx.targetControl) return null;
  switch (ctx.key) {
    case 'Escape':
    case 'p':
    case 'P':
      return { action: 'exit' };
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
 * Center translation that keeps the presented app surface dead-center in the
 * viewport, independent of the board camera. The screen frame is the app
 * surface plus its 48px header, so centering the frame would leave the app
 * surface `48 * scale` pixels low. This centers on the app surface. The frame
 * lives inside the board world at its board position; this maps that position
 * to the viewport center.
 */
export function presentTransform(
  frameLeft: number,
  surfaceTop: number,
  surfaceWidth: number,
  surfaceHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  scale: number,
): { x: number; y: number; k: number } {
  const x = viewportWidth / 2 - (frameLeft + surfaceWidth / 2) * scale;
  const y = viewportHeight / 2 - (surfaceTop + surfaceHeight / 2) * scale;
  return { x, y, k: scale };
}
