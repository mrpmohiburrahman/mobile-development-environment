import { existsSync, readFileSync } from 'node:fs';
import { STATUS_PATH } from './shared.mjs';

const status = existsSync(STATUS_PATH) ? JSON.parse(readFileSync(STATUS_PATH, 'utf8')) : null;
const lines = ['## Screenshot comparison', ''];
if (!status || status.outcome === 'started') {
  lines.push(
    'Screenshot generation did not finish. This is an infrastructure failure, not a comparison result.',
    '',
    'Check the install, export, and browser launch steps above.',
  );
} else {
  lines.push(`Outcome: **${status.outcome}**`, '', '```', status.message ?? '', '```');
}
console.log(lines.join('\n'));
