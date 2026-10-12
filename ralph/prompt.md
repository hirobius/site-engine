# Ralph loop — one iteration

Read AGENTS.md first. Its "Ralph quality bar" section is binding.

The issue to work arrives as `ISSUE=<n>` in your instructions — the harness
(ralph/run.sh or the CI guard) selected and claimed it deterministically.
**You never pick a task and never look for another one.**

## 1. Understand the task
Run: gh issue view <n> — read the title, body, acceptance criteria, comments.

If it is genuinely ambiguous, or needs a human decision, or is blocked on
something you cannot resolve this iteration, do a **clean blocked-stop** — this
is a first-class outcome, NOT a failure, and it is always better than guessing:

1. Post an issue comment whose **first line is exactly** `ralph-blocked: <one-line reason>`
   (put the detail/options below it). That marker is load-bearing: the harness
   keys on it to route the issue to a human WITHOUT counting a failed attempt or
   re-picking it. Skip the marker and your deliberate stop looks identical to a
   crash — it burns an attempt and the loop retries a blocker it can't clear.
2. Do NOT open a PR. Do NOT touch labels (the harness applies `needs-adrian`).
3. STOP. The harness reconciles the rest.

## 2. Implement it — small
- One logical change. If the issue is big, ship the smallest complete
  slice and comment the rest back on the issue.
- Follow existing repo patterns. The codebase is the source of truth,
  not your assumptions.

## 2b. Red first - required
Commit a FAILING test before the fix. The first commit on your branch that
touches test files must fail `bash ralph/gate.sh` on its own (red); the final
commit must pass it (green). Never put the test and the fix in one commit.
Docs-only changes are exempt. The harness checks this and posts a
`ralph-tdd:` comment on a mismatch (a warning until 2026-10-21, a failed run
after).

## 3. Pass the gate — required
Run: bash ralph/gate.sh
Must pass with zero errors. If it fails, fix YOUR change until it passes.
Never open a PR on a red gate. Never weaken tests or types to pass it.

## 4. Record progress
Append to progress.txt (terse, grammar optional):
- Issue # + one line
- Decisions + why
- Files changed
- Notes for next iteration

## 5. Ship it
- Branch: ralph/issue-<n>-<slug> — EXACTLY this shape; the harness keys
  reconciliation on it, and it makes a racing duplicate push fail loudly.
- Commit (match this repo's commit style)
- Before opening the PR run: bash ralph/lib.sh pre_pr_gates <n>
  If it prints a reason and exits non-zero, fix that (add the missing tests)
  and do NOT open the PR.
- Open PR with a BARE `Closes #<n>` in the body — on its own line, with no
  markdown emphasis around it and never as part of a list. `Closes **#44**`
  and `Closes #186 · #187 · #188` both look right and both silently close
  NOTHING (the second lost three issues in one merge). Repeat the keyword
  per issue instead. Note this is necessary but NOT sufficient — a clean
  bare reference has also failed — so the harness verifies the transition
  after the merge regardless (ops#305).
  The body MUST contain the three headings below; write it with the `pr` skill shape: `## Summary` (smallest
  visual) · `## Evidence` (gate.sh output tail, or the test that went red →
  green) · `## Merge Danger` (Door one-way/two-way, Blast Radius). Follow the
  repo's `.github/PULL_REQUEST_TEMPLATE.md` when present: its headings are the
  `pr` shape, and any extra sections it has are kept too.
- Comment the issue with a 2-line summary
- Never merge. Never push to main. A human approves merges
  (`ralph-approved` on the PR, or the issue was pre-tagged `ralph-auto`).

## Loop hygiene — hard rules
- NEVER add/remove `ralph-*` labels and never touch `refs/heads/ralph/claim-*`,
  ralph/.lock, ralph/runs.jsonl, or ralph/logs/ — the harness owns those.
- If a `gh` call fails transiently (rate limit / 5xx / network), retry it up
  to 3 times with a short sleep; if it still fails, say so and stop — the
  harness records the attempt and will retry or park.
