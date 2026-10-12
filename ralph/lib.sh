#!/usr/bin/env bash
# shellcheck shell=bash
# ralph/lib.sh — shared plumbing for the Ralph loop (sourced by next.sh,
# run.sh, loop.sh, status.sh; executable as `bash ralph/lib.sh <fn> [args]`
# so workflows can call single helpers).
#
# Contract: ALL loop state lives in GitHub and is mutated ONLY through gh —
# labels (queue/park), comments (claims + attempt counts, the audit trail),
# claim refs (refs/heads/ralph/claim-<n>, the atomic lock), branches and PRs
# (the work product). No other state store.
#
# Repo-agnostic: the repo is derived from `git remote get-url origin`, knobs
# from ralph/config.env (env vars win), so any hirobius repo can vendor this
# directory unchanged — only gate.sh and config.env are per-repo.

RALPH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Per-repo knobs (checked in); real env overrides the file so CI can tune.
if [ -f "$RALPH_DIR/config.env" ]; then
  while IFS='=' read -r k v; do
    case "$k" in '' | \#*) continue ;; esac
    [ -z "${!k:-}" ] && export "$k=$v"
  done <"$RALPH_DIR/config.env"
fi
: "${RALPH_ITER_TIMEOUT:=3600}"                       # seconds one claude iteration may run
: "${RALPH_MAX_ATTEMPTS:=2}"                          # failed attempts before parking
: "${RALPH_MAX_LIFETIME_ATTEMPTS:=5}"                 # failed attempts EVER, across re-queues
: "${RALPH_SUBSTANTIVE_COMMENT_CHARS:=120}"           # length that marks a reasoned stop
: "${RALPH_PR_WAIT:=1800}"                            # seconds loop.sh waits on an open PR
: "${RALPH_CLAIM_TTL:=$((RALPH_ITER_TIMEOUT * 2))}"   # claim older than this w/o a PR = stale
: "${RALPH_READY_LABEL:=ralph-ready}"
: "${RALPH_AUTO_MERGE_LABEL:=ralph-auto}"
: "${RALPH_APPROVE_LABEL:=ralph-approved}"
: "${RALPH_DRY_RUN:=0}"
: "${RALPH_SUPERVISED_CMD:=}"        # ralph#25: command printing the supervised-path manifest (empty = no boundary configured, today's behaviour)
: "${RALPH_DEFAULT_AUTO_MERGE:=false}" # ralph#26: opt-in default-on arming; NEVER flip the fleet-wide default here — per-repo config.env only
: "${RALPH_WEDGE_GRACE_MIN:=10}"     # ralph#16: minutes to wait for a ralph-gate run to appear/post before calling it dead
: "${RALPH_CLAIM_DEDUPE_SECS:=60}"   # ralph#17: a ralph-claim posted more recently than this = the double-claim race, not a distinct trigger
: "${RALPH_DOD_DRAFT_CMD:=}"         # ops#296: command drafting a DoD checklist from the issue body on stdin (a haiku-model call); empty = heuristic fallback, no workflow wiring required
: "${RALPH_BLOCKED_REASON_MAX_CHARS:=1200}" # ops#370 item 2: cap on the quoted `ralph-blocked` body in a park comment

: "${RALPH_TDD_ENFORCE_AFTER:=2026-10-21}" # ops#504: red-first mismatch only warns before this date (YYYY-MM-DD, UTC), fails the run on/after it
: "${RALPH_TEST_PATH_RE:=(^|/)(tests?|__tests__|spec)/|\.(test|spec)\.[A-Za-z0-9]+$}" # what counts as a test file for the red-first check

repo_slug() {
  # CI first: $GITHUB_REPOSITORY is the runner's canonical slug. The checkout's
  # origin URL is NOT trustworthy mid-job — claude-code-action rewrites it to
  # https://x-access-token:<token>@github.com/..., which the sed below didn't
  # strip, so every "repos/$(repo_slug)/..." API path built after the model
  # step 404'd SILENTLY (ralph#8: claim refs never released, attempt-budget
  # resets never seen). The local fallback also strips embedded credentials.
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    echo "$GITHUB_REPOSITORY"
    return 0
  fi
  git remote get-url origin | sed -E 's#^(git@github\.com:|https://([^@/]+@)?github\.com/)##; s#\.git$##'
}

default_branch() {
  git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##' || echo main
}

# GNU date first, BSD date fallback (Adrian runs the loop on macOS too).
epoch_of() {
  date -u -d "$1" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$1" +%s
}

iso_of() { # epoch seconds → ISO-8601 Zulu (GNU first, BSD fallback)
  date -u -d "@$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ
}

# Bounded retry for transient gh failures (rate limit, 5xx, network).
# NOT for calls whose failure is meaningful (claim-ref create must see 422).
gh_retry() {
  local attempt delay
  for attempt in 1 2 3; do
    if gh "$@"; then return 0; fi
    delay=$((2 ** attempt))
    echo "ralph: gh $1 failed (attempt $attempt/3) — retrying in ${delay}s" >&2
    sleep "$delay"
  done
  echo "ralph: gh $1 failed after 3 attempts" >&2
  return 1
}

# ------------------------------------------------------ frontier selection

# blocked_by_refs — ops#474. Reads an issue body on stdin; prints the same-repo
# `#N` refs listed under a `## Blocked by` heading (up to the next heading),
# one per line, deduped. Tolerant of CRLF bodies, any heading level `#`..`######`
# and an optional trailing colon (`### Blocked by:`) — a parser miss fails OPEN
# (the ticket gets picked), so it must not be picky. A missing section, or one
# whose first line starts with "None", means no blockers (prints nothing).
# Cross-repo refs (owner/repo#N) are ignored: only same-repo blockers can be
# checked.
blocked_by_refs() {
  tr -d '\r' | awk '
    { l = tolower($0) }
    l ~ /^#+[ \t]+blocked by:?[ \t]*$/ && match(l, /^#+/) && RLENGTH <= 6 { inside = 1; first = 1; next }
    /^#+[ \t]/ { inside = 0 }
    inside {
      if (first && $0 ~ /^[ \t]*$/) next
      if (first && l ~ /^[ \t]*none/) { inside = 0; next }
      first = 0
      print
    }' | grep -oE '(^|[^A-Za-z0-9_/.-])#[0-9]+' | grep -oE '[0-9]+' | sort -un || true
}

# has_blocked_by_section — ops#505. Reads an issue body on stdin; returns 0 when
# it carries a `## Blocked by` heading (same tolerance as blocked_by_refs: CRLF,
# `#`..`######`, optional trailing colon), 1 otherwise. "None" counts as declared.
has_blocked_by_section() {
  tr -d '\r' | awk '
    { l = tolower($0) }
    l ~ /^#+[ \t]+blocked by:?[ \t]*$/ && match(l, /^#+/) && RLENGTH <= 6 { found = 1 }
    END { exit found ? 0 : 1 }'
}

# blocker_state <n> <for-issue> — prints OPEN|CLOSED|MERGED|... or returns 1 when
# unreadable (the reason is logged to stderr). Looked up once per run: results,
# failures included, are cached under $RALPH_BLOCKER_CACHE (a directory the
# caller creates; without it every call goes to the API).
blocker_state() {
  local b=$1 for=$2 f="" state err
  [ -n "${RALPH_BLOCKER_CACHE:-}" ] && f="$RALPH_BLOCKER_CACHE/$b"
  if [ -n "$f" ] && [ -f "$f" ]; then
    state=$(cat "$f")
  else
    err=$(mktemp)
    if state=$(gh_retry issue view "$b" --json state --jq .state 2>"$err"); then
      :
    elif grep -qiE 'could not resolve|not found|no issue|is a pull request|404' "$err"; then
      state="NOTFOUND"
    else
      state="UNREADABLE"
    fi
    cat "$err" >&2
    rm -f "$err"
    [ -n "$f" ] && printf '%s\n' "$state" >"$f"
  fi
  case $state in
    NOTFOUND) echo "ralph: #$for blocker #$b not found — fix the Blocked by list" >&2; return 1 ;;
    UNREADABLE) echo "ralph: #$for blocker #$b unreadable (API failure) — will retry next run" >&2; return 1 ;;
  esac
  echo "$state"
}

# open_blocker <body> [for-issue] — prints the first blocker number that is
# still not done and returns 0 when it is OPEN; returns 1 when none is open;
# returns 2 (printing the number) when a blocker's state cannot be read or is
# not a done/open state — callers fail closed (skip, never park). CLOSED and
# MERGED both count as done.
open_blocker() {
  local b state
  for b in $(blocked_by_refs <<<"$1"); do
    state=$(blocker_state "$b" "${2:-?}") || { echo "$b"; return 2; }
    case $state in
      CLOSED | MERGED) ;;
      OPEN) echo "$b"; return 0 ;;
      *) echo "$b"; return 2 ;;
    esac
  done
  return 1
}

