# 19 — Analytics tab

Type: task
Status: ready-for-agent
Labels: ready-for-agent
Blocked by: 15 — Analytics sender
Map: ../map.md
Spec: ../spec.md

## What to build

The studio gains an Analytics tab that explains the boundary. It states that analytics come from the app on a device or simulator and that the studio sends nothing. It links to the Mixpanel project. Without a token it says Mixpanel: not configured. It never shows the token and never shows a send log.

## Acceptance criteria

- [ ] The tab states that the studio sends nothing and links to the existing Mixpanel project.
- [ ] With no token the tab also reads Mixpanel: not configured. The token never appears.
- [ ] The tab is not a send log and not an embedded dashboard.
- [ ] A browser test intercepts every regional ingestion host. It uses a configured test token. It asserts zero requests after habit, sign-out, and navigation actions.
- [ ] A separate check covers the absent-token note. App actions still work.
- [ ] `npm test`, lint, and typechecking pass.
