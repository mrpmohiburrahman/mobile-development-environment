import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useEditorStore } from '../ds/editorState';
import { TokensFrom, useTokens } from '../ds/store';
import committedTokens from '../ds/tokens.json';
import type { TokenSource } from '../ds/renderSource';
import { SEED, useHabits } from '../store/habits';
import { frameId } from './boardFrames';
import {
  CAPTURE_FONT_CHECK,
  CAPTURE_SURFACE_HEIGHT,
  CAPTURE_SURFACE_WIDTH,
  captureFixtureFor,
  evaluateCaptureReadiness,
  expectedMeterScales,
  fixtureMatches,
  parseCaptureSearch,
  type CaptureParseOutcome,
  type CaptureRequest,
} from './captureMode';
import { CHROME, TONE } from './chrome';
import { DesigningProvider } from './designing';
import { judgeCandidates } from './renderFidelity';
import { BUNDLED_FONT_FAMILY, loadBundledFontWeights, probeFontCandidates } from './renderFidelity.dom';
import { screens } from './screens';

const KNOWN_SCREENS = screens.map((s) => s.key);
const SCREEN_BY_KEY = new Map(screens.map((s) => [s.key, s]));
const COMMITTED = committedTokens as Record<string, unknown>;
const COMMITTED_SOURCE: TokenSource = { kind: 'pinned', tree: COMMITTED, label: 'COMMITTED' };
const SERVER_CAPTURE: CaptureParseOutcome = { kind: 'inactive' };

let cachedSearch: string | null = null;
let cachedOutcome: CaptureParseOutcome = SERVER_CAPTURE;

function ignoreLocationChanges(): () => void {
  return () => {};
}

function readCaptureOutcome(): CaptureParseOutcome {
  if (typeof window === 'undefined') return SERVER_CAPTURE;
  const search = window.location.search;
  if (search !== cachedSearch) {
    cachedSearch = search;
    cachedOutcome = parseCaptureSearch(search, KNOWN_SCREENS);
  }
  return cachedOutcome;
}

export function useCaptureOutcome(): CaptureParseOutcome {
  return useSyncExternalStore(ignoreLocationChanges, readCaptureOutcome, () => SERVER_CAPTURE);
}

function applyCaptureFixture(request: CaptureRequest): void {
  const editor = useEditorStore.getState();
  if (editor.scheme !== request.scheme || Object.keys(editor.overrides).length > 0) {
    useEditorStore.setState({
      scheme: request.scheme,
      overrides: {},
      rejection: null,
      undoNote: null,
    });
  }
  if (!fixtureMatches(request, useHabits.getState(), SEED)) {
    const fixture = captureFixtureFor(request);
    useHabits.setState({
      habits: SEED.map((h) => ({ ...h, done: [...h.done] })),
      signedIn: fixture.signedIn,
      selectedId: fixture.selectedId,
    });
  }
}

function useFixtureActive(request: CaptureRequest): boolean {
  const habitsMatch = useHabits((s) => fixtureMatches(request, s, SEED));
  const editorMatches = useEditorStore(
    (s) => s.scheme === request.scheme && Object.keys(s.overrides).length === 0,
  );
  return habitsMatch && editorMatches;
}

function CommittedTokensProbe({ onReport }: { onReport: (active: boolean) => void }) {
  const tokens = useTokens();
  useLayoutEffect(() => {
    onReport((tokens as unknown) === COMMITTED);
  }, [tokens, onReport]);
  return null;
}

function readObservedMeterScales(surface: HTMLElement): number[] {
  const scales: number[] = [];
  for (const node of surface.querySelectorAll<HTMLElement>('*')) {
    const inlineMatch = /scaleX\(([^)]+)\)/.exec(node.style.transform || '');
    if (inlineMatch) {
      const value = Number.parseFloat(inlineMatch[1]);
      if (Number.isFinite(value)) scales.push(value);
      continue;
    }
    const computed = getComputedStyle(node);
    if (computed.transformOrigin.startsWith('0px ') && node.parentElement?.style.overflow === 'hidden') {
      const transform = computed.transform;
      scales.push(!transform || transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a);
    }
  }
  return scales;
}

function domMatchesFixture(surface: HTMLElement, request: CaptureRequest): boolean {
  const text = (surface.textContent ?? '').trim();
  if (text.length === 0) return false;
  if (request.screen !== 'habit') return true;
  if (request.state === 'populated') {
    return text.includes('Morning run') && !text.includes('No habit selected');
  }
  return text.includes('No habit selected') && !text.includes('Morning run');
}

function CaptureError({ message }: { message: string }) {
  return (
    <div
      id="capture-error"
      role="alert"
      data-capture-error="true"
      style={{
        maxWidth: 440,
        marginBottom: 12,
        padding: 16,
        borderRadius: 10,
        border: `1px solid ${CHROME.border}`,
        backgroundColor: CHROME.panel,
        color: TONE.degraded,
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        lineHeight: '18px',
      }}>
      {message}
    </div>
  );
}

function CaptureFrame({ mode, children }: { mode: 'active' | 'error'; children: ReactNode }) {
  return (
    <main
      aria-label="Capture mode"
      data-capture-mode={mode}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        padding: mode === 'error' ? 24 : 0,
        backgroundColor: CHROME.bg,
      }}>
      {children}
    </main>
  );
}

