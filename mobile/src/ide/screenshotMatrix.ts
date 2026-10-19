import { EMPTY_STATE_SCREEN } from './captureMode.ts';

export const SCREENSHOT_SCHEMES = ['light', 'dark'] as const;
export type ScreenshotScheme = (typeof SCREENSHOT_SCHEMES)[number];

export type ScreenshotState = 'populated' | 'empty';

export type ScreenshotCase = {
  screen: string;
  scheme: ScreenshotScheme;
  state: ScreenshotState;
  id: string;
  baseline: string;
};

export const SCREENSHOT_VIEWPORT = { width: 480, height: 900 } as const;
export const SCREENSHOT_DPR = 2;
export const SCREENSHOT_CSS_WIDTH = 390;
export const SCREENSHOT_CSS_HEIGHT = 820;
export const SCREENSHOT_PNG_WIDTH = SCREENSHOT_CSS_WIDTH * SCREENSHOT_DPR;
export const SCREENSHOT_PNG_HEIGHT = SCREENSHOT_CSS_HEIGHT * SCREENSHOT_DPR;
export const SCREENSHOT_DIR = 'e2e/__screenshots__';
export const SCREENSHOT_RECORD_PATH = 'mobile/src/ide/screenshot-record.json';

export const CAPTURE_CONTEXT = {
  viewport: SCREENSHOT_VIEWPORT,
  deviceScaleFactor: SCREENSHOT_DPR,
  reducedMotion: 'reduce',
  timezoneId: 'UTC',
  colorScheme: 'light',
  locale: 'en-GB',
} as const;

export const CAPTURE_SCREENSHOT = { scale: 'device', animations: 'disabled', caret: 'hide' } as const;

export const DIFF_OPTIONS = { threshold: 0, maxDiffPixelRatio: 0 } as const;

export const PINNED_PLATFORM = 'linux';
export const PINNED_ARCH = 'arm64';
export const PINNED_OS_CODENAME = 'noble';
export const PINNED_BROWSERS_PATH = '/ms-playwright';
export const PINNED_ENVIRONMENT = `${PINNED_PLATFORM}/${PINNED_ARCH}`;

export function screenshotCaseId(screen: string, scheme: string, state: string): string {
  return `${screen}-${scheme}-${state}`;
}

export function screenshotBaselineFor(screen: string, scheme: string, state: string): string {
  return `${SCREENSHOT_DIR}/${screenshotCaseId(screen, scheme, state)}.png`;
}

function caseFor(screen: string, scheme: ScreenshotScheme, state: ScreenshotState): ScreenshotCase {
  return {
    screen,
    scheme,
    state,
    id: screenshotCaseId(screen, scheme, state),
    baseline: screenshotBaselineFor(screen, scheme, state),
  };
}

export function screenshotMatrix(screens: readonly string[]): ScreenshotCase[] {
  const populated = screens.flatMap((screen) => SCREENSHOT_SCHEMES.map((scheme) => caseFor(screen, scheme, 'populated')));
  const empty = screens.includes(EMPTY_STATE_SCREEN)
    ? SCREENSHOT_SCHEMES.map((scheme) => caseFor(EMPTY_STATE_SCREEN, scheme, 'empty'))
    : [];
  return [...populated, ...empty];
}

export function captureUrlFor(c: ScreenshotCase): string {
  return `?capture=1&screen=${c.screen}&scheme=${c.scheme}&state=${c.state}`;
}

export function playwrightImageFor(version: string): string {
  return `mcr.microsoft.com/playwright:v${version}-noble`;
}

export type PinFacts = {
  platform: string;
  arch: string;
  osCodename: string | null;
  browsersPath: string | undefined;
  chromiumInstalled: boolean;
  declaredImage: string | undefined;
};

export type PinVerdict = { pinned: boolean; image: string; reasons: string[] };

export function evaluatePin(facts: PinFacts, playwrightVersion: string): PinVerdict {
  const image = playwrightImageFor(playwrightVersion);
  const reasons: string[] = [];
  if (facts.platform !== PINNED_PLATFORM) reasons.push(`platform is ${facts.platform}, not ${PINNED_PLATFORM}`);
  if (facts.arch !== PINNED_ARCH) reasons.push(`architecture is ${facts.arch}, not ${PINNED_ARCH}`);
  if (facts.osCodename !== PINNED_OS_CODENAME) {
    reasons.push(`operating system is ${facts.osCodename ?? 'unknown'}, not Ubuntu ${PINNED_OS_CODENAME}`);
  }
  if (facts.browsersPath !== PINNED_BROWSERS_PATH) {
    reasons.push(`PLAYWRIGHT_BROWSERS_PATH is ${facts.browsersPath ?? 'unset'}, not ${PINNED_BROWSERS_PATH}`);
  }
  if (!facts.chromiumInstalled) reasons.push(`the image has no Chromium build for Playwright ${playwrightVersion}`);
  if (facts.declaredImage !== image) reasons.push(`VR_IMAGE is ${facts.declaredImage ?? 'unset'}, not ${image}`);
  return { pinned: reasons.length === 0, image, reasons };
}

export type CompareVerdict = { action: 'compare' | 'skip' | 'fail'; message: string };

export const SKIP_MESSAGE = 'comparison skipped: this is not the pinned image, so this result is not a pass';