# --------------------------------------------------------- supervised paths

# ralph_diff_is_supervised — ralph#25. Reads the changed file paths for a
# diff, one per line, on stdin. Prints the matched supervised path(s) (one
# per line) to stdout and returns 0 when the diff touches a supervised path,
# 1 when the diff is clean of them.
#
# RALPH_SUPERVISED_CMD (default empty) is a caller-configured command that
# prints the supervised-path manifest, one entry per line: a trailing `/`
# is a directory-prefix match (`lib/leads/` matches `lib/leads/foo.mjs`),
# anything else is an exact-file match (`api/lead-action.ts` matches only
# that path). This is the consumer side of ops#400's
# `scripts/ralph-supervised-paths.mjs` — kit/lib.sh does not know or care how
# the manifest is produced, only how to run it and read its output.
#
# RALPH_SUPERVISED_CMD unset → not supervised. This is deliberate: it is
# today's behaviour, unchanged, for every caller that has not configured a
# boundary command (hds, site-engine as of ralph#25) — arming logic must
# reach the identical code path it does today rather than start blocking on
# a manifest that doesn't exist yet.
#
# RALPH_SUPERVISED_CMD configured but it exits non-zero OR prints nothing →
# FAILS CLOSED: the diff is reported supervised regardless of what changed,
# because an unreadable boundary must never silently read as "nothing is
# supervised". Never fail-open here — a broken manifest command must block
# auto-merge, not skip the check.
ralph_diff_is_supervised() {
  local paths patterns rc=0 path pat matched=""
  paths="$(cat)"
  [ -z "${RALPH_SUPERVISED_CMD:-}" ] && return 1
  patterns="$(eval "$RALPH_SUPERVISED_CMD" 2>/dev/null)" || rc=$?
  if [ "$rc" -ne 0 ] || [ -z "$patterns" ]; then
    echo "ralph_diff_is_supervised: RALPH_SUPERVISED_CMD failed or printed nothing — treating the diff as supervised" >&2
    return 0
  fi
  [ -z "$paths" ] && return 1
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    while IFS= read -r pat; do
      [ -z "$pat" ] && continue
      case "$pat" in
        */)
          case "$path" in
            "$pat"*)
              matched="${matched}${path}"$'\n'
              break
              ;;
          esac
          ;;
        *)
          if [ "$path" = "$pat" ]; then
            matched="${matched}${path}"$'\n'
            break
          fi
          ;;
      esac
    done <<<"$patterns"
  done <<<"$paths"
  if [ -n "$matched" ]; then
    printf '%s' "$matched"
    return 0
  fi
  return 1
}

# ralph_arm_reason <pr_ok> <issue_ok> — ralph#26. Pure decision fn for
# whether to arm auto-merge and why. <pr_ok>/<issue_ok> are "true"/"false"
# strings — the caller's existing checks for the approve label
# ($RALPH_APPROVE_LABEL) on the PR and the auto-merge label
# ($RALPH_AUTO_MERGE_LABEL) on the linked issue. Reads the diff's changed
# paths on stdin, same contract as ralph_diff_is_supervised (one path per
# line) — this is how the boundary from ralph#25 applies uniformly to
# every arming reason, including the new default-posture one.
#
# THE BOUNDARY APPLIES TO ALL THREE REASONS, NOT JUST THE NEW ONE. A
# supervised diff blocks arming even when the PR carries the approve label
# or the issue is pre-tagged ralph-auto — ralph#26 must not weaken what
# ralph#25 just enforced.
#
# FAIL CLOSED. ralph_diff_is_supervised already fails closed (an unreadable
# RALPH_SUPERVISED_CMD reads as "the whole diff is supervised"); this
# function inherits that by simply deferring to it, so a broken boundary
# command blocks arming under every value of every flag/label.
#
# Prints exactly one of `ralph-approved` | `issue ralph-auto` |
# `default posture` to stdout and returns 0 when arming is authorized (in
# that priority order — an explicit approve label or issue tag always wins
# over the caller's default posture); prints nothing and returns 1 when
# the diff is supervised, the boundary command failed, or none of
# pr_ok/issue_ok/RALPH_DEFAULT_AUTO_MERGE authorize it.
ralph_arm_reason() {
  local pr_ok="${1:-false}" issue_ok="${2:-false}" paths
  paths="$(cat)"
  if printf '%s\n' "$paths" | ralph_diff_is_supervised >/dev/null; then
    return 1
  fi
  if [ "$pr_ok" = "true" ]; then
    echo "ralph-approved"
    return 0
  fi
  if [ "$issue_ok" = "true" ]; then
    echo "issue ralph-auto"
    return 0
  fi
  if [ "${RALPH_DEFAULT_AUTO_MERGE:-false}" = "true" ]; then
    echo "default posture"
    return 0
  fi
  return 1
}

notify_discord() {
  if [ -z "${DISCORD_WEBHOOK_URL:-}" ]; then
    echo "ralph: (no DISCORD_WEBHOOK_URL — not pinging) $*" >&2
    return 0
  fi
  curl -sS -H "Content-Type: application/json" \
    -d "$(jq -n --arg c "$*" '{content:$c}')" \
    "$DISCORD_WEBHOOK_URL" >/dev/null || echo "ralph: Discord notify failed (non-fatal)" >&2
}

# audit <run_id> <issue> <decision> <result> <exit_reason> [stash_ref]
# One JSONL line per iteration into ralph/runs.jsonl (gitignored, last 200 kept)
# — the after-the-fact record of what every run decided and why it exited.
audit() {
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq -cn --arg ts "$ts" --arg run "$1" --arg issue "$2" --arg decision "$3" \
    --arg result "$4" --arg reason "$5" --arg stash "${6:-}" \
    '{ts:$ts, run_id:$run, issue:$issue, decision:$decision, result:$result,
      exit_reason:$reason} + (if $stash != "" then {stash_ref:$stash} else {} end)' \
    >>"$RALPH_DIR/runs.jsonl"
  tail -n 200 "$RALPH_DIR/runs.jsonl" >"$RALPH_DIR/runs.jsonl.tmp" &&
    mv "$RALPH_DIR/runs.jsonl.tmp" "$RALPH_DIR/runs.jsonl"
}

# ---------------------------------------------------------------- PR health

# ops#476: a Ralph PR labelled needs-adrian is PARKED on a human (supervised
# path, design question) — it does not count as in-flight, so it never trips
# single-flight (run.sh exit 13). Any other open Ralph PR is ACTIVE and does,
# keeping at most one active PR per repo. Claim refs are never PRs.
RALPH_OPEN_PRS_FIELDS="number,headRefName,headRefOid,updatedAt,labels"
_ralph_pr_base='[.[] | select(.headRefName | startswith("ralph/")) |
  select(.headRefName | startswith("ralph/claim-") | not)'
_ralph_parked_test='((.labels // []) | map(.name) | index("needs-adrian")) != null'
RALPH_ACTIVE_PRS_JQ="$_ralph_pr_base | select($_ralph_parked_test | not)]"
RALPH_PARKED_PRS_JQ="$_ralph_pr_base | select($_ralph_parked_test)]"

# open_ralph_prs — ACTIVE (non-parked) open Ralph PRs; what the wedge check
# and single-flight consume. parked_ralph_prs — the needs-adrian ones.
open_ralph_prs() {
  gh pr list --state open --json "$RALPH_OPEN_PRS_FIELDS" --jq "$RALPH_ACTIVE_PRS_JQ"
}

parked_ralph_prs() {
  gh pr list --state open --json "$RALPH_OPEN_PRS_FIELDS" --jq "$RALPH_PARKED_PRS_JQ"
}

