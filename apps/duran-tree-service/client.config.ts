import { defineClient } from "@hirobius/schema";

/**
 * PLACEHOLDER preview — cold-outreach preview for a real no-website lead
 * (Duran's Tree Service LLC, Yakima WA — sourced via an Outscraper Google Maps
 * pull). A 5.0-star business across 132 Google reviews with zero web presence:
 * exactly the outreach thesis — strong reputation, invisible online.
 * Landscaping (green) palette is the closest natural-trade fit for tree care.
 *
 * Real lead facts used verbatim: business name, hours, city/service
 * area (Yakima + surrounding Yakima Valley, confirmed by coords — no street
 * address was returned, so none is set here), the 5.0★/132-review aggregate,
 * and "online estimates: true". No street address, no review text/authors
 * (we have the count only — never fabricate review text, issue #146), and no
 * licensed/insured/bonded/certified claim (none confirmed on the lead row —
 * the #149 acceptance gate flags unverifiable claims). Services below are
 * standard tree-service offerings (removal, pruning, stump grinding,
 * storm/emergency work, land clearing), described generically — same pattern
 * as monroe-street-power-wash / pnw-arborist, not a fabricated specific fact.
 *
 * The lead's phone number is deliberately NOT stored here: contact details stay
 * on the lead row, out of the repo and out of git history. The value below is
 * the fleet's FCC-reserved 555-01XX stub, same as the other previews.
 *
 * TODO before go-live (`pnpm go-live duran-tree-service` arms the placeholder gate):
 *  - business.phone is a 555-01XX placeholder — set it from the lead row at intake.
 *  - business.email is a placeholder (.example) — the lead has no email; set
 *    the real intake email once obtained.
 *  - business.serviceAreas beyond "Yakima" / "Yakima Valley" (specific nearby
 *    towns) are unconfirmed — do not add without intake confirmation.
 *  - form.accessKey is the all-zeros placeholder — set a real Web3Forms key.
 *  - seo.siteUrl is a .example placeholder — register + set the real
 *    production domain (this business has no website today — securing the
 *    domain is part of the pitch).
 *  - Add photos to src/assets/photos + "gallery" to layout.sectionOrder (no
 *    imagery source for this lead yet — shipped photo-less by design).
 *  - Add real Google reviews to `reviews` + "reviews" to layout.sectionOrder
 *    only once individual review text/authors are sourced with permission
 *    to publish (docs/GO-LIVE-CHECKLIST.md §2) — we have the aggregate
 *    rating/count only, not review content.
 */
export const client = defineClient({
  slug: "duran-tree-service",
  business: {
    name: "Duran's Tree Service LLC",
    phone: "(509) 555-0103",
    email: "hello@duranstreeservice.example",
    hours: [
      { days: "Mon–Sat", hours: "6:30 AM – 7:00 PM" },
      { days: "Sun", hours: "7:00 AM – 7:00 PM" },
    ],
    serviceAreas: ["Yakima", "Yakima Valley"],
  },
  brand: {
    palettePreset: "landscaping",
    font: "inter",
    radius: "md",
  },
  layout: {
    // No "gallery" (photo-less, no imagery source for this lead) and no
    // "reviews" (aggregate rating only, no individual review text/authors
    // sourced — golden rule #5) — an empty section would render blank.
    sectionOrder: ["services", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "Tree Removal",
      description:
        "Safe, careful removal of hazardous, dead, or unwanted trees — from tight residential lots to large-diameter removals — with full cleanup afterward.",
    },
    {
      title: "Tree Trimming & Pruning",
      description:
        "Structural and health pruning that shapes the canopy, clears hazards away from structures and power lines, and keeps trees strong year-round.",
    },
    {
      title: "Stump Grinding",
      description:
        "Complete stump grinding below grade so the yard is left level and ready to reseed, replant, or pave over — no leftover eyesore.",
    },
    {
      title: "Storm & Emergency Tree Service",
      description:
        "Fast response for downed limbs, storm-damaged trees, and hazard removals so your property is safe again quickly.",
    },
    {
      title: "Lot & Land Clearing",
      description:
        "Clearing brush, small trees, and overgrowth to open up a lot for building, landscaping, or reclaiming usable land.",
    },
  ],
  copy: {
    heroHeadline: "Yakima Valley's Trusted Tree Service",
    heroSub:
      "Tree removal, trimming, stump grinding, and storm cleanup — with free online estimates for Yakima and the surrounding valley.",
    ctaLabel: "Get a Free Estimate",
    about:
      "Duran's Tree Service LLC is a locally owned tree-care company serving Yakima and the surrounding Yakima Valley, with a 5.0-star reputation earned across 132 Google reviews. We handle everything from tree removal and pruning to stump grinding, storm and emergency work, and lot clearing — with free online estimates and careful, thorough work on every job.",
  },
  gallery: [],
  // Aggregate rating (5.0★ / 132 reviews) is a real sourced fact and is
  // stated in copy.about above; individual review text/authors are NOT
  // sourced, so this stays empty — we never invent review content (#146).
  reviews: [],
  map: {
    embedQuery: "Yakima, WA",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "Duran's Tree Service LLC | Yakima Tree Service",
    description:
      "Yakima Valley's tree-care pros. Tree removal, trimming, stump grinding, and storm cleanup. Free online estimates, 5.0 stars on Google.",
    city: "Yakima",
    region: "WA",
    siteUrl: "https://duran-tree-service.example",
  },
});
