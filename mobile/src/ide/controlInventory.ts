import type { Tone } from '../ds/reachability.ts';

export type DetectedControl = {
  id: string;
  frame: string;
  label: string;
  context: string;
  siblings: string[];
};

export type ControlSnapshot = {
  controls: DetectedControl[];
  framesRead: number;
  framesExpected: number;
};

export type ControlReport = {
  detected: number;
  declaredInert: number;
  unknown: number;
  tone: Tone;
  label: string;
  detail: string;
};

const TAB_LABELS = ['Today', 'Habits', 'Stats', 'Profile'];
const EMPTY_SETTINGS_HANDLERS = ['Dark mode follows system', 'Daily nudge', 'Weekly summary', 'Streak at risk'];

function isDeclaredInert(control: DetectedControl, tabScreens: readonly string[], navigationEnabled: boolean): boolean {
  if (!navigationEnabled && tabScreens.includes(control.frame) && TAB_LABELS.includes(control.label) &&
    control.siblings.length === TAB_LABELS.length && TAB_LABELS.every((label) => control.siblings.includes(label))) return true;
  if (!navigationEnabled && ['settings', 'habit'].includes(control.frame) && /^‹\s*Back$/.test(control.label)) return true;
  return control.frame === 'settings' && control.label === '' && EMPTY_SETTINGS_HANDLERS.includes(control.context);
}

export function summarizeControls(snapshot: ControlSnapshot, tabScreens: readonly string[], navigationEnabled = false): ControlReport {
  const controls = [...new Map(snapshot.controls.map((control) => [control.id, control])).values()];
  const detected = controls.length;
  const declaredInert = controls.filter((control) => isDeclaredInert(control, tabScreens, navigationEnabled)).length;
  const unknown = detected - declaredInert;
  const partial = snapshot.framesRead < snapshot.framesExpected;
  const coverage = `${snapshot.framesRead} of ${snapshot.framesExpected} frames read.`;
  if (snapshot.framesRead === 0 || detected === 0) {
    return {
      detected, declaredInert, unknown,
      tone: 'degraded',
      label: snapshot.framesRead === 0 ? 'control inventory: not measured' : 'control inventory: no controls detected',
      detail: `${coverage} This does not prove that the app has no controls.`,
    };
  }
  return {
    detected,
    declaredInert,
    unknown,
    tone: partial ? 'degraded' : 'muted',
    label: `${partial ? 'partial: ' : ''}${declaredInert} of ${detected} detected controls declared inert in the studio`,
    detail: `${unknown} unknown. ${coverage} Declarations describe studio rules, not observed behavior. The inventory does not press controls.`,
  };
}
