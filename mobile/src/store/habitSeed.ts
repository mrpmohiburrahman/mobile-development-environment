import { day } from './habitDates.ts';

export type Habit = {
  id: string;
  name: string;
  category: 'health' | 'focus' | 'craft';
  target: number;
  /** ISO dates, most recent first. */
  done: string[];
};

export const SEED: Habit[] = [
  { id: 'h1', name: 'Morning run', category: 'health', target: 5, done: [day(0), day(1), day(3), day(4)] },
  { id: 'h2', name: 'Read 20 pages', category: 'focus', target: 7, done: [day(0), day(1), day(2), day(3), day(4), day(5)] },
  { id: 'h3', name: 'Practice guitar', category: 'craft', target: 4, done: [day(1), day(2)] },
  { id: 'h4', name: 'No screens after 10pm', category: 'health', target: 7, done: [day(2), day(4), day(6)] },
  { id: 'h5', name: 'Write journal', category: 'focus', target: 3, done: [day(0), day(2), day(5)] },
  { id: 'h6', name: 'Sketch daily', category: 'craft', target: 5, done: [day(0)] },
];
