Type: task
Status: resolved
Blocked by: 01, 03

## Question

Build the seven habit-tracker screens against the token system, with seeded local data.

## Answer

Seven screens under `src/app/`: Login, Today (index), All habits, Habit detail, Stats, Profile, Settings. Seeded local data in `src/store/habits.ts`, no API keys, no backend.

All of them render through `src/ui/` components that read tokens at render time rather than baking values in — that is what makes a single token edit repaint the entire blueprint at once.
