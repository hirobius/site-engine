#!/usr/bin/env bash
# ralph/test.sh — test-only runner for the kit's red-first check (ops#504, ops#568).
# The kit checks out the branch's FIRST test-touching commit in a bare
# `git worktree` and runs this; non-zero = red (good), zero = the new test
# already passed (a red-first violation: warns until RALPH_TDD_ENFORCE_AFTER
# in lib.sh, then blocks).
#
# gate.sh can't do this job: it runs the whole build + check + test suite, and a
# bare worktree has no node_modules. This runner installs the workspace (offline
# from the pnpm store where possible, so workspace links point into THIS
# worktree) and runs just the vitest files that commit touched, each from its own
# workspace package. `*.spec.ts` files are Playwright (apps/_gallery,
# apps/demo-pressure-pros), not vitest, and are not judged here.
set -euo pipefail
cd "$(dirname "$0")/.."

files=$(git diff-tree --no-commit-id --name-only -r --diff-filter=AM HEAD |
  grep -E '^(packages|apps)/[^/]+/.*\.test\.(ts|tsx|mjs)$|^scripts/[^/]+\.test\.(ts|mjs)$' |
  grep -vE '^apps/(demo-pressure-pros|_gallery)/' |
  sort || true)
if [ -z "$files" ]; then
  echo "ralph/test.sh: no vitest test file in $(git rev-parse --short HEAD) — can't judge red-first" >&2
  exit 3
fi

if [ ! -e node_modules ]; then
  pnpm install --frozen-lockfile --prefer-offline >&2
fi

# Group by workspace package (first path segment pair, or scripts/) and run each
# group with that package's vitest, paths relative to the package.
rc=0
for pkg in $(printf '%s\n' "$files" | sed -E 's#^((packages|apps)/[^/]+|scripts)/.*#\1#' | sort -u); do
  rel=$(printf '%s\n' "$files" | grep -E "^$pkg/" | sed "s#^$pkg/##")
  echo "ralph/test.sh: $pkg: $(echo $rel)" >&2
  # shellcheck disable=SC2086 # one path per word; repo paths carry no spaces
  (cd "$pkg" && pnpm exec vitest run $rel) || rc=1
done
exit $rc
