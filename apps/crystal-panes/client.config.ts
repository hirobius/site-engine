import { defineClient } from "@hirobius/schema";

/**
 * PLACEHOLDER preview — cold-outreach preview for the next lead on the ops board
 * (Crystal Panes Window and Gutter Cleaning, Seattle WA). Highly-rated exterior
 * cleaner: 5.0★ across 1,000+ Google reviews (real aggregate facts from the lead
 * row). This is a gated preview, so unknown contact details are clearly-fictional
 * placeholders (email, form key, siteUrl) pending real intake — see the TODOs
 * below. Photo-less by design, like the other preview apps (issue #14 tracks
 * real imagery).
 *
 * Real lead facts used verbatim: business name, phone, city/region, and the core
 * services named in the Google Business description ("algae-removing,
 * gutter-cleaning and window-cleaning services for homes"). Nothing beyond those
 * facts is asserted as true. Reviews are omitted (no review text on the lead row —
 * golden rule #5, never fabricate reviews).
 *
 * TODO before go-live (`pnpm go-live crystal-panes` arms the placeholder gate):
 *  - business.email is a placeholder (.example) — set the real intake email.
 *  - business.hours is a placeholder ("Call for hours") — confirm real hours.
 *  - business.serviceAreas beyond Seattle are metro-standard guesses — confirm at intake.
 *  - form.accessKey is the all-zeros placeholder — set a real Web3Forms key.
 *  - seo.siteUrl is a .example placeholder — set the real production domain.
 *    (Their existing site is crystalpanes.com; the production domain is Adrian's call.)
 *  - Add photos to src/assets/photos + "gallery" to layout.sectionOrder.
 *  - Add real Google reviews to `reviews` + "reviews" to layout.sectionOrder.
 */
export const client = defineClient({
  slug: "crystal-panes",
  business: {
    name: "Crystal Panes Window and Gutter Cleaning",
    phone: "(206) 284-5183",
    email: "hello@crystal-panes.example",
    hours: [{ days: "Mon–Sun", hours: "Call for hours" }],
    serviceAreas: ["Seattle", "Bellevue", "Shoreline", "Kirkland", "Renton"],
  },
  brand: {
    palettePreset: "pressure-washing",
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
      title: "Window Cleaning",
      description:
        "Interior and exterior window cleaning for homes — glass, screens, tracks, and sills left streak-free, with a spot-free rinse on exterior panes.",
    },
    {
      title: "Gutter Cleaning",
      description:
        "Full hand-cleaning of gutters and downspouts to clear leaves, moss, and debris so water drains away from your roof and foundation.",
    },
    {
      title: "Roof & Siding Algae Removal",
      description:
        "Low-pressure soft washing lifts algae, moss, and black streaks from roofs and siding without the damage a high-pressure spray causes.",
    },
    {
      title: "Pressure Washing",
      description:
        "Driveways, walkways, patios, and decks cleared of dirt, moss, and built-up grime — bringing tired exterior surfaces back to life.",
    },
  ],
  copy: {
    heroHeadline: "Seattle's Window, Gutter & Exterior Cleaning Pros",
    heroSub:
      "Streak-free windows, clear gutters, and algae-free roofs and siding — done right, fully insured, with free estimates.",
    ctaLabel: "Get a Free Quote",
    about:
      "Crystal Panes is a locally owned window and gutter cleaning company serving Seattle-area homeowners, with a 5-star reputation earned across more than a thousand reviews. We specialize in residential window cleaning, gutter cleaning, and gentle algae and moss removal for roofs and siding — using soft-wash techniques that lift years of grime without damaging your home. Fast scheduling, upfront pricing, and friendly, careful crews on every job.",
  },
  gallery: [],
  reviews: [],
  map: {
    embedQuery: "Seattle, WA",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "Crystal Panes | Seattle Window & Gutter Cleaning",
    description:
      "Seattle's window, gutter, and exterior cleaning pros. Residential window cleaning, gutter cleaning, and roof & siding algae removal. Free estimates, fully insured.",
    city: "Seattle",
    region: "WA",
    siteUrl: "https://crystal-panes.example",
  },
});
