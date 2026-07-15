import { defineClient } from "@hirobius/schema";

/**
 * PLACEHOLDER preview — cold-outreach preview for a NO-WEBSITE lead on the ops
 * board (Septic Response, Kirkland WA). Highly-rated septic company — 4.9★ across
 * 200+ Google reviews (real aggregate facts from the lead row) — with no existing
 * web presence.
 *
 * ⚠️ OFF-CORE-TRADE: "Septic system service" is NOT one of our four shipped trades
 * (landscaping / junk-removal / pressure-washing / concrete-fencing). Per the
 * engine's default-trade rule, this uses the pressure-washing palette (blue reads
 * fine for a water/utility service), but the positioning is Adrian's call —
 * septic may warrant a different template or a pass. Flagged, not blocked.
 *
 * Real lead facts used verbatim: business name, phone, city/region. The lead row
 * has NO Google description, so the services below are STANDARD septic offerings
 * (pumping, inspection, repair) — not business-specific claims; confirm the actual
 * service menu at intake (see TODOs). Reviews/gallery omitted (no source data —
 * golden rule #5).
 *
 * TODO before go-live (`pnpm go-live septic-response` arms the placeholder gate):
 *  - CONFIRM the service menu — services are trade-standard guesses (no lead description).
 *  - CONFIRM the palette/positioning — septic is outside the four core trades.
 *  - business.email is a placeholder (.example) — set the real intake email.
 *  - business.hours is a placeholder ("Call for hours") — confirm real hours (septic is often 24/7 emergency).
 *  - business.serviceAreas beyond Kirkland are metro-standard guesses — confirm at intake.
 *  - form.accessKey is the all-zeros placeholder — set a real Web3Forms key.
 *  - seo.siteUrl is a .example placeholder — register + set the real production domain (no site today).
 *  - Add photos to src/assets/photos + "gallery" to layout.sectionOrder.
 *  - Add real Google reviews to `reviews` + "reviews" to layout.sectionOrder.
 */
export const client = defineClient({
  slug: "septic-response",
  business: {
    name: "Septic Response",
    phone: "(206) 962-2600",
    email: "hello@septic-response.example",
    hours: [{ days: "Mon–Sun", hours: "Call for hours" }],
    serviceAreas: ["Kirkland", "Redmond", "Bellevue", "Bothell", "Woodinville"],
  },
  brand: {
    palettePreset: "pressure-washing",
    font: "inter",
    radius: "md",
  },
  layout: {
    variant: "A",
    // No "gallery"/"reviews" — this preview ships no photos and carries no
    // review text; an empty section would render blank and fail the
    // acceptance section-completeness check.
    sectionOrder: ["services", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "Septic Tank Pumping",
      description:
        "Routine and on-demand septic tank pumping to keep your system flowing and prevent backups — fast scheduling when you need it.",
    },
    {
      title: "Septic Inspections",
      description:
        "Thorough system inspections for real-estate transactions, maintenance, or peace of mind — with a clear report of what we find.",
    },
    {
      title: "Repairs & Maintenance",
      description:
        "Diagnosing and repairing failing components — pumps, lines, baffles, and drain fields — and setting up a maintenance schedule that heads off costly failures.",
    },
    {
      title: "Emergency Septic Service",
      description:
        "Backed-up or overflowing? Fast-response service to diagnose the problem and get your system working again with minimal disruption.",
    },
  ],
  copy: {
    heroHeadline: "Kirkland's Trusted Septic Pros — Fast Response",
    heroSub:
      "Septic pumping, inspections, repairs, and emergency service for Eastside homeowners — dependable, upfront, and fully insured.",
    ctaLabel: "Get a Free Quote",
    about:
      "Septic Response is a locally owned septic company serving Kirkland and the surrounding Eastside, with a 4.9-star reputation earned across more than two hundred reviews. From routine pumping and inspections to repairs and emergency service, we keep your system running and give you honest, upfront answers — no upsells, no surprises. Fast scheduling and careful, professional crews on every call.",
  },
  gallery: [],
  reviews: [],
  map: {
    embedQuery: "Kirkland, WA",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "Septic Response | Kirkland Septic Service",
    description:
      "Kirkland's trusted septic pros. Septic tank pumping, inspections, repairs, and fast emergency service for the Eastside. Free estimates, fully insured.",
    city: "Kirkland",
    region: "WA",
    siteUrl: "https://septic-response.example",
  },
});
