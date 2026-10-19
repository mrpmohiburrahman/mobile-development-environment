#!/usr/bin/env bash
#
# Builds the read-only web export into dist/.
#
# The build sets the token-server URL to port 9. The client refuses requests
# for this URL before fetch. Metro removes the unused fetch branch.
#
# Usage: scripts/export-web.sh
#
# Set EXPO_BASE_URL to serve the export from a subpath, for example
# EXPO_BASE_URL=/mobile-development-environment for GitHub Pages.
#
# Exits 0 when the export holds the read-only client and no writer URL.
# Exits 1 when the export fails or when the bundle can still reach a writer.
set -euo pipefail

readonly BLOCKED_URL='http://127.0.0.1:9'
readonly READ_ONLY_MESSAGE='The build uses in-memory token edits.'
readonly WRITER_URL='localhost:3001'

cd "$(dirname "$0")/.."
rm -rf dist
(
  cd mobile
  EXPO_PUBLIC_TOKEN_SERVER="$BLOCKED_URL" npx expo export --platform web --output-dir ../dist "$@"
)

if ! grep -R -q -F "$READ_ONLY_MESSAGE" dist/_expo; then
  echo "export-web: the bundle does not hold the read-only client." >&2
  exit 1
fi
if grep -R -q -F "$WRITER_URL" dist/_expo; then
  echo "export-web: the bundle still holds the writer URL $WRITER_URL." >&2
  exit 1
fi
node scripts/prepare-web-fonts.mjs dist
node scripts/verify-web.mjs dist
echo "read-only export  →  dist/"
