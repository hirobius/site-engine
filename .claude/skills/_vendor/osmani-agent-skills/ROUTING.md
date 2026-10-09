# Osmani agent-skills: routing

Vendored from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)
(MIT, see `LICENSE` here) at commit `1401c8b8030e023baeebb31781a6653fe8e93026`,
2026-10-09 (ops#552). Pinned in `skills-lock.json`; the skill files are committed
unmodified. Shared checklists the skills link to (`../../references/*.md`) live in
`.claude/references/`.

## Precedence

Matt Pocock's skills stay the mandatory routing (`/implement`, `/tdd`,
`/code-review`, `/diagnosing-bugs`, `/to-tickets`, `/grill-me`,
`/triage`, `/codebase-design`). When an Osmani skill covers the same ground, run
the Pocock one. No Osmani skill name equals an existing skill name, so **nothing
was renamed**; if a future bump introduces a clash, vendor the Osmani one as
`osmani-<name>` (directory and `name:`) and record the rename in its lock entry.

## Overlaps (Pocock wins)

| Osmani skill                   | Use instead                     |
| ------------------------------ | ------------------------------- |
| `test-driven-development`      | `/tdd`                          |
| `debugging-and-error-recovery` | `/diagnosing-bugs`              |
| `code-review-and-quality`      | `/code-review`                  |
| `incremental-implementation`   | `/implement`                    |
| `spec-driven-development`      | `/grill-me`, then `/to-tickets` |
| `planning-and-task-breakdown`  | `/to-tickets`                   |
| `interview-me`                 | `/grill-me`                     |

## Adds value (no Pocock equivalent): reach for these

- `security-and-hardening`, `performance-optimization`, `api-and-interface-design`,
  `observability-and-instrumentation`: domain checklists plus `.claude/references/`.
- `shipping-and-launch`, `ci-cd-and-automation`, `git-workflow-and-versioning`,
  `deprecation-and-migration`: the release and change-management side.
- `code-simplification`, `frontend-ui-engineering`, `browser-testing-with-devtools`.
- `idea-refine`, `context-engineering`, `source-driven-development`,
  `doubt-driven-development`, `constraint-driven-development`.
- `using-agent-skills` is the upstream index; read it for the lifecycle map.

## Not vendored

Upstream also ships slash commands (`/spec`, `/plan`, `/build`, `/test`, `/review`,
`/ship`, `/code-simplify`, `/constraints`, `/webperf`), four reviewer personas
(`code-reviewer`, `test-engineer`, `security-auditor`, `web-performance-auditor`),
hooks and evals. This repo has no `.claude/commands/` or `.claude/agents/`, so
none are installed. Invoke the matching skill directly; the skills' mentions of
those commands and personas are informational. Vendor them from the same pin if
the repo adopts either directory.
