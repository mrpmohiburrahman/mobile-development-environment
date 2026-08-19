import { create } from 'zustand';

export type Habit = {
  id: string;
  name: string;
  category: 'health' | 'focus' | 'craft';
  target: number;
  /** ISO dates, most recent first. */
  done: string[];
};

const day = (offset: number) => {
  const d = new Date(2026, 7, 19 - offset);
  return d.toISOString().slice(0, 10);
};

const SEED: Habit[] = [
  { id: 'h1', name: 'Morning run', category: 'health', target: 5, done: [day(0), day(1), day(3), day(4)] },
  { id: 'h2', name: 'Read 20 pages', category: 'focus', target: 7, done: [day(0), day(1), day(2), day(3), day(4), day(5)] },
  { id: 'h3', name: 'Practice guitar', category: 'craft', target: 4, done: [day(1), day(2)] },
  { id: 'h4', name: 'No screens after 10pm', category: 'health', target: 7, done: [day(2), day(4), day(6)] },
  { id: 'h5', name: 'Write journal', category: 'focus', target: 3, done: [day(0), day(2), day(5)] },
  { id: 'h6', name: 'Sketch daily', category: 'craft', target: 5, done: [day(0)] },
];

type State = {
  habits: Habit[];
  signedIn: boolean;
  selectedId: string | null;
  signIn: () => void;
  signOut: () => void;
  select: (id: string | null) => void;
  toggleToday: (id: string) => void;
};

export const useHabits = create<State>((set) => ({
  habits: SEED,
  signedIn: false,
  selectedId: null,
  signIn: () => set({ signedIn: true }),
  signOut: () => set({ signedIn: false, selectedId: null }),
  select: (id) => set({ selectedId: id }),
  toggleToday: (id) =>
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id !== id
          ? h
          : { ...h, done: h.done.includes(day(0)) ? h.done.filter((d) => d !== day(0)) : [day(0), ...h.done] },
      ),
    })),
}));

export const today = () => day(0);

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
