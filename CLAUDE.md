## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Host resource policy

This machine also runs other work. Do not consume host memory without permission.

### Measure before you build

Measure the host before any command that allocates memory. Report these three values to the owner:

```bash
sysctl vm.swapusage                 # swap used / total
memory_pressure | tail -1           # system-wide free percentage
ps -Ao rss,comm -m | head -11       # top RSS consumers
```

### Ask before heavy work

Ask the owner in an interactive question before each tier. Wait for the answer. Do not batch the tiers into one question.

| Tier | Commands | Estimated peak |
|---|---|---|
| Light | `npm test`, lint, typecheck, `bash scripts/guard.sh` | 300 MB - 1 GB each |
| Medium | `npm run export:web`, the `browser/*.mjs` Playwright checks | 1.5 - 2.5 GB |
| Heavy | `npx expo prebuild`, `pod install`, `xcodebuild`, a booted Simulator with Metro | 5 - 8 GB |

The owner granted standing permission for the Light tier on 2026-10-19. Ask again for Medium and Heavy on each new session.

State the measured swap use and the estimated peak in every question. Give a "report it as blocked" option in every question.

### Never fake a verification

A check that the owner refuses is a blocked check. Record it as blocked in the report. Do not record it as a pass. Do not substitute a cheaper check and call it the same evidence.
