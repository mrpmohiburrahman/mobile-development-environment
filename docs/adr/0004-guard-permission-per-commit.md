# Grant guard permission per commit

The guard fails any change to the app's screens and shared components. This effort needs two small edits in guarded files. A commit grants permission with a `Guard-Allow: <path> -- <reason>` trailer. The guard passes only the named file, and only in the range that contains that commit. A later branch needs its own trailer.

## Alternatives

- Add the files to the permanent exception list. The files then stay unguarded after the work ends.
- Remove the guard for app code. Nothing then stops the studio from editing a screen to make its own output look right.

## Consequences

Every guarded edit names its file and its reason in history. A reviewer reads the reason in the guard output. The guard depends on commit trailers, so CI must fetch full history. Both workflows already do.

See [ticket 09](../../.scratch/five-bullets-built/issues/09-the-new-guard.md).
