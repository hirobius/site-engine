#!/usr/bin/env bash
# ralph/next.sh — deterministic task selector for the Ralph loop.
#
# Same repo state → same pick, always: open `ralph-ready` issues are ordered
# by priority label (p0 < p1 < p2 < p3 < unlabeled), then ascending issue
# number. The LLM never chooses — this script does, and run.sh / the CI guard
# both call it, so local and CI runs agree on "next".
#
# Candidates are vetted in order and parked (with a written reason) when:
#   - the body has no acceptance-criteria/DoD marker → a drafted DoD checklist
#     is posted as a comment (marker `ralph-dod-draft:`, never edits the body),
#     then parked to needs-adrian as a draft-awaiting-review, not a rejection
#     (ops#296)
#   - a ralph PR merged/closed AFTER the latest ralph-ready labeling exists
#     (last cycle already ended in a merge or a human rejection, yet the
#     issue is still open+queued)                     → parked to needs-adrian
#   - failed attempts ≥ RALPH_MAX_ATTEMPTS            → parked to ralph-parked
#   - lifetime failures ≥ RALPH_MAX_LIFETIME_ATTEMPTS → parked (re-queuing
#     resets the per-cycle budget on purpose; it does NOT reset this one)
# Issues labeled blocked / needs-adrian / ralph-parked, or holding a fresh
# claim (refs/heads/ralph/claim-<n>), are skipped — as is any candidate whose
# history/budget cannot be verified (API failure fails closed: skip, no park).
# Candidates with an OPEN ticket under their `## Blocked by` heading are skipped
# too (ops#474; no park, no attempt burned; unreadable blocker fails closed).
# Spec tickets (sub-issues, i.e. with a parent) lacking a `## Blocked by` section
# are parked to needs-adrian (ops#505) — write "None" if there are no blockers.
# Standalone issues are unaffected. Parents come from ONE batched REST list.
# Stale claims (older than RALPH_CLAIM_TTL, no open PR) do NOT block
# selection — run.sh reclaims them.
#
# stdout: the selected issue number (nothing else).
# Exit:   0 = picked · 10 = queue empty/exhausted (or the ralph#17 double-claim
#         dedupe fired) · 20 = GitHub API failure.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=ralph/lib.sh
. ralph/lib.sh

# ralph#17: double-claim dedupe. A push-event guard run and the
# workflow_dispatch chain hop it spawns for the same merge can both reach
# this selector seconds apart — the caller's concurrency group
# (cancel-in-progress: false) only serializes, it does not dedupe, so the
# second run would otherwise claim whatever the first released and burn a
# redundant iteration. Scoped tight, on purpose: a plain `push` event, or a
# `workflow_dispatch` with NO explicit issue (blank ISSUE_INPUT — the hop
# itself, or a manual dispatch left blank) are the only triggers that reach
# next.sh without already knowing which issue they want. An explicit dispatch
# (ISSUE_INPUT set) never calls next.sh at all — the caller steals its named
# issue directly — and every other trigger (a `ralph-ready` label event, a
# `schedule` idle-watchdog tick surfacing genuinely new ready work) must never
# be suppressed by this.
case "${GITHUB_EVENT_NAME:-}" in
  push | workflow_dispatch)
    if [ -z "${ISSUE_INPUT:-}" ] && recent_claim_within "$RALPH_CLAIM_DEDUPE_SECS"; then
      echo "ralph: a ralph-claim was posted within the last ${RALPH_CLAIM_DEDUPE_SECS}s — likely the push/dispatch-hop double-fire (ralph#17); skipping this cycle." >&2
      exit 10
    fi
    ;;
esac

issues=$(gh_retry issue list --label "$RALPH_READY_LABEL" --state open \
  --limit 100 --json number,labels,body) || exit 20

# ops#505: one batched lookup of which ready issues are sub-issues — the REST
# issue JSON carries `parent_issue_url` only when the issue has a parent.
sub_issues=$(gh_retry api "repos/$(repo_slug)/issues?labels=$RALPH_READY_LABEL&state=open&per_page=100" \
  --jq '[.[] | select(.parent_issue_url != null) | .number]') || exit 20

# One prefetch of every non-open ralph/issue-* PR — the history guard in the
# candidate walk needs it, and fetching once keeps the walk O(1) API calls.
all_prs=$(gh_retry pr list --state all --limit 200 --json number,headRefName,state,mergedAt,closedAt,body \
  --jq '[.[] | select(.headRefName | startswith("ralph/issue-"))]') || exit 20
