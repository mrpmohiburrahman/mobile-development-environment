# Store shareable URL state in the hash fragment

The deployed studio must reproduce a shared view without a token server.
Store shareable URL state in `#s=<payload>` to keep it separate from the route path and query parameters.
Include token overrides in the payload so the link needs no server snapshot.

## Format

- Include a schema version (`v`), the present flag, the screen key, the scheme, and the token overrides.
- Encode token overrides as differences from the bundled `tokens.json`.
- Compress the JSON payload with deflate through `CompressionStream`.
- Encode the compressed bytes as base64url.

## Alternatives

- Query parameters mix the shared payload with parameters that Expo Router uses.
- Server snapshots require storage that the static Pages build does not provide.
- Plain JSON avoids compression but produces longer links.

## Consequences

Shared links make the format costly to change.
Future formats must preserve compatibility or display a clear warning.
Validate decoded values before applying them.
Apply valid values from a supported format and report rejected values.
Reject an unreadable payload or unsupported version with a warning, not a route failure.

The receiver applies token overrides to its bundled tokens.
A link does not preserve an earlier build or the app data.

See [ticket 06](../../.scratch/five-bullets-built/issues/06-present-mode-and-url.md) for the agreed behavior.
