#!/bin/bash
# Build the read-only web deploy.
#
# The export bakes a token-server URL that nothing listens on. A static host
# has no filesystem, and this build must not write even if :3001 is up on the
# machine that built it.
set -euo pipefail
cd "$(dirname "$0")/.."
export EXPO_PUBLIC_TOKEN_SERVER=http://127.0.0.1:9
cd mobile
npx expo export --platform web --output-dir ../dist
cd ..
if ! grep -R -q -F '127.0.0.1:9' dist; then
  echo "export did not bake the read-only token-server URL" >&2
  exit 1
fi
echo "read-only export  →  dist/"
