Type: task
Status: open
Blocked by: 05

## Question

Write down the three things we are not building, so nobody re-derives them.

## Why

`studio-honesty` found the README making claims the code did not support, and
fixed them. The same failure runs the other way: a rejected idea that leaves no
trace gets re-proposed by the next person who reads the talk, usually as a
feature. Each of these three cost real analysis to decide.

Decisions are cheap to record and expensive to lose. This is the ticket.

## Three rejections

### 1. Mixpanel — rejected

Zero occurrences of `mixpanel`, `Mixpanel`, `analytics` or `Analytics` in the
transcript. One unvalidated bullet.

It is a **product** feature arriving in a **dev tool**, and it fails three
standing constraints:

- A runtime dependency. The server is Node-stdlib-only and the app takes no
  dependency for anything the studio does.
- A committed project token, which breaks the deliberate credential-free clone
  (`mobile-dev-env` ticket 01: *"no API keys, no backend, seeded local data, so a
  clone runs instantly"*).
- It is orthogonal to the thesis. The claim is that design changes land in the
  codebase as git diffs. Phone-home telemetry is a different product, and it
  would be the one part of the bundle talking to a third party.

**Kept:** the shape. An event stream from the running app is what items 1 and 2
needed, and ticket 02 builds it with no SDK, no account and no network.

### 2. Pixel-diff visual regression — rejected, on a precondition

Ticket 05 has the argument. Short form: this app has no fixed typeface — the
first two families in `--font-display` are installed nowhere — so every unique
thing a pixel diff would add is font-dependent, and a font-independent visual
regression reduces to the style comparison that already exists.

Not refused on principle. **Waiting on a precondition**, and ticket 05 builds the
measurement that says whether the precondition holds.

### 3. Stakeholder conversations — no code

One sentence from the talk, conditional on *"if this was being used in a large
organization"*. There are no stakeholders. The mechanism that would make it true
for one — a link someone can open — already exists as the deployed static build
and the README GIFs.

What is missing is a sentence, not software.

Deliberately **not** built, though it is a real gap: a "show me just this
screen, large" view. A stakeholder conversation wants one screen at a useful size
and the blueprint's zoom is one ctrl+wheel scale shared across all seven frames.
Real, not asked for, and a ticket of its own rather than a line here.

## Scope

README changes only, written to **ASD-STE100 Strict** — user-facing text, so the
universal config's rule applies here even though the map and its tickets match
their siblings' voice.

- A short section naming the five bullets from the talk, and where each one
  landed: built, kept in a different shape, or not built and why. One line each.
- The stakeholder paragraph: the blueprint is the artifact such a conversation
  would be held around, and what it is **not** — not a Figma replacement, not a
  record of what was agreed, and the deployed build's edits are per-visitor.
- The Mixpanel line: not built, and the event stream that replaced it.
- A pointer to the render-fidelity report for the visual-regression line, so the
  answer is "measured, currently no", not "undecided".

Keep the README's voice. It is currently the most-read file in the repo and it
is good; this adds a section, it does not rewrite the thing.

## Tests

Static, in the shape `test/chrome.test.ts` established:

- The README claims no screenshot, no pixel diff and no analytics. Assert it. The
  prior map's rule was that neither the UI nor the code comments may imply
  otherwise — that holds in both directions, and a later contributor adding
  `html2canvas` should fail a test rather than a review argument.
- The drift section still says "not a pixel diff of two screenshots". If that
  sentence is ever deleted, this test should say why it is allowed to be.

This is the cheapest possible guard against the repo quietly growing the thing
its own documentation rules out.
