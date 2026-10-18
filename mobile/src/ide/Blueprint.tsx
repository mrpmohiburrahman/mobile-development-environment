import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { screens } from './screens';
import { CHROME, TONE } from './chrome';
import { useCommittedTokens } from './BaselinePanel';
import { DiskBadge } from './DiskBadge';
import { Label } from './Label';
import { clipTarget, describePresses } from './presses';
import { recordPress, setPressListening, useSpine } from './spineStore';
import { RenderVerdictBadge } from './RenderVerdict';
import { ControlInventoryBadge } from './ControlInventoryBadge';
import { frameSelector, parseFrameId } from './boardFrames';
import { StudioBoard } from './MidpointPrototype';

const FRAME_SELECTOR = frameSelector();
const LABELS = new Map(screens.map((s) => [s.key, s.label]));

function PressBadge() {
  const spine = useSpine();
  const report = describePresses(spine.tally, spine.pressListening);

  return (
    <View style={{ gap: 2, maxWidth: 560 }}>
      <Label role="caption" color={TONE[report.tone]} style={{ fontWeight: '600' }} numberOfLines={1}>
        {report.label}
      </Label>
      <Label role="caption" color={CHROME.textMuted} numberOfLines={2}>
        {report.detail}
        {spine.dropped > 0 ? ` ${spine.dropped} older rows left the ring. The count includes them.` : ''}
      </Label>
    </View>
  );
}

export function Blueprint({ comparing = false, focus = null }: { comparing?: boolean; focus?: string | null }) {
  const workspaceRef = useRef<View>(null);
  const { tree } = useCommittedTokens(comparing);
  const baseline = comparing ? tree : null;

  useEffect(() => {
    const node = workspaceRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) {
      setPressListening(false);
      return;
    }

    const handle = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest) return;
      const frame = target.closest(FRAME_SELECTOR);
      if (!frame || !node.contains(frame)) return;
      const parsed = parseFrameId(frame.id);
      if (!parsed) return;
      recordPress({
        frame: parsed.key,
        column: parsed.column,
        label: LABELS.get(parsed.key) ?? parsed.key,
        target: clipTarget(target.textContent),
      });
    };

    node.addEventListener('click', handle, true);
    setPressListening(true);
    return () => {
      node.removeEventListener('click', handle, true);
      setPressListening(false);
    };
  }, []);

  return (
    <View ref={workspaceRef} style={{ flex: 1, minHeight: 0, minWidth: 0, backgroundColor: CHROME.bg }}>
      <StudioBoard
        baseline={baseline}
        focus={focus}
        badge={<DiskBadge />}
        reports={
          <View style={{ gap: 8 }}>
            <ControlInventoryBadge host={workspaceRef} comparing={Boolean(baseline)} navigationEnabled />
            <PressBadge />
            <RenderVerdictBadge host={workspaceRef} />
          </View>
        }
      />
    </View>
  );
}
