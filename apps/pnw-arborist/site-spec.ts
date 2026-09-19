import { defineSiteSpec } from "@hirobius/schema/site-spec";

/**
 * Bespoke art direction + per-client copy for PNW Arborist Consulting.
 *
 * Business FACTS (name, phone, hours, service areas, SEO) stay in
 * `client.config.ts` — this file never restates one. Copy here is templates:
 * `{name}` and `{city}` are filled from the ClientConfig at render time.
 */
export const spec = defineSiteSpec({
  slug: "pnw-arborist",
  client: "PNW Arborist Consulting",

  wordmark: { lead: "PNW", accent: "Arborist" },

  // Real Google Business Profile, from the lead row — links the rating/count
  // claim to its source, which keeps it verifiable rather than asserted.
  googleUrl:
    "https://www.google.com/maps/place/PNW+Arborist+Consulting+Inc/@47.039404499999996,-122.962087,14z/data=!4m8!1m2!2m1!1sPNW+Arborist+Consulting+Inc!3m4!1s0x5491753684d57163:0x9f678c481890c294!8m2!3d47.039404499999996!4d-122.962087",

  tradeEyebrow: "Certified Arborists",
  heroAlt: "Tree care by {name} in {city}",

  headline: {
    lead: "Careful, certified tree care for",
    accent: "{city} homeowners.",
  },
  bandHeadline: {
    lead: "A reputation built one careful job at a time —",
    accent: "and it shows.",
  },

  stats: [
    { k: "4.9★", l: "Google rating" },
    { k: "200+", l: "Google reviews" },
    { k: "Free", l: "On-site estimates" },
  ],

  regionPhrase: " — and the surrounding Thurston County area.",
  formPlaceholder: "Tree removal, pruning, a health assessment…",
  footerDescription:
    "Certified arborists serving {city} and the surrounding Thurston County area.",

  images: { hero: "photos/hero.jpg", band: "photos/canopy.jpg" },

  // Light editorial serif on warm paper, deep forest-green accent.
  // `src/styles/design.css` is generated from this block — edit here, not there.
  design: {
    "--paper": "#f2eee3",
    "--paper-2": "#ebe4d5",
    "--ink": "#1b241d",
    "--muted": "#5f665b",
    "--accent": "#2c5637",
    "--accent-deep": "#1d3b26",
    "--line": "rgba(27, 36, 29, 0.16)",
    "--dark": "#141d17",
    "--dark-paper": "#ece6d7",
    "--dark-muted": "#9aa593",
    // Derived tones that were inline literals before se#207.
    "--accent-light": "#8fbf9c",
    "--accent-shade": "#14201a",
    "--accent-wash": "rgba(143, 191, 156, 0.22)",
    "--scrim": "rgba(20, 29, 23, 0.82)",
    "--scrim-strong": "rgba(20, 29, 23, 0.9)",
  },
});