# classify_wedged  (stdin: open_ralph_prs JSON)
# Prints "- #N — reason" per WEDGED PR; prints nothing when every open Ralph
# PR is healthy in-flight.
#
# ralph#16: gate="none"/"pending" alone can't tell "gate is running" from
# "gate crashed / never fired" — the old code waited a flat 3h to find out,
# stalling the single-flight queue silently the whole time. So when the
# posted status isn't yet failure/success, ask GitHub directly whether a
# ralph-gate run exists for the PR's branch:
#   - any run whose status isn't "completed" (queued/in_progress/requested/
#     waiting/pending/…) → healthy in-flight, no matter the PR age.
#   - no run at all, PR older than RALPH_WEDGE_GRACE_MIN minutes → wedged now
#     (gate never started).
#   - only completed run(s) and still no posted status, PR older than the
#     grace period → wedged now (gate died mid-run without posting).
#   - the run-lookup itself fails (gh error, rate limit, workflow renamed) →
#     fall back to the original age-only 3h rule, since "running" vs "dead"
#     can't be told apart without it.
#
# Looked up BY BRANCH, not by head sha (ralph#16 review round 2): the gate's
# self-heal step pushes a fix commit with a GITHUB_TOKEN push
# (`git push origin HEAD:<head_ref>`), which cannot re-trigger this workflow —
# the re-gate and re-review run inline in the SAME job and the verdict is
# posted on the new, live head sha. So a commit-sha run lookup for that new
# sha always comes back empty even though the gate is actively re-running,
# and every self-heal whose re-gate+re-review takes longer than the grace
# period would false-alarm as wedged. Branch-based lookup finds the run that
# is actually in flight regardless of which sha triggered it.
classify_wedged() {
  local prs now n sha branch updated gate age_h age_min runs lookup_ok live_count run_count
  prs=$(cat)
  now=$(date -u +%s)
  while read -r n sha branch updated; do
    [ -z "$n" ] && continue
    gate=$(gh api "repos/$(repo_slug)/commits/$sha/status" \
      --jq '[.statuses[] | select(.context=="ralph-gate")] | sort_by(.created_at) | (last.state // "none")' \
      2>/dev/null || echo none)
    age_h=$(((now - $(epoch_of "$updated")) / 3600))
    age_min=$(((now - $(epoch_of "$updated")) / 60))
    if [ "$gate" = "failure" ]; then
      echo "- #$n — ralph-gate FAILED (changes requested / red gate); needs a human."
      continue
    fi
    [ "$gate" = "none" ] || [ "$gate" = "pending" ] || continue
    lookup_ok=1
    runs=$(gh run list --workflow ralph-gate.yml --branch "$branch" --json status,createdAt 2>/dev/null) || lookup_ok=0
    [ -n "$runs" ] || lookup_ok=0
    if [ "$lookup_ok" -eq 1 ]; then
      live_count=$(jq -r '[.[] | select(.status != "completed")] | length' <<<"$runs" 2>/dev/null) || live_count=0
      run_count=$(jq -r 'length' <<<"$runs" 2>/dev/null) || run_count=0
      [ "${live_count:-0}" -gt 0 ] && continue # a live run — healthy, regardless of age
      if [ "$age_min" -ge "$RALPH_WEDGE_GRACE_MIN" ]; then
        if [ "${run_count:-0}" -eq 0 ]; then
          echo "- #$n — open ${age_min}m, no ralph-gate run found for the branch (gate never started)."
        else
          echo "- #$n — ralph-gate run(s) completed for the branch but no status was posted (gate died mid-run)."
        fi
      fi
      # else: within the grace period, no live run yet — healthy (still spinning up)
      continue
    fi
    # run-lookup failed/unusable — fall back to the original 3h age-only rule.
    if [ "$age_h" -ge 3 ]; then
      echo "- #$n — open ${age_h}h with no passing ralph-gate (stale / never gated)."
    fi
  done < <(jq -r '.[] | "\(.number) \(.headRefOid) \(.headRefName) \(.updatedAt)"' <<<"$prs")
}

# ------------------------------------------------------------------- claims

claim_ref_exists() {
  git ls-remote --exit-code origin "refs/heads/ralph/claim-$1" >/dev/null 2>&1
}

delete_claim_ref() {
  gh api -X DELETE "repos/$(repo_slug)/git/refs/heads/ralph/claim-$1" >/dev/null 2>&1
}

# A claim is stale when there is no open PR for the issue's branch AND its
# newest claim comment (or none at all — claimer died before commenting) is
# older than RALPH_CLAIM_TTL. Stale claims are reclaimable; a killed run can
# never deadlock the queue.
claim_is_stale() {
  local n=$1 open last now age
  open=$(gh pr list --state open --json headRefName \
    --jq "[.[] | select(.headRefName | startswith(\"ralph/issue-$n-\"))] | length" \
    2>/dev/null || echo 0)
  [ "${open:-0}" -gt 0 ] && return 1
  last=$(gh issue view "$n" --json comments \
    --jq '[.comments[] | select(.body | startswith("ralph-claim"))] | (last.createdAt // empty)' \
    2>/dev/null || true)
  [ -z "$last" ] && return 0
  now=$(date -u +%s)
  age=$((now - $(epoch_of "$last")))
  [ "$age" -ge "$RALPH_CLAIM_TTL" ]
}

ensure_label() { # ensure_label <name> <color> <description>
  gh label create "$1" --color "$2" --description "$3" >/dev/null 2>&1 || true
}

# claim_issue <n> <run_id> — atomic test-and-set: creating the claim ref
# succeeds for exactly one caller (GitHub rejects an existing ref with 422),
# so two iterations can never win the same issue. Re-claiming an issue whose
# ref you already hold is handled by the caller keeping its run_id — the
# comment trail makes ownership visible. Returns 1 on a lost race.
claim_issue() {
  local n=$1 run_id=$2 sha ok
  if [ "$RALPH_DRY_RUN" = "1" ]; then
    echo "ralph[dry-run]: would claim #$n" >&2
    return 0
  fi
  if claim_ref_exists "$n"; then
    if claim_is_stale "$n"; then
      echo "ralph: claim on #$n is stale — reclaiming" >&2
      delete_claim_ref "$n" || return 1
    else
      return 1
    fi
  fi
  sha=$(git rev-parse HEAD)
  gh api -X POST "repos/$(repo_slug)/git/refs" \
    -f ref="refs/heads/ralph/claim-$n" -f sha="$sha" >/dev/null 2>&1 || return 1
  ensure_label ralph-wip FBCA04 "Ralph is working this issue right now"
  gh issue edit "$n" --add-label ralph-wip >/dev/null 2>&1 || true
  gh issue comment "$n" --body "ralph-claim $run_id" >/dev/null 2>&1 || true
  # The claim only counts if the issue is still open and still queued —
  # otherwise it was closed/retracted between select and claim.
  # Pipe to real jq: gh's --jq takes only an expression, it has NO --arg flag
  # (using one makes gh error and every re-verify silently fail — bit us live).
  ok=$(gh issue view "$n" --json state,labels 2>/dev/null |
    jq -r --arg l "$RALPH_READY_LABEL" \
      'if .state == "OPEN" and ([.labels[].name] | index($l) != null) then "yes" else "no" end' \
      2>/dev/null || echo no)
  if [ "$ok" != "yes" ]; then
    echo "ralph: #$n was closed or unqueued between select and claim — releasing" >&2
    release_claim "$n"
    return 1
  fi
  return 0
}

release_claim() {
  local n=$1
  [ "$RALPH_DRY_RUN" = "1" ] && return 0
  # Fail loud (stderr, non-fatal): a leaked claim ref blocks re-queueing the
  # issue until the stale-TTL reclaim — never let that happen silently again.
  delete_claim_ref "$n" ||
    echo "ralph: WARNING — could not delete claim ref for #$n; it will block re-claims until the stale-TTL reclaim." >&2
  gh issue edit "$n" --remove-label ralph-wip >/dev/null 2>&1 || true
}

