import { defineSiteSpec } from "@hirobius/schema/site-spec";

/**
 * Bespoke art direction + per-client copy for Septic Response.
 *
 * Business FACTS (name, phone, hours, service areas, SEO) stay in
 * `client.config.ts` — this file never restates one. Copy here is templates:
 * `{name}` and `{city}` are filled from the ClientConfig at render time.
 */
export const spec = defineSiteSpec({
  slug: "septic-response",
  client: "Septic Response",

  wordmark: { lead: "Septic", accent: "Response" },

  googleUrl:
    "https://www.google.com/maps/place/Septic+Response/@47.6809747,-122.1940532,14z/data=!4m8!1m2!2m1!1sSeptic+Response!3m4!1s0x0:0x0!8m2!3d47.6809747!4d-122.1940532",

  tradeEyebrow: "24/7 Septic Service",
  heroAlt: "{name} septic service in {city}",

  headline: {
    lead: "Fast, dependable septic care for",
    accent: "{city} homeowners.",
  },
  bandHeadline: {
    lead: "When it can't wait, we're there —",
    accent: "day or night.",
  },

  stats: [
    { k: "4.9★", l: "Google rating" },
    { k: "200+", l: "Google reviews" },
    { k: "24/7", l: "Emergency service" },
  ],

  regionPhrase: " — and the surrounding Eastside.",
  formPlaceholder: "Backed up, a pump-out, an inspection…",
  footerDescription:
    "Septic pros serving {city} and the surrounding Eastside — 24/7 emergency service.",

  images: { hero: "photos/hero.jpg", band: "photos/canopy.jpg" },

  // Water-blue/teal (se#150, retraded in se#205) — trade-appropriate for
  // septic/utility, not the arborist greens.
  // `src/styles/design.css` is generated from this block — edit here, not there.
  design: {
    "--paper": "#f4fafd",
    "--paper-2": "#dceef6",
    "--ink": "#0b2230",
    "--muted": "#4d6b7a",
    "--accent": "#0a6cb5",
    "--accent-deep": "#084f87",
    "--line": "rgba(11, 34, 48, 0.16)",
    "--dark": "#071b28",
    "--dark-paper": "#e4f1f6",
    "--dark-muted": "#86a3b3",
    // Derived tones that were inline literals before se#207.
    "--accent-light": "#0e9e90",
    "--accent-shade": "#071b28",
    "--accent-wash": "rgba(14, 158, 144, 0.22)",
    "--scrim": "rgba(7, 27, 40, 0.82)",
    "--scrim-strong": "rgba(7, 27, 40, 0.9)",
  },
});
