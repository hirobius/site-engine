import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineSiteSpec, renderSpecTemplate, type SiteSpec } from "./site-spec.js";

const BASE: SiteSpec = {
  slug: "acme-co",
  client: "Acme Co",
  wordmark: { lead: "Acme", accent: "Co" },
  googleUrl: "https://www.google.com/maps/place/Acme",
  tradeEyebrow: "Certified Widgeteers",
  heroAlt: "Widget work by {name} in {city}",
  headline: { lead: "Careful widgets for", accent: "{city} homeowners." },
  bandHeadline: { lead: "Built to last —", accent: "and it shows." },
  stats: [
    { k: "4.9★", l: "Google rating" },
    { k: "200+", l: "Google reviews" },
    { k: "Free", l: "Estimates" },
  ],
  regionPhrase: " — and the surrounding area.",
  formPlaceholder: "Tell us what you need…",
  footerDescription: "Widgeteers serving {city}.",
  images: { hero: "photos/hero.jpg", band: "photos/band.jpg", v2Hero: "photos/v2-hero.jpg" },
  content: {
    serviceIcons: ["wrench"],
    features: [
      { icon: "badge-check", title: "Local", text: "Local widgeteers." },
      { icon: "clock", title: "Fast", text: "Fast turnaround." },
      { icon: "star", title: "Rated", text: "Highly rated." },
      { icon: "leaf", title: "Tidy", text: "Clean site." },
    ],
    steps: [
      { icon: "phone-call", title: "Call", text: "Tell us what you need." },
      { icon: "calendar-check", title: "Schedule", text: "We book a time." },
      { icon: "wrench", title: "Done", text: "We do the work." },
    ],
    heroEyebrow: "Certified widgeteers",
    heroTrust: [
      { icon: "star", k: "4.9", l: "Google rating" },
      { icon: "badge-check", k: "200+", l: "reviews" },
      { icon: "leaf", k: "", l: "Free estimates" },
    ],
    servicesHeading: "Expert widget work",
    servicesIntro: "From install to repair — one careful team.",
    featuresHeading: "Reliable and local",
    areaHeading: "Serving the area",
    footerNote: "widgeteers serving {city}.",
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
  photoQueries: {
    hero: { query: "widget on a table", orientation: "portrait" },
    band: { query: "widgets in sunlight", orientation: "landscape" },
    v2Hero: { query: "widget factory", orientation: "landscape" },
  },
  design: { "--accent": "#2c5637" },
};

describe("defineSiteSpec", () => {
  it("accepts a well-formed spec", () => {
    expect(defineSiteSpec(BASE).slug).toBe("acme-co");
  });

  it("rejects a non-kebab slug — it is also the localStorage key prefix", () => {
    expect(() => defineSiteSpec({ ...BASE, slug: "Acme Co" })).toThrow();
  });

  it("rejects a design key that is not a CSS custom property", () => {
    // The whole point of keying `design` by property name is that
    // src/styles/design.css is a direct projection with no mapping layer.
    expect(() => defineSiteSpec({ ...BASE, design: { accent: "#2c5637" } })).toThrow();
  });

  it("requires exactly three stats — the layout is a 3-column grid", () => {
    expect(() => defineSiteSpec({ ...BASE, stats: BASE.stats.slice(0, 2) })).toThrow();
    expect(() => defineSiteSpec({ ...BASE, stats: [...BASE.stats, BASE.stats[0]] })).toThrow();
  });

  it("rejects a googleUrl that is not a URL", () => {
    expect(() => defineSiteSpec({ ...BASE, googleUrl: "maps/place/Acme" })).toThrow();
  });

  it("requires exactly four features — the V2 grid is a 4-column layout", () => {
    expect(() =>
      defineSiteSpec({
        ...BASE,
        content: { ...BASE.content, features: BASE.content.features.slice(0, 3) },
      }),
    ).toThrow();
  });

  it("requires exactly three steps — the V2 row is a 3-column layout", () => {
    expect(() =>
      defineSiteSpec({
        ...BASE,
        content: { ...BASE.content, steps: [...BASE.content.steps, BASE.content.steps[0]] },
      }),
    ).toThrow();
  });

  it("requires exactly three hero trust badges", () => {
    expect(() =>
      defineSiteSpec({
        ...BASE,
        content: { ...BASE.content, heroTrust: BASE.content.heroTrust.slice(0, 2) },
      }),
    ).toThrow();
  });

  it("rejects a non-kebab icon id", () => {
    expect(() =>
      defineSiteSpec({
        ...BASE,
        content: { ...BASE.content, serviceIcons: ["Wrench"] },
      }),
    ).toThrow();
  });

  it("allows an empty `k` on a hero trust badge with no bold number", () => {
    expect(defineSiteSpec(BASE).content.heroTrust[2].k).toBe("");
  });

  it("rejects a photoQuery with an unknown orientation", () => {
    expect(() =>
      defineSiteSpec({
        ...BASE,
        photoQueries: {
          ...BASE.photoQueries,
          hero: { query: "widget", orientation: "diagonal" },
        },
      }),
    ).toThrow();
  });
});

describe("renderSpecTemplate", () => {
  const vars = { name: "Acme Co", city: "Olympia" };

  it("fills {name} and {city}", () => {
    expect(renderSpecTemplate("Widget work by {name} in {city}", vars)).toBe(
      "Widget work by Acme Co in Olympia",
    );
  });

  it("leaves text without placeholders alone", () => {
    expect(renderSpecTemplate("and it shows.", vars)).toBe("and it shows.");
  });

  it("throws on an unknown placeholder rather than shipping {typo} to a client", () => {
    expect(() => renderSpecTemplate("Serving {citee}", vars)).toThrow(/unknown placeholder \{citee\}/);
  });
});

describe("the bespoke tier stays out of the frozen ClientConfig contract", () => {
  it("is not re-exported from index.ts", () => {
    // If this ever fails, `refresh-ops-snapshot` starts seeing SiteSpec and the
    // bespoke tier acquires an ops re-sync burden it is specifically designed
    // not to have (se#207).
    const index = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
    expect(index).not.toMatch(/site-spec/);
  });
});
