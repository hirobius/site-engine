#!/usr/bin/env bash
# Feedback gate Ralph must pass before opening a PR. Red = no PR — the gate
# FAILS CLOSED: any step failing aborts immediately and names the culprit.
set -euo pipefail
cd "$(dirname "$0")/.."

run_step() {
  echo "── gate: $*"
  if ! "$@"; then
    echo "── gate FAILED at: $* — no PR, no done. Fix the change until green." >&2
    exit 1
  fi
}

# clients: no `typecheck` script (lint==check); a passing build is the
# load-bearing gate — never touch live client output without one.
#
# The @hirobius/demo-pressure-pros Playwright browser smoke is EXCLUDED from
# the gate: it needs a served build + SITE_LIVE env this fast per-PR gate does
# not provision, so it fails here for reasons unrelated to the change under
# review. Browser E2E stays covered by the dedicated CI job (ci.yml). The gate
# still runs the full build, check, and every vitest suite. This file is the
# ONLY per-repo part of the gate.
run_step pnpm build
run_step pnpm check
run_step pnpm exec turbo run test --filter='!@hirobius/demo-pressure-pros'

echo "── gate: all green"
