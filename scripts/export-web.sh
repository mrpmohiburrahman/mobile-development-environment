#!/usr/bin/env bash
#
# Builds the read-only web export into dist/.
#
# The export bakes a token-server URL on port 9. Browsers block port 9 for
# every request. So each write fails at once, and no write reaches any
# machine. That includes the machine that built the export, even when a token
# server runs there on :3001.
#
# Usage: scripts/export-web.sh
#
# Set EXPO_BASE_URL to serve the export from a subpath, for example
# EXPO_BASE_URL=/mobile-development-environment for GitHub Pages.
#
# Exits 0 when the export holds the blocked URL and no writer URL. Exits 1
# when the export fails or when the bundle can still reach a writer.
set -euo pipefail

readonly BLOCKED_URL='http://127.0.0.1:9'
readonly WRITER_URL='localhost:3001'

cd "$(dirname "$0")/.."
rm -rf dist
(
  cd mobile
  EXPO_PUBLIC_TOKEN_SERVER="$BLOCKED_URL" npx expo export --platform web --output-dir ../dist
)

if ! grep -R -q -F "\"$BLOCKED_URL\"" dist/_expo; then
  echo "export-web: the bundle does not hold the blocked URL $BLOCKED_URL." >&2
  exit 1
fi
if grep -R -q -F "$WRITER_URL" dist/_expo; then
  echo "export-web: the bundle still holds the writer URL $WRITER_URL." >&2
  exit 1
fi
echo "read-only export  →  dist/"
