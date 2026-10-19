import { isFullCommit } from './screenshotMatrix.ts';

export const NO_RUN_HEADLINE = 'No screenshot run on record';

const ABSENT_DETAIL = 'The studio has no bundled screenshot record. The studio has no approved baseline.';
const UNREADABLE_DETAIL = 'The bundled screenshot record is not readable. The studio has no approved baseline.';
const NO_RUN_HINT = 'Run npm run vr:update in the pinned image to write the record.';

const APPROVED_CAVEAT =
  'The baselines came from this source commit. This record does not show that this build passed. HEAD can be newer than this commit. Only the CI comparison checks a build.';

export type RegressionCase = {
  id: string;
  screen: string;
  scheme: string;
  state: string;
  baseline: string;
};

export type RegressionNote =
  | {
      kind: 'approved';
      headline: string;
      sourceCommit: string;
      details: string[];
      cases: RegressionCase[];
      caveat: string;
    }
  | {
      kind: 'none';
      headline: string;
      detail: string;
      hint: string;
    };

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCase(value: unknown): RegressionCase | null {
  if (!isRecordObject(value)) return null;
  const { id, screen, scheme, state, baseline } = value;
  if (
    typeof id !== 'string' ||
    typeof screen !== 'string' ||
    typeof scheme !== 'string' ||
    typeof state !== 'string' ||
    typeof baseline !== 'string'
  ) {
    return null;
  }
  return { id, screen, scheme, state, baseline };
}

function readCases(value: unknown): RegressionCase[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const cases = value.map(readCase);
  if (!cases.every((c): c is RegressionCase => c !== null)) return null;
  return new Set(cases.map((c) => c.id)).size === cases.length ? cases : null;
}

function none(detail: string): RegressionNote {
  return { kind: 'none', headline: NO_RUN_HEADLINE, detail, hint: NO_RUN_HINT };
}

function detailLines(record: Record<string, unknown>, sourceCommit: string, count: number): string[] {
  const lines = [`Source commit: ${sourceCommit}`];
  if (typeof record.image === 'string') lines.push(`Image: ${record.image}`);
  if (typeof record.environment === 'string') lines.push(`Environment: ${record.environment}`);
  const png = isRecordObject(record.png) ? record.png : null;
  if (png && typeof png.width === 'number' && typeof png.height === 'number' && typeof record.deviceScaleFactor === 'number') {
    lines.push(`Capture: ${png.width} by ${png.height} PNG at DPR ${record.deviceScaleFactor}`);
  }
  const css = isRecordObject(record.css) ? record.css : null;
  if (css && typeof css.width === 'number' && typeof css.height === 'number') {
    lines.push(`App surface: ${css.width} by ${css.height} CSS pixels`);
  }
  lines.push(`Cases: ${count}`);
  return lines;
}

export function regressionNote(record: unknown): RegressionNote {
  if (record === null || record === undefined) return none(ABSENT_DETAIL);
  if (!isRecordObject(record)) return none(UNREADABLE_DETAIL);
  const sourceCommit = record.sourceCommit;
  const cases = readCases(record.cases);
  if (!isFullCommit(sourceCommit) || !cases) return none(UNREADABLE_DETAIL);
  return {
    kind: 'approved',
    headline: `Approved at ${sourceCommit.slice(0, 7)}`,
    sourceCommit,
    details: detailLines(record, sourceCommit, cases.length),
    cases,
    caveat: APPROVED_CAVEAT,
  };
}
