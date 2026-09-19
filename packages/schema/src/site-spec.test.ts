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
  images: { hero: "photos/hero.jpg", band: "photos/band.jpg" },
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
