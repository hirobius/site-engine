import { defineSiteSpec } from "@hirobius/schema/site-spec";
import photoQueries from "./photo-queries.json";

/**
 * STUB art direction + copy for the BESPOKE tier's copy source (se#209).
 *
 * `apps/_bespoke-template` is never deployed — see `client.config.ts`'s header
 * for why it's a workspace member and what a real bespoke app must replace.
 * The icon ids below match `src/components/Icon.astro`'s stubbed `ICONS` map
 * 1:1 (`bespoke-spec-gate.test.ts`, se#208, asserts that pairing for every
 * bespoke app this template gets copied into).
 */
export const spec = defineSiteSpec({
  slug: "bespoke-template",
  client: "Bespoke Template Co",

  wordmark: { lead: "Bespoke", accent: "Template" },

  googleUrl: "https://www.google.com/maps",

  tradeEyebrow: "Stub Trade",
  heroAlt: "Stub hero photo for {name} in {city}",

  headline: {
    lead: "Stub headline for",
    accent: "{city} — replace at intake.",
  },
  bandHeadline: {
    lead: "Stub band headline —",
    accent: "replace at intake.",
  },

  stats: [
    { k: "0.0★", l: "Stub rating" },
    { k: "0", l: "Stub reviews" },
    { k: "Free", l: "Stub estimates" },
  ],

  regionPhrase: " — stub region phrase.",
  formPlaceholder: "Stub form placeholder…",
  footerDescription: "Stub footer description for {name} in {city}.",

  images: { hero: "photos/hero.jpg", band: "photos/canopy.jpg", v2Hero: "photos/v2-hero.jpg" },

  content: {
    serviceIcons: ["axe", "scissors", "stethoscope"],
    features: [
      {
        icon: "badge-check",
        title: "Stub feature one",
        text: "Stub feature copy — replace at intake.",
      },
      {
        icon: "clock",
        title: "Stub feature two",
        text: "Stub feature copy — replace at intake.",
      },
      {
        icon: "leaf",
        title: "Stub feature three",
        text: "Stub feature copy — replace at intake.",
      },
      {
        icon: "star",
        title: "Stub feature four",
        text: "Stub feature copy — replace at intake.",
      },
    ],
    steps: [
      {
        icon: "phone-call",
        title: "Stub step one",
        text: "Stub step copy — replace at intake.",
      },
      {
        icon: "calendar-check",
        title: "Stub step two",
        text: "Stub step copy — replace at intake.",
      },
      {
        icon: "tree-pine",
        title: "Stub step three",
        text: "Stub step copy — replace at intake.",
      },
    ],
    heroEyebrow: "Stub eyebrow",
    heroTrust: [
      { icon: "star", k: "0.0", l: "stub rating" },
      { icon: "badge-check", k: "0", l: "stub reviews" },
      { icon: "leaf", k: "", l: "Stub estimates" },
    ],
    servicesHeading: "Stub services heading",
    servicesIntro: "Stub services intro — replace at intake.",
    featuresHeading: "Stub features heading",
    areaHeading: "Stub service area heading",
    footerNote: "stub footer note for {name} in {city}.",
    mapEmbedBase: "https://www.google.com/maps",
  },

  sectionHeadings: {
    servicesEyebrow: "What we do",
    featuresEyebrow: "Why choose us",
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

  // Stub palette — copied structurally from a shipped bespoke app so the
  // `--v2-*` derived-token set stays complete; values are arbitrary for a
  // template that never renders in production.
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
    "--accent-light": "#8fbf9c",
    "--accent-shade": "#14201a",
    "--accent-wash": "rgba(143, 191, 156, 0.22)",
    "--scrim": "rgba(20, 29, 23, 0.82)",
    "--scrim-strong": "rgba(20, 29, 23, 0.9)",

    "--pv-bg": "#14201a",
    "--pv-fg": "#f2eee3",
    "--pv-shadow": "rgba(0, 0, 0, 0.28)",
    "--pv-seg-off": "rgba(255, 255, 255, 0.62)",
    "--pv-menu-label": "rgba(242, 238, 227, 0.55)",

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
