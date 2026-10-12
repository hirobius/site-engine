# Fleet lessons (read-only copy)

This directory is vendored from [hirobius/ops](https://github.com/hirobius/ops) for the
`site-engine` repo. It holds the fleet lessons ledger and the hook that shows a
session the lessons that match what it is doing (ops#600).

- `learned-rules.jsonl`: the ledger, one lesson per line
- `lessons-recall.mjs` and `lib/`: the hook and its matcher, wired in `../settings.json`
- `check-drift.mjs`: fails when any file here differs from `lessons.lock.json`

Do not edit these files. Lessons are added and changed in ops; then, from the
ops checkout, run

    pnpm lessons:vendor <path to this repo> site-engine

and commit the result.
