import { describe, expect, it } from "vitest";
import { defineClient, type ClientConfig, type ClientConfigInput } from "@hirobius/schema";
import { brandStyle, fontHref } from "./theme.js";

// brandStyle()/fontHref() are the seams that turn `brand.fontPairing` (#155)
// and `brand.shadow` (#157) into the emitted CSS vars / web-font link. Both
// dials are optional and additive — the base config below sets neither, so
// every assertion against it proves the default path stays byte-identical.

const BASE_INPUT: ClientConfigInput = {
  slug: "acme-co",
  business: {
    name: "Real Business Co",
    phone: "(509) 838-4200",
    email: "hello@realbusinessco.com",
    hours: [{ days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" }],
    serviceAreas: ["Spokane"],
  },
  brand: { palettePreset: "pressure-washing" as const },
  layout: { sectionOrder: ["services", "contact"] },
  services: [{ title: "Washing", description: "We wash things." }],
  copy: { heroHeadline: "Headline", heroSub: "Sub", about: "About us." },
  form: { provider: "web3forms" as const, accessKey: "real-web3forms-key-123" },
  seo: {
    title: "Real Business Co | Spokane",
    description: "Spokane's real business.",
    city: "Spokane",
    region: "WA",
    siteUrl: "https://realbusinessco.com",
  },
};

function withBrand(brand: Partial<ClientConfig["brand"]>): ClientConfig {
  return defineClient({
    ...BASE_INPUT,
    brand: { palettePreset: "pressure-washing", ...brand },
  });
}

describe("brand.fontPairing (#155)", () => {
  it("defaults both stacks from brand.font — byte-identical to today", () => {
    const withFont = withBrand({ font: "inter" });
    const style = brandStyle(withFont);
    // Same stack emitted for both display and primary typography.
    const display = /--primitive-typography-family-display:([^;]+)/.exec(style)?.[1];
    const primary = /--primitive-typography-family-primary:([^;]+)/.exec(style)?.[1];
    expect(display).toBeTruthy();
    expect(display).toBe(primary);
    expect(display).toContain("Inter");
  });

  it("frees the heading stack from the body stack when set", () => {
    const style = brandStyle(withBrand({ fontPairing: "editorial" }));
    const display = /--primitive-typography-family-display:([^;]+)/.exec(style)?.[1];
    const primary = /--primitive-typography-family-primary:([^;]+)/.exec(style)?.[1];
    expect(display).toContain("Fraunces");
    expect(primary).toContain("Inter");
    expect(display).not.toBe(primary);
  });

  it("ignores brand.font once fontPairing is set", () => {
    const style = brandStyle(withBrand({ font: "slab", fontPairing: "editorial" }));
    expect(style).toContain("Fraunces");
    expect(style).not.toContain("Roboto Slab");
  });

  it("fontHref is null by default (system) and by default for pairing 'system'", () => {
    expect(fontHref(withBrand({}))).toBeNull();
    expect(fontHref(withBrand({ fontPairing: "system" }))).toBeNull();
  });

  it("fontHref loads both families in one stylesheet link for a web pairing", () => {
    const href = fontHref(withBrand({ fontPairing: "editorial" }));
    expect(href).toContain("family=Fraunces");
    expect(href).toContain("family=Inter");
  });

  it("fontHref prefers the pairing href over the plain font href when both are set", () => {
    const href = fontHref(withBrand({ font: "inter", fontPairing: "modern" }));
    expect(href).toContain("Space+Grotesk");
  });
});

describe("brand.shadow (#157)", () => {
  it("defaults to soft — emits no --semantic-shadow-* override", () => {
    const style = brandStyle(withBrand({}));
    expect(style).not.toContain("--semantic-shadow-subtle");
    expect(style).not.toContain("--semantic-shadow-floating");
    expect(style).not.toContain("--semantic-shadow-overlay");
  });

  it("explicit 'soft' also emits no override (identical to default)", () => {
    const style = brandStyle(withBrand({ shadow: "soft" }));
    expect(style).not.toContain("--semantic-shadow-subtle");
  });

  it("'flat' zeroes out all three shadow tiers", () => {
    const style = brandStyle(withBrand({ shadow: "flat" }));
    expect(style).toContain("--semantic-shadow-subtle:none");
    expect(style).toContain("--semantic-shadow-floating:none");
    expect(style).toContain("--semantic-shadow-overlay:none");
  });

  it("'hard' emits solid, no-blur offset shadows for all three tiers", () => {
    const style = brandStyle(withBrand({ shadow: "hard" }));
    expect(style).toMatch(/--semantic-shadow-subtle:2px 2px 0 0 /);
    expect(style).toMatch(/--semantic-shadow-floating:4px 4px 0 0 /);
    expect(style).toMatch(/--semantic-shadow-overlay:6px 6px 0 0 /);
  });
});

describe("brand.spacingDensity (#86, spacing-density slice)", () => {
  it("defaults to comfortable — emits no --semantic-spacing-section-y* override", () => {
    const style = brandStyle(withBrand({}));
    expect(style).not.toContain("--semantic-spacing-section-y");
  });

  it("explicit 'comfortable' also emits no override (identical to default)", () => {
    const style = brandStyle(withBrand({ spacingDensity: "comfortable" }));
    expect(style).not.toContain("--semantic-spacing-section-y");
  });

  it("'compact' tightens the section rhythm", () => {
    const style = brandStyle(withBrand({ spacingDensity: "compact" }));
    expect(style).toContain("--semantic-spacing-section-y:var(--primitive-space-12)");
    expect(style).toContain("--semantic-spacing-section-y-lg:var(--primitive-space-16)");
  });

  it("'airy' loosens the section rhythm", () => {
    const style = brandStyle(withBrand({ spacingDensity: "airy" }));
    expect(style).toContain("--semantic-spacing-section-y:var(--primitive-space-24)");
    expect(style).toContain("--semantic-spacing-section-y-lg:var(--primitive-space-32)");
  });
});
