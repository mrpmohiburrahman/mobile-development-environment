#!/usr/bin/env bash
#
# The studio's byte-identical guard.
#
# The design-token studio works by editing design tokens and rendering the real
# screens that consume them. Its credibility rests on those screens not being
# touched: if the studio can quietly edit a screen to make its own claim look
# better, then rendering the real components proves nothing at all. So the app
# tree is off limits while the studio grows around it.
#
# Guarded, must be byte-identical:
#   mobile/src/ui       — shared components
#   mobile/src/app      — routes and screens, including everything under (tabs)/
# Except: mobile/src/app/ide.tsx, the studio's own route. See the map's note on
# ide.tsx being a named exception to the byte-identical rule.
#
# Everything else is the studio's own ground and is expected to move: ds/ (the
# override layer), ide/ (the editor), the token server, tests, the README.
#
# Usage: scripts/guard.sh [range]
#
# With no range, compares against the repository's real default branch. Prefer
# `origin/main` over a local `main`: a local main goes stale, and a stale base
# makes the diff include commits by other people, which this guard would then
# blame on the branch being checked.
#
# Exits 0 when the range changed nothing guarded, 1 when it did, and 1 on a
# broken range. That last case matters: a shallow clone or a typo'd base ref
# makes `git diff` fail, and a guard that exits 0 there is theatre.
set -euo pipefail

if [ "$#" -gt 0 ]; then
  range="$1"
else
  if git rev-parse --verify --quiet origin/HEAD >/dev/null; then
    range="origin/HEAD...HEAD"
  elif git rev-parse --verify --quiet origin/main >/dev/null; then
    range="origin/main...HEAD"
  else
    range="main...HEAD"
  fi
  printf 'guard: no range given, using %s\n' "$range" >&2
fi

# Two watched directories plus one carve-out. The `:(exclude)` form was checked
# against git 2.54 and is the documented way to subtract a path from an
# already-listed one; do not "simplify" it into a second --exclude, which only
# applies to the pathspecs that follow it.
pathspec=(mobile/src/ui mobile/src/app ':(exclude)mobile/src/app/ide.tsx')

# Ask git directly rather than pre-checking the refs: `rev-parse --verify` takes a
# single object and rejects the `a...b` range form this guard is built on, so a
# pre-check would reject every valid invocation. If the diff itself fails — bad
# base ref, shallow clone with no merge base — the error text already names the
# range, and we relay it. Deliberately loud: CI must not read this as clean.
if ! changed="$(git diff --name-only "$range" -- "${pathspec[@]}" 2>&1)"; then
  printf 'guard: could not diff range %s — bad base ref, or a shallow clone with no merge base.\n' "$range" >&2
  printf '%s\n' "$changed" >&2
  printf 'guard: fetch full history (`git fetch --unshallow`) or pass a range that resolves.\n' >&2
  exit 1
fi

if [ -z "$changed" ]; then
  printf 'guard: OK — %s changed nothing guarded.\n' "$range"
  exit 0
fi

# Sorted: CI logs are read by people, and a stable order makes two runs of the
# same failure comparable.
printf 'guard: BROKEN — %s changed files the studio must not touch:\n\n' "$range" >&2
printf '%s\n' "$changed" | sort | sed 's/^/  /' >&2
cat >&2 <<'EOF'

These are the app's own screens and shared components. The studio earns trust
by rendering the real components; editing them to make its output look right
voids that. Revert them, or move the change somewhere the studio is allowed to
live (mobile/src/ds, mobile/src/ide, token-server).

The single exception is mobile/src/app/ide.tsx — the studio's own route.
EOF
exit 1