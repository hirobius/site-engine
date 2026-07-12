import { describe, expect, it } from "vitest";
import { leadToConfig, mapCategoryToTrade, type LeadRow } from "./lead-to-config.js";
import { PALETTE_PRESET_IDS } from "./presets.js";

const ROLLING_SUDS: LeadRow = {
  name: "Rolling Suds of Seattle",
  slug: "rolling-suds-of-seattle",
  category: "Pressure washing service",
  city: "Seattle",
  region: "WA",
  phone: "(206) 555-0142",
  email: "info@rollingsudsseattle.com",
  hours: [
    { days: "Mon–Fri", hours: "8:00 AM – 5:00 PM" },
    { days: "Sat", hours: "9:00 AM – 1:00 PM" },
  ],
  serviceArea: ["Seattle, WA", "Bellevue, WA", "Redmond, WA"],
};

describe("leadToConfig", () => {
  it("maps a fully-populated lead to a valid config", () => {
    const { config, todos } = leadToConfig(ROLLING_SUDS);

    expect(config.slug).toBe("rolling-suds-of-seattle");
    expect(config.business.name).toBe("Rolling Suds of Seattle");
    expect(config.business.phone).toBe("(206) 555-0142");
    expect(config.business.email).toBe("info@rollingsudsseattle.com");
    expect(config.business.hours).toEqual(ROLLING_SUDS.hours);
    expect(config.business.serviceAreas).toEqual(["Seattle, WA", "Bellevue, WA", "Redmond, WA"]);
    expect(config.brand.palettePreset).toBe("pressure-washing");
    expect(config.services.length).toBeGreaterThan(0);
    expect(config.layout.sectionOrder).toEqual(["services", "serviceAreaMap", "contact"]);
    expect(config.seo.siteUrl).toBe("https://rolling-suds-of-seattle.example");
    expect(config.seo.title.length).toBeLessThanOrEqual(70);
    expect(config.seo.description.length).toBeLessThanOrEqual(180);

    // known facts present -> no stub todos for them
    expect(todos.some((t) => t.includes("business.phone"))).toBe(false);
    expect(todos.some((t) => t.includes("business.email"))).toBe(false);
    expect(todos.some((t) => t.includes("business.hours"))).toBe(false);
    expect(todos.some((t) => t.includes("didn't match a known trade"))).toBe(false);

    // never supplied by a lead row -> always flagged
    expect(todos.some((t) => t.includes("form.accessKey"))).toBe(true);
    expect(todos.some((t) => t.includes("no photos yet"))).toBe(true);
    expect(todos.some((t) => t.includes("no reviews yet"))).toBe(true);
  });

  it("never fabricates a missing phone/email/hours — stubs them and flags a todo", () => {
    const sparse: LeadRow = {
      name: "Clearwater Exteriors",
      slug: "clearwater-exteriors",
      category: "Power washing",
      city: "Tacoma",
      region: "WA",
    };

    const { config, todos } = leadToConfig(sparse);

    expect(config.business.phone).toBe("(555) 010-0000");
    expect(config.business.email).toBe("hello@clearwater-exteriors.example");
    expect(config.business.hours).toEqual([{ days: "Mon–Sun", hours: "Call for hours" }]);
    // known fact (city/region) used, not fabricated
    expect(config.business.serviceAreas).toEqual(["Tacoma, WA"]);

    expect(todos).toContain("business.phone is missing — using a placeholder, replace before going live");
    expect(todos).toContain("business.email is missing — using a placeholder, replace before going live");
    expect(todos).toContain("business.hours is missing — using a placeholder, replace before going live");
  });

  it("accepts a comma-separated serviceArea string", () => {
    const { config } = leadToConfig({ ...ROLLING_SUDS, serviceArea: "Seattle, WA, Bellevue, WA" });
    expect(config.business.serviceAreas).toEqual(["Seattle", "WA", "Bellevue", "WA"]);
  });

  it("flags an unmapped category and defaults to the beachhead trade", () => {
    const { config, todos } = leadToConfig({ ...ROLLING_SUDS, category: "Widget assembly" });
    expect(config.brand.palettePreset).toBe("pressure-washing");
    expect(todos.some((t) => t.includes('category "Widget assembly" didn\'t match a known trade'))).toBe(true);
  });
});

describe("mapCategoryToTrade", () => {
  it("maps every shipped trade from a realistic category string", () => {
    const samples: Record<(typeof PALETTE_PRESET_IDS)[number], string> = {
      landscaping: "Landscaper",
      "junk-removal": "Junk removal service",
      "pressure-washing": "Pressure washing service",
      "concrete-fencing": "Fence contractor",
    };

    for (const trade of PALETTE_PRESET_IDS) {
      const result = mapCategoryToTrade(samples[trade]);
      expect(result.trade).toBe(trade);
      expect(result.matched).toBe(true);
    }
  });

  it("falls back to pressure-washing, unmatched, for an unknown category", () => {
    expect(mapCategoryToTrade("Widget assembly")).toEqual({ trade: "pressure-washing", matched: false });
  });
});
