import { defineClient } from "@hirobius/schema";

/**
 * PLACEHOLDER preview — fictional business, no real data. Built to prove the
 * factory + preview-deploy + basic-auth gate end to end. Photo-less by design
 * (the theme carries the look); real imagery is a separate concern (issue #14).
 */
export const client = defineClient({
  slug: "preview-evergreen-lawn",
  business: {
    name: "Evergreen Lawn & Landscape",
    phone: "(555) 010-2201",
    email: "hello@evergreen-lawn.example",
    hours: [
      { days: "Mon–Fri", hours: "7:00 AM – 6:00 PM" },
      { days: "Sat", hours: "8:00 AM – 3:00 PM" },
      { days: "Sun", hours: "Closed" },
    ],
    serviceAreas: ["Placeholderville", "Sample Springs", "Testfield"],
  },
  brand: {
    palettePreset: "landscaping",
    font: "work-sans",
    radius: "lg",
  },
  layout: {
    sectionOrder: ["services", "gallery", "reviews", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "Weekly Lawn Care",
      description: "Mowing, edging, and cleanup on a schedule that keeps your yard sharp all season.",
    },
    {
      title: "Landscape Design & Planting",
      description: "Beds, shrubs, and seasonal color designed for your space and planted to last.",
    },
    {
      title: "Cleanups & Mulching",
      description: "Spring and fall cleanups plus fresh mulch that protects roots and lifts curb appeal.",
    },
  ],
  copy: {
    heroHeadline: "Placeholderville's Lawn & Landscape Crew",
    heroSub: "Weekly mowing, clean beds, and healthy plantings — done right and on time. Free quotes.",
    ctaLabel: "Get a Free Quote",
    about:
      "Evergreen Lawn & Landscape is a placeholder business used to prove the site factory. Copy, colors, and layout all come from one config file — no bespoke code for this site.",
  },
  reviews: [
    { author: "Sample Customer", rating: 5, text: "Yard has never looked better. Reliable and friendly crew.", source: "Google" },
    { author: "Test Reviewer", rating: 5, text: "Showed up every week without fail. Beds look fantastic.", source: "Google" },
  ],
  map: {
    embedQuery: "Placeholderville",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "Evergreen Lawn & Landscape | Placeholderville Lawn Care",
    description:
      "Placeholder preview site. Weekly lawn care, landscape design, and cleanups in Placeholderville and nearby. Free quotes.",
    city: "Placeholderville",
    region: "ST",
    siteUrl: "https://preview-evergreen-lawn.example",
  },
});
