# Third-party skills: routing

Vendored unmodified, pinned in `skills-lock.json` (commit + sha256). Pocock skills stay the
mandatory routing; Osmani next; these fill gaps neither covers. Re-pin by editing the lock
and running the installer, never by hand-editing skill files.

| Skill | Source (MIT) | Use it for |
| --- | --- | --- |
| `slopmonster` | ItsssssJack/SlopMonster `3fc9787` | Client-site copy before go-live: run `python3 .claude/skills/slopmonster/tools/deslop.py apps/<slug>/dist/index.html` (visible text only). Never invents facts: missing numbers become `[needs number]` and block launch. Rival-model pass needs the `codex` CLI; without it, report the pass as skipped. |
