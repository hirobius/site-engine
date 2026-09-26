import { defineClient } from "@hirobius/schema";

/**
 * STUB client config for the BESPOKE tier's copy source (se#209).
 *
 * This app is never deployed — `pnpm-workspace.yaml` includes it (same as
 * `_template`) only so `pnpm check` / `pnpm build` / `pnpm test` validate the
 * shared bespoke files, and `bespoke-template-gate.test.ts` (packages/template)
 * asserts every real bespoke app's `src/pages/{index,v2}.astro`,
 * `src/components/PreviewControls.astro`, and `scripts/fetch-photos.mjs` stay
 * byte-identical to this app's copies. Scaffold a new bespoke app by copying
 * `apps/_bespoke-template/` and replacing this file + `site-spec.ts` +
 * `src/components/Icon.astro` (the three genuinely per-client files) with real
 * intake facts — never invent business facts here (golden rule #5).
 *
 * All values below are placeholders on purpose: 555-01XX phone, `.example`
 * email/domain, all-zeros form key — the same fleet-standard stubs used by
 * every speculative preview before intake.
 */
export const client = defineClient({
  slug: "bespoke-template",
  business: {
    name: "Bespoke Template Co",
    phone: "(360) 555-0100",
    email: "hello@bespoke-template.example",
    hours: [{ days: "Mon–Sun", hours: "Call for hours" }],
    serviceAreas: ["Example City"],
  },
  brand: {
    palettePreset: "landscaping",
    font: "inter",
    radius: "md",
  },
  layout: {
    sectionOrder: ["services", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "Example Service One",
      description: "Replace with a real service description at intake.",
    },
    {
      title: "Example Service Two",
      description: "Replace with a real service description at intake.",
    },
    {
      title: "Example Service Three",
      description: "Replace with a real service description at intake.",
    },
  ],
  copy: {
    heroHeadline: "Bespoke Template Stub Headline",
    heroSub: "Stub sub-headline — replace at intake.",
    ctaLabel: "Get a Free Quote",
    about: "Stub about copy — replace at intake.",
  },
  gallery: [],
  reviews: [],
  map: {
    embedQuery: "Example City",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "Bespoke Template Stub | Do Not Deploy",
    description: "Stub SEO description — replace at intake.",
    city: "Example City",
    region: "WA",
    siteUrl: "https://bespoke-template.example",
  },
});
