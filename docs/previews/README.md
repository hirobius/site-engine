# Spec previews (realtor kit)

Self-contained HTML previews of the three real-estate design directions from the
realtor preview kit (see site-engine #23/#24). Each is one standalone file —
open it in a browser. These are design references / spec-client showcases, NOT
factory client apps (no `apps/<slug>`, no `client.config.ts`). Harvesting the
warm-serif direction into the Astro factory is tracked in #23.

## Files

| File | Direction | Source spec |
|---|---|---|
| `elizabeth-beard.html` | Warm-serif editorial, multi-page (Home / About / Buying / Selling / Referrals / Journal / Contact, hash-routed) | `aura-hirobius-core.md` warm skin |
| `meridian.html` | Modern-grotesk, paper + clay, near-black inversion; home-forward | #24, grotesk swing |
| `ironridge.html` | Rugged / no-photo, type-forward, ember accent (parked direction) | #23 IRONRIDGE |

## Update (2026-07-14, later) — rebuilt to match the originals from screenshots

Adrian supplied full-page screenshots of all three artifacts. The three files
were then rebuilt a second time to **match the originals**: correct multi-page
structure (EB: About/Buying/Selling/Referrals/Journal/Contact; Meridian:
Buy/Sell/Build/Contact; IRONRIDGE: Buy/Sell/Invest/Contact), real markets
(Spokane & North Idaho / Spokane Inland NW / Colorado Front Range), exact copy,
brokerage (eXp Realty), the credential-stat rail, clay/ember accents, stats, and
closing tables. Two known deltas from the originals:

1. **Photography** — the originals use real photos (Elizabeth's B&W portrait,
   warm interiors, the mountain hero). These rebuilds use tonal CSS placeholders
   with the same labels/crops; drop in the real image files to finish.
2. **EB "Selling" page** — the only page not screenshotted; reconstructed in the
   identical system from the Selling card + valuation pattern. Swap when captured.

The section below documents the original (spec-only) reconstruction context.

## Provenance — reconstructions, not the originals (2026-07-14)

The original builds existed **only** as published claude.ai Artifacts. Their
content lives on `*.frame.claudeusercontent.com`, a host this repo's build/agent
environment is firewalled from (egress policy denies it at CONNECT), and the
files were never committed to any branch — so the exact original HTML could not
be retrieved.

These three files are therefore **faithful rebuilds to the documented design
system**, not byte-for-byte copies of the artifacts. They implement the recovered
spec exactly:

- **Skin** (`aura-hirobius-core.md`): warm cream ground `#F4EFE7`, surface
  `#FBF8F2`, warm near-black `#2B2A26`, one deep-sage accent `#4A5443`, hairline
  `#E4DDD0`. Serif display (Fraunces) + Inter body + mono eyebrows.
- **Signature patterns**: bracket/numbered mono eyebrows, roman+italic emphasis
  word, stat rail, label↔value spec list, inversion CTA block, crop-mark hero
  frame, live status line — all per the CORE spec.
- **Sections** (`realtor-template.md`): Hero → Featured listings → Agent bio →
  Stats → Neighborhoods → Testimonials → Home-valuation CTA → Contact/footer with
  fair-housing disclaimer.

Content is **sample/curated copy with placeholder contact details** (`555-01xx`
numbers, sample addresses) — appropriate for a showcase, and per repo rule never
fabricated as real business facts. Photography is rendered as CSS treatments with
labelled photo slots (stock hosts were always blocked in the preview env).

If the original artifact HTML is ever recovered (e.g. via a browser DevTools
Network capture from a logged-in session), drop it in over these to replace the
reconstruction.

## Companion docs (recovered from `claude/realtor-starter`)

`../realtor-template.md` · `../aura-hirobius-core.md` · `../hirobius-core-brief.md`
· `../../claude-config/skills/generate-client-config/SKILL.md`
