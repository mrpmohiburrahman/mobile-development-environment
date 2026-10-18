import type { Scheme } from '../ds/editorState';

/**
 * The present bar: screen label, declared position, scheme toggle, and Exit.
 * Rendered by the board inside the viewport so it floats over the presented
 * frame at the viewport bottom edge. Owns no state -- label, position, and
 * scheme come in as props; Exit and the toggle call back out. Kept out of
 * `MidpointPrototype.tsx` so the bar can be reviewed (and styled) on its own.
 */
export function PresentBar({
  label,
  position,
  scheme,
  onToggleScheme,
  onExit,
}: {
  label: string;
  position: { current: number; total: number } | null;
  scheme: Scheme;
  onToggleScheme: () => void;
  onExit: () => void;
}) {
  return (
    <div className="mp-presentbar" role="toolbar" aria-label="Present bar">
      <span className="mp-present-label">
        <strong>{label}</strong>
        <span>{position ? `${position.current} / ${position.total}` : ''}</span>
      </span>
      <button
        type="button"
        aria-label={`Scheme: ${scheme}. Press to switch to ${scheme === 'light' ? 'dark' : 'light'}`}
        aria-pressed={scheme === 'dark'}
        onClick={onToggleScheme}>
        {scheme === 'light' ? 'Light' : 'Dark'}
      </button>
      <button type="button" onClick={onExit}>
        Exit
      </button>
    </div>
  );
}
