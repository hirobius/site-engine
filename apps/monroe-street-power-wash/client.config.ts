import { defineClient } from "@hirobius/schema";

/**
 * PLACEHOLDER preview — first lead → preview site (Monroe Street Power Wash,
 * Spokane WA). Highly-rated pressure washer with no existing website; this is
 * a cold-outreach preview, so contact details are clearly-fictional
 * placeholders (phone, email, form key) pending real intake. Photo-less by
 * design, like the other preview apps (see issue #14 for real imagery).
 *
 * Reviews are omitted (empty array, not in sectionOrder): we carry NO review
 * text without a real source (golden rule #5 — never invent business facts).
 * Unverifiable claims ("fully insured", "satisfaction guarantee") are softened
 * out of the copy until backed by intake fields (#87/#149). Regenerate from the
 * real lead row for the verified version (#146).
 */
export const client = defineClient({
  slug: "monroe-street-power-wash",
  business: {
    name: "Monroe Street Power Wash",
    phone: "(509) 555-0100",
    email: "hello@monroestreetpowerwash.example",
    hours: [
      { days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" },
      { days: "Sat", hours: "9:00 AM – 3:00 PM" },
      { days: "Sun", hours: "Closed" },
    ],
    serviceAreas: ["Spokane", "Spokane Valley", "Liberty Lake", "Cheney", "Mead"],
  },
  brand: {
    palettePreset: "pressure-washing",
    font: "inter",
    radius: "md",
  },
  layout: {
    variant: "A",
    // No "gallery" (photo-less, #14) and no "reviews" (no real review source,
    // #146) — an empty section would render blank.
    sectionOrder: ["services", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "House Soft Washing",
      description:
        "Low-pressure, chemical soft-wash treatment that lifts mold, algae, and grime from siding without damaging paint, stucco, or trim.",
    },
    {
      title: "Roof Soft Washing",
      description:
        "Manufacturer-safe soft wash removes black streaks, moss, and lichen from asphalt shingles — no high-pressure spray, no shingle damage.",
    },
    {
      title: "Driveway & Concrete Cleaning",
      description:
        "High-pressure surface cleaning strips oil stains, tire marks, and years of built-up grime from driveways, walkways, and patios.",
    },
    {
      title: "Deck & Fence Restoration",
      description:
        "Wood-safe cleaning lifts dirt and graying from decks and fences and preps the surface for staining or sealing.",
    },
    {
      title: "Commercial Pressure Washing",
      description:
        "Storefronts, sidewalks, parking lots, and dumpster pads kept looking sharp for Spokane businesses, scheduled around your hours.",
    },
  ],
  copy: {
    heroHeadline: "Spokane's Soft Wash & Pressure Washing Pros",
    heroSub:
      "House washing, roofs, driveways, decks, and commercial exteriors — done right, with free estimates.",
    ctaLabel: "Get a Free Quote",
    about:
      "Monroe Street Power Wash is a locally owned pressure washing company serving Spokane and the surrounding area. We specialize in gentle soft-washing for siding and roofs alongside driveway, deck, fence, and commercial cleaning — using techniques that lift years of grime without damaging your property. Fast scheduling and upfront pricing on every job.",
  },
  gallery: [],
  // Empty until a real review source exists — we never invent reviews (#146).
  reviews: [],
  map: {
    embedQuery: "Spokane, WA",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "Monroe Street Power Wash | Spokane Pressure Washing",
    description:
      "Spokane's soft wash and pressure washing experts. House, roof, driveway, deck, fence, and commercial cleaning. Free estimates.",
    city: "Spokane",
    region: "WA",
    siteUrl: "https://monroestreetpowerwash.example",
  },
});