history=$(jq '[.[] | select(.state != "OPEN")]' <<<"$all_prs")
open_prs=$(jq '[.[] | select(.state == "OPEN")]' <<<"$all_prs")

ordered=$(jq -r '
  def prio: [.labels[].name | select(test("^p[0-3]$"))] | sort | (first // "p9")
            | ltrimstr("p") | tonumber;
  map(select([.labels[].name] as $l
    | (($l | index("blocked")) or ($l | index("needs-adrian"))
       or ($l | index("ralph-parked"))) | not))
  | sort_by([prio, .number]) | .[].number' <<<"$issues")

[ -z "$ordered" ] && exit 10

has_dod_marker() {
  grep -qiE -- '- \[ \]|acceptance|definition of done|\bDoD\b' <<<"$1"
}

# Per-run cache of blocker states: a blocker shared by several candidates is
# looked up once (open_blocker runs in a subshell, so the cache is a directory).
RALPH_BLOCKER_CACHE=$(mktemp -d)
export RALPH_BLOCKER_CACHE
trap 'rm -rf "$RALPH_BLOCKER_CACHE"' EXIT

for n in $ordered; do
  body=$(jq -r --argjson n "$n" '.[] | select(.number == $n) | .body // ""' <<<"$issues")

  # Freshly claimed by another runner → theirs, move on. Stale → offer it;
  # run.sh's claim step deletes the stale ref atomically before re-claiming.
  if claim_ref_exists "$n" && ! claim_is_stale "$n"; then
    echo "ralph: #$n is claimed (fresh) — skipping" >&2
    continue
  fi

  # ops#302/#476: an issue that already owns an OPEN Ralph PR (active, or
  # parked on needs-adrian) is never re-picked — even while it still carries
  # the ready label. Otherwise a parked PR would be duplicated by a fresh run.
  if jq -e --arg p "ralph/issue-$n-" 'any(.[]; .headRefName | startswith($p))' <<<"$open_prs" >/dev/null; then
    echo "ralph: #$n already owns an open Ralph PR (in flight or parked) — skipping" >&2
    continue
  fi

  # ops#505: a spec ticket (has a parent) must declare `## Blocked by` (even if
  # only "None") — makes /to-tickets' dependency graph mandatory. Park, don't skip.
  if jq -e --argjson n "$n" 'index($n) != null' <<<"$sub_issues" >/dev/null &&
    ! has_blocked_by_section <<<"$body"; then
    echo "ralph: #$n is a spec sub-issue with no '## Blocked by' section — parking" >&2
    park_issue "$n" "spec tickets must declare Blocked by (write None if none). Add a \`## Blocked by\` section (\`- None (can start immediately)\` if nothing blocks it), then re-add \`$RALPH_READY_LABEL\`." needs-adrian >&2
    continue
  fi

  # Frontier selection (ops#474): a candidate whose `## Blocked by` tickets are
  # not all done (CLOSED/MERGED) is skipped — no park, no attempt burned, stdout
  # untouched. An unreadable or missing blocker fails closed (skip, never park;
  # open_blocker logs the reason). Runs AFTER the free guards above so it costs
  # nothing for candidates already skipped, and BEFORE the DoD draft so a
  # blocked issue is never drafted or parked while it waits.
  blocker=$(open_blocker "$body" "$n") && brc=0 || brc=$?
  if [ "$brc" -eq 0 ]; then
    echo "ralph: #$n blocked by #$blocker (open) — skipping" >&2
    continue
  elif [ "$brc" -eq 2 ]; then
    echo "ralph: #$n blocker #$blocker is not readable/usable — skipping (fail-closed)" >&2
    continue
  fi

  if ! has_dod_marker "$body"; then
    echo "ralph: #$n has no acceptance-criteria/DoD marker — drafting a DoD checklist instead of a bare park (ops#296)" >&2
    # >&2: this script's stdout is ONLY the selected issue number; park side
    # effects must never leak into it (callers capture it).
    post_dod_draft "$n" "$body" >&2
    park_issue "$n" "no acceptance criteria found in the body (looked for a \`- [ ]\` checklist or an acceptance / DoD / definition-of-done section). Drafted one above (see the \`ralph-dod-draft:\` comment) — it's a draft awaiting your thumbs-up, not a rejection. Review it (edit into the body, or accept as-is), then re-add \`$RALPH_READY_LABEL\`." needs-adrian >&2
    continue
  fi

  # PR-history guard: a merged/closed ralph PR NEWER than the latest
  # ralph-ready labeling means the last queue-cycle already ended in a merge
  # (issue still open → the remainder isn't agent-actionable; hds#126 looped
  # on exactly this) or in a human rejection (needs direction, not a retry).
  # Re-adding the ready label moves the boundary — a deliberate re-queue
  # still works. An unknowable boundary fails closed: skip, never park.
  boundary=$(latest_ready_label_at "$n")
  if [ "$boundary" = "unknown" ]; then
    echo "ralph: cannot fetch #$n's label events (API failure) — skipping (fail-closed)" >&2
    continue
  fi
  verdict=$(jq -r --arg p "ralph/issue-$n-" --arg b "${boundary:-1970-01-01T00:00:00Z}" '
    [.[] | select(.headRefName | startswith($p))
         | select(((.mergedAt // .closedAt) // "") > $b)]
    | if any(.state == "MERGED") then "merged"
      elif length > 0 then "closed" else "" end' <<<"$history")
  if [ "$verdict" = "merged" ]; then
    # ops#531: a merged PR naming this issue with a closing keyword means
    # GitHub's linkage failed — close it (completed) instead of parking.
    closed_by=""
    while IFS= read -r mpr; do
      [ -z "$mpr" ] && continue
      mbody=$(jq -r --argjson p "$mpr" '.[] | select(.number == $p) | .body // ""' <<<"$history")
      if body_closes_issue "$mbody" "$n"; then
        closed_by=$mpr
        break
      fi
    done < <(jq -r --arg p "ralph/issue-$n-" --arg b "${boundary:-1970-01-01T00:00:00Z}" '
      .[] | select(.headRefName | startswith($p))
          | select(.state == "MERGED" and (((.mergedAt // .closedAt) // "") > $b))
          | .number // empty' <<<"$history")
    if [ -n "$closed_by" ]; then
      close_issue_for_merged_pr "$n" "$closed_by" >&2 || true
      continue
    fi
    echo "ralph: #$n already has merged PR(s) newer than its last $RALPH_READY_LABEL labeling — parking" >&2
    park_issue "$n" "prior Ralph PR(s) merged but the issue is still open — the remainder looks not agent-actionable. Close the issue or split what's left into a new issue, then re-add \`$RALPH_READY_LABEL\`." needs-adrian >&2
    continue
  fi
  if [ "$verdict" = "closed" ]; then
    echo "ralph: #$n has human-closed Ralph PR(s) newer than its last $RALPH_READY_LABEL labeling — parking" >&2
    park_issue "$n" "Ralph PR(s) for this issue were closed without merging — a human rejection needs direction, not a retry. Decide the path, then re-add \`$RALPH_READY_LABEL\`." needs-adrian >&2
    continue
  fi

  attempts=$(count_attempts "$n" "${boundary:-1970-01-01T00:00:00Z}")
  if [ "$attempts" = "unknown" ]; then
    echo "ralph: cannot verify #$n's attempt budget (API failure) — skipping (fail-closed)" >&2
    continue
  fi
  fails=${attempts%% *}
  lifetime_fails=${attempts##* }

  if [ "${fails:-0}" -ge "$RALPH_MAX_ATTEMPTS" ]; then
    echo "ralph: #$n already failed $fails attempt(s) — parking" >&2
    park_issue "$n" "hit the attempt cap ($fails/$RALPH_MAX_ATTEMPTS failed attempts — see the ralph-attempt-failed comments above)." ralph-parked >&2
    continue
  fi

  # Lifetime budget: bounds thrash that re-queuing would otherwise reset. The
  # per-cycle check above stays the primary guard; this only catches an issue
  # re-queued into failure repeatedly.
  if [ "${lifetime_fails:-0}" -ge "$RALPH_MAX_LIFETIME_ATTEMPTS" ]; then
    echo "ralph: #$n has failed $lifetime_fails time(s) across all queueings — parking" >&2
    park_issue "$n" \
      "hit the LIFETIME attempt cap ($lifetime_fails/$RALPH_MAX_LIFETIME_ATTEMPTS failed attempts across every queueing, not just this one)." \
      ralph-parked \
      "re-adding \`$RALPH_READY_LABEL\` will NOT clear this — a lifetime count cannot go down. Close or split the issue, or raise \`RALPH_MAX_LIFETIME_ATTEMPTS\` in \`ralph/config.env\` if the failures were loop infrastructure rather than the issue" >&2
    continue
  fi

  echo "$n"
  exit 0
done

exit 10
