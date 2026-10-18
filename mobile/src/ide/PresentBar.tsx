import type { Scheme } from '../ds/editorState';

/**
 * The present bar: screen label, declared position, Light/Dark toggle, and
 * Exit control. It floats over the presented screen frame at the bottom edge
 * of the board viewport. Its container opts out of the board's pointer capture
 * so both controls receive clicks while the frame below remains interactive.
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
    <div className="mp-presentbar" aria-label="Present bar">
      <span className="mp-present-label">
        <strong>{label}</strong>
        <span>{position ? `${position.current} / ${position.total}` : ''}</span>
      </span>
      <button
        type="button"
        aria-label={`Scheme: ${scheme}. Activate to switch to ${scheme === 'light' ? 'dark' : 'light'}`}
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
