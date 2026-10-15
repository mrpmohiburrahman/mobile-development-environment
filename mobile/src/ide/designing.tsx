import { createContext, useContext, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { recordRoute } from './spineStore';
import { usePrototypeNavigation } from './prototypeNavigation';
import type { Column } from './spine';

/**
 * Screens rendered inside the blueprint need to behave slightly differently:
 * a tap must not navigate, or the whole artboard would sail off to one route.
 *
 * The talk this is modelled on threaded a `designing` prop through every screen.
 * Context is better here — Expo Router owns screen mounting, so there is no
 * single call site to pass a prop from, and prop-drilling it would mean every
 * intermediate component grows an argument it doesn't care about.
 */
const DesigningContext = createContext(false);

/**
 * Which frame a screen is being rendered as.
 *
 * A **separate** context, deliberately. `useDesigning()` is consumed by
 * `mobile/src/ui/index.tsx`, which is byte-identical and uses the result as a
 * boolean — `if (designing) return`. Returning an object from the same hook would
 * make every tab tap and back press look "designing" in the real app, so the tab
 * bar would never navigate and the guard would have failed silently rather than
 * loudly.
 *
 * The frame's identity is what lets a route change say where it came from, and a
 * press say which frame it landed in.
 *
 * `BoardColumn` is the spine's `Column` under this module's name rather than a
 * second copy of the same two-value union: a route fact and a press fact both carry
 * it into the log, and two unions that happen to agree today are a drift waiting to
 * be introduced.
 */
export type BoardColumn = Column;
export type Frame = { screenKey: string | null; column: BoardColumn };

const FrameContext = createContext<Frame>({ screenKey: null, column: 'current' });

export const DesigningProvider = ({
  children,
  screenKey = null,
  column = 'current',
}: {
  children: ReactNode;
  screenKey?: string | null;
  column?: BoardColumn;
}) => (
  <FrameContext.Provider value={{ screenKey, column }}>
    <DesigningContext.Provider value={true}>{children}</DesigningContext.Provider>
  </FrameContext.Provider>
);

export const useDesigning = () => useContext(DesigningContext);

/** Which frame the calling screen is drawn as, when it is on the blueprint. */
export const useFrame = () => useContext(FrameContext);

/**
 * The navigation seam: the one place every route change passes through.
 *
 * It **records and returns**, and under the designing context it still does not
 * navigate. Both halves are load-bearing.
 *
 * Recording is what makes the route list possible at all. `useNavigate` is the
 * only function in the app that pushes, and every screen calls it instead of
 * `useRouter`, so one function sees every edge. A screen added later that reaches
 * the router directly would cost the list an edge with nothing reporting it —
 * hence the static test in `test/mechanisms.test.ts` that asserts no other call
 * site pushes.
 *
 * Not navigating is the older, more important half. A regression there loses the
 * reader their board, silently and irrecoverably, which is the worst failure this
 * work could produce: the studio would appear to work perfectly while showing a
 * different app. The guard and its test are both here rather than in review
 * because this is a one-line change with a catastrophic failure mode.
 */
export function useNavigate() {
  const designing = useDesigning();
  const frame = useFrame();
  const router = useRouter();
  const prototypeNavigation = usePrototypeNavigation();
  return (href: string) => {
    recordRoute({ from: frame.screenKey, to: href, column: frame.column });
    if (designing) prototypeNavigation?.('push', href);
    if (designing) return;
    router.push(href as never);
  };
}