# ADR-0003 — Skins (design packs) are the unit of visual variety

**Status:** Accepted (2026-07-12, Adrian) — strategy only; mechanism deliberately NOT built yet (ops feature freeze)
**Scope:** strategy for `packages/schema` / `packages/template` visual variety; supersedes the *goal* (not the rail) of ADR-0002
**Related:** ADR-0002 (section variants — the delivery rail), #128 (epic), #23 (realtor preview kit), `docs/HARVESTING.md`

## Context

ADR-0002 shipped per-section style variants (closed enums, dispatchers, purity
gate). Left as the *goal*, that model trends toward "maintain a million
sections": each new variant adds permanent maintenance (contrast pairs, visual
baselines, review surface) while adding less and less perceived difference —
a prospect feels an art direction, not section geometry. Meanwhile the realtor
preview kit (#23) validated the opposite framing live: **structure fixed, skin
swappable** — three coherent art directions (warm-editorial, modern-editorial,
video-hero) over one page structure, each reading as a genuinely different
site.

## Decision

1. **The unit of design investment is a SKIN**: one coherent art direction —
   a hero treatment + matching section treatments + type scale + palette
   family + motion feel — designed together, shipped together, selected by a
   single config key. Target 2–4 skins, each deliberate; not N-per-section
   variants.
2. **Section variants remain the rail, capped.** A variant is added only in
   service of a skin's section vocabulary, ~3 per section maximum; variants no
   skin uses get pruned (a fleet event, done deliberately). `docs/HARVESTING.md`
   stays the porting contract for whatever a skin needs harvested.
3. **Mechanics (future work, not built now):** a skin is an **override-only
   preset** pinning `layout.sections.<id>.variant` choices + `brand` token
   defaults — the exact merge pattern of
   `packages/schema/src/content-packs.ts` (`applyContentPack`) — behind one
   closed-enum key (e.g. `design: "classic" | "editorial"`). Config-editing
   agents pick a skin the same way they pick a palette preset; everything in
   ADR-0002's containment model (closed enums, semantic tokens, purity gate,
   visual baselines) applies unchanged.
4. **Bespoke stays the paid tier.** Per-client one-off design (AI-generated or
   hand-built) is explicitly rejected as the fleet model — it dissolves the
   schema contract, the purity gate, and fleet safety. It remains the
   custom-component engagement the pricing already defines.
5. **Build is parked** per the ops feature freeze / north star: the skin
   mechanism and the first skin port proceed only on a real signal (outreach
   feedback that previews look samey, a client asking for a direction we lack)
   or an explicit freeze exception. First skin candidate when that happens:
   realtor **warm-editorial** (#23).

## Rejected alternatives

- **Section-library treadmill** (variants as the goal): diminishing perceived
  returns, unbounded maintenance.
- **Bespoke-per-client generation** (aura/v0-style one-offs): maximum variety,
  destroys the moat — no contract, no gates, every site a maintenance orphan.
- **Off-the-shelf builders/templates** (Webflow/Framer): loses the engine and
  the config-only economics; already rejected in the delivery architecture.

## Consequences

- Epic #128's remaining follow-ups are re-scoped under this decision
  (see issue comments): services variants (#130) proceed only as part of a
  skin; two parked issues track the skin mechanism and the warm-editorial port.
- ADR-0002's mechanism, gates, and playbook remain fully in force — this ADR
  changes what travels on the rail, not the rail.
