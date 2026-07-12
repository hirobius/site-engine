/**
 * Section style variants — the single source of truth for which visual
 * treatments each section offers. `packages/schema` derives the config enums
 * from this, `packages/template` keys its per-section dispatchers off it, and
 * `apps/_gallery` enumerates it for previews/visual regression.
 *
 * Rules of the registry:
 * - The FIRST value of each tuple is the default and must stay the design
 *   existing clients already render — adding a variant never restyles a site.
 * - Variant ids are short kebab-case layout adjectives ("split-card",
 *   "banner"), never trade names — the set is universal, not per-vertical.
 * - Every id maps 1:1 to a component file
 *   `packages/template/src/components/<sectionId>/<variantId>.astro`.
 * - Adding a value here is a schema change: re-run `pnpm schema:snapshot-ops`
 *   and re-sync the ops vendored copy (see ops-drift.test.ts).
 * - This is a closed set on purpose. A design that can't be expressed as one
 *   of these variants is a custom-component engagement, not a config edit.
 */
export const SECTION_VARIANTS = {
  hero: ["classic", "video", "split-card", "banner"],
  services: ["grid"],
  gallery: ["grid"],
  reviews: ["cards"],
  serviceAreaMap: ["standard"],
  contact: ["standard"],
} as const;

export type VariantSectionId = keyof typeof SECTION_VARIANTS;

export type SectionVariantId<S extends VariantSectionId> =
  (typeof SECTION_VARIANTS)[S][number];
