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
# The @hirobius/demo-pressure-pros Playwright browser smoke runs against
# `astro preview` (a plain local static file server) — SITE_LIVE gating is
# Vercel Routing Middleware, a platform feature that does not run there, so
# it cannot be the cause of a failure in this suite. The real prerequisite is
# the Chromium browser binary, which isn't present by default in a fresh
# checkout; install it below (idempotent — a few hundred ms once cached) so
# the suite runs in the fast per-PR gate the same as it does in ci.yml.
run_step pnpm --filter @hirobius/demo-pressure-pros exec playwright install chromium
run_step pnpm build
run_step pnpm check
run_step pnpm exec turbo run test

echo "── gate: all green"
