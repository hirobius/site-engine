import { defineClient } from "@hirobius/schema";

/**
 * PLACEHOLDER preview — fictional business, no real data. Built to prove the
 * factory + preview-deploy + basic-auth gate end to end. Photo-less by design
 * (the theme carries the look); real imagery is a separate concern (issue #14).
 */
export const client = defineClient({
  slug: "preview-clearout-junk",
  business: {
    name: "ClearOut Junk Removal",
    phone: "(555) 010-3302",
    email: "hello@clearout-junk.example",
    hours: [
      { days: "Mon–Sat", hours: "7:00 AM – 8:00 PM" },
      { days: "Sun", hours: "9:00 AM – 5:00 PM" },
    ],
    serviceAreas: ["Placeholderville", "Sample Springs", "Testfield", "Mockton"],
  },
  brand: {
    palettePreset: "junk-removal",
    font: "inter",
    radius: "md",
  },
  layout: {
    variant: "A",
    sectionOrder: ["services", "reviews", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "Full-Service Junk Removal",
      description: "We load it, haul it, and sweep up — furniture, appliances, and whole-home cleanouts.",
    },
    {
      title: "Garage & Estate Cleanouts",
      description: "Fast, no-hassle cleanouts that turn a packed garage or estate into a clean slate.",
    },
    {
      title: "Construction & Yard Debris",
      description: "Renovation debris, old fencing, and yard waste removed same-day when you need the space back.",
    },
  ],
  copy: {
    heroHeadline: "Placeholderville Junk Removal, Same Day",
    heroSub: "One call and it's gone — furniture, appliances, and full cleanouts. Upfront pricing, no surprises.",
    ctaLabel: "Get a Free Quote",
    about:
      "ClearOut Junk Removal is a placeholder business used to prove the site factory. Copy, colors, and layout all come from one config file — no bespoke code for this site.",
  },
  reviews: [
    { author: "Sample Customer", rating: 5, text: "Gone in under an hour. Fair price and super polite crew.", source: "Google" },
    { author: "Test Reviewer", rating: 5, text: "Cleared out my whole garage same day I called. Lifesaver.", source: "Yelp" },
  ],
  map: {
    embedQuery: "Placeholderville",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "ClearOut Junk Removal | Same-Day Hauling in Placeholderville",
    description:
      "Placeholder preview site. Same-day junk removal, garage and estate cleanouts, and debris hauling in Placeholderville. Upfront pricing.",
    city: "Placeholderville",
    region: "ST",
    siteUrl: "https://preview-clearout-junk.example",
  },
});
