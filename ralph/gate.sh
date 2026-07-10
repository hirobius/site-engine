#!/usr/bin/env bash
# Feedback gate Ralph must pass before opening a PR. Red = no PR.
set -euo pipefail
cd "$(dirname "$0")/.."

# Repos WITH the loop system:
# GATE="pnpm loop:validate"
# clients: no `typecheck` script (lint==check); a passing build is the
# load-bearing gate — never touch live client output without one.
#
# The @hirobius/demo-pressure-pros Playwright browser smoke is EXCLUDED from the
# gate: it needs a served build + SITE_LIVE env this fast per-PR gate does not
# provision, so it fails here for reasons unrelated to the change under review.
# Browser E2E stays covered by the dedicated CI job (ci.yml). The gate still runs
# the full build, check, and every vitest suite.
GATE="pnpm build && pnpm check && pnpm exec turbo run test --filter='!@hirobius/demo-pressure-pros'"

eval "$GATE"
