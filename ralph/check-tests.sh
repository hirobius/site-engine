#!/usr/bin/env bash
# ralph/check-tests.sh <base> <head> — consumer hook for the kit's tests-with-code
# gate (ops#504). Exit 0 = ok, non-zero = source changed without a test; stdout is
# the reason. Only code the factory ships counts as source: packages/*/src,
# scripts/ and apps/*/src. A client site's config/photos need no unit test (the
# Zod schema validates the config at build), so they are not source here.
set -euo pipefail
cd "$(dirname "$0")/.."
base=${1:?base ref}
head=${2:?head ref}

changed=$(git diff --name-only --diff-filter=AM "$base...$head")

code=$(printf '%s\n' "$changed" |
  grep -E '^(packages/[^/]+/src|apps/[^/]+/src|scripts)/.*\.(ts|tsx|mjs|js|astro)$' |
  grep -vE '\.(test|spec)\.[a-z]+$' || true)
[ -z "$code" ] && exit 0

tests=$(printf '%s\n' "$changed" | grep -E '\.(test|spec)\.(ts|tsx|mjs|js)$' || true)
if [ -z "$tests" ]; then
  echo "source changed without a test: $(printf '%s\n' "$code" | head -5 | tr '\n' ' ')— add or update a *.test.ts, or explain in the PR why it is not testable"
  exit 1
fi
exit 0
