# Keep screenshot baselines Linux-only

Mac and Linux do not rasterise the same pixels, even with a bundled font. Screenshot baselines come only from the pinned Playwright Linux image. A developer updates baselines in that image and submits the PNGs for review. CI compares the current app surfaces with those PNGs. CI does not commit new baselines.

## Alternatives

- A labelled CI job can commit baselines. That removes local review of the PNGs.
- Mac baselines need a wide tolerance. That tolerance hides real changes.

## Consequences

A Mac run cannot approve a screenshot baseline. The command skips a comparison off the pinned image. That result is not a pass. CI fails a skipped comparison.

See [ticket 08](../../.scratch/five-bullets-built/issues/08-visual-regression-contract.md).
