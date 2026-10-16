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
# Except:
#   mobile/src/app/ide.tsx — the studio's own route.
#   mobile/src/ui/index.tsx — the shared TabBar and BackBar controls that report
#     suppressed designing presses to the studio's navigation seam, and the
#     shared font family.
#
# A commit can grant permission for one guarded file in the checked range with a
# trailer line:
#   Guard-Allow: <path> -- <reason>
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
# Exits 0 when the range has no unpermitted guarded change, and 1 on an
# unpermitted change, a Guard-Allow trailer without a reason, or a broken
# range. That last case matters: a shallow clone or a typo'd base ref makes
# `git diff` fail, and a guard that exits 0 there is theatre.
set -euo pipefail

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

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

pathspec=(mobile/src/ui mobile/src/app ':(exclude)mobile/src/app/ide.tsx' ':(exclude)mobile/src/ui/index.tsx')

if ! changed="$(git diff --name-only "$range" -- "${pathspec[@]}" 2>&1)"; then
  printf 'guard: could not diff range %s — bad base ref, or a shallow clone with no merge base.\n' "$range" >&2
  printf '%s\n' "$changed" >&2
  printf 'guard: fetch full history (`git fetch --unshallow`) or pass a range that resolves.\n' >&2
  exit 1
fi

log_range=""
case "$range" in
  *...*)
    left="${range%...*}"
    right="${range#*...}"
    log_range="${left:-HEAD}..${right:-HEAD}"
    ;;
esac

allowed_entries=""
if [ -n "$log_range" ]; then
  while IFS= read -r line; do
    case "$line" in
      Guard-Allow:*)
        rest="$(trim "${line#Guard-Allow:}")"
        allow_path=""
        allow_reason=""
        case "$rest" in
          "-- "*|"--")
            allow_path=""
            allow_reason="$(trim "${rest#--}")"
            ;;
          *" -- "*)
            allow_path="$(trim "${rest%% -- *}")"
            allow_reason="$(trim "${rest#* -- }")"
            ;;
          *" --")
            allow_path="$(trim "${rest% --}")"
            allow_reason=""
            ;;
          *)
            allow_path="$rest"
            allow_reason=""
            ;;
        esac
        if [ -z "$allow_path" ] || [ -z "$allow_reason" ]; then
          printf 'guard: BROKEN — Guard-Allow for %s has no reason.\n' "${allow_path:-<empty>}" >&2
          exit 1
        fi
        allowed_entries="${allowed_entries}${allow_path}"$'\t'"${allow_reason}"$'\n'
        ;;
    esac
  done < <(git log "$log_range" --format='%(trailers:key=Guard-Allow)')
fi

if [ -z "$changed" ]; then
  printf 'guard: OK — %s changed nothing guarded.\n' "$range"
  exit 0
fi

unpermitted=""
permitted_lines=""
while IFS= read -r file; do
  [ -z "$file" ] && continue
  reason=""
  while IFS=$'\t' read -r allow_path allow_reason; do
    [ -z "$allow_path" ] && continue
    if [ "$allow_path" = "$file" ]; then
      reason="$allow_reason"
      break
    fi
  done <<< "$allowed_entries"
  if [ -n "$reason" ]; then
    permitted_lines="${permitted_lines}  ${file} — ${reason}"$'\n'
  else
    unpermitted="${unpermitted}${file}"$'\n'
  fi
done < <(printf '%s\n' "$changed" | sort)

if [ -z "$unpermitted" ]; then
  printf 'guard: OK — %s changed only permitted files:\n' "$range"
  printf '%s' "$permitted_lines"
  exit 0
fi

printf 'guard: BROKEN — %s changed files the studio must not touch:\n\n' "$range" >&2
printf '%s' "$unpermitted" | sed 's/^/  /' >&2
cat >&2 <<'EOF'

These are the app's own screens and shared components. The studio earns trust
by rendering the real components; editing them to make its output look right
voids that. Revert them, move the change somewhere the studio is allowed to
live (mobile/src/ds, mobile/src/ide, token-server), or grant permission in a
commit message with a trailer naming the exact file and reason:

Guard-Allow: <path> -- <reason>

The named exceptions are mobile/src/app/ide.tsx (the studio's own route) and
mobile/src/ui/index.tsx (the designing navigation seam for TabBar and BackBar,
and the shared font family).
EOF
exit 1
