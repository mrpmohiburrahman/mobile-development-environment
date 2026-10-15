import { resolveFrames } from './boardFrames.ts';
import type { Column } from './spine.ts';
import type { ControlSnapshot, DetectedControl } from './controlInventory.ts';

const CONTROL_SELECTOR = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [tabindex="0"]';
const text = (element: Element | null): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

export function readControlInventory(host: unknown, keys: string[], column: Column): ControlSnapshot {
  const resolved = resolveFrames(host, keys, column);
  const controls: DetectedControl[] = [];
  for (const { key, element } of resolved.frames) {
    for (const [index, control] of Array.from(element.querySelectorAll(CONTROL_SELECTOR)).entries()) {
      if (control.getClientRects().length === 0 || control.closest('[hidden], [aria-hidden="true"]')) continue;
      if (typeof getComputedStyle === 'function' && getComputedStyle(control).visibility !== 'visible') continue;
      const parent = control.parentElement;
      const siblings = parent ? Array.from(parent.children).filter((child) => child.matches(CONTROL_SELECTOR)).map(text) : [];
      controls.push({
        id: `${column}:${key}:${index}`,
        frame: key,
        label: text(control),
        context: text(parent),
        siblings,
      });
    }
  }
  return { controls, framesRead: resolved.found, framesExpected: resolved.asked };
}
