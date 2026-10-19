#!/usr/bin/env bash
#
# Runs a screenshot command inside the pinned Playwright image as linux/arm64.
#
# Usage: scripts/vr-docker.sh vr|vr:update|vr:proof
#
# The image tag comes from the Playwright version in package.json. The script
# mounts the repository and its git directory at their host paths, so git
# reads the real HEAD inside the container. Linux node_modules live in named
# volumes, so the host node_modules stay unchanged.
#
# Exits with the exit code of the screenshot command.
set -euo pipefail

command="${1:-}"
case "$command" in
  vr | vr:update | vr:proof) ;;
  *)
    echo "usage: scripts/vr-docker.sh vr|vr:update|vr:proof" >&2
    exit 2
    ;;
esac

cd "$(dirname "$0")/.."
root="$(pwd -P)"
version="$(node -p "require('./package.json').devDependencies.playwright")"
image="mcr.microsoft.com/playwright:v${version}-noble"
git_common="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"

mounts=(-v "$root:$root")
case "$git_common/" in
  "$root/"*) ;;
  *) mounts+=(-v "$git_common:$git_common") ;;
esac

docker run --rm --platform linux/arm64 \
  "${mounts[@]}" \
  -v vr-root-node-modules:"$root/node_modules" \
  -v vr-mobile-node-modules:"$root/mobile/node_modules" \
  -w "$root" \
  -e TZ=UTC \
  -e VR_IMAGE="$image" \
  -e VR_REQUIRE_COMPARE \
  "$image" \
  bash -c '
    set -euo pipefail
    git config --global --add safe.directory "*"
    if ! cmp -s mobile/package-lock.json mobile/node_modules/.vr-lock; then
      (cd mobile && npm ci --ignore-scripts --no-audit --no-fund)
      cp mobile/package-lock.json mobile/node_modules/.vr-lock
    fi
    if ! cmp -s yarn.lock node_modules/.vr-lock; then
      npx --yes yarn@1.22.22 install --frozen-lockfile --ignore-scripts
      cp yarn.lock node_modules/.vr-lock
    fi
    if [ "$0" != "vr:proof" ]; then npm run export:web; fi
    npm run "$0"
  ' "$command"
