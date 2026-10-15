import { useEffect, useState, type RefObject } from 'react';
import { View } from 'react-native';
import { frameSelector } from './boardFrames';
import { readControlInventory } from './controlInventory.dom';
import { summarizeControls, type ControlSnapshot } from './controlInventory';
import { screenKeyOf, tabKeys } from './routerKeys';
import { screens, routerKeys } from './screens';
import { useSpine } from './spineStore';
import { CHROME, TONE } from './chrome';
import { Label } from './Label';

const keys = screens.map((screen) => screen.key);
const tabScreens = tabKeys(routerKeys).map(screenKeyOf);
const empty = (): ControlSnapshot => ({ controls: [], framesRead: 0, framesExpected: keys.length });

export function ControlInventoryBadge({ host, comparing }: { host: RefObject<View | null>; comparing: boolean }) {
  const { seq } = useSpine();
  const [snapshots, setSnapshots] = useState({ current: empty(), comparison: empty() });

  useEffect(() => {
    const node = host.current as unknown as HTMLElement | null;
    if (!node?.querySelector) return;
    let pending = 0;
    const schedule = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        setSnapshots({
          current: readControlInventory(node, keys, 'current'),
          comparison: comparing ? readControlInventory(node, keys, 'comparison') : empty(),
        });
      });
    };
    schedule();
    const observer = new MutationObserver((records) => {
      if (records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        return target?.closest(frameSelector());
      })) schedule();
    });
    observer.observe(node, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['tabindex', 'role', 'hidden', 'aria-hidden', 'disabled', 'aria-disabled'] });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(pending);
    };
  }, [host, comparing, seq]);

  const columns = comparing ? ['current', 'comparison'] as const : ['current'] as const;
  return (
    <View nativeID="control-inventory" style={{ gap: 4, maxWidth: 700 }}>
      {columns.map((column) => {
        const report = summarizeControls(snapshots[column], tabScreens);
        return (
          <View key={column} style={{ gap: 2 }}>
            <Label role="caption" color={TONE[report.tone]} style={{ fontWeight: '600' }}>
              {column === 'current' ? 'Current' : 'HEAD comparison'}: {report.label}
            </Label>
            <Label role="caption" color={CHROME.textMuted}>{report.detail}</Label>
          </View>
        );
      })}
      <Label role="caption" color={CHROME.textMuted}>
        Declarations cover tab and back guards, plus Settings controls with empty handlers. Other behavior remains unknown.
      </Label>
      <Label role="caption" color={CHROME.textMuted}>
        Detection covers buttons, links, form fields, and tab stops. Custom controls without these signals can be absent from this count.
      </Label>
    </View>
  );
}
