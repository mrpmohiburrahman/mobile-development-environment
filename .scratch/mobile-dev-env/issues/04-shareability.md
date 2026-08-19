Type: grilling
Status: resolved

## Question

The token server writes to disk, so a static web deploy cannot do the real loop. How does an employer see this working?

## Answer

GitHub repo + README with GIFs + a read-only web deploy.

The deployed build runs the IDE with in-memory token edits: live recolouring works and feels identical, but nothing is written. The README GIFs carry the part a deploy structurally cannot show — the `git diff` moment, which is the actual thesis of the talk.

This means the token client needs two backends behind one interface (HTTP when a token server is reachable, in-memory otherwise), decided in ticket 05.

Rejected: a hosted token server with real writes — orthogonal infra work, and shared mutable state on a public URL gets griefed within a day.
