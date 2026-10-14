# 07 — What we are not building

**What to build:** Three of the five ideas from the original talk are not being
built, and a decision that leaves no trace gets re-proposed by the next person
who reads the talk — usually as a feature. One README section names where each of
the five landed and why, and tests fail if the things this repo rules out ever
appear.

**Blocked by:** 06 — the visual regression line quotes the verdict, so it cannot
be written until the verdict exists.

**Status:** ready-for-agent

Lands last regardless, because it should describe what actually shipped.

## Verification harness

`npm test`. No browser needed — this ticket is documentation plus two static
tests.

## Acceptance criteria

- [ ] A README section names all five ideas from the talk and where each landed:
      built, reshaped, or not built with the reason. One line each.
- [ ] The stakeholder paragraph says what the blueprint is **not**: not a design
      tool, not a record of what was agreed, and per-visitor on the deployed
      build.
- [ ] The analytics line records that the event stream replaced the SDK, and why
      the SDK was declined — a runtime dependency, a committed project token that
      breaks the credential-free clone, and orthogonality to a tool whose claim is
      that design changes land in the codebase.
- [ ] The visual regression line points at the render verdict, so the answer reads
      as "measured, currently no" rather than undecided.
- [ ] A test fails if the app manifest gains a screenshot or rasterisation
      dependency.
- [ ] A test fails if the README stops denying a pixel diff — and the test names
      why it is allowed to.
- [ ] The drift section still says the report is not a pixel diff of two
      screenshots. Deleting that sentence should fail a test, not pass review.

## Note on voice

The README is the most-read file in this repo and it is currently good. This
ticket **adds a section**; it does not rewrite the thing. The new prose is
user-facing documentation and is written to Simplified Technical English, unlike
the planning documents in this directory, which follow the voice of the two
prior maps.
