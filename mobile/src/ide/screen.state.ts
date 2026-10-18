import { create } from 'zustand';

/**
 * The key of the frame the studio board camera is currently showing, and
 * whether the board is presenting.
 *
 * Present mode needs to know the camera screen after the board finishes a
 * camera flight, and the board is not a descendant of the present overlay's
 * host (both hang from `mobile/src/app/ide.tsx`), so a prop would thread
 * through three layers that never read it. A one-field store carries both
 * values instead, the same way the spine carries press data between the
 * studio chrome and the board. Not persisted, and the board is the only
 * writer.
 *
 * Keep the field name `presentedKey` distinct from the camera's working state:
 * this is the *settled* screen, written at fly rest and on entering Present,
 * not the camera's target mid-flight. Momentum-events-of-state, not the state
 * itself -- the log keeps the events; the UI keeps this one value.
 */
type ScreenState = {
  presentedKey: string | null;
  setPresentedKey: (key: string | null) => void;
  presenting: boolean;
  setPresenting: (presenting: boolean) => void;
};

export const useScreenState = create<ScreenState>((set) => ({
  presentedKey: null,
  setPresentedKey: (presentedKey) => set({ presentedKey }),
  presenting: false,
  setPresenting: (presenting) => set({ presenting }),
}));