function CaptureValidSurface({ request }: { request: CaptureRequest }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const committedActive = useRef(false);
  const scheduleRef = useRef<() => void>(() => {});
  const [verdict, setVerdict] = useState<{ ready: boolean; error: string | null }>({
    ready: false,
    error: null,
  });
  const entry = SCREEN_BY_KEY.get(request.screen);
  const fixtureActive = useFixtureActive(request);

  const reportCommitted = useCallback((active: boolean) => {
    committedActive.current = active;
    scheduleRef.current();
  }, []);

  useLayoutEffect(() => {
    applyCaptureFixture(request);
  }, [request]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    let cancelled = false;
    let rafId = 0;
    let fontsSettled = false;
    let failedWeights: number[] = [];
    const trackedImages = new Set<HTMLImageElement>();

    const evaluate = () => {
      if (cancelled) return;
      const el = surfaceRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const transform = getComputedStyle(el).transform;
      const editor = useEditorStore.getState();
      const fixtureReady =
        fixtureMatches(request, useHabits.getState(), SEED) && domMatchesFixture(el, request);
      const judged = fontsSettled
        ? judgeCandidates([BUNDLED_FONT_FAMILY], probeFontCandidates([BUNDLED_FONT_FAMILY]))
        : [];
      const animations = el.getAnimations?.({ subtree: true }) ?? [];

      const next = evaluateCaptureReadiness({
        request,
        fixtureReady,
        activeScheme: editor.scheme,
        overrideCount: Object.keys(editor.overrides).length,
        committedTokensActive: committedActive.current,
        surfaceWidth: rect.width,
        surfaceHeight: rect.height,
        surfaceScale: !transform || transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a,
        fontsReady: fontsSettled,
        splineSansChecked: fontsSettled && Boolean(document.fonts?.check(CAPTURE_FONT_CHECK)),
        splineSansPresent: judged[0]?.fate === 'present',
        failedFontWeights: failedWeights,
        images: Array.from(document.images, (img) => ({
          complete: img.complete,
          naturalWidth: img.naturalWidth,
        })),
        reducedMotion: Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
        animationsFinished: animations.every((a) => a.playState === 'finished'),
        expectedMeterScales: expectedMeterScales(request, SEED),
        observedMeterScales: readObservedMeterScales(el),
      });

      setVerdict((prev) => (prev.ready === next.ready && prev.error === next.error ? prev : next));
    };

    const scheduleEvaluate = () => {
      if (cancelled) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(evaluate);
    };
    scheduleRef.current = scheduleEvaluate;

    const watchImages = () => {
      for (const img of Array.from(document.images)) {
        if (trackedImages.has(img)) continue;
        trackedImages.add(img);
        if (!img.complete) {
          img.addEventListener('load', scheduleEvaluate, { once: true });
          img.addEventListener('error', scheduleEvaluate, { once: true });
        }
      }
    };
    watchImages();

    const resizeObserver = new ResizeObserver(scheduleEvaluate);
    resizeObserver.observe(surface);

    const mutationObserver = new MutationObserver(() => {
      watchImages();
      scheduleEvaluate();
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'src'],
    });

    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    media?.addEventListener?.('change', scheduleEvaluate);

    const enforceFixture = () => {
      applyCaptureFixture(request);
      scheduleEvaluate();
    };
    const unEditor = useEditorStore.subscribe(enforceFixture);
    const unHabits = useHabits.subscribe(enforceFixture);

    void loadBundledFontWeights().then((failed) => {
      if (cancelled) return;
      fontsSettled = true;
      failedWeights = failed;
      scheduleEvaluate();
    });

    scheduleEvaluate();

    return () => {
      cancelled = true;
      scheduleRef.current = () => {};
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      media?.removeEventListener?.('change', scheduleEvaluate);
      unEditor();
      unHabits();
      for (const img of trackedImages) {
        img.removeEventListener('load', scheduleEvaluate);
        img.removeEventListener('error', scheduleEvaluate);
      }
    };
  }, [request]);

  if (!entry) return null;
  const Component = entry.Component;

  return (
    <CaptureFrame mode="active">
      {verdict.error && <CaptureError message={verdict.error} />}
      <div
        id={frameId(entry.key)}
        ref={surfaceRef}
        data-capture-surface="true"
        data-screen={request.screen}
        data-scheme={request.scheme}
        data-state={request.state}
        data-screenshot-ready={verdict.ready ? 'true' : undefined}
        style={{
          width: CAPTURE_SURFACE_WIDTH,
          height: CAPTURE_SURFACE_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
        <TokensFrom source={COMMITTED_SOURCE}>
          <CommittedTokensProbe onReport={reportCommitted} />
          {fixtureActive && (
            <DesigningProvider screenKey={entry.key} column="current">
              <Component />
            </DesigningProvider>
          )}
        </TokensFrom>
      </div>
    </CaptureFrame>
  );
}

export function CaptureSurface({
  outcome,
}: {
  outcome: Exclude<CaptureParseOutcome, { kind: 'inactive' }>;
}) {
  if (outcome.kind === 'invalid') {
    return (
      <CaptureFrame mode="error">
        <CaptureError message={outcome.error} />
      </CaptureFrame>
    );
  }
  return <CaptureValidSurface request={outcome.request} />;
}
