/**
 * What the board says about the presses on it.
 *
 * ## Why this exists
 *
 * Roughly half the controls on the blueprint dim under your finger and then do
 * nothing: the avatar, the stats card, all sixteen tab taps, four toggles that
 * were never implemented, two back bars. Nothing on screen says which half, or
 * why — so a developer reads a working control as a broken one, and the board's
 * silence reads as an accusation against the app.
 *
 * ## The words matter more than the count
 *
 * A press that changed nothing is **inert in the studio**. Never unavailable,
 * missing, unimplemented, or broken. The control is real; the blueprint
 * deliberately does not navigate, and the tab bar deliberately does not reach the
 * navigation seam. Every one of those would be called a bug if this panel called
 * it one, and it would be the panel that was wrong.
 *
 * That is also why a control unimplemented everywhere in the app gets no
 * stronger a word than one inert only in the studio: the studio cannot tell them
 * apart, so it does not claim to. The wording is the mechanism that keeps the
 * studio from over-claiming, and `test/presses.test.ts` asserts it.
 *
 * ## Where the attribution happens
 *
 * Not here. A capture-phase listener on the workspace node records every press
 * before the component's own handler runs — the same node the zoom listener
 * already attaches a wheel handler to — and `spine.ts` decides the verdict, since
 * pairing a press against an event needs the task structure only the spine has.
 *
 * This module shapes the *report* and holds the vocabulary. Pure, and no runtime
 * imports, so `test/presses.test.ts` can load it.
 */

import type { Tone } from '../ds/reachability.ts';
import type { PressTally, PressVerdict } from './spine.ts';

/** The four verdicts, in the order a reader meets them. */
export const PRESS_VERDICTS: readonly PressVerdict[] = [
  'live',
  'inert',
  'unattributed',
  'unlocated',
];

export type VerdictCopy = { tone: Tone; label: string; detail: string };

/**
 * One sentence per verdict, in the studio's own voice.
 *
 * No entry names the app as broken, because the studio has no evidence that it
 * is. `detail` on every entry names whose limitation the finding belongs to,
 * which is the whole difference between "this control does nothing" and "this
 * control does nothing **on the blueprint**".
 */
const VERDICT_COPY: Record<PressVerdict, VerdictCopy> = {
  live: {
    tone: 'ok',
    label: 'live',
    detail: 'this press changed something, so it is a working control',
  },
  inert: {
    tone: 'muted',
    label: 'inert in the studio',
    detail:
      'the press was seen and nothing changed. The blueprint does not navigate from a frame, so this is the studio’s limit, not a fault in the app.',
  },
  unattributed: {
    tone: 'muted',
    label: 'not credited',
    detail:
      'another press in the same interaction already took the one change between them. This press is counted, and no change is claimed for it.',
  },
  unlocated: {
    tone: 'degraded',
    label: 'press not located',
    detail:
      'the studio saw this press and could not say which frame it landed in. That is a failed measurement, so it is counted apart from the controls above.',
  },
};

export function pressVerdictCopy(verdict: PressVerdict): VerdictCopy {
  return VERDICT_COPY[verdict];
}

export type PressReport = {
  tone: Tone;
  label: string;
  detail: string;
  presses: number;
  live: number;
  inert: number;
  unattributed: number;
  unlocated: number;
  /** Whether the board's capture listener was attached when this was read. */
  listening: boolean;
};

/**
 * The badge in the board chrome.
 *
 * The label is a measurement and the detail is the caveat. Keeping them apart
 * matters: a panel that fuses them turns a caveat about the studio into an
 * accusation about the app, which is the reading this whole feature exists to
 * remove.
 *
 * `listening` is the honest-zero guard, and it is checked **first**. A tally of
 * zero gathered by a listener that never attached is not "nothing was pressed" —
 * it is "nothing was listening", and the two must not render as one string. That
 * is the same distinction the change log draws for the stores, and collapsing it
 * here would let a broken reader report a quiet board.
 */
export function describePresses(tally: PressTally, listening: boolean): PressReport {
  const { presses, live, inert, unattributed, unlocated } = tally;

  if (!listening && presses === 0) {
    return {
      tone: 'degraded',
      label: 'presses: not listening',
      detail:
        'the board’s capture listener never attached, so no press could have been counted. This is a failed measurement, not a quiet board.',
      ...tally,
      listening,
    };
  }

  // Presses gathered while it was listening, and the listener has since gone away.
  // The count is still real, so it is reported — with the gap stated rather than
  // left for the reader to assume the board is still being watched.
  const stale = listening ? '' : ' The board is not being listened to right now, so this count has stopped growing.';

  if (presses === 0) {
    return {
      tone: 'muted',
      label: 'no presses counted',
      detail:
        'press any control on the board to see whether it does anything. Nothing here has been pressed yet, which is not the same as nothing working.' +
        stale,
      ...tally,
      listening,
    };
  }

  const located = presses - unlocated;

  // Nothing could be placed, so there is no measurement to report — only the
  // measurement's own failure. Rendering "0 of 0 presses changed something" would
  // read as a result, and it is not one.
  if (located === 0) {
    return {
      tone: 'degraded',
      label: `${unlocated} press${unlocated === 1 ? '' : 'es'} could not be placed on a frame`,
      detail:
        'the studio saw them and could not say which frame they landed on. That is a failed measurement, not a result about the app.' +
        stale,
      ...tally,
      listening,
    };
  }

  // A failed measurement outranks a result: some presses were not placeable, so
  // the located count is incomplete and the badge must not present it as total.
  if (unlocated > 0) {
    return {
      tone: 'degraded',
      label: `${live} of ${located} presses changed something`,
      detail: `${unlocated} press${unlocated === 1 ? '' : 'es'} could not be placed on a frame, so the located count is incomplete. ${caveat(inert, unattributed)}` + stale,
      ...tally,
      listening,
    };
  }

  return {
    tone: live === presses ? 'ok' : inert > 0 ? 'degraded' : 'muted',
    label: `${live} of ${presses} presses changed something`,
    detail: caveat(inert, unattributed) + stale,
    ...tally,
    listening,
  };
}

function caveat(inert: number, unattributed: number): string {
  const parts: string[] = [];
  if (inert > 0) {
    parts.push(
      `${inert} inert in the studio — the press was seen and nothing changed, which is the blueprint not navigating rather than a control that does not work`,
    );
  }
  if (unattributed > 0) {
    parts.push(`${unattributed} not credited, because an earlier press in the same interaction took the change`);
  }
  return parts.length > 0 ? parts.join('. ') : 'every press the studio located changed something.';
}

/** How much of a pressed element's text a row shows. */
export const PRESS_TARGET_MAX = 48;

/**
 * The pressed element's own words, trimmed and clipped.
 *
 * A habit card carries its habit name, which is the only label on the board that
 * tells you *which* control a row is about. Collapsing it to "a control" would
 * make the report unusable; printing all of it would let one long string own a
 * row. So: trim, clip, and say so with an ellipsis.
 */
export function clipTarget(text: string | null): string | null {
  if (text === null) return null;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) return null;
  return trimmed.length <= PRESS_TARGET_MAX ? trimmed : `${trimmed.slice(0, PRESS_TARGET_MAX - 1)}…`;
}