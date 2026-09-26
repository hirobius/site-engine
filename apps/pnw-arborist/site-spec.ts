import { defineSiteSpec } from "@hirobius/schema/site-spec";
import photoQueries from "./photo-queries.json";

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

  images: { hero: "photos/hero.jpg", band: "photos/canopy.jpg", v2Hero: "photos/v2-hero.jpg" },

  content: {
    serviceIcons: ["axe", "scissors", "stethoscope"],
    features: [
      {
        icon: "badge-check",
        title: "Local & experienced",
        text: "Olympia-based arborists who know Thurston County trees and soils.",
      },
      {
        icon: "clock",
        title: "Fast scheduling",
        text: "Quick, honest quotes and prompt, reliable appointments.",
      },
      {
        icon: "leaf",
        title: "Careful & clean",
        text: "We protect your property and leave the site tidy — every visit.",
      },
      {
        icon: "star",
        title: "4.9-star rated",
        text: "Trusted across 200+ Google reviews from local homeowners.",
      },
    ],
    steps: [
      {
        icon: "phone-call",
        title: "Request a quote",
        text: "Call or send the form — tell us what your trees need.",
      },
      {
        icon: "calendar-check",
        title: "We assess & schedule",
        text: "A certified arborist evaluates the work and sets a time.",
      },
      {
        icon: "tree-pine",
        title: "Careful work, clean site",
        text: "We do the job safely and leave your yard spotless.",
      },
    ],
    heroEyebrow: "Certified arborists",
    heroTrust: [
      { icon: "star", k: "4.9", l: "Google rating" },
      { icon: "badge-check", k: "200+", l: "reviews" },
      { icon: "leaf", k: "", l: "Free estimates" },
    ],
    servicesHeading: "Expert care for every tree on your property",
    servicesIntro:
      "From removals to fine pruning and honest health assessments — one careful, local team.",
    featuresHeading: "Reliable, tidy, and genuinely local",
    areaHeading: "Serving Olympia & Thurston County",
    footerNote: "certified arborists serving {city} and the surrounding Thurston County area.",
  },

  sectionHeadings: {
    servicesEyebrow: "What we do",
    featuresEyebrow: "Why homeowners choose us",
    stepsEyebrow: "How it works",
    stepsHeading: "Three simple steps",
    serviceAreaEyebrow: "Service area",
    contactEyebrow: "Get in touch",
    contactHeading: "Get a Free Quote",
    footerExplore: "Explore",
    footerTagline: "Free, no-obligation estimates",
  },

  photoQueries,

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

    // PreviewControls.astro's own chrome — fixed neutral colours, deliberately
    // NOT brand-derived (it's preview-only UI, shared unchanged by every
    // bespoke app; se#208 moved it out of that component's literals too).
    "--pv-bg": "#14201a",
    "--pv-fg": "#f2eee3",
    "--pv-shadow": "rgba(0, 0, 0, 0.28)",
    "--pv-seg-off": "rgba(255, 255, 255, 0.62)",
    "--pv-menu-label": "rgba(242, 238, 227, 0.55)",

    // V2 half — the "Modern" page's own :root, generated into
    // `src/styles/design-v2.css` (se#208). `--v2-` prefixed so these can live
    // in the same flat record as V1's identically-named roles above without
    // colliding; the generated stylesheet re-declares them under the plain
    // names v2.astro's CSS actually uses (they never share a document with V1).
    "--v2-bg": "#f5f7f3",
    "--v2-surface": "#ffffff",
    "--v2-ink": "#15241b",
    "--v2-muted": "#5a6960",
    "--v2-line": "#e2e8df",
    "--v2-accent": "#1f5236",
    "--v2-accent-deep": "#163a27",
    "--v2-tint": "#e9f1e9",
    "--v2-highlight": "#bf8730",
    "--v2-dark": "#12251a",
    "--v2-dark-fg": "#e9f0e7",
    "--v2-dark-muted": "#9db0a2",
    "--v2-highlight-ink": "#1c1406",
    "--v2-btn-primary-shadow": "rgba(31, 82, 54, 0.28)",
    "--v2-btn-highlight-shadow": "rgba(191, 135, 48, 0.3)",
    "--v2-btn-ghost-border": "rgba(255, 255, 255, 0.5)",
    "--v2-btn-ghost-hover-bg": "rgba(255, 255, 255, 0.12)",
    "--v2-hero-veil-1": "rgba(18, 37, 26, 0.62)",
    "--v2-hero-veil-2": "rgba(18, 37, 26, 0.82)",
    "--v2-hero-eyebrow-color": "#b9d4bf",
    "--v2-hero-sub-color": "rgba(255, 255, 255, 0.86)",
    "--v2-hero-trust-color": "rgba(255, 255, 255, 0.9)",
    "--v2-card-hover-shadow": "rgba(21, 36, 27, 0.1)",
    "--v2-card-hover-border": "#cfe0cf",
    "--v2-feat-icon-shadow": "rgba(21, 36, 27, 0.08)",
    "--v2-band-veil-1": "rgba(18, 37, 26, 0.72)",
    "--v2-band-veil-2": "rgba(18, 37, 26, 0.82)",
    "--v2-band-label-color": "rgba(255, 255, 255, 0.72)",
    "--v2-contact-card-shadow": "rgba(21, 36, 27, 0.08)",
    "--v2-field-focus-ring": "rgba(31, 82, 54, 0.12)",
    "--v2-error": "#b23a20",
    "--v2-foot-bar-border": "rgba(255, 255, 255, 0.12)",
  },
});
