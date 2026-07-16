/**
 * Public API for @hirobius/template (non-component helpers).
 *
 * Astro section components are imported by path, e.g.
 *   import Hero from "@hirobius/template/components/Hero.astro";
 * This barrel re-exports the lib helpers and the schema surface so app code has
 * a single import for everything non-visual.
 */
export * from "./lib/theme.js";
export * from "./lib/seo.js";
export * from "./lib/og-image.js";
export * from "./lib/llms-txt.js";
export * from "./acceptance.js";
export * from "./build-gate.js";
export * from "./og-image-integration.js";
export { defineClient, SECTION_VARIANTS } from "@hirobius/schema";
export type { ClientConfig, SectionId } from "@hirobius/schema";
import type { SectionVariantId, VariantSectionId } from "@hirobius/schema";

/** Ordered list of section component filenames keyed by SectionId. Apps map
 *  `config.layout.sectionOrder` over this to compose the page. Kept here so a
 *  new section is wired in one place. */
export const SECTION_COMPONENTS = {
  services: "ServicesGrid.astro",
  gallery: "Gallery.astro",
  reviews: "Reviews.astro",
  serviceAreaMap: "ServiceAreaMap.astro",
  contact: "ContactForm.astro",
} as const;

/**
 * Component file for every (section, variant) pair in the schema's
 * SECTION_VARIANTS registry, relative to `src/components`. Sections that
 * haven't had their first harvest yet keep their original flat file;
 * harvested sections use `<sectionId>/<variantId>.astro` behind a flat
 * dispatcher under the original filename (e.g. `Hero.astro`,
 * `ServicesGrid.astro`). registry.test.ts asserts this map and
 * SECTION_VARIANTS never drift and that every file exists.
 */
export const SECTION_VARIANT_COMPONENTS = {
  hero: {
    classic: "hero/classic.astro",
    video: "hero/video.astro",
    "split-card": "hero/split-card.astro",
    banner: "hero/banner.astro",
  },
  services: {
    grid: "services/grid.astro",
    cards: "services/cards.astro",
    alternating: "services/alternating.astro",
  },
  gallery: { grid: "gallery/grid.astro" },
  reviews: { cards: "reviews/cards.astro" },
  serviceAreaMap: { standard: "ServiceAreaMap.astro" },
  contact: { standard: "ContactForm.astro" },
} as const satisfies {
  [S in VariantSectionId]: Record<SectionVariantId<S>, string>;
};
