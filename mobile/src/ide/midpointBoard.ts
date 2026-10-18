import { screenKeyOf, tabKeys } from './routerKeys.ts';
import { buildRouteList, declaredTabRoutes } from './routes.ts';
import type { SpineEntry } from './spine.ts';

export type Connection = { from: string; to: string; action: string; kind: 'app' | 'tab' | 'back' };
export type Point = { x: number; y: number };
export type BoardHistory = Readonly<Record<string, readonly string[]>>;

export function navigateBoardHistory(history: BoardHistory, from: string, target: string | null): { history: BoardHistory; to: string | null } {
  const path = history[from] ?? [from];
  const to = target ?? (path.length > 1 ? path[path.length - 2] : null);
  if (to === null || to === from) return { history, to: null };
  return {
    history: { ...history, [to]: target === null ? path.slice(0, -1) : [...path, to] },
    to,
  };
}

export const APP_ROUTES: Connection[] = [
  { from: 'login', to: 'index', action: 'Sign in', kind: 'app' },
  { from: 'index', to: 'profile', action: 'Open profile', kind: 'app' },
  { from: 'index', to: 'stats', action: 'View progress', kind: 'app' },
  { from: 'index', to: 'habit', action: 'Open habit', kind: 'app' },
  { from: 'habits', to: 'habit', action: 'Open habit', kind: 'app' },
  { from: 'profile', to: 'settings', action: 'Open settings', kind: 'app' },
  { from: 'profile', to: 'login', action: 'Sign out', kind: 'app' },
];

export const KEYBOARD_STEP = 16;
export const KEYBOARD_SHIFT_STEP = 48;

export const keyOf = (c: Pick<Connection, 'from' | 'to'>): string => `${c.from}:${c.to}`;

export const destination = (href?: string): string =>
  !href || href === '/' ? 'index' : href.replace(/^\//, '').split(/[?#]/)[0];

export function buildTabConnections(routerKeys: string[], labels: ReadonlyMap<string, string>): Connection[] {
  const sources = tabKeys(routerKeys).map(screenKeyOf);
  const targets = declaredTabRoutes(routerKeys).map((row) => destination(row.to));
  return sources.flatMap((from) =>
    targets
      .filter((to) => to !== from)
      .map((to) => ({
        from,
        to,
        action: `Tab: ${labels.get(to) ?? to}`,
        kind: 'tab' as const,
      })),
  );
}

export function mergeSpineRoutes(
  baseRoutes: readonly Connection[],
  entries: SpineEntry[],
  routerKeys: string[],
  labels: ReadonlyMap<string, string>,
  afterSeq = 0,
): { routes: Connection[]; spineObserved: Set<string> } {
  const rows = buildRouteList(entries.filter((entry) => entry.seq > afterSeq), routerKeys);
  const spineObserved = new Set<string>();
  const discovered: Connection[] = [];
  const known = new Set(baseRoutes.map(keyOf));

  for (const row of rows) {
    if (row.provenance !== 'observed' || row.column !== 'current' || !row.from || !labels.has(row.from)) continue;
    const to = destination(row.to);
    if (to === row.from || !labels.has(to)) continue;
    const id = `${row.from}:${to}`;
    spineObserved.add(id);
    if (!known.has(id)) {
      known.add(id);
      discovered.push({
        from: row.from,
        to,
        action: `Navigate to ${labels.get(to) ?? to}`,
        kind: 'app',
      });
    }
  }

  return { routes: [...baseRoutes, ...discovered], spineObserved };
}

export function bringToFront(order: readonly string[], key: string): string[] {
  if (!order.includes(key)) return [...order, key];
  if (order[order.length - 1] === key) return [...order];
  return [...order.filter((k) => k !== key), key];
}

export function resolveFrameOverlap(
  movedKey: string,
  candidate: Point,
  positions: Readonly<Record<string, Point>>,
  keys: readonly string[],
  declaredLeft: (key: string) => number,
  rowY: number,
  frameWidth = 390,
  headerHeight = 48,
): Point {
  const targetX = declaredLeft(movedKey) + candidate.x;
  let targetY = rowY + candidate.y;
  const nudge = headerHeight + 8;

  for (let pass = 0; pass < keys.length; pass++) {
    let collided = false;
    for (const other of keys) {
      if (other === movedKey) continue;
      const off = positions[other];
      const ox = declaredLeft(other) + (off?.x ?? 0);
      const oy = rowY + (off?.y ?? 0);
      if (Math.abs(targetX - ox) < frameWidth - 48 && Math.abs(targetY - oy) < headerHeight) {
        targetY = oy + nudge;
        collided = true;
        break;
      }
    }
    if (!collided) break;
  }

  return { x: candidate.x, y: targetY - rowY };
}

export function stepFramePosition(current: Point, key: string, shiftKey = false): Point | null {
  const step = shiftKey ? KEYBOARD_SHIFT_STEP : KEYBOARD_STEP;
  switch (key) {
    case 'ArrowLeft':
      return { x: current.x - step, y: current.y };
    case 'ArrowRight':
      return { x: current.x + step, y: current.y };
    case 'ArrowUp':
      return { x: current.x, y: current.y - step };
    case 'ArrowDown':
      return { x: current.x, y: current.y + step };
    case 'Home':
      return { x: 0, y: 0 };
    default:
      return null;
  }
}
