import type { Scheme } from '../ds/editorState.ts';

export const CAPTURE_SURFACE_WIDTH = 390;
export const CAPTURE_SURFACE_HEIGHT = 820;
export const CAPTURE_FONT_CHECK = '700 16px "Spline Sans"';
export const POPULATED_HABIT_ID = 'h1';
export const EMPTY_STATE_SCREEN = 'habit';

export type CaptureState = 'populated' | 'empty';

export type CaptureRequest = {
  screen: string;
  scheme: Scheme;
  state: CaptureState;
};

export type CaptureFixture = {
  signedIn: true;
  selectedId: string | null;
};

export type SeedHabit = {
  id: string;
  name: string;
  category: 'health' | 'focus' | 'craft';
  target: number;
  done: readonly string[];
};

export type ImageObservation = {
  complete: boolean;
  naturalWidth: number;
};

export type CaptureReadinessInput = {
  request: CaptureRequest;
  fixtureReady: boolean;
  activeScheme: Scheme;
  overrideCount: number;
  committedTokensActive: boolean;
  surfaceWidth: number;
  surfaceHeight: number;
  surfaceScale: number;
  fontsReady: boolean;
  splineSansChecked: boolean;
  splineSansPresent: boolean;
  failedFontWeights: readonly number[];
  images: readonly ImageObservation[];
  reducedMotion: boolean;
  animationsFinished: boolean;
  expectedMeterScales: readonly number[];
  observedMeterScales: readonly number[];
};

export type CaptureReadinessVerdict = {
  ready: boolean;
  error: string | null;
};

export type CaptureParseOutcome =
  | { kind: 'inactive' }
  | { kind: 'valid'; request: CaptureRequest }
  | { kind: 'invalid'; error: string };

export const CAPTURE_ERRORS = {
  captureFlag: 'Capture mode needs capture=1 in the URL query.',
  unknownScreen: 'Capture mode does not know the requested screen.',
  unknownScheme: 'Capture mode does not know the requested colour scheme. Use light or dark.',
  unknownState: 'Capture mode does not know the requested state. Use populated or empty.',
  emptyNotSupported: 'The empty state is only for the Habit detail screen.',
  missingFont: 'Capture mode cannot load the required Spline Sans font.',
  failedImage: 'Capture mode found a failed image.',
  reducedMotion: 'Capture mode needs prefers-reduced-motion set to reduce.',
} as const;

export function parseCaptureSearch(
  search: string,
  knownScreens: readonly string[],
): CaptureParseOutcome {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (!params.has('capture')) {
    return { kind: 'inactive' };
  }
  if (params.get('capture') !== '1') {
    return { kind: 'invalid', error: CAPTURE_ERRORS.captureFlag };
  }
  const screen = params.get('screen');
  if (!screen || !knownScreens.includes(screen)) {
    return { kind: 'invalid', error: CAPTURE_ERRORS.unknownScreen };
  }
  const scheme = params.get('scheme');
  if (scheme !== 'light' && scheme !== 'dark') {
    return { kind: 'invalid', error: CAPTURE_ERRORS.unknownScheme };
  }
  const state = params.get('state');
  if (state !== 'populated' && state !== 'empty') {
    return { kind: 'invalid', error: CAPTURE_ERRORS.unknownState };
  }
  if (state === 'empty' && screen !== EMPTY_STATE_SCREEN) {
    return { kind: 'invalid', error: CAPTURE_ERRORS.emptyNotSupported };
  }
  return { kind: 'valid', request: { screen, scheme, state } };
}

export function captureFixtureFor(request: CaptureRequest): CaptureFixture {
  return {
    signedIn: true,
    selectedId: request.screen === EMPTY_STATE_SCREEN && request.state === 'populated' ? POPULATED_HABIT_ID : null,
  };
}

export function fixtureMatches(
  request: CaptureRequest,
  current: { signedIn: boolean; selectedId: string | null; habits: readonly SeedHabit[] },
  seed: readonly SeedHabit[],
): boolean {
  const expected = captureFixtureFor(request);
  if (current.signedIn !== expected.signedIn || current.selectedId !== expected.selectedId) {
    return false;
  }
  if (current.habits.length !== seed.length) return false;
  for (let i = 0; i < seed.length; i++) {
    const a = current.habits[i];
    const b = seed[i];
    if (
      !a ||
      a.id !== b.id ||
      a.name !== b.name ||
      a.category !== b.category ||
      a.target !== b.target ||
      a.done.length !== b.done.length ||
      !a.done.every((dayIso, j) => dayIso === b.done[j])
    ) {
      return false;
    }
  }
  return true;
}

function meterScaleFor(habit: SeedHabit): number {
  const pct = Math.min(100, Math.round((habit.done.length / Math.max(1, habit.target)) * 100));
  return pct / 100;
}

export function expectedMeterScales(request: CaptureRequest, seed: readonly SeedHabit[]): number[] {
  if (request.screen === 'habit') {
    if (request.state === 'empty') return [];
    const selected = seed.find((h) => h.id === POPULATED_HABIT_ID);
    return selected ? [meterScaleFor(selected)] : [];
  }
  if (request.screen === 'index' || request.screen === 'stats') {
    return seed.map(meterScaleFor);
  }
  if (request.screen === 'habits') {
    return (['health', 'focus', 'craft'] as const).flatMap((cat) =>
      seed.filter((h) => h.category === cat).map(meterScaleFor),
    );
  }
  return [];
}

export function evaluateCaptureReadiness(input: CaptureReadinessInput): CaptureReadinessVerdict {
  if (!input.reducedMotion) {
    return { ready: false, error: CAPTURE_ERRORS.reducedMotion };
  }
  if (input.images.some((img) => img.complete && img.naturalWidth <= 0)) {
    return { ready: false, error: CAPTURE_ERRORS.failedImage };
  }
  if (
    input.failedFontWeights.length > 0 ||
    (input.fontsReady && (!input.splineSansChecked || !input.splineSansPresent))
  ) {
    return { ready: false, error: CAPTURE_ERRORS.missingFont };
  }
  if (!input.fixtureReady) return { ready: false, error: null };
  if (input.activeScheme !== input.request.scheme) return { ready: false, error: null };
  if (input.overrideCount !== 0 || !input.committedTokensActive) return { ready: false, error: null };
  if (
    Math.round(input.surfaceWidth) !== CAPTURE_SURFACE_WIDTH ||
    Math.round(input.surfaceHeight) !== CAPTURE_SURFACE_HEIGHT ||
    Math.abs(input.surfaceScale - 1) >= 0.001
  ) {
    return { ready: false, error: null };
  }
  if (!input.fontsReady || !input.splineSansChecked || !input.splineSansPresent) {
    return { ready: false, error: null };
  }
  if (!input.images.every((img) => img.complete && img.naturalWidth > 0)) {
    return { ready: false, error: null };
  }
  if (!input.animationsFinished) return { ready: false, error: null };
  if (
    input.observedMeterScales.length !== input.expectedMeterScales.length ||
    !input.expectedMeterScales.every((expected, i) => Math.abs((input.observedMeterScales[i] ?? -1) - expected) < 0.001)
  ) {
    return { ready: false, error: null };
  }
  return { ready: true, error: null };
}