export function compareVerdict(pin: PinVerdict, requireCompare: boolean): CompareVerdict {
  if (pin.pinned) return { action: 'compare', message: `comparison runs in ${pin.image}` };
  const why = pin.reasons.join('; ');
  if (requireCompare) return { action: 'fail', message: `${SKIP_MESSAGE}. VR_REQUIRE_COMPARE=1 fails a skip. ${why}` };
  return { action: 'skip', message: `${SKIP_MESSAGE}. ${why}` };
}

export function updateRefusal(pin: PinVerdict): string | null {
  if (pin.pinned) return null;
  return `vr:update refuses to run outside the pinned Linux image ${pin.image} (${PINNED_ENVIRONMENT}). No baselines were written. ${pin.reasons.join('; ')}`;
}

export type ScreenshotRecordCase = {
  id: string;
  screen: string;
  scheme: string;
  state: string;
  baseline: string;
  bytes: number;
};

export type ScreenshotRecord = {
  sourceCommit: string;
  environment: string;
  image: string;
  playwrightVersion: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  png: { width: number; height: number };
  css: { width: number; height: number };
  totalBytes: number;
  cases: ScreenshotRecordCase[];
};

export function buildScreenshotRecord(input: {
  sourceCommit: string;
  playwrightVersion: string;
  cases: { screenshot: ScreenshotCase; bytes: number }[];
}): ScreenshotRecord {
  const cases = input.cases.map(({ screenshot, bytes }) => ({
    id: screenshot.id,
    screen: screenshot.screen,
    scheme: screenshot.scheme,
    state: screenshot.state,
    baseline: screenshot.baseline,
    bytes,
  }));
  return {
    sourceCommit: input.sourceCommit,
    environment: PINNED_ENVIRONMENT,
    image: playwrightImageFor(input.playwrightVersion),
    playwrightVersion: input.playwrightVersion,
    viewport: { ...SCREENSHOT_VIEWPORT },
    deviceScaleFactor: SCREENSHOT_DPR,
    png: { width: SCREENSHOT_PNG_WIDTH, height: SCREENSHOT_PNG_HEIGHT },
    css: { width: SCREENSHOT_CSS_WIDTH, height: SCREENSHOT_CSS_HEIGHT },
    totalBytes: cases.reduce((sum, c) => sum + c.bytes, 0),
    cases,
  };
}

export type ScreenshotValidation = { ok: boolean; errors: string[] };

const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

export function validateScreenshotRecord(
  record: unknown,
  matrix: readonly ScreenshotCase[],
  opts: { existingBaselines: readonly string[]; playwrightVersion: string },
): ScreenshotValidation {
  if (!record || typeof record !== 'object') {
    return { ok: false, errors: ['screenshot record is missing'] };
  }
  const errors: string[] = [];
  const r = record as Partial<ScreenshotRecord>;
  if (typeof r.sourceCommit !== 'string' || !COMMIT_PATTERN.test(r.sourceCommit)) {
    errors.push('screenshot record has no full source commit');
  }
  if (r.playwrightVersion !== opts.playwrightVersion) {
    errors.push(`screenshot record Playwright ${r.playwrightVersion ?? 'unset'} does not match ${opts.playwrightVersion}`);
  }
  if (r.image !== playwrightImageFor(opts.playwrightVersion)) errors.push('screenshot record image is not the pinned image');
  if (r.environment !== PINNED_ENVIRONMENT) errors.push(`screenshot record environment is not ${PINNED_ENVIRONMENT}`);
  if (r.deviceScaleFactor !== SCREENSHOT_DPR) errors.push(`screenshot record DPR is not ${SCREENSHOT_DPR}`);
  if (r.png?.width !== SCREENSHOT_PNG_WIDTH || r.png?.height !== SCREENSHOT_PNG_HEIGHT) {
    errors.push(`screenshot record PNG size is not ${SCREENSHOT_PNG_WIDTH} by ${SCREENSHOT_PNG_HEIGHT}`);
  }
  if (!Array.isArray(r.cases)) return { ok: false, errors: [...errors, 'screenshot record has no cases'] };
  if (matrix.length === 0) errors.push('screenshot matrix is empty');
  const byId = new Map(r.cases.map((c) => [c.id, c]));
  for (const expected of matrix) {
    const found = byId.get(expected.id);
    if (!found) errors.push(`screenshot record is missing case ${expected.id}`);
    else if (
      found.screen !== expected.screen ||
      found.scheme !== expected.scheme ||
      found.state !== expected.state ||
      found.baseline !== expected.baseline
    ) {
      errors.push(`screenshot record case ${expected.id} does not match the matrix`);
    }
  }
  if (r.cases.length !== matrix.length) {
    errors.push(`screenshot record has ${r.cases.length} cases, expected ${matrix.length}`);
  }
  if (r.totalBytes !== r.cases.reduce((sum, c) => sum + (c.bytes ?? 0), 0)) {
    errors.push('screenshot record total bytes do not match its cases');
  }
  const existing = new Set(opts.existingBaselines);
  for (const expected of matrix) {
    if (!existing.has(expected.baseline)) errors.push(`missing baseline ${expected.baseline}`);
  }
  return { ok: errors.length === 0, errors };
}

export function parsePngSize(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || signature.some((value, i) => bytes[i] !== value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

export function samePngBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
