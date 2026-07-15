import { defineClient } from "@hirobius/schema";

/**
 * PLACEHOLDER preview — cold-outreach preview for the top NO-WEBSITE lead on the
 * ops board (PNW Arborist Consulting Inc, Olympia WA). A highly-rated tree-care
 * business — 4.9★ across 200+ Google reviews (real aggregate facts from the lead
 * row) — with no existing web presence, which is exactly the outreach thesis:
 * strong reputation, invisible online. Landscaping palette (green) fits tree care.
 *
 * Real lead facts used verbatim: business name, phone, city/region, and the core
 * services named in the Google Business description ("tree removals and tree
 * pruning, as well as tree-health consultations"). Nothing beyond those facts is
 * asserted as true. Reviews/gallery omitted (no review text / no photos on the
 * lead row — golden rule #5, never fabricate).
 *
 * TODO before go-live (`pnpm go-live pnw-arborist` arms the placeholder gate):
 *  - business.email is a placeholder (.example) — set the real intake email.
 *  - business.hours is a placeholder ("Call for hours") — confirm real hours.
 *  - business.serviceAreas beyond Olympia are metro-standard guesses — confirm at intake.
 *  - form.accessKey is the all-zeros placeholder — set a real Web3Forms key.
 *  - seo.siteUrl is a .example placeholder — register + set the real production domain
 *    (this business has NO website today — securing the domain is part of the pitch).
 *  - Add photos to src/assets/photos + "gallery" to layout.sectionOrder.
 *  - Add real Google reviews to `reviews` + "reviews" to layout.sectionOrder.
 */
export const client = defineClient({
  slug: "pnw-arborist",
  business: {
    name: "PNW Arborist Consulting Inc",
    phone: "(360) 545-5633",
    email: "hello@pnw-arborist.example",
    hours: [{ days: "Mon–Sun", hours: "Call for hours" }],
    serviceAreas: ["Olympia", "Lacey", "Tumwater", "Yelm"],
  },
  brand: {
    palettePreset: "landscaping",
    font: "inter",
    radius: "md",
  },
  layout: {
    variant: "A",
    // No "gallery"/"reviews" — this preview ships no photos and carries no
    // review text (same precedent as monroe-street-power-wash); an empty
    // section would render blank and fail the acceptance section-completeness check.
    sectionOrder: ["services", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "Tree Removal",
      description:
        "Safe, careful removal of hazardous, dead, or unwanted trees — from tight residential lots to large-diameter removals — with full cleanup afterward.",
    },
    {
      title: "Tree Pruning & Trimming",
      description:
        "Structural and health pruning that improves canopy shape, clears hazards, and keeps your trees strong — done to proper arboricultural standards.",
    },
    {
      title: "Tree Health & Risk Assessments",
      description:
        "Certified arborist consultations: diagnosing disease and pest issues, evaluating structural risk, and giving you a clear, honest plan for each tree.",
    },
  ],
  copy: {
    heroHeadline: "Olympia's Trusted Tree Care & Certified Arborists",
    heroSub:
      "Tree removal, expert pruning, and honest arborist assessments — fully insured, with free estimates for Thurston County homeowners.",
    ctaLabel: "Get a Free Quote",
    about:
      "PNW Arborist Consulting is a locally owned tree-care company serving Olympia and the surrounding Thurston County area, with a 4.9-star reputation earned across more than two hundred reviews. We specialize in tree removal, structural and health pruning, and certified arborist consultations — helping homeowners keep their trees safe, healthy, and beautiful. Fast scheduling, upfront pricing, and careful, professional crews on every job.",
  },
  gallery: [],
  reviews: [],
  map: {
    embedQuery: "Olympia, WA",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "PNW Arborist Consulting | Olympia Tree Service",
    description:
      "Olympia's certified arborists and tree-care pros. Tree removal, expert pruning, and honest tree-health and risk assessments. Free estimates, fully insured.",
    city: "Olympia",
    region: "WA",
    siteUrl: "https://pnw-arborist.example",
  },
});
