# 06 — Present mode and the shareable URL

Type: grilling
Status: open
Blocked by: —
Map: ../map.md

## Question

"Blueprint view for easier conversations with stakeholders" becomes code as
two things chosen at charting: a **Present mode** and **shareable URL
state**. Grill until each is specified tightly enough to build:

**Present mode**

- Entry and exit: a button on the chrome, a keyboard shortcut, `?present=1`
  in the URL, or all three.
- What is hidden: all studio panels? the frame labels? the route edges?
- One screen large: which screen first, how large (fit height? fixed device
  scale?), and what arrow keys / click do.
- Light/dark toggle inside Present mode, and whether token edits are
  possible while presenting or the mode is strictly read-only.
- Does the state/analytics spine keep recording during a presentation?

**Shareable URL state**

- What is encoded: focused screen, scheme, zoom, scroll position, present
  flag, and **token overrides**. Overrides are the hard one — a full
  override set may be kilobytes. Decide between diff-from-committed only, a
  compressed hash fragment, or a server-held snapshot id (which the
  read-only Pages build cannot create).
- Where it lives: query string vs. hash fragment (Pages serves a subpath;
  Expo Router owns the path).
- Reproducibility on the deployed build: the link must reproduce the view
  with no token server. The honest zero: a link that references an override
  set the build cannot apply must say so.
- Copy-link affordance, and whether the URL updates live as you work or
  only on "Share".

Resolve with a short spec the implementation ticket can execute.
