import { defineClient } from "@hirobius/schema";

/**
 * PLACEHOLDER preview — fictional business, no real data. Built to prove the
 * factory + preview-deploy + basic-auth gate end to end. Photo-less by design
 * (the theme carries the look); real imagery is a separate concern (issue #14).
 */
export const client = defineClient({
  slug: "preview-solidline-concrete",
  business: {
    name: "SolidLine Concrete & Fencing",
    phone: "(555) 010-4403",
    email: "hello@solidline-concrete.example",
    hours: [
      { days: "Mon–Fri", hours: "7:00 AM – 5:00 PM" },
      { days: "Sat", hours: "By appointment" },
      { days: "Sun", hours: "Closed" },
    ],
    serviceAreas: ["Placeholderville", "Sample Springs", "Mockton"],
  },
  brand: {
    palettePreset: "concrete-fencing",
    font: "slab",
    radius: "sm",
  },
  layout: {
    sectionOrder: ["services", "gallery", "reviews", "serviceAreaMap", "contact"],
  },
  services: [
    {
      title: "Driveways & Patios",
      description: "Poured, stamped, or resurfaced concrete built to last through every season.",
    },
    {
      title: "Fence Installation",
      description: "Wood, vinyl, and chain-link fencing installed straight, solid, and on schedule.",
    },
    {
      title: "Repairs & Resurfacing",
      description: "Cracked slabs and leaning fences made right — safe, level, and looking new.",
    },
  ],
  copy: {
    heroHeadline: "Concrete & Fencing Built to Last in Placeholderville",
    heroSub: "Driveways, patios, and fences done straight and solid — with a crew that shows up. Free estimates.",
    ctaLabel: "Get a Free Estimate",
    about:
      "SolidLine Concrete & Fencing is a placeholder business used to prove the site factory. Copy, colors, and layout all come from one config file — no bespoke code for this site.",
  },
  reviews: [
    { author: "Sample Customer", rating: 5, text: "New driveway is flawless. Clean lines and no mess left behind.", source: "Google" },
    { author: "Test Reviewer", rating: 5, text: "Fence went up in two days and looks rock solid. Great crew.", source: "Google" },
  ],
  map: {
    embedQuery: "Placeholderville",
  },
  form: {
    provider: "web3forms",
    accessKey: "00000000-0000-0000-0000-000000000000",
  },
  seo: {
    title: "SolidLine Concrete & Fencing | Placeholderville Contractors",
    description:
      "Placeholder preview site. Concrete driveways and patios, fence installation, and repairs in Placeholderville and nearby. Free estimates.",
    city: "Placeholderville",
    region: "ST",
    siteUrl: "https://preview-solidline-concrete.example",
  },
});
