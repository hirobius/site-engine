#!/usr/bin/env bash
# Feedback gate Ralph must pass before opening a PR. Red = no PR.
set -euo pipefail
cd "$(dirname "$0")/.."

# Repos WITH the loop system:
# GATE="pnpm loop:validate"
# clients: no `typecheck` script (lint==check); a passing build is the
# load-bearing gate — never touch live client output without one.
GATE="pnpm build && pnpm check && pnpm test"

eval "$GATE"
