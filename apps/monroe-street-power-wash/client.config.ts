import { defineClient } from "@hirobius/schema";

/**
 * Monroe Street Power Wash (Spokane, WA) — regenerated from the REAL ops
 * `leads` row (Supabase), replacing the earlier fabricated config that
 * mispresented this business as a pressure-washing contractor.
 *
 * What the lead row actually says (golden rule #5 — facts from intake only):
 *   category        "Car wash" (self-serve / touchless automatic)
 *   phone           +1 509-327-9641
 *   street_address  3121 N Monroe St, Spokane, WA 99205
 *   hours           Open 24 hours, every day
 *   rating/reviews  3.8 ★ over 335 Google reviews
 *   description     "Car-washing facility featuring touchless automatic
 *                    options along with self-serve bays."
 *   email / website / service_area / individual reviews  → NONE in intake
 *
 * Copy below is written to match that real description; nothing is invented
 * beyond it. Palette uses "pressure-washing" (closest shipped preset — there
 * is no car-wash pack; a clean-water blue suits a wash).
 *
 * TODO before go-live (intake had no value — placeholders, not facts):
 *   - business.email — real address unknown; using a stub
 *   - form.accessKey — set a real Web3Forms key
 *   - seo.siteUrl — set the real production URL
 *   - reviews — only the 3.8/335 aggregate exists; no individual review text
 *     to show, so the reviews section is intentionally omitted (no fabrication)
 *   - photos — one real Google photo exists but is an external URL; kept
 *     photo-less like the other preview apps until it's downloaded locally
 */
export const client = defineClient({
  slug: "monroe-street-power-wash",
  business: {
    name: "Monroe Street Power Wash",
    phone: "(509) 327-9641",
    email: "hello@monroe-street-power-wash-spokane.example", // TODO: real email (none in intake)
    address: "3121 N Monroe St, Spokane, WA 99205",
    hours: [{ days: "Every day", hours: "Open 24 hours" }],
    serviceAreas: ["Spokane, WA"],
  },
  brand: {
    palettePreset: "pressure-washing",
    font: "inter",
    radius: "md",
  },
  layout: {
    // No reviews/gallery sections — no individual review text or local photos
    // exist in intake, and an empty section renders blank / fails acceptance.
    sectionOrder: ["services", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "Touchless Automatic Wash",
      description:
        "Drive-through touchless bays clean your vehicle without brushes or contact — a gentle, hands-off wash any time of day.",
    },
    {
      title: "Self-Serve Wash Bays",
      description:
        "Do-it-yourself stalls with the equipment to foam, wash, and rinse your car, truck, or SUV at your own pace.",
    },
    {
      title: "Open 24 Hours",
      description:
        "Both the touchless automatic and self-serve options are available around the clock, every day — wash on your schedule.",
    },
  ],
  copy: {
    heroHeadline: "Spokane's 24-Hour Self-Serve & Touchless Car Wash",
    heroSub:
      "Touchless automatic bays and self-serve stalls on N Monroe St — open 24 hours, every day. Drive in whenever it's convenient.",
    ctaLabel: "Visit Us on N Monroe St",
    about:
      "Monroe Street Power Wash is a self-serve and touchless automatic car wash at 3121 N Monroe St in Spokane. Open 24 hours a day, every day — pull into a touchless automatic bay for a hands-off clean, or use a self-serve stall when you'd rather do it yourself. A long-standing local spot with hundreds of Google reviews.",
  },
  map: {
    embedQuery: "3121 N Monroe St, Spokane, WA 99205",
  },
  form: {
    provider: "web3forms",
    accessKey: "REPLACE_WITH_WEB3FORMS_ACCESS_KEY", // TODO: real Web3Forms key
  },
  seo: {
    title: "Monroe Street Power Wash | 24-Hour Spokane Car Wash",
    description:
      "Self-serve and touchless automatic car wash at 3121 N Monroe St, Spokane. Open 24 hours, every day.",
    city: "Spokane",
    region: "WA",
    siteUrl: "https://monroe-street-power-wash-spokane.example", // TODO: real production URL
  },
});
