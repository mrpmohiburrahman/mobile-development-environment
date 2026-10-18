import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { DesigningProvider } from './designing';
import { routerKeys, screens } from './screens';
import { PrototypeNavigationContext, type PrototypeAction } from './prototypeNavigation';
import { recordRoute, useSpine } from './spineStore';
import { backGap, describeBackGap, ROUTE_PROVENANCE, type RouteGap } from './routes';
import { countBackControls } from './renderFidelity.dom';
import { frameId, resolveFrames } from './boardFrames';
import {
  APP_ROUTES,
  bringToFront,
  buildTabConnections,
  destination,
  keyOf,
  mergeSpineRoutes,
  navigateBoardHistory,
  type BoardHistory,
  resolveFrameOverlap,
  stepFramePosition,
  type Connection,
  type Point,
} from './midpointBoard';
import { PresentBar } from './PresentBar';
import { useScreenState } from './screen.state';
import { presentKeyboardDecision, presentScale, presentTransform, declaredPosition, stepDeclaredScreen, nearestScreenToPoint } from './presentMode';
import { useEditorStore } from '../ds/editorState';
import { useHabits } from '../store/habits';
import { TokensFrom } from '../ds/store';
import './midpointPrototype.css';

type Activity = Connection & { mode: 'live' | 'preview'; seq: number };
type View = { x: number; y: number; k: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const LABELS = new Map(screens.map((s) => [s.key, s.label]));
const TAB_ROUTES: Connection[] = buildTabConnections(routerKeys, LABELS);
const W = 390;
const H = 820;
const GAP = 196;
const PAD = 72;
const CAPTION = 48;
const LANE = 56;
const MIN_K = 0.06;
const MAX_K = 1.6;
const FOOT = 120;
const DRAG_THRESHOLD = 4;
const POSITION_KEY = 'streak-studio.midpoints.frame-positions';
const width = screens.length * W + (screens.length - 1) * GAP + PAD * 2;
const labelOf = (key: string) => LABELS.get(key) ?? key;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Frame positions live in the browser only. Rearranging the board makes a
// journey easier to read, but the arrangement is not app state, so it never
// travels down the spine into the codebase.
function readPositions(): Record<string, Point> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const known = new Set(screens.map((s) => s.key));
    const next: Record<string, Point> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const p = value as Point | null;
      if (known.has(key) && p && Number.isFinite(p.x) && Number.isFinite(p.y)) next[key] = { x: p.x, y: p.y };
    }
    return next;
  } catch {
    return {};
  }
}

function writePositions(positions: Record<string, Point>) {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(positions).length === 0) window.localStorage.removeItem(POSITION_KEY);
    else window.localStorage.setItem(POSITION_KEY, JSON.stringify(positions));
  } catch {
    // Storage may be unavailable (private mode, quota). Positions then last for
    // this page load only, which is acceptable for a prototype.
  }
}

/** The affordance that says a frame can be dragged. Visible on hover only. */
function Grip() {
  return (
    <svg className="mp-grip" width="10" height="14" viewBox="0 0 10 14" aria-hidden="true" focusable="false">
      {[2, 7, 12].map((cy) => [2.5, 7.5].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.3} fill="currentColor" />))}
    </svg>
  );
}

