import {
  defineClient,
  type ClientConfig,
  type ClientConfigDraft,
  type ClientConfigInput,
  type SectionVariantId,
  type SkinId,
  type VariantSectionId,
} from "@hirobius/schema";
import type { PalettePresetId } from "@hirobius/schema/presets";

/**
 * Demo configs — one per trade preset — built through the real schema so the
 * gallery can only ever show configs that would actually pass `pnpm build`.
 * No image paths are set, so components render their no-photo states (the
 * gallery is about layout + theming, not stock imagery).
 */
interface PresetDemo {
  preset: PalettePresetId;
  label: string;
  variant: "A" | "B";
  business: string;
  headline: string;
  sub: string;
  services: [string, string][];
}

const DEMOS: PresetDemo[] = [
  {
    preset: "landscaping",
    label: "Landscaping",
    variant: "A",
    business: "Green Thumb Landscaping",
    headline: "Austin's Lawn & Landscape Crew",
    sub: "Design, install, and maintenance that makes the neighbors ask who you use.",
    services: [
      ["Lawn Care", "Weekly mowing, edging, and cleanup on a schedule you can set and forget."],
      ["Landscape Design", "Beds, borders, and native plantings designed for Texas summers."],
      ["Irrigation", "Smart sprinkler installs and repairs that cut your water bill."],
    ],
  },
  {
    preset: "junk-removal",
    label: "Junk Removal",
    variant: "B",
    business: "Haul-It-Away",
    headline: "Same-Day Junk Removal",
    sub: "Point at it, we haul it. Furniture, appliances, garage cleanouts — gone today.",
    services: [
      ["Furniture Removal", "Couches, mattresses, and that recliner nobody will admit to owning."],
      ["Appliance Haul-Off", "Old fridges, washers, and dryers responsibly recycled."],
      ["Garage Cleanouts", "From one item to a full truck, we leave it broom-clean."],
    ],
  },
  {
    preset: "pressure-washing",
    label: "Pressure Washing",
    variant: "A",
    business: "Pressure Pros",
    headline: "Driveways & Siding, Restored",
    sub: "Soft-wash and surface cleaning that brings back the curb appeal. Free quotes.",
    services: [
      ["House Washing", "Gentle soft-wash that lifts mildew without harming your siding."],
      ["Driveways & Concrete", "Oil stains and grime gone; concrete back to its original color."],
      ["Roof Cleaning", "Low-pressure treatment that protects your shingles and warranty."],
    ],
  },
  {
    preset: "concrete-fencing",
    label: "Concrete & Fencing",
    variant: "A",
    business: "Ironclad Concrete & Fence",
    headline: "Concrete & Fencing Done Right",
    sub: "Driveways, patios, and fences built to outlast the weather and the warranty.",
    services: [
      ["Concrete Flatwork", "Driveways, patios, and walkways poured level and built to last."],
      ["Fence Installation", "Wood, metal, and privacy fences set straight and solid."],
      ["Repairs & Resurfacing", "Cracks, settling, and tired surfaces made new again."],
    ],
  },
];

