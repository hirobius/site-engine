# ADR-0002 — Section style variants (the harvest mechanism)

**Status:** Accepted (2026-07-12)
**Scope:** `packages/schema` (`layout.sections`, `SECTION_VARIANTS`), `packages/template` (variant components, dispatchers, purity gate), `apps/_gallery` (variants page)
**Docs:** `docs/HARVESTING.md` (the working checklist) · `packages/template/ATTRIBUTIONS.md`

## Context

We want more visual variety across the fleet by harvesting section designs
from external sources (open-source Astro themes, common marketing patterns
re-implemented from scratch, reference sites). The non-negotiable constraint
is the factory's moat: a client site is one config file; everything visual is
a fixed shared component. Harvested designs must therefore become
**config-selectable variants**, not markup anyone (human or agent) edits per
client. The set is deliberately universal — variant ids are layout adjectives
(`split-card`, `banner`), never trade names.

## Decision

1. **Schema:** `packages/schema/src/section-variants.ts` exports
   `SECTION_VARIANTS`, one readonly tuple per section (hero + the five
   orderable sections). `LayoutSchema` gains `layout.sections.<id>.variant`,
   a closed `z.enum` per section, **fully defaulted** — the first tuple value
   is the current design, so every existing config parses unchanged and
   renders the same site. `.strict()` rejects unknown section keys. The legacy
   `layout.variant: "A" | "B"` hero switch stays as a deprecated alias:
   `defineClient()` bridges `"B"` → `hero.variant = "video"` unless an
   explicit hero variant is set (explicit wins). Any change here re-syncs
   ops's vendored `lib/schema` + `pnpm schema:snapshot-ops`.
2. **Components:** one `.astro` file per variant at
   `components/<sectionId>/<variantId>.astro` (filename = enum value), behind
   a thin dispatcher that keeps the original flat filename (`Hero.astro`), so
   app imports never change. The dispatcher map is `satisfies`-checked against
   the enum — a missing variant fails `astro check`. A section is
   dispatcherized only when its second variant arrives.
   `SECTION_VARIANT_COMPONENTS` in `packages/template/src/index.ts` records
   every (section, variant) → file; `registry.test.ts` pins it against
   `SECTION_VARIANTS` and the filesystem.
3. **Containment (why agents can't "run wild"):**
   - Closed Zod enums — an unknown variant throws in `defineClient()`; the
     build fails. Config-editing agents never see `.astro` files.
   - Semantic tokens only — variants consume `bg-primary`/`text-fg`/
     `font-heading`/`rounded-theme`…, so every variant respects every client's
     palette/font/radius/motion and the WCAG contrast gate.
   - `purity.test.ts` — deterministic lexical sweep (no literal colors,
     palette classes, arbitrary color/url values, unallowlisted scripts,
     imports, external URLs, `@font-face`, `@import`). Guards the harvesting
     sessions themselves; exceptions are explicit allowlists reviewed as code.
   - The conversion contract in `docs/HARVESTING.md` (licensing, existing
     schema fields only, graceful degradation), reviewed via `/code-review`.
4. **Preview + drift guard:** `apps/_gallery/variants.astro` enumerates every
   pair through `defineClient()` (only shippable combos render); Playwright
   snapshots one image **per section**, so a new variant re-baselines only its
   own section.

## Consequences

- Adding a variant is an enum value + one component file + registry entries —
  the full touch list is in `docs/HARVESTING.md`. It is still a versioned
  fleet event (the shared CSS bundle hash changes even when default markup
  doesn't).
- The variant axis is per-section and flat. If a future design needs
  per-variant knobs, the `{ variant }` object leaves room without reshaping.
- Migrating the legacy `layout.variant` alias out of configs (and eventually
  the schema) is deferred, deliberate work.
