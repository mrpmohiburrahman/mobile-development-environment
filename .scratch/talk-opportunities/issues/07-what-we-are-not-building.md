# 07 — What we are not building

**What to build:** Three of the five ideas from the original talk are not being
built, and a decision that leaves no trace gets re-proposed by the next person
who reads the talk — usually as a feature. One README section names where each of
the five landed and why, and tests fail if the things this repo rules out ever
appear.

**Blocked by:** 06 — the visual regression line quotes the verdict, so it cannot
be written until the verdict exists.

**Status:** resolved

Lands last regardless, because it should describe what actually shipped.

## Verification harness

`npm test`. No browser needed — this ticket is documentation plus two static
tests.

## Acceptance criteria

- [x] A README section names all five ideas from the talk and where each landed:
      built, reshaped, or not built with the reason. One line each.
- [x] The stakeholder paragraph says what the blueprint is **not**: not a design
      tool, not a record of what was agreed, and per-visitor on the deployed
      build.
- [x] The analytics line records that the event stream replaced the SDK, and why
      the SDK was declined — a runtime dependency, a committed project token that
      breaks the credential-free clone, and orthogonality to a tool whose claim is
      that design changes land in the codebase.
- [x] The visual regression line points at the render verdict, so the answer reads
      as "measured, currently no" rather than undecided.
- [x] A test fails if the app manifest gains a screenshot or rasterisation
      dependency.
- [x] A test fails if the README stops denying a pixel diff — and the test names
      why it is allowed to.
- [x] The drift section still says the report is not a pixel diff of two
      screenshots. Deleting that sentence should fail a test, not pass review.

## Note on voice

The README is the most-read file in this repo and it is currently good. This
ticket **adds a section**; it does not rewrite the thing. The new prose is
user-facing documentation and is written to Simplified Technical English, unlike
the planning documents in this directory, which follow the voice of the two
prior maps.

## Comments

Boxes ticked: 7 of 7. Everything left unticked was not re-run this
session, and an unticked box is the honest record of that.

Implemented, and the review pass found the README contradicting the measurement.

**Fixed after review.** The visual-regression paragraph rested on "neither family is
installed", and the render verdict says `Inter` is present. The paragraph now points
at the measured answer: one family absent, one present and unshipped by this repo,
and the confidence condition still answered no — because a face the commit does not
control is a face the commit does not pin. That keeps the rejection standing on the
measurement instead of on a premise the measurement corrected.

**Verified.** The five-idea table names where each landed. The stakeholder paragraph
says what the blueprint is not. The analytics paragraph records the SDK's rejection
and its three reasons. The visual-regression line points at the verdict.
`test/mechanisms.test.ts` fails on a screenshot or rasterisation dependency in the
app manifest, and on the README ceasing to deny a pixel diff. The drift section
still says the report is not a pixel diff of two screenshots. 320 tests pass and the
guard reports nothing guarded changed.

The new prose was also checked with the STE linter this repo's docs are written to.
The rewritten section is clean; the file as a whole went from 66 violations (32
hard, 2.9 per 100 words) to 62 (31 hard, 2.7).
