import { defineClient } from "@hirobius/schema";

/**
 * Demo client — "Pressure Pros". Proves the system end to end with placeholder
 * imagery. Everything here is config; there is no bespoke code for this site.
 */
export const client = defineClient({
  slug: "pressure-pros",
  business: {
    name: "Pressure Pros",
    phone: "(512) 555-0142",
    email: "quotes@pressurepros.example",
    hours: [
      { days: "Mon–Fri", hours: "7:00 AM – 7:00 PM" },
      { days: "Sat", hours: "8:00 AM – 4:00 PM" },
      { days: "Sun", hours: "Closed" },
    ],
    serviceAreas: ["Austin", "Round Rock", "Cedar Park", "Pflugerville"],
  },
  brand: {
    palettePreset: "pressure-washing",
    font: "inter",
    radius: "lg",
  },
  layout: {
    variant: "A",
    sectionOrder: ["services", "gallery", "reviews", "serviceAreaMap", "contact"],
  },
  hero: {
    image: "/photos/hero.jpg",
  },
  services: [
    {
      title: "House & Siding Washing",
      description:
        "Soft-wash that lifts dirt, mildew, and algae without damaging your siding, brick, or stucco.",
      image: "/photos/service-house.jpg",
    },
    {
      title: "Driveways & Concrete",
      description:
        "Surface-cleaned driveways, sidewalks, and patios — oil stains and grime gone, curb appeal back.",
      image: "/photos/service-driveway.jpg",
    },
    {
      title: "Roof & Gutter Cleaning",
      description:
        "Low-pressure roof treatment and gutter flush-outs that protect your shingles and your warranty.",
      image: "/photos/service-roof.jpg",
    },
  ],
  copy: {
    heroHeadline: "Austin's Pressure Washing Pros",
    heroSub:
      "Driveways, siding, decks, and roofs — restored to like-new. Free quotes, same-week scheduling.",
    ctaLabel: "Get a Free Quote",
    about:
      "Pressure Pros is a family-owned crew serving the greater Austin area for over 10 years. We're licensed, insured, and obsessed with the before-and-after. If it has a surface, we can make it shine.",
  },
  gallery: [
    { src: "/photos/gallery-1.jpg", alt: "Driveway before and after pressure washing" },
    { src: "/photos/gallery-2.jpg", alt: "Clean white siding on a two-story home" },
    { src: "/photos/gallery-3.jpg", alt: "Restored wooden deck after soft washing" },
    { src: "/photos/gallery-4.jpg", alt: "Sparkling clean concrete patio" },
    { src: "/photos/gallery-5.jpg", alt: "Roof cleaning in progress" },
    { src: "/photos/gallery-6.jpg", alt: "Freshly cleaned brick walkway" },
  ],
  reviews: [
    {
      author: "Maria G.",
      rating: 5,
      text: "Our driveway looks brand new. Showed up on time, fair price, super friendly.",
      source: "Google",
    },
    {
      author: "Dave R.",
      rating: 5,
      text: "Booked them for the house and ended up doing the deck too. Worth every penny.",
      source: "Google",
    },
    {
      author: "Priya S.",
      rating: 5,
      text: "Years of algae off our north-facing siding in one afternoon. Highly recommend.",
      source: "Yelp",
    },
  ],
  map: {
    embedQuery: "Austin, TX",
  },
  form: {
    provider: "web3forms",
    // Demo placeholder. Real clients get their own Web3Forms key in env/config.
    accessKey: "00000000-0000-0000-0000-000000000000",
    // hcaptchaSiteKey omitted in the demo; production clients set this day one.
  },
  seo: {
    title: "Pressure Pros | Pressure Washing in Austin, TX",
    description:
      "Professional pressure washing in Austin, Round Rock & Cedar Park. Driveways, siding, decks, and roofs. Free quotes, same-week service.",
    city: "Austin",
    region: "TX",
    siteUrl: "https://pressure-pros.example",
    ogImage: "/photos/og.jpg",
  },
});
