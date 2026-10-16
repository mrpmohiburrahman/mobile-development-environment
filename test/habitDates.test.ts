import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const datesUrl = new URL('../mobile/src/store/habitDates.ts', import.meta.url).href;
const expected = {
  today: '2026-08-19',
  label: 'Wed, Aug 19',
  monthBoundary: ['2026-07-31', '2026-09-01'],
  yearLabels: ['Thu, Jan 1', 'Thu, Dec 31'],
  // The Habit detail "Recent" rows. West of UTC, `getDay()` on an ISO date
  // string reads the evening before, so Wednesday showed as Tuesday.
  longWeekdays: ['Wednesday', 'Tuesday', 'Sunday', 'Thursday'],
  week: [
    { iso: '2026-08-13', weekday: 'Thu' },
    { iso: '2026-08-14', weekday: 'Fri' },
    { iso: '2026-08-15', weekday: 'Sat' },
    { iso: '2026-08-16', weekday: 'Sun' },
    { iso: '2026-08-17', weekday: 'Mon' },
    { iso: '2026-08-18', weekday: 'Tue' },
    { iso: '2026-08-19', weekday: 'Wed' },
  ],
};

for (const timezone of ['UTC', 'Asia/Dhaka', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
  test(`demo dates match server-rendered text in ${timezone}`, () => {
    const script = `
      import { day, today, dateLabel, weekDays, weekdayLong } from ${JSON.stringify(datesUrl)};
      console.log(JSON.stringify({
        today: today(),
        label: dateLabel(today()),
        monthBoundary: [day(19), day(-13)],
        yearLabels: [dateLabel('2026-01-01'), dateLabel('2026-12-31')],
        longWeekdays: [today(), day(1), day(3), '2026-01-01'].map(weekdayLong),
        week: weekDays(),
      }));
    `;
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
      env: { ...process.env, TZ: timezone },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), expected);
  });
}
