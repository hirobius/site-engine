# Recovered spec previews (realtor kit)

Landing zone for the real-estate preview builds recovered from published
Artifacts (see site-engine #23/#24). Each preview is a single self-contained
HTML file, committed **as-is** — these are design references / spec-client
showcases, NOT factory client apps (no `apps/<slug>` scaffold, no
`client.config.ts`). Harvesting them into the Astro factory is tracked in #23.

## Expected files

| File | Source artifact | Notes |
|---|---|---|
| `elizabeth-beard.html` | [Elizabeth Beard — Spokane Real Estate](https://claude.ai/code/artifact/c9adf062-1ad3-480f-87d1-a2947f616734) (2026-07-05) | Warm-serif editorial, multi-page (hash-routed): Home / About / Buying / Selling / Referrals / Journal / Contact |
| `meridian.html` | [Meridian — Modern Real Estate](https://claude.ai/code/artifact/c903fc21-598f-4ceb-859b-4fb6f2d2070c) (2026-07-05) | Modern-grotesk skin (Archivo + Inter, paper + clay) — see #24 |
| `ironridge.html` | [IRONRIDGE — Residential Real Estate](https://claude.ai/code/artifact/a016dada-e51a-4161-8e7d-5a7c7ed7f96a) (2026-07-05) | Rugged / no-photo direction, parked |

Earlier Elizabeth Beard iterations (Direction 2/3, first preview, 2026-07-03)
remain as Artifacts only; the table above pins the latest of each direction.

## Recovery status (2026-07-14)

The HTML is not yet committed: artifact **content** fetches return HTTP 403
from the remote session environment (metadata/list works; content does not),
and no branch in site-engine / ops / hds / Ralph ever carried these files —
the Artifacts are the sole surviving copies. Unblock: Adrian shares the three
artifacts (or drops the downloaded HTML into a session), then the files land
here verbatim.

Companion docs recovered from `claude/realtor-starter` in the same commit:
`docs/realtor-template.md` (ClientConfig extension spec),
`docs/aura-hirobius-core.md` (structured aura DESIGN.md, warm skin),
`docs/hirobius-core-brief.md` (prose brief),
`claude-config/skills/generate-client-config/SKILL.md`.
