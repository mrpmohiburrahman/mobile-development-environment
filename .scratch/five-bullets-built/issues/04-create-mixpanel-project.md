# 04 — Create the Mixpanel project

Type: task (HITL)
Status: resolved
Blocked by: —
Map: ../map.md

## Question

A real Mixpanel project must exist before ticket 07 can design against it
and before any event can be verified end to end. Only you can create it.

Checklist:

1. Sign up or sign in at mixpanel.com. The free plan is enough.
2. Create a project named `mobile-development-environment` (or your choice).
   Pick the data residency region you want — note it; the ingestion URL
   depends on it.
3. Open **Project Settings → Access Keys**. Copy the **Project Token**.
4. Create `mobile/.env.local` (gitignored — confirm `.gitignore` covers it;
   add the line if not) containing:

   ```
   EXPO_PUBLIC_MIXPANEL_TOKEN=<token>
   EXPO_PUBLIC_MIXPANEL_REGION=us   # or eu / in
   ```

5. If you want the deployed GitHub Pages build to send events too, add the
   same two values as **repository secrets** named `MIXPANEL_TOKEN` and
   `MIXPANEL_REGION`. Otherwise skip, and the public build will say "not
   sending".
6. Keep the Mixpanel **Events** page open; ticket 07's verification posts a
   planted event and expects to see it there.

Resolve by recording: project name, region, where the token lives, and
whether the repo secrets were set. Never paste the token into this file.

## Answer

- Project: `mobile-development-environment` (project ID 4074212, organization `personal`)
- Region: `us`
- Token: `mobile/.env.local` as `EXPO_PUBLIC_MIXPANEL_TOKEN`. Git ignores that file.
- Repository secrets `MIXPANEL_TOKEN` and `MIXPANEL_REGION`: not set. The public build says "not sending" until the implementation ticket adds them.
- Resolved: 2026-10-16
