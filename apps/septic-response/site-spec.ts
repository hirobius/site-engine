import { defineSiteSpec } from "@hirobius/schema/site-spec";
import photoQueries from "./photo-queries.json";

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

  // se#208: was 0x0:0x0 here (a placeholder introduced in #214) but the real
  // place id in v2.astro's own literal before this change — restored so the
  // rating claim stays checkable on BOTH variants, per the field's own doc.
  googleUrl:
    "https://www.google.com/maps/place/Septic+Response/@47.6809747,-122.1940532,14z/data=!4m8!1m2!2m1!1sSeptic+Response!3m4!1s0x549013dbbc3d6a7b:0x1686c3c7092fbfa6!8m2!3d47.6809747!4d-122.1940532",

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

  images: { hero: "photos/hero.jpg", band: "photos/canopy.jpg", v2Hero: "photos/v2-hero.jpg" },

  content: {
    serviceIcons: ["truck", "search-check", "wrench", "siren"],
    features: [
      {
        icon: "clock",
        title: "24/7 emergency",
        text: "Backed up at 2am? We answer the phone and come out — any day, any hour.",
      },
      {
        icon: "truck",
        title: "Fast response",
        text: "Prompt arrivals and quick diagnosis so a small problem stays small.",
      },
      {
        icon: "badge-check",
        title: "Honest & upfront",
        text: "Clear quotes and straight answers — no upsells, no surprises.",
      },
      {
        icon: "star",
        title: "4.9-star rated",
        text: "Trusted across 200+ Google reviews from Eastside homeowners.",
      },
    ],
    steps: [
      {
        icon: "phone-call",
        title: "Call us anytime",
        text: "Reach a real person 24/7 and tell us what's happening.",
      },
      {
        icon: "search-check",
        title: "We diagnose & quote",
        text: "We assess the system and give you an honest, upfront price.",
      },
      {
        icon: "wrench",
        title: "Fixed fast, done right",
        text: "We pump, repair, or replace — and clean up after ourselves.",
      },
    ],
    heroEyebrow: "24/7 septic service",
    heroTrust: [
      { icon: "star", k: "4.9", l: "Google rating" },
      { icon: "badge-check", k: "200+", l: "reviews" },
      { icon: "clock", k: "", l: "24/7 service" },
    ],
    servicesHeading: "Complete septic care for your home",
    servicesIntro:
      "From routine pumping and inspections to urgent repairs — one dependable local team.",
    featuresHeading: "Dependable, upfront, and always available",
    areaHeading: "Serving Kirkland & the Eastside",
    footerNote: "septic pros serving {city} and the surrounding Eastside.",
    mapEmbedBase: "https://www.google.com/maps",
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
    v1ServicesKicker: "/ Services",
    v1ServicesLabel: "What we do",
    v1AreaKicker: "/ Service area",
    v1AreaLabel: "Where we work",
    v1ContactKicker: "/ Get in touch",
    v1TrustedKicker: "Trusted locally",
  },

  photoQueries,

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
    "--v2-bg": "#f4fafd",
    "--v2-surface": "#ffffff",
    "--v2-ink": "#0b2230",
    "--v2-muted": "#4d6b7a",
    "--v2-line": "#dbe9f2",
    "--v2-accent": "#0a6cb5",
    "--v2-accent-deep": "#084f87",
    "--v2-tint": "#dceef6",
    "--v2-highlight": "#0e9e90",
    "--v2-dark": "#071b28",
    "--v2-dark-fg": "#e4f1f6",
    "--v2-dark-muted": "#86a3b3",
    "--v2-highlight-ink": "#1c1406",
    "--v2-btn-primary-shadow": "rgba(10, 108, 181, 0.28)",
    "--v2-btn-highlight-shadow": "rgba(14, 158, 144, 0.3)",
    "--v2-btn-ghost-border": "rgba(255, 255, 255, 0.5)",
    "--v2-btn-ghost-hover-bg": "rgba(255, 255, 255, 0.12)",
    "--v2-hero-veil-1": "rgba(7, 27, 40, 0.62)",
    "--v2-hero-veil-2": "rgba(7, 27, 40, 0.82)",
    "--v2-hero-eyebrow-color": "#a6d1e8",
    "--v2-hero-sub-color": "rgba(255, 255, 255, 0.86)",
    "--v2-hero-trust-color": "rgba(255, 255, 255, 0.9)",
    "--v2-card-hover-shadow": "rgba(11, 34, 48, 0.1)",
    "--v2-card-hover-border": "#c3ddec",
    "--v2-feat-icon-shadow": "rgba(11, 34, 48, 0.08)",
    "--v2-band-veil-1": "rgba(7, 27, 40, 0.72)",
    "--v2-band-veil-2": "rgba(7, 27, 40, 0.82)",
    "--v2-band-label-color": "rgba(255, 255, 255, 0.72)",
    "--v2-contact-card-shadow": "rgba(11, 34, 48, 0.08)",
    "--v2-field-focus-ring": "rgba(10, 108, 181, 0.12)",
    "--v2-error": "#b23a20",
    "--v2-foot-bar-border": "rgba(255, 255, 255, 0.12)",
  },
});