function roundedPath(points: Point[], radius: number) {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1], p = points[i], next = points[i + 1];
    const a = Math.hypot(p.x - prev.x, p.y - prev.y);
    const b = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(radius, a / 2, b / 2);
    const start = { x: p.x - (p.x - prev.x) / a * r, y: p.y - (p.y - prev.y) / a * r };
    const end = { x: p.x + (next.x - p.x) / b * r, y: p.y + (next.y - p.y) / b * r };
    d += ` L ${start.x} ${start.y} Q ${p.x} ${p.y} ${end.x} ${end.y}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

export function StudioBoard({ baseline = null, focus = null, badge, reports }: {
  baseline?: Record<string, any> | null;
  focus?: string | null;
  badge?: ReactNode;
  reports?: ReactNode;
}) {
  const spine = useSpine();
  const presentedKey = useScreenState((s) => s.presentedKey);
  const setPresentedKey = useScreenState((s) => s.setPresentedKey);
  const presenting = useScreenState((s) => s.presenting);
  const scheme = useEditorStore((s) => s.scheme);
  const setScheme = useEditorStore((s) => s.setScheme);
  const setPresenting = useCallback((value: boolean) => useScreenState.getState().setPresenting(value), []);
  const [includeTabs, setIncludeTabs] = useState(false);
  const [sessionStart, setSessionStart] = useState(spine.seq);
  const [active, setActive] = useState<Activity | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.4 });
  const [fitMode, setFitMode] = useState(true);
  const [flying, setFlying] = useState(false);
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  const [observed, setObserved] = useState<Set<string>>(new Set());
  const [activity, setActivity] = useState<Activity[]>([]);
  const [extra, setExtra] = useState<Connection[]>([]);
  const [message, setMessage] = useState('No route observed. Use an app control or preview a connection.');
  const [selected, setSelected] = useState(0);
  const [inspector, setInspector] = useState(false);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [positionsReady, setPositionsReady] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [zOrder, setZOrder] = useState<string[]>(() => screens.map((s) => s.key));
  const [gap, setGap] = useState<RouteGap>(() => backGap(null));
  const viewport = useRef<HTMLDivElement>(null);
  const histories = useRef<Record<'live' | 'preview', BoardHistory>>({ live: {}, preview: {} });
  const previewDestination = useRef('habit');
  const seq = useRef(0);
  const drag = useRef<{ id: number; moved: boolean } | null>(null);
  const frameDrag = useRef<{ key: string; id: number; startX: number; startY: number; base: Point; moved: boolean } | null>(null);
  const lastGestureMoved = useRef(false);
  const spaceHeld = useRef(false);
  const flyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = active;
  const k = view?.k ?? 0.4;
  const movedCount = Object.keys(positions).length;

  useEffect(() => {
    const s = useHabits.getState();
    if (s.selectedId === null && s.habits[0]) s.select(s.habits[0].id);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setPositions(readPositions());
      setPositionsReady(true);
    });
    return () => {
      cancelAnimationFrame(id);
      if (flyTimer.current) clearTimeout(flyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (positionsReady) writePositions(positions);
  }, [positions, positionsReady]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const resolved = resolveFrames(viewport.current, screens.map((s) => s.key));
      setGap(backGap(resolved.found === 0 ? null : countBackControls(resolved.frames), resolved.missing));
    });
    return () => cancelAnimationFrame(id);
  }, [spine.seq, activity.length]);

  const { routes, spineObserved } = useMemo(() => {
    const all = [...APP_ROUTES, ...(includeTabs ? TAB_ROUTES : []), ...extra];
    const unique = all.filter((c, i) => all.findIndex((other) => keyOf(other) === keyOf(c)) === i);
    return mergeSpineRoutes(unique, spine.entries, routerKeys, LABELS, sessionStart);
  }, [includeTabs, extra, spine.entries, sessionStart]);
  const allObserved = useMemo(() => new Set([...observed, ...spineObserved]), [observed, spineObserved]);
  const gapCopy = describeBackGap(gap);
  const index = new Map(screens.map((s, i) => [s.key, i]));
  const detours = routes.filter((c) => Math.abs(index.get(c.from)! - index.get(c.to)!) > 1);
  const rowY = 60 + detours.length * LANE;
  const baselineOffset = baseline ? CAPTION + H + FOOT : 0;
  const height = rowY + CAPTION + H + FOOT + baselineOffset;
  const selectedRoute = routes[Math.min(selected, routes.length - 1)];
  const leftOf = (key: string) => PAD + index.get(key)! * (W + GAP);
  const frameAt = (key: string): Point => {
    const off = positions[key];
    return { x: leftOf(key) + (off?.x ?? 0), y: rowY + (off?.y ?? 0) };
  };
  const centerOf = (key: string): Point => {
    const p = frameAt(key);
    return { x: p.x + W / 2, y: p.y + CAPTION + H / 2 };
  };
  // The board bounds follow the frames, so fit and overview always frame what is
  // actually on the canvas. The declared board stays the lower bound: dragging a
  // frame inward never zooms the camera past the whole journey.
  const bounds: Bounds = useMemo(() => {
    const xs = screens.map((s) => frameAt(s.key).x);
    const ys = screens.map((s) => frameAt(s.key).y);
    return {
      minX: Math.min(0, ...xs),
      minY: Math.min(0, ...ys),
      maxX: Math.max(width, ...xs.map((x) => x + W)),
      maxY: Math.max(height, ...ys.map((y) => y + CAPTION + H + FOOT + baselineOffset)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, rowY, baselineOffset]);

  const fitView = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const k2 = clamp(Math.min((el.clientWidth - 60) / bw, (el.clientHeight - 60) / bh), MIN_K, MAX_K);
    setView({ k: k2, x: el.clientWidth / 2 - (bounds.minX + bw / 2) * k2, y: el.clientHeight / 2 - (bounds.minY + bh / 2) * k2 });
  }, [bounds]);

  const flyTo = useCallback((key: string | null, targetK?: number) => {
    const el = viewport.current;
    if (!el) return;
    if (key !== null) setPresentedKey(key);
    if (flyTimer.current) clearTimeout(flyTimer.current);
    if (key === null) {
      setFitMode(true);
      setFlying(true);
      fitView();
    } else {
      const c = centerOf(key);
      const k2 = clamp(targetK ?? Math.min((el.clientWidth - 160) / W, (el.clientHeight - 160) / (CAPTION + H + 80)), MIN_K, MAX_K);
      setFitMode(false);
      setFlying(true);
      setView({ k: k2, x: el.clientWidth / 2 - c.x * k2, y: el.clientHeight / 2 - c.y * k2 });
    }
    flyTimer.current = setTimeout(() => setFlying(false), 480);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitView, positions, rowY, setPresentedKey]);

  const presentKey = presenting ? presentedKey : null;
  const presentedLabel = presentKey ? labelOf(presentKey) : null;
  const presentedPos = presentKey ? declaredPosition(screens.map((s) => s.key), presentKey) : null;
  const presentK = presentScale(vpSize.h);
  const presentFrame = presentKey ? frameAt(presentKey) : null;
  const presentView = presentKey && presentFrame
    ? presentTransform(presentFrame.x, presentFrame.y + CAPTION, W, H, vpSize.w, vpSize.h, presentK)
    : null;

  useEffect(() => {
    if (!presenting) return;
    const decide = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));
      const control = Boolean(target?.closest('button, a, summary, [role="button"], [role="tab"], [role="switch"]'));
      const decision = presentKeyboardDecision({ key: event.key, targetEditable: editable, targetControl: control, presenting });
      if (!decision) return;
      event.preventDefault();
      if (decision.action === 'exit') setPresenting(false);
      else if (decision.action === 'step') {
        const key = useScreenState.getState().presentedKey;
        if (!key) return;
        const next = stepDeclaredScreen(screens.map((s) => s.key), key, decision.delta);
        if (next) setPresentedKey(next);
      } else if (decision.action === 'toggleScheme') {
        const cur = useEditorStore.getState().scheme;
        setScheme(cur === 'light' ? 'dark' : 'light');
      }
    };
    window.addEventListener('keydown', decide);
    return () => window.removeEventListener('keydown', decide);
  }, [presenting, setPresentedKey, setScheme, setPresenting]);

  const enterPresent = useCallback(() => {
    const current = useScreenState.getState().presentedKey;
    if (current) {
      setPresenting(true);
      return;
    }
    const el = viewport.current;
    if (!el || !view) {
      setPresenting(true);
      return;
    }
    const centerX = (el.clientWidth / 2 - view.x) / view.k;
    const centerY = (el.clientHeight / 2 - view.y) / view.k;
    const keys = screens.map((screen) => screen.key);
    const centers = Object.fromEntries(keys.map((key) => [key, centerOf(key)]));
    const key = nearestScreenToPoint(centers, keys, { x: centerX, y: centerY });
    if (key) setPresentedKey(key);
    setPresenting(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, rowY, positions, setPresentedKey, setPresenting]);

  useEffect(() => {
    if (!navigationTarget) return;
    const presenting = useScreenState.getState().presenting;
    if (presenting) {
      const id = requestAnimationFrame(() => {
        setPresentedKey(navigationTarget);
        setNavigationTarget(null);
      });
      return () => cancelAnimationFrame(id);
    }
    const id = requestAnimationFrame(() => {
      flyTo(navigationTarget);
      setNavigationTarget(null);
    });
    return () => cancelAnimationFrame(id);
  }, [navigationTarget, flyTo, setPresentedKey]);

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    const el = viewport.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = cx - rect.left, py = cy - rect.top;
    setFitMode(false);
    setView((v) => {
      const cur = v ?? { x: 0, y: 0, k: 0.4 };
      const k2 = clamp(cur.k * factor, MIN_K, MAX_K);
      const wx = (px - cur.x) / cur.k, wy = (py - cur.y) / cur.k;
      return { k: k2, x: px - wx * k2, y: py - wy * k2 };
    });
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setFitMode(false);
    setView((v) => v ? { ...v, x: v.x + dx, y: v.y + dy } : v);
  }, []);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => setVpSize({ w: el.clientWidth, h: el.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  // Re-fit on resize, and after a frame drag ends while the camera is in
  // overview. Not during the drag: a camera that chases the pointer makes the
  // frame feel like it is sliding away.
  useEffect(() => {
    if (fitMode && vpSize.w > 0 && !dragged) fitView();
  }, [fitMode, vpSize, fitView, dragged]);

  useEffect(() => {
    const el = viewport.current;
    if (!el || presenting) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.12 : 1 / 1.12);
      else panBy(-event.deltaX, -event.deltaY);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoomAt, panBy, presenting]);

  useEffect(() => {
    if (presenting) return;
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]') || event.metaKey || event.ctrlKey) return;
      if (event.key !== 'Escape' && target.closest('button, a, summary, [role="button"], [role="tab"], [role="switch"]')) return;
      if (event.key === ' ') { spaceHeld.current = true; setSpace(true); event.preventDefault(); }
      if (event.key === 'Escape' && frameDrag.current) {
        const key = frameDrag.current.key;
        const base = frameDrag.current.base;
        frameDrag.current = null;
        setDragged(null);
        setPositions((old) => {
          const next = { ...old };
          if (base.x === 0 && base.y === 0) delete next[key];
          else next[key] = base;
          return next;
        });
      }
      if (event.key === '+' || event.key === '=') zoomAt(vpSize.w / 2 + (viewport.current?.getBoundingClientRect().left ?? 0), vpSize.h / 2 + (viewport.current?.getBoundingClientRect().top ?? 0), 1.2);
      if (event.key === '-') zoomAt(vpSize.w / 2 + (viewport.current?.getBoundingClientRect().left ?? 0), vpSize.h / 2 + (viewport.current?.getBoundingClientRect().top ?? 0), 1 / 1.2);
      if (event.key === '0') { setFitMode(true); fitView(); }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === ' ') { spaceHeld.current = false; setSpace(false); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [zoomAt, fitView, vpSize, presenting]);

  useEffect(() => {
    if (presenting) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));
      const control = Boolean(target?.closest('button, a, summary, [role="button"], [role="tab"], [role="switch"]'));
      const decision = presentKeyboardDecision({ key: event.key, targetEditable: editable, targetControl: control, presenting: false });
      if (decision?.action === 'enter') { event.preventDefault(); enterPresent(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, enterPresent]);

  const record = (from: string, action: PrototypeAction, href: string | undefined, mode: 'live' | 'preview') => {
    setActive(null);
    const target = action === 'back' ? null : destination(href);
    if (!LABELS.has(from) || (target !== null && !LABELS.has(target))) {
      setMessage('No board destination exists for this route.');
      return;
    }
    const next = navigateBoardHistory(histories.current[mode], from, target);
    const to = next.to;
    if (to === null) {
      setMessage(action === 'back'
        ? `${labelOf(from)}: no back destination. Navigate into this screen first.`
        : `${labelOf(from)} is already the current tab. No navigation connection fired.`);
      return;
    }
    histories.current[mode] = next.history;
    if (mode === 'preview') previewDestination.current = to;
    const route = action === 'back'
      ? { from, to, action: 'Back', kind: 'back' as const }
      : [...APP_ROUTES, ...TAB_ROUTES].find((c) => c.from === from && c.to === to) ?? { from, to, action: 'Navigate', kind: 'app' as const };
    if (route.kind === 'tab') setIncludeTabs(true);
    if (action === 'back') setExtra((old) => [...old.filter((c) => keyOf(c) !== keyOf(route)), route]);
    if (mode === 'live') {
      setObserved((old) => new Set([...old, keyOf(route)]));
      if (action !== 'push') recordRoute({ from, to: to === 'index' ? '/' : `/${to}`, column: 'current' });
      setNavigationTarget(to);
    }
    const entry = { ...route, mode, seq: ++seq.current };
    setActive(entry);
    setActivity((old) => [entry, ...old].slice(0, 12));
    setMessage(`${mode === 'preview' ? 'Preview only' : 'Observed'}: ${labelOf(from)} → ${labelOf(to)} · ${route.action}`);
  };

  // Which side of its source frame a connection leaves from, in board space.
  // Spatial, not declared: a dragged frame keeps its connections attached to the
  // sides that actually face each other.
  const sideOf = (r: Connection) => Math.sign(centerOf(r.to).x - centerOf(r.from).x) || 1;

  const geometry = (c: Connection) => {
    // Direct or detour comes from the declared screen order and stays fixed.
    const direct = Math.abs(index.get(c.from)! - index.get(c.to)!) === 1;
    const dir = sideOf(c);
    const reverseExists = routes.some((r) => r.from === c.to && r.to === c.from);
    const start = frameAt(c.from);
    const end = frameAt(c.to);
    const startX = start.x + (dir === 1 ? W : 0);
    const endX = end.x + (dir === 1 ? 0 : W);
    const fromRoutes = routes.filter((r) => r.from === c.from && sideOf(r) === dir);
    const toRoutes = routes.filter((r) => r.to === c.to && sideOf(r) === dir);
    const fromPort = fromRoutes.findIndex((r) => keyOf(r) === keyOf(c));
    const toPort = toRoutes.findIndex((r) => keyOf(r) === keyOf(c));
    const dy = reverseExists ? -dir * 14 : 0;
    const startY = centerOf(c.from).y + (direct ? dy : (fromPort - (fromRoutes.length - 1) / 2) * 14);
    const endY = centerOf(c.to).y + (direct ? dy : (toPort - (toRoutes.length - 1) / 2) * 14);
    const labelFont = Math.min(11 / k, 26);
    if (direct) return { d: `M ${startX} ${startY} L ${endX} ${endY}`, startX, startY, endX, endY, direct, labelX: (startX + endX) / 2, labelY: (startY + endY) / 2 + (dir === 1 ? -labelFont * 1.8 : labelFont * 2.1), labelFont, lane: -1 };
    // Detour lanes stay tied to the declared row, so the lane stack keeps its
    // reading order whatever the frames on the board are doing.
    const lane = detours.findIndex((r) => keyOf(r) === keyOf(c));
    const laneY = rowY - (lane + 1) * LANE;
    const stub = (port: number) => GAP * (0.18 + Math.min(port, 6) * 0.044);
    const sx = startX + dir * stub(fromPort), ex = endX - dir * stub(toPort);
    const points = [{ x: startX, y: startY }, { x: sx, y: startY }, { x: sx, y: laneY }, { x: ex, y: laneY }, { x: ex, y: endY }, { x: endX, y: endY }];
    const d = roundedPath(points, 22);
    return { d, startX, startY, endX, endY, direct, labelX: (sx + ex) / 2, labelY: laneY, labelFont, lane };
  };

  const preview = (route: Connection) => record(route.from, route.kind === 'back' ? 'back' : route.kind === 'tab' ? 'tab' : 'push', route.to === 'index' ? '/' : `/${route.to}`, 'preview');
  const reset = () => {
    histories.current = { live: {}, preview: {} };
    previewDestination.current = 'habit';
    setSessionStart(spine.seq);
    setNavigationTarget(null);
    setActive(null);
    setObserved(new Set()); setActivity([]); setExtra([]); setSelected(0);
    setMessage('No route observed. Use an app control or preview a connection.');
  };
  // Reset layout restores both halves of the board arrangement: where the frames
  // sit and where the camera looks. A reset that only moved frames looked dead
  // after a pan or zoom, because the button stayed disabled while the view was
  // off. `flyTo(null)` animates the camera home and the fit effect re-runs once
  // the cleared positions change the bounds.
  const layoutDirty = movedCount > 0 || !fitMode;
  const resetLayout = () => {
    frameDrag.current = null;
    setDragged(null);
    setPositions({});
    flyTo(null);
    setMessage(movedCount > 0
      ? 'Frame positions and camera restored to the declared board layout.'
      : 'Camera restored to the board overview.');
  };

  // Board pan: any press that is not on a live app control, a drag handle, or the
  // canvas chrome. Space or the middle button pans even over an app surface.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (presenting) return;
    const target = event.target as HTMLElement;
    const onInteractive = Boolean(target.closest('.mp-phone, .mp-presentbar, .mp-canvas-controls, .mp-flybar, .mp-frame-heading, .mp-frame-footnote'));
    const canPan = event.button === 1 || spaceHeld.current || (event.button === 0 && !onInteractive);
    if (!canPan) return;
    event.preventDefault();
    drag.current = { id: event.pointerId, moved: false };
    setPanning(true);
    try { viewport.current?.setPointerCapture(event.pointerId); } catch { /* synthetic events in tests */ }
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    drag.current.moved = true;
    panBy(event.movementX, event.movementY);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    drag.current = null;
    setPanning(false);
  };

  const onHandlePointerDown = (key: string) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    lastGestureMoved.current = false;
    event.stopPropagation();
    event.preventDefault();
    setZOrder((old) => bringToFront(old, key));
    frameDrag.current = { key, id: event.pointerId, startX: event.clientX, startY: event.clientY, base: positions[key] ?? { x: 0, y: 0 }, moved: false };
    setDragged(key);
  };
  const onHandleKeyDown = (key: string) => (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      flyTo(key, 0.9);
      return;
    }
    const cur = positions[key] ?? { x: 0, y: 0 };
    const stepped = stepFramePosition(cur, event.key, event.shiftKey);
    if (!stepped) return;
    event.preventDefault();
    event.stopPropagation();
    setZOrder((old) => bringToFront(old, key));
    const keys = screens.map((s) => s.key);
    setPositions((old) => {
      if (stepped.x === 0 && stepped.y === 0) {
        const next = { ...old };
        delete next[key];
        return next;
      }
      const safe = resolveFrameOverlap(key, stepped, old, keys, leftOf, rowY, W, CAPTION);
      return { ...old, [key]: safe };
    });
    setMessage(
      stepped.x === 0 && stepped.y === 0
        ? `Restored ${labelOf(key)} to its declared position.`
        : `Moved ${labelOf(key)} by keyboard.`,
    );
  };
  const onFrameDoubleClick = (key: string) => (event: ReactMouseEvent) => {
    if (lastGestureMoved.current) return;
    event.preventDefault();
    flyTo(key, 0.9);
  };

  useEffect(() => {
    if (!dragged) return;
    const move = (event: PointerEvent) => {
      const d = frameDrag.current;
      if (!d || d.id !== event.pointerId) return;
      const dx = event.clientX - d.startX;
      const dy = event.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
      const scale = view?.k ?? 0.4;
      let wx = dx / scale;
      let wy = dy / scale;
      if (event.shiftKey) {
        if (Math.abs(dx) >= Math.abs(dy)) wy = 0;
        else wx = 0;
      }
      setPositions((old) => ({ ...old, [d.key]: { x: d.base.x + wx, y: d.base.y + wy } }));
    };
    const up = (event: PointerEvent) => {
      const d = frameDrag.current;
      if (!d || d.id !== event.pointerId) return;
      lastGestureMoved.current = d.moved;
      frameDrag.current = null;
      setDragged(null);
      if (d.moved) {
        const keys = screens.map((s) => s.key);
        setPositions((old) => {
          const cur = old[d.key];
          if (!cur) return old;
          const safe = resolveFrameOverlap(d.key, cur, old, keys, leftOf, rowY, W, CAPTION);
          if (safe.x === cur.x && safe.y === cur.y) return old;
          setMessage(`Nudged ${labelOf(d.key)} so both frame headers stay reachable.`);
          return { ...old, [d.key]: safe };
        });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragged, view, rowY]);

  return (
    <main
      className={presenting ? 'mp mp-presenting' : 'mp'}
      aria-label="Studio board"
      data-layout-ready={positionsReady && Boolean(view)}
      data-presenting={presenting}
      data-presented={presentKey ?? undefined}
      data-present-scale={presenting ? presentK : undefined}>
      <header className="mp-header">
        <div className="mp-brand"><span className="mp-brand-icon">S</span><span>Streak Studio</span></div>
        <span className="mp-header-divider" />
        <div className="mp-heading"><h1>Navigation board</h1><span>Real app screens · drag frames · pan and zoom</span></div>
        {badge}
        <div className="mp-header-actions"><button type="button" aria-label={`Present ${presentedLabel ?? 'board'}`} aria-pressed={presenting} onClick={() => (presenting ? setPresenting(false) : enterPresent())} title="Present the camera screen (P)">Present</button><button type="button" onClick={reset}>Reset session</button><button type="button" onClick={resetLayout} disabled={!layoutDirty} title="Restore frame positions and the camera overview">Reset layout</button><button type="button" aria-pressed={inspector} onClick={() => setInspector(!inspector)}>Route inspector {inspector ? '−' : '+'}</button></div>
      </header>

      <section className="mp-toolbar" aria-label="Board controls">
        <div className="mp-scope" role="group" aria-label="Route scope">
          <button type="button" aria-pressed={!includeTabs} onClick={() => setIncludeTabs(false)}>App actions <span>{APP_ROUTES.length}</span></button>
          <button type="button" aria-pressed={includeTabs} onClick={() => setIncludeTabs(true)}>Include tabs <span>+{TAB_ROUTES.length}</span></button>
        </div>
        <span className="mp-legend">Dashed: {ROUTE_PROVENANCE.declared.label} · Solid: {ROUTE_PROVENANCE.observed.label}</span>
        {view && reports && <details className="mp-reports"><summary>Studio evidence</summary><div>{reports}</div></details>}
        <div className="mp-viewhint">The camera flies to the screen each navigation lands on.</div>
      </section>

      <div className="mp-workspace">
        <div className="mp-canvas-shell">
          <div
            className="mp-viewport"
            ref={viewport}
            data-panning={panning}
            data-space={space}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}>
            {view && <div className="mp-world" data-flying={flying} style={presenting && presentView ? { width: bounds.maxX, height: bounds.maxY, transform: `translate(${presentView.x}px, ${presentView.y}px) scale(${presentView.k})` } : { width: bounds.maxX, height: bounds.maxY, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
              <svg className="mp-connectors" width={bounds.maxX} height={bounds.maxY} role="img" aria-label="Navigation connections between real app screens">
                <defs>
                  {['rest', 'used', 'active'].map((kind) => <marker key={kind} id={`mp-arrow-${kind}`} markerUnits="userSpaceOnUse" markerWidth={12} markerHeight={12} refX={10.5} refY={6} orient="auto"><path d="M 1.5 2.5 L 10.5 6 L 1.5 9.5" fill="none" stroke={`var(--${kind === 'active' ? 'accent' : kind === 'used' ? 'line-used' : 'line'})`} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></marker>)}
                </defs>
                {routes.map((route) => {
                  const g = geometry(route);
                  const id = keyOf(route);
                  const seen = allObserved.has(id);
                  const active = last && keyOf(last) === id;
                  const color = active ? 'var(--accent)' : seen ? 'var(--line-used)' : g.direct ? 'var(--line-direct)' : 'var(--line)';
                  const labelText = g.direct ? route.action.replace(/^(Open |Tab: )/, '') : route.action;
                  const labelWidth = labelText.length * g.labelFont * 0.56 + g.labelFont * 1.6;
                  const labelHeight = g.labelFont * 2;
                  return (
                    <g key={id} data-connection={id} data-direct={g.direct} data-active={Boolean(active)} data-evidence={seen ? 'observed' : 'declared'}>
                      <title>{`${labelOf(route.from)} → ${labelOf(route.to)}: ${route.action}. ${seen ? 'Observed' : 'Declared'}.`}</title>
                      <path d={g.d} fill="none" stroke="var(--canvas)" strokeWidth={6} strokeLinejoin="round" />
                      <path d={g.d} fill="none" stroke={color} strokeWidth={active ? 3 : 2.2} strokeDasharray={!seen ? '10 10' : undefined} strokeLinecap="round" markerEnd={`url(#mp-arrow-${active ? 'active' : seen ? 'used' : 'rest'})`} />
                      <circle cx={g.startX} cy={g.startY} r={3.4} fill="var(--canvas)" stroke={color} strokeWidth={1.8} />
                      {!g.direct && <circle cx={g.endX} cy={g.endY} r={3.4} fill="var(--canvas)" stroke={color} strokeWidth={1.8} />}
                      <g><rect x={g.labelX - labelWidth / 2} y={g.labelY - labelHeight / 2} width={labelWidth} height={labelHeight} rx={g.labelFont * 0.6} fill={active ? 'var(--label-active)' : 'var(--canvas)'} stroke={active ? 'var(--accent-border)' : 'var(--border)'} strokeWidth={1.2} /><text x={g.labelX} y={g.labelY + g.labelFont * 0.36} textAnchor="middle" fill={active ? 'var(--accent)' : 'var(--muted)'} fontWeight={active ? 600 : 400} fontSize={g.labelFont}>{labelText}</text></g>
                    </g>
                  );
                })}
              </svg>

              {screens.map(({ key, label, Component }, i) => {
                const p = frameAt(key);
                const z = dragged === key ? 10 : 1 + Math.max(0, zOrder.indexOf(key));
                return (
                  <section key={key} id={`mp-frame-${key}`} className="mp-frame" data-focused={focus === key} data-active={Boolean(last && (last.from === key || last.to === key))} data-dragging={dragged === key} data-presented={presenting && presentKey === key} aria-hidden={presenting && presentKey !== key} style={{ left: p.x, top: p.y, width: W, zIndex: presenting && presentKey === key ? 5 : z, '--readable-size': `${Math.min(12 / k, 40)}px` } as CSSProperties}>
                    <header className="mp-frame-heading" role="button" tabIndex={0} aria-label={`Move ${label} frame`} title="Drag or use arrow keys to move this screen frame" onFocus={() => setZOrder((old) => bringToFront(old, key))} onKeyDown={onHandleKeyDown(key)} onPointerDown={onHandlePointerDown(key)} onDoubleClick={onFrameDoubleClick(key)}><Grip /><span>{String(i + 1).padStart(2, '0')}</span><strong>{label}</strong><code>{key === 'index' ? '/' : `/${key}`}</code></header>
                    <div id={frameId(key)} className="mp-phone" style={{ width: W, height: H }}>
                      <PrototypeNavigationContext.Provider value={(action, href) => record(key, action, href, 'live')}><DesigningProvider screenKey={key} column="current"><Component /></DesigningProvider></PrototypeNavigationContext.Provider>
                    </div>
                    <div className="mp-frame-footnote" title="Drag to move this screen frame" onPointerDown={onHandlePointerDown(key)}>{key === 'habit' || key === 'settings' ? 'Back follows the latest incoming path' : 'Live component · shared app state'}</div>
                  </section>
                );
              })}
              {baseline && <TokensFrom source={{ kind: 'pinned', tree: baseline, label: 'HEAD' }}>
                {screens.map(({ key, label, Component }, i) => {
                  const p = frameAt(key);
                  return (
                    <section key={`base-${key}`} className="mp-frame mp-baseline" style={{ left: p.x, top: p.y + baselineOffset, width: W, '--readable-size': `${Math.min(12 / k, 40)}px` } as CSSProperties}>
                      <header className="mp-frame-heading"><span>{String(i + 1).padStart(2, '0')}</span><strong>{label} · HEAD</strong></header>
                      <div id={frameId(key, true)} className="mp-phone" style={{ width: W, height: H }}>
                        <DesigningProvider screenKey={key} column="comparison"><Component /></DesigningProvider>
                      </div>
                    </section>
                  );
                })}
              </TokensFrom>}
            </div>}

            <div className="mp-canvas-controls">
              <button type="button" aria-label="Zoom out" onClick={(e) => zoomAt(e.clientX, e.clientY, 1 / 1.25)}>−</button>
              <button type="button" aria-label="Zoom to 100%" onClick={(e) => { const el = viewport.current; if (!el || !view) return; const rect = el.getBoundingClientRect(); zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / view.k); }}>{Math.round(k * 100)}%</button>
              <button type="button" aria-label="Zoom in" onClick={(e) => zoomAt(e.clientX, e.clientY, 1.25)}>+</button>
              <button type="button" aria-pressed={fitMode} title="Fit the whole board in view" onClick={() => flyTo(null)}>Fit</button>
            </div>

            <div className="mp-flybar" role="group" aria-label="Fly to screen">
              {screens.map(({ key, label }) => <button type="button" key={key} onClick={() => flyTo(key)}>{label}</button>)}
            </div>

            {presenting && presentKey && presentedLabel && (
              <PresentBar
                label={presentedLabel}
                position={presentedPos}
                scheme={scheme}
                onToggleScheme={() => setScheme(scheme === 'light' ? 'dark' : 'light')}
                onExit={() => setPresenting(false)}
              />
            )}
          </div>
        </div>

        {inspector && <aside className="mp-inspector"><div className="mp-inspector-title"><h2>Route inspector</h2><span>{routes.length} connections</span></div><p>Preview a path without changing app state. Actual app controls mark routes as observed. {gapCopy.label} ({gapCopy.detail}).</p><div className="mp-route-list">{routes.map((r, i) => <button type="button" key={keyOf(r)} aria-pressed={i === selected} onClick={() => setSelected(i)}><span className="mp-route-number">{String(i + 1).padStart(2, '0')}</span><span><strong>{r.action}</strong><small>{labelOf(r.from)} → {labelOf(r.to)}</small></span><i className={allObserved.has(keyOf(r)) ? 'mp-used-dot' : 'mp-declared-dot'} /></button>)}</div><button type="button" className="mp-primary" onClick={() => selectedRoute && preview(selectedRoute)}>Preview selected route →</button><div className="mp-history"><h3>Recent actions</h3>{activity.length ? activity.slice(0, 5).map((a) => <div key={a.seq}><strong>{a.mode === 'preview' ? 'Preview' : 'Observed'}</strong><span>{labelOf(a.from)} → {labelOf(a.to)}</span></div>) : <p>No route observed in this session.</p>}</div></aside>}
      </div>

      <section className="mp-status" aria-live="polite"><span className={last?.mode === 'live' ? 'mp-status-live' : 'mp-status-label'}>{last ? last.mode === 'live' ? 'OBSERVED' : 'PREVIEW' : 'READY'}</span><span>{message}</span><small>{allObserved.size} observed · {routes.length} visible · {gapCopy.label} · {includeTabs ? 'tab routes included' : `${TAB_ROUTES.length} tab routes hidden`}{movedCount > 0 ? ` · ${movedCount} frame${movedCount === 1 ? '' : 's'} moved` : ''}</small></section>
      <footer className="mp-footer"><p className="mp-footer-hint">Drag a screen header or footer, or focus a header and press arrow keys, to move that frame. Drag empty board space to move the board. <kbd>Shift</kbd> locks one axis. <kbd>Esc</kbd> cancels a move. <kbd>0</kbd> fits the whole board. Reset layout restores frames and camera.</p><div className="mp-preview-controls"><label className="mp-action-select">Try a connection<select aria-label="Preview route" value={Math.min(selected, routes.length - 1)} onChange={(e) => setSelected(Number(e.target.value))}>{routes.map((r, i) => <option key={keyOf(r)} value={i}>{labelOf(r.from)} → {labelOf(r.to)} · {r.action}</option>)}</select></label><button type="button" className="mp-primary" onClick={() => selectedRoute && preview(selectedRoute)}>Preview →</button><button type="button" onClick={() => { record(previewDestination.current, 'back', undefined, 'preview'); }}>Back</button></div></footer>
    </main>
  );
}
