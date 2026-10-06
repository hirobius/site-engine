import { defineClient } from "@hirobius/schema";

/**
 * PLACEHOLDER preview — outreach preview for Tevah Lash, a lash-extension
 * studio and lash-supply brand in Post Falls / Coeur d'Alene, Idaho (lead
 * supplied by Adrian, 2026-10-06, from its public Google / Instagram presence).
 * No website found: web search returns nothing beyond social profiles —
 * exactly the outreach thesis.
 *
 * Real public facts used verbatim: business name, Post Falls / Coeur d'Alene
 * ID location, custom eyelash extensions, the signature "Wispy Luxe" style,
 * lash supplies (sold as "Tevah Lash Supplies"), and the @tevahco Instagram.
 * No phone, email, street address, hours, prices, or reviews were found, so
 * none are invented: contact fields are the fleet's stubs, prices are never
 * stated, and `reviews` is empty (#146). No licensed/certified claim (#149).
 * "Lash Fills" is a standard offering for any extension studio, described
 * generically — same pattern as duran-tree-service's services.
 *
 * Palette: the pressure-washing preset is only the base; every token is
 * overridden with a soft mauve/blush beauty palette (brand.cssVarOverrides is
 * the sanctioned per-client surface — no new preset).
 *
 * TODO before sending the preview (docs/PIPELINE-RUNBOOK.md pre-send step):
 *  - business.phone is a 555-01XX stub — set it from intake for the deploy
 *    that produces the link (keep the real value out of git).
 *  - business.email is a .example placeholder.
 *  - business.hours is "By appointment" — unconfirmed; replace with real hours.
 *  - social.facebook: the "Tevah Lash Supplies" page URL wasn't captured — add it.
 *  - form.accessKey / seo.siteUrl are placeholders (go-live only).
 *  - Photos: Tevah's own lash work (with permission) for hero + gallery;
 *    shipped photo-less until then.
 */
export const client = defineClient({
  slug: "tevah-lash",
  business: {
    name: "Tevah Lash",
    phone: "(208) 555-0104",
    email: "hello@tevahlash.example",
    hours: [{ days: "Appointments", hours: "By appointment" }],
    serviceAreas: ["Post Falls", "Coeur d'Alene"],
  },
  social: {
    instagram: "https://www.instagram.com/tevahco/",
  },
  brand: {
    palettePreset: "pressure-washing",
    cssVarOverrides: {
      "--brand-primary": "#6e4a55",
      "--brand-accent": "#e7c3c0",
      "--brand-bg": "#fbf7f5",
      "--brand-fg": "#2b2124",
      "--brand-muted": "#f2e7e4",
      "--brand-on-primary": "#ffffff",
    },
    font: "inter",
    fontPairing: "editorial",
    radius: "xl",
  },
  layout: {
    // No "gallery" (no photos sourced yet) and no "reviews" (none sourced —
    // never invent review content) — empty sections would render blank.
    sectionOrder: ["services", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "Custom Lash Extensions",
      description:
        "A lash set designed around your eye shape and the look you want — from soft and natural to full and dramatic.",
    },
    {
      title: "Wispy Luxe Signature Set",
      description:
        "Tevah's signature wispy style: textured, fluttery lashes with soft spikes for that effortless, camera-ready look.",
    },
    {
      title: "Lash Fills",
      description:
        "Keep your set full and fresh between appointments with regular fills.",
    },
    {
      title: "Lash Supplies",
      description:
        "The same lashes and supplies used in the studio, from Tevah Lash Supplies — for lash artists and lash lovers alike.",
    },
  ],
  copy: {
    heroHeadline: "Custom Lash Extensions in Post Falls & Coeur d'Alene",
    heroSub:
      "Signature styles like Wispy Luxe, set by hand and made for your eyes — plus pro lash supplies from Tevah Lash.",
    ctaLabel: "Book Your Lashes",
    about:
      "Tevah Lash is a lash extension studio and lash-supply brand based in Post Falls, Idaho, serving Post Falls and Coeur d'Alene. Every set is customized — from soft, natural looks to Tevah's signature Wispy Luxe — and the lashes and supplies used in the studio are available through Tevah Lash Supplies. Follow along on Instagram at @tevahco.",
  },
  gallery: [],
  reviews: [],
  map: {
    embedQuery: "Post Falls, ID",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "Tevah Lash | Lash Extensions in Post Falls & Coeur d'Alene",
    description:
      "Custom lash extensions and the signature Wispy Luxe set in Post Falls and Coeur d'Alene, Idaho. Lash fills and pro lash supplies from Tevah Lash.",
    city: "Post Falls",
    region: "ID",
    siteUrl: "https://tevah-lash.example",
  },
});
