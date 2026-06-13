import { defineClient } from "@hirobius/schema";

/**
 * Canonical client config stub.
 *
 * `scripts/new-client.ts` copies this whole app to apps/<slug> and rewrites the
 * fields below. It is kept VALID (not full of empty strings) so the _template
 * app builds in CI — an invalid config here would fail the whole pipeline.
 *
 * Everything the site shows comes from this object. If a client needs something
 * that isn't expressible here, that's a custom-component engagement, not a
 * config edit (see README → "Scope policy").
 */
export const client = defineClient({
  slug: "template",
  business: {
    name: "Acme Service Co.",
    phone: "(555) 010-0000",
    email: "hello@example.com",
    hours: [
      { days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" },
      { days: "Sat", hours: "9:00 AM – 2:00 PM" },
      { days: "Sun", hours: "Closed" },
    ],
    serviceAreas: ["Your City", "Neighbor Town"],
  },
  brand: {
    palettePreset: "pressure-washing",
    font: "inter",
    radius: "md",
  },
  layout: {
    variant: "A",
    sectionOrder: ["services", "gallery", "reviews", "serviceAreaMap", "contact"],
  },
  hero: {
    image: "/photos/hero.jpg",
  },
  services: [
    { title: "Service One", description: "Describe the first core service here." },
    { title: "Service Two", description: "Describe the second core service here." },
    { title: "Service Three", description: "Describe the third core service here." },
  ],
  copy: {
    heroHeadline: "Headline that names the service and the place.",
    heroSub: "One sentence on the promise: fast, local, done right.",
    ctaLabel: "Get a Free Quote",
    about: "A short paragraph about the business, its experience, and why locals trust it.",
  },
  gallery: [],
  reviews: [
    { author: "Happy Customer", rating: 5, text: "Great work, on time and fairly priced.", source: "Google" },
  ],
  map: {
    embedQuery: "Your City",
  },
  form: {
    provider: "web3forms",
    accessKey: "REPLACE_WITH_WEB3FORMS_ACCESS_KEY",
    // hcaptchaSiteKey: "REPLACE_WITH_HCAPTCHA_SITE_KEY",
  },
  seo: {
    title: "Acme Service Co. | Your City Service Pros",
    description: "Professional service in Your City and surrounding areas. Free quotes, fast response.",
    city: "Your City",
    region: "ST",
    siteUrl: "https://example.com",
  },
});