# recent_claim_within <secs> — ralph#17 double-claim dedupe. True when some
# OTHER run's `ralph-claim` comment (the same comment claim_issue posts
# alongside creating the refs/heads/ralph/claim-<n> ref — the two are created
# together, so the comment's timestamp stands in for the ref's) was posted on
# any currently in-flight (ralph-wip labeled) issue within the last <secs>
# seconds.
#
# WHY THIS CATCHES THE RACE: a push-event guard run and the workflow_dispatch
# chain hop it spawns for the same merge can both reach next.sh's selection
# step seconds apart, because the caller's concurrency group
# (cancel-in-progress: false) only serializes — it does not dedupe. The
# second run then wakes, calls next.sh, and claims whatever the first run
# already released, burning a redundant model iteration on work that was (or
# is about to be) already claimed. A claim posted moments ago is that
# signature; a claim from minutes/hours ago is just normal loop activity and
# must never suppress a genuinely distinct trigger (label event, a cron tick
# that found new ready work, ...).
#
# Scoped to ralph-wip issues (the label claim_issue sets alongside the ref)
# rather than a repo-wide comment search: bounded to the handful of issues
# that could plausibly be mid-claim right now, cheap, and needs no new gh
# capability. On any gh/jq failure, or when nothing recent is found, returns
# 1 (no dedupe) — an API hiccup must never suppress a real trigger.
recent_claim_within() {
  local secs=$1 wip newest now age
  wip=$(gh issue list --label ralph-wip --state open --json comments 2>/dev/null) || return 1
  [ -z "$wip" ] && return 1
  newest=$(jq -r '[.[].comments[]? | select(.body | startswith("ralph-claim"))]
    | sort_by(.createdAt) | (last.createdAt // empty)' <<<"$wip" 2>/dev/null) || return 1
  [ -z "$newest" ] && return 1
  now=$(date -u +%s)
  age=$((now - $(epoch_of "$newest")))
  [ "$age" -ge 0 ] && [ "$age" -lt "$secs" ]
}

# ------------------------------------------------------- attempts + parking

# Newest `ralph-ready` labeled event — the shared reset boundary: re-adding the
# label deliberately restarts BOTH the attempt budget and next.sh's PR-history
# guard, so a re-queued parked issue never instantly re-parks at the cap and a
# prior cycle's signals never leak into this one. Only failures/PRs newer than
# this timestamp count (ISO-8601 Zulu strings compare correctly as text). Prints
# the timestamp, empty when no such event exists, or the literal `unknown` when
# the API call itself failed — callers fail closed on `unknown` (skip/fail, never
# park) rather than counting from epoch (the old fail-open bit us past the cap).
latest_ready_label_at() {
  local n=$1 events
  events=$(gh api "repos/$(repo_slug)/issues/$n/events" --paginate 2>/dev/null) || {
    echo unknown
    return 0
  }
  jq -rs --arg l "$RALPH_READY_LABEL" \
    '[add[] | select(.event == "labeled" and .label.name == $l)] | (last.created_at // empty)' \
    <<<"$events" 2>/dev/null || echo unknown
}

# count_failed_attempts <n> [since] — failures NEWER than the latest ralph-ready
# labeled event. No event → count everything (conservative). Prints the literal
# `unknown` when the boundary or the comment fetch is unavailable, so a
# transient API flake can never re-select a should-be-parked issue (the old
# `|| echo 0` fail-open did exactly that); callers must skip/fail, never park.
count_attempts() { # <n> [since] — echoes "<this-cycle> <lifetime>", or "unknown"
  local n=$1 since=${2:-} comments
  [ -z "$since" ] && since=$(latest_ready_label_at "$n")
  [ "$since" = "unknown" ] && {
    echo unknown
    return 0
  }
  comments=$(gh issue view "$n" --json comments 2>/dev/null) || {
    echo unknown
    return 0
  }
  # ONE fetch, both numbers. next.sh's candidate walk is deliberately O(1) API
  # calls per candidate ("fetching once keeps the walk O(1)"); asking the same
  # endpoint twice for two views of the same list would break that for no gain,
  # and would also make the second call's failure branch unreachable — the first
  # would already have returned `unknown`.
  jq -r --arg since "${since:-1970-01-01T00:00:00Z}" \
    '[.comments[] | select(.body | startswith("ralph-attempt-failed"))] as $all
     | "\($all | map(select(.createdAt > $since)) | length) \($all | length)"' \
    <<<"$comments" 2>/dev/null || echo unknown
}

# Back-compat wrapper: the per-cycle count alone. reconcile_issue still wants
# just this one, and it is the older of the two contracts.
count_failed_attempts() {
  local both
  both=$(count_attempts "$1" "${2:-}")
  [ "$both" = "unknown" ] && {
    echo unknown
    return 0
  }
  echo "${both%% *}"
}

# Did the model post a `ralph-blocked` sentinel THIS cycle? That comment is the
# model's explicit "I followed the blocked/ambiguous → comment and STOP
# contract; this is a clean hand-off to a human, not a crashed attempt" signal
# (prompt.md §1). Gated by latest_ready_label_at so a stale sentinel from a
# prior cycle can't suppress a genuine failure after a re-queue. An unknowable
# boundary (events API down) → treat as unsignalled, so the conservative
# attempt path runs rather than a possibly-stale sentinel suppressing a failure.
model_signalled_blocked() {
  local n=$1 since count
  since=$(latest_ready_label_at "$n")
  [ "$since" = "unknown" ] && return 1
  count=$(gh issue view "$n" --json comments 2>/dev/null |
    jq -r --arg since "${since:-1970-01-01T00:00:00Z}" \
      '[.comments[] | select((.body | ascii_downcase | startswith("ralph-blocked")) and (.createdAt > $since))] | length' \
      2>/dev/null || echo 0)
  [ "${count:-0}" -gt 0 ]
}

# model_blocked_reason <n> — the newest `ralph-blocked` comment's own BODY this
# cycle, same gating (latest_ready_label_at) as model_signalled_blocked, so it
# only ever quotes the sentinel that just made model_signalled_blocked true —
# never a stale one from before the last re-queue.
#
# WHY THIS EXISTS. ops#370 item 2 (ops#103): the agent's own comment correctly
# said the work had already shipped in merged PR #192, but the park comment
# substituted a fabricated harness diagnosis — "branch pushed but PR creation
# failed after 3 attempts (auth/network?)" — that contradicted it outright. A
# park record that misreports corrupts the corpus #298 harvests into
# docs/ai/learned-rules.jsonl: a wrong park teaches a wrong rule. Quoting the
# model's own words verbatim in reconcile_issue step 4 makes that
# misattribution impossible — the harness's guess becomes a clearly-labelled
# secondary note, never the headline reason.
#
# Truncated (RALPH_BLOCKED_REASON_MAX_CHARS) and blockquoted for embedding in
# a GitHub comment body. Prints nothing (never "unknown") on any failure or
# absence — callers fall back to the harness's own reason alone, exactly
# today's behaviour.
model_blocked_reason() {
  local n=$1 since body
  since=$(latest_ready_label_at "$n")
  [ "$since" = "unknown" ] && return 0
  body=$(gh issue view "$n" --json comments 2>/dev/null |
    jq -r --arg since "${since:-1970-01-01T00:00:00Z}" \
      '[.comments[] | select((.body | ascii_downcase | startswith("ralph-blocked")) and (.createdAt > $since))]
       | (last.body // empty)' \
      2>/dev/null) || return 0
  [ -z "$body" ] && return 0
  if [ "${#body}" -gt "$RALPH_BLOCKED_REASON_MAX_CHARS" ]; then
    body="${body:0:$RALPH_BLOCKED_REASON_MAX_CHARS}"$'\n…(truncated)'
  fi
  echo "> ${body//$'\n'/$'\n'> }"
}

# Did the MODEL leave a substantive comment of its own this cycle?
#
# This is the fallback behind model_signalled_blocked. ops#303: "A load-bearing
# protocol rides entirely on the model remembering a string prefix, with no
# fallback." It failed exactly that way on ops#39 and ops#44 — the agent
# explained clearly why it was stopping, just not starting with `ralph-blocked`,
# and was charged an attempt for doing what CLAUDE.md asks.
#
# Three things keep the inference honest:
#   - gated to THIS cycle, like the sentinel, so a re-queue resets it;
#   - harness-authored comments are excluded — `ralph-claim`,
#     `ralph-attempt-failed` and the park/gate notices are the loop talking to
#     itself. Counting them would make EVERY failure look deliberate and the
#     attempt budget would stop working altogether;
#   - a length floor, so a one-liner like "working on it" is not a reasoned stop.
#
# On any API failure this returns false — a conservative fall-through to the
# attempt path, never a silent swallow of a real crash.
model_left_substantive_comment() {
  local n=$1 since count
  since=$(latest_ready_label_at "$n")
  [ "$since" = "unknown" ] && return 1
  count=$(gh issue view "$n" --json comments 2>/dev/null |
    jq -r --arg since "${since:-1970-01-01T00:00:00Z}" \
      --argjson min "${RALPH_SUBSTANTIVE_COMMENT_CHARS}" \
      '[.comments[]
        | select(.createdAt > $since)
        | select((.body | ascii_downcase | test("^ralph-")) | not)
        | select((.body | test("Ralph (parked|watchdog)|ralph-gate:")) | not)
        | select((.body | length) >= $min)] | length' \
      2>/dev/null || echo 0)
  [ "${count:-0}" -gt 0 ]
}

# True when <body> carries a GitHub closing keyword (close/closes/closed,
# fix/fixes/fixed, resolve/resolves/resolved; case-insensitive) naming #<n> on
# the SAME line. Emphasis markers and middot lists keep the number on the
# keyword's line, so one line-scoped match covers them. A bare mention
# ("see #126") never matches.
body_closes_issue() { # <body> <n>
  grep -iE '(clos(e|es|ed)|fix(es|ed)?|resolv(e|es|ed))[[:space:]:]' <<<"$1" |
    grep -qE "#${2}([^0-9]|\$)"
}

# Optional consumer hook: ralph/post-close.sh <issue-number>, run after the kit
# itself closes an issue. Bot closes never trigger other workflows (events
# caused by GITHUB_TOKEN start none), so a consumer's `issues: closed`
# automation (e.g. a spec rollup) needs this nudge. Looked up beside lib.sh the
# same way the consumer's gate.sh is. A missing hook is fine; a failing hook
# warns and never fails the run.
run_post_close_hook() { # <n>
  local hook="$RALPH_DIR/post-close.sh" rc=0
  { [ -f "$hook" ] && [ -x "$hook" ]; } || return 0
  "$hook" "$1" || rc=$?
  [ "$rc" -eq 0 ] || echo "ralph: warning — post-close hook failed for #$1 (exit $rc); continuing" >&2
  return 0
}

# Close #<n> as completed, citing merged PR #<pr>, then run the post-close hook.
close_issue_for_merged_pr() { # <n> <pr>
  local n=$1 pr=$2
  if [ "$RALPH_DRY_RUN" = "1" ]; then
    echo "ralph[dry-run]: would close #$n (merged PR #$pr names it with a closing keyword)" >&2
    return 0
  fi
  if gh issue close "$n" --reason completed --comment "Closed by the Ralph loop: merged PR #$pr names this issue with a closing keyword, but the issue was still open." >/dev/null 2>&1; then
    echo "ralph: closed #$n — merged PR #$pr names it with a closing keyword" >&2
    run_post_close_hook "$n"
  else
    echo "ralph: could not close #$n after PR #$pr merged — do it by hand" >&2
    return 1
  fi
}

# After a Ralph PR merges, confirm its linked issue ACTUALLY closed — and close
# it if GitHub's linkage silently failed. ops#305.
#
# WHY THIS IS THE PRIMARY DEFENCE, not a backstop. ops#305 framed the cause as a
# breakable reference: `Closes **#44**`, or the middot list
# `Closes #186 · #187 · #188 · #191 · #196` that lost three issues in PR #311.
# Both are real. But on 2026-09-16 PR #360 carried a clean, bare `Closes #297`
# on its own line, based on the default branch, merged — and #297 stayed open.
# Correct syntax is not sufficient, so a pre-merge body check cannot be the
# primary mechanism. Only verifying the transition afterwards catches a failure
# whose syntax was already right.
#
# THE SAFETY GUARD. A merged PR does NOT imply a finished issue —
# reconcile_issue's step 6 exists precisely because merged work often leaves a
# remainder. So this closes only when the PR body carries a closing keyword
# naming THIS issue, and only on the keyword's own line, so a passing mention
# elsewhere ("see #126 for the rest") is never mistaken for intent. It repairs a
# linkage the author expressed; it never invents one.
#
# Fails safe at every step: an unreadable PR, an unparseable branch, a
# non-MERGED state or an unknown issue state all return without closing.
verify_issue_closed() { # <pr>
  local pr=$1 json head pstate body n istate
  json=$(gh pr view "$pr" --json headRefName,state,body 2>/dev/null) || return 0
  [ -z "$json" ] && return 0
  pstate=$(jq -r '.state // ""' <<<"$json" 2>/dev/null) || return 0
  [ "$pstate" = "MERGED" ] || return 0
  head=$(jq -r '.headRefName // ""' <<<"$json" 2>/dev/null)
  n=$(sed -n 's|^ralph/issue-\([0-9]\{1,\}\)-.*|\1|p' <<<"$head")
  [ -z "$n" ] && return 0
  body=$(jq -r '.body // ""' <<<"$json" 2>/dev/null)

  # A closing keyword and this issue's number on the SAME line. Emphasis markers
  # sit outside the `#<n>` token (`**#126**` still contains `#126`), and a
  # middot list keeps every number on the keyword's line — so one line-scoped
  # match covers all three forms GitHub mis-parses.
  body_closes_issue "$body" "$n" || return 0

  istate=$(gh issue view "$n" --json state --jq .state 2>/dev/null) || return 0
  [ -z "$istate" ] && return 0
  [ "$istate" = "CLOSED" ] && return 0

  [ "$RALPH_DRY_RUN" = "1" ] && {
    echo "ralph[dry-run]: would close #$n (PR #$pr merged, linkage did not fire)" >&2
    return 0
  }
  gh issue close "$n" --reason completed --comment "Closed by the Ralph loop's post-merge check: PR #$pr merged carrying a closing keyword for this issue, but GitHub's linkage never fired.

This is ops#305. It is not always malformed syntax — PR #360 carried a clean, bare \`Closes #297\` and still failed to close it — which is why the transition is verified after the merge rather than only checked before it." >/dev/null 2>&1 ||
    {
      echo "ralph: could not close #$n after PR #$pr merged — do it by hand" >&2
      return 0
    }
  echo "ralph: closed #$n — PR #$pr merged but GitHub's linkage did not fire" >&2
  run_post_close_hook "$n"
}

record_failed_attempt() { # <n> <run_id> <reason>
  [ "$RALPH_DRY_RUN" = "1" ] && return 0
  gh issue comment "$1" --body "ralph-attempt-failed $2 — $3" >/dev/null 2>&1 || true
}

# ralph#10: on a genuine no-ship (no branch pushed, no comment of any kind
# from the model this cycle) the operator gets a park with nothing written by
# the iteration itself — could be turn/time budget exhaustion, could be a
# clean-but-silent SDK end (ralph#10's second reproduction: 28 turns, 5.5
# minutes, no permission wall — not exhaustion). Both look identical from
# outside, so name the uncertainty rather than guessing at a cause, and
# nudge toward the one mitigation that helps either way: splitting the issue.
#
# RALPH_RESULT_FILE (optional, set by the workflow) is the agent's own final
# result text — `result.result` from the SDK response, not full transcript.
# Appending its tail turns an unexplainable park into a diagnosable one
# (ralph#10's stated fix: this is the workflow-side half described in the
# issue as "capture the agent's final result text on a no-side-effect
# iteration"). Missing/empty/unreadable file is silently skipped — this must
# never fail the reconcile over a missing env var or a workflow that hasn't
# wired it in yet.
no_output_note() {
  local note="iteration produced no output — likely budget exhaustion or a silent end; consider splitting the issue"
  if [ -n "${RALPH_RESULT_FILE:-}" ] && [ -r "$RALPH_RESULT_FILE" ]; then
    local tail
    tail=$(tail -c 4000 "$RALPH_RESULT_FILE" 2>/dev/null || true)
    if [ -n "$tail" ]; then
      note="$note

Agent's final result (tail):
\`\`\`
$tail
\`\`\`"
    fi
  fi
  echo "$note"
}

# --------------------------------------------------------- DoD draft (ops#296)
#
# Frontier-doctrine decision (ops#274 / ops#296, Adrian 2026-09-26): a missing
# DoD checklist is a context gap, not a rejection. Instead of parking bare,
# next.sh drafts a checklist and posts it as a COMMENT — never into the issue
# body, so it can never overwrite anything a human wrote — then parks to
# needs-adrian as before so nothing auto-proceeds. A human reviews, folds it
# into the body (edited or as-is), and re-adds ralph-ready.

# heuristic_dod_draft <body> — zero-dependency fallback: pulls any existing
# "- " bullets out of the body (Proposal/plan lines often already state the
# acceptance shape) and always adds a generic pair so the draft is never
# empty. Deliberately dumb — it exists so the feature works with no engine
# wiring at all; draft_dod_checklist prefers a real model when configured.
heuristic_dod_draft() {
  local body=$1 bullets
  bullets=$(grep -E '^[[:space:]]*[-*][[:space:]]+\S' <<<"$body" | sed -E 's/^[[:space:]]*[-*][[:space:]]+/- [ ] /' | head -n 8)
  {
    echo "- [ ] TODO (drafted, unreviewed): confirm the concrete outcome this issue delivers"
    [ -n "$bullets" ] && printf '%s\n' "$bullets"
    echo "- [ ] TODO (drafted, unreviewed): confirm how success will be verified (test, manual check, etc.)"
  }
}

# draft_dod_checklist <body> — echoes checklist markdown, prefixed with the
# `ralph-dod-draft:` marker line a human (or a future re-check) can grep for.
# RALPH_DOD_DRAFT_CMD, if set, is a command that receives the issue body on
# stdin and prints checklist markdown on stdout (e.g. a `claude --model
# haiku...` one-liner, per the ops#296 dispatch-rules pick of the cheap tier
# for non-architectural drafting) — that wiring is a workflow-level change
# (new step/secret in ralph-run-reusable.yml) and is NOT implemented here; see
# the repo README / issue for the exact patch. Unset, or the command producing
# nothing, falls back to the heuristic so this never blocks on missing wiring.
draft_dod_checklist() {
  local body=$1 draft=""
  if [ -n "$RALPH_DOD_DRAFT_CMD" ]; then
    draft=$(printf '%s' "$body" | eval "$RALPH_DOD_DRAFT_CMD" 2>/dev/null || true)
  fi
  if [ -z "$(tr -d '[:space:]' <<<"$draft")" ]; then
    draft=$(heuristic_dod_draft "$body")
  fi
  printf 'ralph-dod-draft:\n%s' "$draft"
}

# post_dod_draft <n> <body> — the comment side-effect; never touches the issue
# body. Best-effort like park_issue's own comment: a failure here must not
# crash the candidate walk in next.sh.
post_dod_draft() {
  local n=$1 body=$2 draft
  if [ "$RALPH_DRY_RUN" = "1" ]; then
    echo "ralph[dry-run]: would post a ralph-dod-draft: comment on #$n" >&2
    return 0
  fi
  draft=$(draft_dod_checklist "$body")
  gh_retry issue comment "$n" --body "$draft" >/dev/null || true
}

# park_issue <n> <reason> <label: ralph-parked|needs-adrian>
# Parking = out of the queue WITH a written reason — never a silent drop,
# never a false "done". Reversible: re-add the ready label to retry.
park_issue() {
  local n=$1 reason=$2 label=$3
  # A park whose retry line is false is worse than no retry line: it sends a
  # human round a loop that cannot succeed. Callers whose park is NOT cleared by
  # re-queuing pass their own hint.
  local retry=${4:-"fix the cause, then re-add \`$RALPH_READY_LABEL\`"}
  if [ "$RALPH_DRY_RUN" = "1" ]; then
    echo "ralph[dry-run]: would park #$n ($label): $reason" >&2
    return 0
  fi
  ensure_label ralph-parked D93F0B "Parked by the Ralph loop — see the park comment"
  ensure_label needs-adrian 5319E7 "Blocked on a human decision"
  # >/dev/null matters: gh edit/comment print URLs on stdout, and park_issue
  # runs inside next.sh's candidate walk — stray stdout would corrupt the
  # selected-issue capture in run.sh / the CI guard (bit us on the first run).
  gh_retry issue edit "$n" --remove-label "$RALPH_READY_LABEL" --add-label "$label" >/dev/null || true
  gh_retry issue comment "$n" --body "🅿️ **Ralph parked this issue** — $reason
(To retry: $retry.)" >/dev/null || true
}

# ---------------------------------------------------------------- reconcile

# run_claim_time <n> <run_id> — the start-of-run boundary: the server-side
# created_at of THIS run's `ralph-claim <run_id>` comment (posted by
# claim_issue), so runner clock skew can't move it. The comment's post is
# ||-guarded and can be missing — fall back to the widest window this run
# could possibly have spanned.
run_claim_time() {
  local n=$1 run_id=$2 t
  t=$(gh api "repos/$(repo_slug)/issues/$n/comments" --paginate 2>/dev/null |
    jq -rs --arg b "ralph-claim $run_id" \
      '[add[] | select(.body == $b)] | (last.created_at // empty)' 2>/dev/null || true)
  if [ -n "$t" ]; then
    echo "$t"
    return 0
  fi
  iso_of "$(($(date -u +%s) - RALPH_ITER_TIMEOUT - 600))"
}

# newest_branch <lines> — lines are "<sha>\t<branch>". Echoes the branch whose
# head commit is newest (ralph#18).
#
# Recovery must never be blocked by an API hiccup: if any candidate cannot be
# dated, this falls back to the historical behaviour (first in ls-remote order)
# and says so, rather than failing the reconciliation. A wrong-but-recovered
# branch is recoverable by hand; a crashed reconcile is not.
#
# ISO-8601 Zulu sorts correctly as a string, so no date parsing is needed.
newest_branch() {
  local lines="$1" best="" best_date="" sha br cdate
  while IFS=$'\t' read -r sha br; do
    [ -n "$br" ] || continue
    cdate=$(gh api "repos/$(repo_slug)/commits/$sha" --jq '.commit.committer.date' 2>/dev/null || true)
    if [ -z "$cdate" ]; then
      echo "ralph: could not date $br via the API — falling back to ls-remote order" >&2
      awk -F'\t' 'NF {print $2}' <<<"$lines" | head -n1
      return 0
    fi
    if [ -z "$best_date" ] || [[ "$cdate" > "$best_date" ]]; then
      best_date="$cdate"
      best="$br"
    fi
  done <<<"$lines"
  [ -n "$best" ] || best=$(awk -F'\t' 'NF {print $2}' <<<"$lines" | head -n1)
  echo "$best"
}

# ------------------------------------------------------------ pre-PR gates
# ops#504. Repo-agnostic rules that run BEFORE a PR opens. The consumer
# supplies the repo-specific parts as optional hooks next to gate.sh:
#   ralph/check-tests.sh <base> <head>  - "source changed without tests" check
#   ralph/test.sh                       - narrower test-only runner (optional;
#                                         the red-first check prefers it over gate.sh)
# A missing hook is skipped with a log line, never a failure.

# pr_body_has_headings <body> - the three fleet /pr headings, each on its own line.
pr_body_has_headings() {
  local b=${1:-} h
  for h in "## Summary" "## Evidence" "## Merge Danger"; do
    grep -qxF -- "$h" <<<"$b" || return 1
  done
}

# pr_body_or_recovery <body> <n> <commits> <gate-tail> <footer> - echoes the
# body if it carries the three headings, else the recovery body (never fails).
pr_body_or_recovery() {
  if pr_body_has_headings "${1:-}"; then
    printf '%s' "$1"
  else
    recovery_pr_body "$2" "${3:-}" "${4:-}" "${5:-}"
  fi
}

# check_tests_with_code <base> <head> - runs the consumer's ralph/check-tests.sh
# if present and executable. Echoes its output tail on failure; returns its code.
check_tests_with_code() {
  local base=$1 head=$2 hook="$RALPH_DIR/check-tests.sh" out rc=0
  if [ ! -x "$hook" ]; then
    echo "ralph: no ralph/check-tests.sh - tests-with-code gate skipped" >&2
    return 0
  fi
  out=$("$hook" "$base" "$head" 2>&1) || rc=$?
  [ "$rc" -eq 0 ] || printf '%s\n' "$(tail -n 15 <<<"$out")"
  return "$rc"
}

# diff_files <base> <head> - changed paths (non-zero when git fails).
diff_files() { git diff --name-only "$1...$2" 2>/dev/null; }

# tdd_check <n> <base> <head> - the red-first rule. Returns 0 = ok / skipped /
# warn-only, 1 = mismatch AND on/after RALPH_TDD_ENFORCE_AFTER (echoes the
# reason). Costs at most ONE extra test run (the first test-touching commit;
# HEAD's green is the normal gate's job). Docs-only diffs and unreadable git skip.
tdd_check() {
  local n=$1 base=$2 head=$3 files f sha first="" tmp runner rc=0 msg=""
  files=$(diff_files "$base" "$head") || files=""
  if [ -z "$files" ]; then
    echo "ralph: tdd check skipped (no readable diff)" >&2
    return 0
  fi
  if ! grep -qvE '\.md$|^docs/' <<<"$files"; then
    echo "ralph: tdd check skipped (docs-only diff)" >&2
    return 0
  fi
  while read -r sha; do
    [ -n "$sha" ] || continue
    f=$(git diff-tree --no-commit-id --name-only -r "$sha" 2>/dev/null) || continue
    if grep -qE "$RALPH_TEST_PATH_RE" <<<"$f"; then
      first=$sha
      break
    fi
  done < <(git log --reverse --format=%H "$base..$head" 2>/dev/null)
  if [ -z "$first" ]; then
    msg="no commit on the branch touches test files - a failing test must be committed before the fix"
  else
    tmp=$(mktemp -d "${TMPDIR:-/tmp}/ralph-tdd-XXXXXX")
    if git worktree add -q --detach "$tmp/wt" "$first" >/dev/null 2>&1; then
      runner="$tmp/wt/ralph/gate.sh"
      [ -x "$tmp/wt/ralph/test.sh" ] && runner="$tmp/wt/ralph/test.sh"
      if [ -f "$runner" ]; then
        (cd "$tmp/wt" && bash "$runner") >/dev/null 2>&1 || rc=$?
        [ "$rc" -eq 0 ] && msg="the first test commit (${first:0:12}) passes on its own - it must FAIL (red) before the fix lands"
      else
        echo "ralph: tdd check skipped (no ralph/gate.sh in the first test commit)" >&2
      fi
      git worktree remove --force "$tmp/wt" >/dev/null 2>&1 || true
    else
      echo "ralph: tdd check skipped (could not check out ${first:0:12})" >&2
    fi
    rm -rf "$tmp"
  fi
  [ -n "$msg" ] || return 0
  [ "$RALPH_DRY_RUN" = "1" ] ||
    gh_retry issue comment "$n" --body "ralph-tdd: $msg" >/dev/null || true
  if [[ "$(date -u +%F)" < "$RALPH_TDD_ENFORCE_AFTER" ]]; then
    echo "ralph: WARNING (enforced from $RALPH_TDD_ENFORCE_AFTER) red-first: $msg" >&2
    return 0
  fi
  echo "red-first violated: $msg"
  return 1
}

# pre_pr_gates <n> [head-ref] - run before opening a PR. Echoes the reason and
# returns 1 on failure (caller opens no PR). Executable as
# `bash ralph/lib.sh pre_pr_gates <n> [ref]` - the model runs it before `gh pr create`.
pre_pr_gates() {
  local n=$1 head=${2:-HEAD} base out
  base="origin/$(default_branch)"
  if ! out=$(check_tests_with_code "$base" "$head"); then
    echo "tests-with-code check failed: $out"
    return 1
  fi
  tdd_check "$n" "$base" "$head"
}

# recovery_pr_body <n> <commit-subjects (newline-separated)> <gate-tail> <footer>
# Pure: the recovery PR body in the fleet /pr shape (ops#475). The FIRST line is
# the bare `Closes #<n>` (see prompt.md step 5), then Summary · Evidence ·
# Merge Danger, then a `---` rule and the footer. The gate tail goes in a ~~~
# fence with any line that could open/close a fence neutralised (indented 4
# spaces); an empty tail says so. The Door is NOT asserted — a recovered branch
# has not been judged one-way or two-way.
recovery_pr_body() {
  local n=$1 commits=${2:-} gate=${3:-} footer=${4:-} list
  list=$(sed -e '/^[[:space:]]*$/d' -e 's/^/- /' <<<"$commits")
  [ -n "$list" ] || list="- (commit subjects unavailable)"
  printf 'Closes #%s\n\n## Summary\n\n%s\n\n## Evidence\n\n' "$n" "$list"
  if [ -n "${gate//[[:space:]]/}" ]; then
    printf '~~~\n%s\n~~~\n' "$(sed -E 's/^[[:space:]]*(```|~~~)/    &/' <<<"$gate")"
  else
    printf 'gate output unavailable\n'
  fi
  printf '\n## Merge Danger\n\n**Door:** unknown, check the diff (recovered branch)\n**Blast Radius:** see diff\n'
  [ -z "$footer" ] || printf '\n---\n\n%s\n' "$footer"
}

# fix_pr_body <n> <pr> [log_path] - a model-opened PR whose body lacks the three
# /pr headings gets the recovery body instead (never fails, never blocks the PR).
fix_pr_body() {
  local n=$1 pr=$2 log_path=${3:-} body branch commits gate_tail=""
  [ "$RALPH_DRY_RUN" = "1" ] && return 0
  body=$(gh pr view "$pr" --json body --jq .body 2>/dev/null) || return 0
  pr_body_has_headings "$body" && return 0
  branch=$(gh pr view "$pr" --json headRefName --jq .headRefName 2>/dev/null || true)
  commits=$(git log --format=%s "origin/$(default_branch)..origin/$branch" 2>/dev/null || true)
  [ -z "$log_path" ] || gate_tail=$(tail -n 20 "$log_path" 2>/dev/null || true)
  gh pr edit "$pr" --body "$(recovery_pr_body "$n" "$commits" "$gate_tail" "PR body lacked the three /pr headings (Summary, Evidence, Merge Danger); replaced by ralph reconciliation.")" >/dev/null 2>&1 || true
}

# reconcile_issue <n> <run_id> <work_status> [log_path]
# log_path: the run transcript (run.sh's $LOGFILE) — its tail is the gate evidence
# in a recovered PR body; the log-name format lives only in run.sh.
# State-based post-iteration reconciliation — the single place that decides
# what actually happened, regardless of how the work step died. Prints one
# token: pr:<num> | parked:<why> | failed:<why>. Never returns non-zero.
reconcile_issue() {
  local n=$1 run_id=$2 work_status=$3 log_path=${4:-} all since pr closed branch i fails why eligible
  local candidates cand_count passed_over commits gate_tail footer gate_fail=""
  all=$(gh pr list --state all --limit 200 --json number,headRefName,state,createdAt,body \
    --jq "[.[] | select(.headRefName | startswith(\"ralph/issue-$n-\"))]" \
    2>/dev/null || echo '[]')
  # PRs from PAST runs must never count as THIS run's shipment: hds#126 looped
  # forever because two long-merged PRs made every no-op iteration reconcile
  # as "success" — no attempt recorded, never parked, reselected every tick.
  # 60s allowance for the gap between ref-create and claim-comment post.
  since=$(iso_of "$(($(epoch_of "$(run_claim_time "$n" "$run_id")") - 60))")
  # 1) An OPEN PR (any age — in-flight work; single-flight holds the loop) or
  #    a PR merged DURING this run → success. A CLOSED one was rejected by a
  #    human — it must never count as shipped, and its branch is never
  #    resurrected.
  pr=$(jq -r --arg s "$since" \
    '[.[] | select(.state == "OPEN" or (.state == "MERGED" and .createdAt >= $s))] | (first.number // empty)' <<<"$all")
  if [ -n "$pr" ]; then
    fix_pr_body "$n" "$pr" "$log_path"
    release_claim "$n"
    echo "pr:$pr"
    return 0
  fi
  closed=$(jq -r '[.[] | select(.state == "CLOSED")] | length' <<<"$all")
  # 2) Branch pushed but no PR (the PR step failed / response was lost) →
  #    open it ourselves, bounded retry with backoff. Never when a CLOSED PR
  #    exists — that would resurrect human-rejected work (parked in 4 below).
  branch=""
  passed_over=""
  if [ "${closed:-0}" -eq 0 ]; then
    # Keep the sha alongside the ref: with more than one orphan we choose by
    # commit date (ralph#18), and the sha is what the commits API needs.
    candidates=$(git ls-remote --heads origin "ralph/issue-$n-*" 2>/dev/null |
      awk 'NF >= 2 {print $1"\t"$2}' | sed 's#refs/heads/##')
    cand_count=$(grep -c . <<<"$candidates" || true)
    if [ "${cand_count:-0}" -gt 1 ]; then
      # ls-remote order is alphabetical, not chronological, so head -n1 could
      # resurrect the older of two crash orphans and open a PR for work that
      # was already superseded.
      branch=$(newest_branch "$candidates")
      passed_over=$(awk -F'\t' -v keep="$branch" 'NF && $2 != keep {print $2}' <<<"$candidates" |
        paste -sd', ' -)
      echo "ralph: multiple ralph/issue-$n-* branches — recovering $branch (newest commit); passed over: ${passed_over:-none}" >&2
    else
      branch=$(awk -F'\t' 'NF {print $2}' <<<"$candidates" | head -n1)
    fi
  fi
  if [ -n "$branch" ]; then
    if [ "$RALPH_DRY_RUN" = "1" ]; then
      echo "pr:dry-run"
      return 0
    fi
    commits=$(git log --format=%s "origin/$(default_branch)..origin/$branch" 2>/dev/null || true)
    gate_tail=""
    [ -z "$log_path" ] || gate_tail=$(tail -n 20 "$log_path" 2>/dev/null || true)
    footer="Opened by ralph reconciliation (run \`$run_id\`): the iteration pushed this branch but its PR step failed.${passed_over:+

**Other branches exist for this issue and were passed over:** $passed_over

This branch was chosen because its head commit is the newest. If the work you wanted is on one of the others, open it by hand — nothing deletes them.}"
    git fetch -q origin "$branch" >/dev/null 2>&1 || true
    gate_fail=$(pre_pr_gates "$n" "origin/$branch") || gate_fail=${gate_fail:-pre-PR gate failed}
    for i in 1 2 3; do
      [ -z "$gate_fail" ] || break
      if gh pr create --head "$branch" --base "$(default_branch)" \
        --title "$(git log -1 --format=%s "origin/$branch" 2>/dev/null || echo "ralph: issue #$n")" \
        --body "$(recovery_pr_body "$n" "$commits" "$gate_tail" "$footer")" \
        >/dev/null 2>&1; then
        release_claim "$n"
        echo "pr:recovered"
        return 0
      fi
      sleep $((2 ** i))
    done
    if [ -n "$gate_fail" ]; then
      why="branch $branch pushed but no PR opened - $(tr '\n' ' ' <<<"$gate_fail")"
    else
      why="branch $branch pushed but PR creation failed after 3 attempts (auth/network?)"
    fi
  else
    why="iteration ended without a pushed branch ($work_status)"
  fi
  # 3) Deliberate stop vs genuine failure. "No branch pushed" is ambiguous: the
  #    model may have crashed/timed out (a real failed attempt → retry), OR it
  #    followed prompt.md §1 ("blocked/ambiguous → comment and STOP") and pushed
  #    nothing ON PURPOSE because the issue needs a human. Burning an attempt on
  #    the latter double-counts one decision and wastes the retry on an
  #    already-known blocker (site-engine#86: a schema-drift blocker cost an
  #    attempt and reddened the run, halting the chain). Distinguish via the
  #    model's own signals, each gated to THIS cycle so a re-queue resets them:
  #      (a) a `ralph-blocked` comment it posted — the PRIMARY signal, because
  #          §1 makes it always comment when it stops (a label add is optional
  #          and a cautious model may skip it), or
  #      (b) the issue left the ready queue mid-run — closed, ready label
  #          pulled, or needs-adrian/blocked added (by the model or a human).
  #    Either routes to a human (needs-adrian) GREEN with no attempt recorded.
  #    On a gh API failure eligibility defaults to "queued" and the sentinel to
  #    absent → conservative fall-through to the attempt path, never a silent
  #    swallow.
  eligible=$(gh issue view "$n" --json state,labels 2>/dev/null |
    jq -r --arg l "$RALPH_READY_LABEL" \
      'if .state != "OPEN" then "closed"
       elif ([.labels[].name] | index($l)) == null then "unqueued"
       elif ([.labels[].name] | (index("needs-adrian") or index("blocked"))) then "handed-off"
       else "queued" end' 2>/dev/null || echo queued)
  # A dead `gh issue view` leaves jq with empty input → empty string, which
  # must read as "queued" (conservative), never as a deliberate stop.
  [ -z "$eligible" ] && eligible=queued
  if [ "$eligible" != "queued" ]; then
    release_claim "$n"
    echo "parked:#$n left the ready queue mid-iteration ($eligible) — deliberate stop, no attempt recorded ($why)"
    return 0
  fi
  # 4) Model signalled a deliberate blocked-stop THIS cycle (`ralph-blocked`
  #    comment) but left labels alone (loop hygiene: the harness owns queue
  #    labels). Route to needs-adrian without counting an attempt — the exact
  #    class that reddened the run and halted the chain in site-engine#86.
  if model_signalled_blocked "$n"; then
    # ops#370 item 2: quote the model's own `ralph-blocked` body FIRST — it is
    # the primary reason. The harness's own guess ($why, e.g. "PR creation
    # failed after 3 attempts") is demoted to a labelled secondary line so it
    # can never again stand in for, or contradict, what the agent actually
    # said (the ops#103 shape).
    local blocked_reason
    blocked_reason=$(model_blocked_reason "$n")
    if [ -n "$blocked_reason" ]; then
      park_issue "$n" "the model signalled it is blocked on a human decision (\`ralph-blocked\`) — its own comment:

$blocked_reason

(harness note: $why)" needs-adrian
    else
      park_issue "$n" "the model signalled it is blocked on a human decision (\`ralph-blocked\`) and stopped without a PR — $why" needs-adrian
    fi
    release_claim "$n"
    echo "parked:#$n — model signalled \`ralph-blocked\` (routed to needs-adrian), no attempt recorded"
    return 0
  fi
  # 5) A human closed Ralph PR(s) for this issue → a rejection needs direction,
  #    not a retry that re-proposes the same rejected change.
  if [ "${closed:-0}" -gt 0 ]; then
    release_claim "$n"
    park_issue "$n" "Ralph PR(s) for this issue were closed without merging — a human rejection needs direction, not a retry. Decide the path, then re-add \`$RALPH_READY_LABEL\`." needs-adrian
    echo "parked:human-closed Ralph PR(s) exist for #$n — needs direction, not a retry"
    return 0
  fi
  # 6) Nothing new this run but PR(s) from PAST runs already merged → the
  #    remainder of the issue is evidently not agent-actionable (hds#126:
  #    merged work + human-only DoD items kept the issue open and looping).
  if jq -e --arg s "$since" \
    '[.[] | select(.state == "MERGED" and .createdAt < $s)] | length > 0' <<<"$all" >/dev/null; then
    # A merged PR naming this issue with a closing keyword means GitHub's
    # linkage failed (ops#531): close it, don't park it.
    local mpr mbody
    while IFS= read -r mpr; do
      [ -z "$mpr" ] && continue
      mbody=$(jq -r --argjson p "$mpr" '.[] | select(.number == $p) | .body // ""' <<<"$all")
      if body_closes_issue "$mbody" "$n"; then
        release_claim "$n"
        close_issue_for_merged_pr "$n" "$mpr" || true
        echo "closed:#$n — merged PR #$mpr names it with a closing keyword"
        return 0
      fi
    done < <(jq -r --arg s "$since" '.[] | select(.state == "MERGED" and .createdAt < $s) | .number // empty' <<<"$all")
    release_claim "$n"
    park_issue "$n" "prior Ralph PR(s) merged but the issue is still open and this iteration produced nothing new — the remainder looks not agent-actionable. Close the issue or split what's left into a new issue, then re-add \`$RALPH_READY_LABEL\`." needs-adrian
    echo "parked:prior merged PR(s) but issue still open — remainder not agent-actionable"
    return 0
  fi
  # 6.5) No sentinel, but the model left a reasoned comment of its own this
  #      cycle → infer a deliberate stop. This is the ops#39 / ops#44 class:
  #      the agent explained why it stopped and was charged an attempt anyway,
  #      because it did not prefix the comment with `ralph-blocked`. Parks to
  #      needs-adrian WITHOUT recording an attempt — and parking (not retrying)
  #      is what makes a false positive safe, since no attempt is recorded here
  #      and so neither cap would bound a retry loop.
  if model_left_substantive_comment "$n"; then
    park_issue "$n" "the model stopped without a PR and left a reasoned explanation instead of a \`ralph-blocked\` sentinel — treating it as a deliberate stop, not a crash. $why" needs-adrian \
      "read the model's comment above first — if it is genuinely blocked, answer it; if it stopped in error, re-add \`$RALPH_READY_LABEL\`"
    release_claim "$n"
    echo "parked:#$n — inferred deliberate stop from the model's own comment, no attempt recorded"
    return 0
  fi
  # 7) Genuine no-ship → record the attempt, release the claim, park on cap.
  #    An `unknown` count (API blindness) fails WITHOUT parking — next.sh
  #    re-checks the budget fail-closed before ever re-offering the issue.
  #    ralph#10: no branch pushed at all (not the "branch pushed, PR create
  #    failed" sub-case) AND no model comment of any kind this cycle (already
  #    ruled out by steps 4/6.5 above) is exactly the unexplainable-silent-end
  #    signature — name it, and attach the agent's own result text if the
  #    workflow gave us one.
  local reason=$why
  [ -z "$branch" ] && reason="$why — $(no_output_note)"
  record_failed_attempt "$n" "$run_id" "$reason"
  release_claim "$n"
  fails=$(count_failed_attempts "$n")
  if [ "$fails" = "unknown" ]; then
    echo "failed:$why (attempt budget unverifiable — API failure; selection re-checks fail-closed)"
  elif [ "${fails:-0}" -ge "$RALPH_MAX_ATTEMPTS" ]; then
    park_issue "$n" "gave up after $fails failed attempt(s) — last: $why" ralph-parked
    echo "parked:$why"
  else
    echo "failed:$why (attempt $fails/$RALPH_MAX_ATTEMPTS)"
  fi
  return 0
}

# Delete local ralph/* branches whose PR is merged or closed. Branches with
# an OPEN PR or with NO PR at all are kept — the latter are forensics from a
# failed attempt (committed but never shipped), never destroy them here.
prune_merged_ralph_branches() {
  local b state
  while read -r b; do
    [ -z "$b" ] && continue
    state=$(gh pr view "$b" --json state --jq .state 2>/dev/null || echo NONE)
    case "$state" in
      MERGED | CLOSED) git branch -D "$b" >/dev/null 2>&1 &&
        echo "ralph: pruned local branch $b (PR $state)" ;;
      *) : ;;
    esac
  done < <(git for-each-ref --format='%(refname:short)' refs/heads/ralph/ |
    grep -v '^ralph/claim-' || true)
}

# Executed directly (`bash ralph/lib.sh <fn> [args]`) → dispatch one helper,
# so workflows reuse the exact same logic as the local scripts.
# retry_hop_issue <reconcile-outcome> <n> - echoes <n> when a failed attempt
# still has budget ("failed:... (attempt N/M)" with N<M), else nothing (ops#481).
# The workflow re-dispatches that issue right away instead of waiting for a
# throttled cron. The attempt cap bounds it: attempt M parks, never retries.
retry_hop_issue() {
  local re='\(attempt ([0-9]+)/([0-9]+)\)$'
  [[ ${1:-} == failed:* && ${1:-} =~ $re ]] || return 0
  [ "${BASH_REMATCH[1]}" -lt "${BASH_REMATCH[2]}" ] && echo "$2"
  return 0
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  "$@"
fi
