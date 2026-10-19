import { create } from 'zustand';
import { track } from '../analytics/track.ts';
import { day } from './habitDates.ts';
import { SEED, type Habit } from './habitSeed.ts';

export { today, dateLabel, weekDays } from './habitDates.ts';
export { SEED, type Habit } from './habitSeed.ts';

type State = {
  habits: Habit[];
  signedIn: boolean;
  selectedId: string | null;
  signIn: () => void;
  signOut: () => void;
  select: (id: string | null) => void;
  toggleToday: (id: string) => void;
};

export const useHabits = create<State>((set, get) => ({
  habits: SEED,
  // Demo flow: land signed-in so the app opens to a populated Today screen.
  // Sign out drops you on the Login screen, which signs straight back in.
  signedIn: true,
  selectedId: null,
  signIn: () => set({ signedIn: true }),
  signOut: () => {
    // Only the transition is an event. A second call changes nothing and sends nothing.
    if (!get().signedIn) return;
    set({ signedIn: false, selectedId: null });
    track('Signed Out');
  },
  select: (id) => set({ selectedId: id }),
  toggleToday: (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit) return;
    const done = !habit.done.includes(day(0));
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id !== id ? h : { ...h, done: done ? [day(0), ...h.done] : h.done.filter((d) => d !== day(0)) },
      ),
    }));
    track('Habit Toggled', { habit_id: id, done });
  },
}));

/** Consecutive days ending today (or yesterday, if today isn't logged yet). */
export function streak(habit: Habit): number {
  const set_ = new Set(habit.done);
  let n = 0;
  // Allow the streak to still count if today simply hasn't happened yet.
  let start = set_.has(day(0)) ? 0 : 1;
  for (let i = start; ; i++) {
    if (!set_.has(day(i))) break;
    n++;
  }
  return n;
}
