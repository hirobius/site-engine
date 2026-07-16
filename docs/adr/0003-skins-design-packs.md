# ADR-0003 — Skins (design packs) are the unit of visual variety

**Status:** Accepted (2026-07-12, Adrian); parking lifted 2026-07-16 (Adrian: "build
skins now" — the "more randomization of the design, automatically per site" ask is
the signal §3/#5 was waiting for); mechanism built 2026-07-16 (#140)
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

## Addendum — parking lifted, mechanism built (2026-07-16)

Point 5's freeze exception fired: Adrian's "more randomization of the design,
automatically per site" ask, plus an explicit freeze lift ("build skins now"),
is the signal this ADR was parked for — now active groundwork under the
site-factory initiative (#148; the seeded genome's curated skins land on this
`design` key once harvested, per #148 EPIC C3).

Issue #140 built the **mechanism only** (no skin content yet — the real skins,
starting with warm-editorial, are #141 and follow-ups):

- `packages/schema/src/skins.ts` — closed-enum `SKIN_IDS` / `SKINS` registry.
  One placeholder skin, `classic`, that reproduces `packages/schema`'s
  ordinary defaults verbatim (first `SECTION_VARIANTS` tuple values +
  `BrandSchema`'s `.default()`s) — a working enum value + test, not real
  design content.
- `packages/schema/src/index.ts` — a top-level `design?: SkinId` field on
  `ClientConfigDraft`, merged by `applyDesignSkin()` with the **exact**
  override-only pattern of `applyContentPack()`: explicit config fields
  (`layout.sections.<id>.variant`, `brand.*`) always win, the skin only fills
  gaps, and `design` is stripped before Zod — it never reaches
  `ClientConfigSchema`, so `ops-shape.snapshot.json` (the ops schema-drift
  guard, #75) needed no changes; re-ran `pnpm schema:snapshot-ops` and
  confirmed a byte-identical snapshot.
- Additive and default-safe: omitting `design` — or setting
  `design: "classic"` — renders byte-identical to today, proven both by unit
  test and by a `dist/` diff on `apps/demo-pressure-pros` with and without the
  field set.
- Containment unchanged: closed enums, semantic tokens, the purity gate, and
  visual baselines all apply exactly as ADR-0002 established — this addendum
  changes nothing about the rail, only confirms the skin mechanism now rides
  on it as designed in §3.
- Follow-up flagged, not done here: `packages/agent` and `scripts/lead-gen`
  are frozen in this repo (engine lives in hirobius/ops), and ops's vendored
  `lib/schema/index.mjs` has never carried `applyContentPack`'s merge
  behavior either — a pre-existing gap this PR does not close. Porting
  `applyDesignSkin` (and `applyContentPack`) to ops's vendored copy is
  tracked as a follow-up so the ops agent can eventually emit `design` too.
