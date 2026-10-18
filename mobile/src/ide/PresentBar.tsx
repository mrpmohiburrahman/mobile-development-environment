import type { Scheme } from '../ds/editorState';

/**
 * The present bar: screen label, declared position, scheme, and Exit hint.
 * Rendered by the board inside the viewport so it floats over the presented
 * frame at the viewport bottom edge. While presenting, focus sits on the
 * frame the presenter came from, so the bar's own buttons refocus rather than
 * fire -- the keyboard is the operative control: Left/Right step, L switches
 * scheme, Escape exits. The bar is a readout, not a toolbar.
 */
export function PresentBar({
  label,
  position,
  scheme,
}: {
  label: string;
  position: { current: number; total: number } | null;
  scheme: Scheme;
}) {
  return (
    <div className="mp-presentbar" role="toolbar" aria-label="Present bar">
      <span className="mp-present-label">
        <strong>{label}</strong>
        <span>{position ? `${position.current} / ${position.total}` : ''}</span>
      </span>
      <span className="mp-present-scheme" aria-label={`Scheme: ${scheme}. Press L to switch.`}>{scheme === 'light' ? 'Light' : 'Dark'}</span>
      <span className="mp-present-hint">← → · L · Esc</span>
    </div>
  );
}
