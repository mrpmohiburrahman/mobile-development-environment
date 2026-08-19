import type { ComponentType } from 'react';

/**
 * The blueprint's screen list, read from the router directory at build time.
 *
 * Metro supports `require.context`, so adding a route file puts it on the
 * artboard automatically. The alternative — a hand-written import list, as in
 * the talk this is modelled on — silently goes stale the first time someone
 * adds a screen and forgets, which is exactly the drift the blueprint exists
 * to catch.
 */
const ctx = (require as any).context('../app', false, /\.tsx$/);

/** Not routes we want on the artboard: the layout wrapper and the IDE itself. */
const EXCLUDE = new Set(['./_layout.tsx', './ide.tsx']);

/** Reading order for the artboard — roughly the order a user meets them. */
const ORDER = ['login', 'index', 'habits', 'habit', 'stats', 'profile', 'settings'];

const LABELS: Record<string, string> = {
  index: 'Today',
  habits: 'All habits',
  habit: 'Habit detail',
};

export type ScreenEntry = {
  key: string;
  label: string;
  route: string;
  Component: ComponentType<any>;
};

export const screens: ScreenEntry[] = ctx
  .keys()
  .filter((k: string) => !EXCLUDE.has(k))
  .map((k: string) => {
    const key = k.replace(/^\.\//, '').replace(/\.tsx$/, '');
    return {
      key,
      label: LABELS[key] ?? key[0].toUpperCase() + key.slice(1),
      route: key === 'index' ? '/' : `/${key}`,
      Component: ctx(k).default,
    };
  })
  .filter((s: ScreenEntry) => Boolean(s.Component))
  .sort((a: ScreenEntry, b: ScreenEntry) => {
    const ia = ORDER.indexOf(a.key);
    const ib = ORDER.indexOf(b.key);
    // Unlisted screens sort after listed ones, alphabetically among themselves.
    if (ia === -1 && ib === -1) return a.key.localeCompare(b.key);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