function build(demo: PresetDemo): ClientConfig {
  return defineClient({
    slug: demo.preset,
    business: {
      name: demo.business,
      phone: "(512) 555-0100",
      email: "hello@example.com",
      hours: [
        { days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" },
        { days: "Sat", hours: "9:00 AM – 2:00 PM" },
        { days: "Sun", hours: "Closed" },
      ],
      serviceAreas: ["Austin", "Round Rock", "Cedar Park"],
    },
    brand: { palettePreset: demo.preset, font: "inter", radius: "lg" },
    layout: { variant: demo.variant, sectionOrder: ["services", "reviews", "contact"] },
    services: demo.services.map(([title, description]) => ({ title, description })),
    copy: {
      heroHeadline: demo.headline,
      heroSub: demo.sub,
      ctaLabel: "Get a Free Quote",
      about: `${demo.business} is a local, family-owned crew. Licensed, insured, and obsessed with the before-and-after.`,
    },
    reviews: [
      { author: "Maria G.", rating: 5, text: "Showed up on time, fair price, fantastic result.", source: "Google" },
      { author: "Dave R.", rating: 5, text: "Booked one job, ended up doing three. Worth every penny.", source: "Google" },
    ],
    map: { embedQuery: "Austin, TX" },
    form: { provider: "web3forms", accessKey: "00000000-0000-0000-0000-000000000000" },
    seo: {
      title: `${demo.business} | Austin, TX`,
      description: demo.sub,
      city: "Austin",
      region: "TX",
      siteUrl: "https://example.com",
    },
  });
}

export interface PresetFixture {
  label: string;
  preset: PalettePresetId;
  variant: "A" | "B";
  config: ClientConfig;
}

export const FIXTURES: PresetFixture[] = DEMOS.map((d) => ({
  label: d.label,
  preset: d.preset,
  variant: d.variant,
  config: build(d),
}));

/**
 * Re-validate a fixture with one section switched to a specific style variant.
 * Runs back through `defineClient()`, so the variants page can only ever show
 * (section, variant) combinations a real client config could ship.
 */
export function withSectionVariant<S extends VariantSectionId>(
  base: ClientConfig,
  section: S,
  variant: SectionVariantId<S>,
): ClientConfig {
  return defineClient({
    ...base,
    layout: {
      ...base.layout,
      sections: { ...base.layout.sections, [section]: { variant } },
    },
  });
}

/**
 * Base input for the skins page (issue #141) — same business content as the
 * "Pressure Pros" preset fixture, but its `brand` sets ONLY `palettePreset`
 * (no `font`/`radius`, unlike `build()` above). That matters: `applyDesignSkin`
 * is override-only — an explicit field always wins over the skin's pin, even
 * when that "explicit" value is just a Zod default that got baked in by an
 * earlier `defineClient()` call. Feeding an already-resolved `ClientConfig`
 * (e.g. a `FIXTURES` entry, which has concrete `font: "inter"`, `radius: "lg"`,
 * `cssVarOverrides: {}`, `layout.sections.hero.variant: "classic"`, …) back in
 * as a skin's base would make every one of THOSE pins lose to values that
 * only look explicit — the skin would visibly do nothing. `withDesignSkin`
 * below applies `design` to this raw, mostly-empty draft instead, so a
 * skin's hero variant, font pairing, palette, radius, shadow, and motion all
 * actually show through.
 */
const SKIN_DEMO_INPUT: ClientConfigInput = {
  slug: "skin-demo",
  business: {
    name: "Pressure Pros",
    phone: "(512) 555-0100",
    email: "hello@example.com",
    hours: [
      { days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" },
      { days: "Sat", hours: "9:00 AM – 2:00 PM" },
      { days: "Sun", hours: "Closed" },
    ],
    serviceAreas: ["Austin", "Round Rock", "Cedar Park"],
  },
  brand: { palettePreset: "pressure-washing" },
  layout: { sectionOrder: ["services", "reviews", "contact"] },
  services: [
    { title: "House Washing", description: "Gentle soft-wash that lifts mildew without harming your siding." },
    { title: "Driveways & Concrete", description: "Oil stains and grime gone; concrete back to its original color." },
    { title: "Roof Cleaning", description: "Low-pressure treatment that protects your shingles and warranty." },
  ],
  copy: {
    heroHeadline: "Driveways & Siding, Restored",
    heroSub: "Soft-wash and surface cleaning that brings back the curb appeal. Free quotes.",
    ctaLabel: "Get a Free Quote",
    about: "Pressure Pros is a local, family-owned crew. Licensed, insured, and obsessed with the before-and-after.",
  },
  reviews: [
    { author: "Maria G.", rating: 5, text: "Showed up on time, fair price, fantastic result.", source: "Google" },
    { author: "Dave R.", rating: 5, text: "Booked one job, ended up doing three. Worth every penny.", source: "Google" },
  ],
  map: { embedQuery: "Austin, TX" },
  form: { provider: "web3forms", accessKey: "00000000-0000-0000-0000-000000000000" },
  seo: {
    title: "Pressure Pros | Austin, TX",
    description: "Soft-wash and surface cleaning that brings back the curb appeal. Free quotes.",
    city: "Austin",
    region: "TX",
    siteUrl: "https://example.com",
  },
};

/**
 * Resolve the skins page's demo config for one skin (issue #141). See
 * `SKIN_DEMO_INPUT` above for why this starts from a raw, unresolved draft
 * instead of reusing a `FIXTURES` entry. Still runs through `defineClient()`,
 * so the page can only ever show a (skin) combination a real client config
 * could ship.
 */
export function withDesignSkin(design: SkinId): ClientConfig {
  return defineClient({ ...SKIN_DEMO_INPUT, design } as ClientConfigDraft);
}
