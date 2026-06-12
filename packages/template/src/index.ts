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
export { defineClient } from "@hirobius/schema";
export type { ClientConfig, SectionId } from "@hirobius/schema";

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
