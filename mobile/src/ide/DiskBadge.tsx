import { useSyncExternalStore } from 'react';
import { Text as RNText, View } from 'react-native';
import { serverIsReachable, subscribeServerStatus } from '../ds/client';
import { describeReachability } from '../ds/reachability';
import { CHROME, TONE } from './chrome';

/**
 * The current write target, subscribed rather than sampled.
 *
 * `useSyncExternalStore` is the right primitive here because the value lives
 * outside React, in a module-level flag that `pushToken`/`revertTokens` write to
 * on a background promise. Reading `serverIsReachable()` during render without
 * subscribing would look correct and then silently go stale.
 *
 * The third argument matters for this route specifically: the web build is
 * `output: "static"`, so this component is server-rendered at build time. During
 * that render there is no subscription, and the honest answer is `null` — "not
 * checked yet". Omitting the server snapshot does not degrade the badge, it
 * throws during prerender.
 *
 * Exported because later tickets need the same read without the pill around it.
 */
export function useWriteTarget() {
  return useSyncExternalStore(subscribeServerStatus, serverIsReachable, serverIsReachable);
}

/**
 * Says where an edit went: to `tokens.json` on disk, to the in-memory override
 * layer only, or not yet determined.
 *
 * It uses raw `RNText` at fixed sizes rather than `Text` from `../ui`, which
 * reads `useTheme()`. Dragging `type.caption.size` would otherwise resize the one
 * component whose job is to report on the tokens — the badge about the token
 * layer should not be resized by it. This is also already what a studio-local
 * `Label` will be, so it is not work that a later Label swap has to redo.
 *
 * It never fetches. The flag is only ever written by a real write attempt, so a
 * badge that says "not checked yet" is reporting that nothing has been tried —
 * not that a probe came back empty. That is why no probe runs on mount.
 */
export function DiskBadge() {
  const reachable = useWriteTarget();
  const { target, tone, label, detail } = describeReachability(reachable);

  return (
    <View style={{ alignItems: 'flex-end', gap: 3 }}>
      <View
        accessibilityRole="text"
        accessibilityLabel={`Token writes: ${label}. ${detail}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingVertical: 4,
          paddingHorizontal: 10,
          borderRadius: 999,
          backgroundColor: CHROME.panel,
          borderWidth: 1,
          borderColor: target === 'memory' ? TONE.degraded : CHROME.border,
        }}>
        <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: TONE[tone] }} />
        <RNText style={{ color: CHROME.text, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 }}>
          {label}
        </RNText>
      </View>
      {/* The consequence, always visible. A hover tooltip would hide the one
          sentence that makes the state mean anything. */}
      <RNText style={{ color: CHROME.textMuted, fontSize: 11 }}>{detail}</RNText>
    </View>
  );
}