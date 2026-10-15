export const day = (offset: number) => {
  const d = new Date(Date.UTC(2026, 7, 19 - offset));
  return d.toISOString().slice(0, 10);
};

export const today = () => day(0);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateLabel(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function weekDays(): { iso: string; weekday: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const iso = day(6 - i);
    return { iso, weekday: WEEKDAYS[new Date(iso).getUTCDay()] };
  });
}
