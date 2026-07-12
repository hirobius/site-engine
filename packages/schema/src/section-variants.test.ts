import { describe, expect, it } from "vitest";
import { defineClient, SECTION_VARIANTS } from "./index.js";
import type { ClientConfigInput } from "./index.js";

const BASE_INPUT: ClientConfigInput = {
  slug: "acme-co",
  business: {
    name: "Real Business Co",
    phone: "(509) 838-4200",
    email: "hello@realbusinessco.com",
    hours: [{ days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" }],
    serviceAreas: ["Spokane"],
  },
  brand: { palettePreset: "pressure-washing" },
  layout: { sectionOrder: ["services", "contact"] },
  services: [{ title: "Washing", description: "We wash things." }],
  copy: {
    heroHeadline: "Headline",
    heroSub: "Sub",
    about: "About us.",
  },
  form: { provider: "web3forms", accessKey: "real-web3forms-key-123" },
  seo: {
    title: "Real Business Co | Spokane",
    description: "Spokane's real business.",
    city: "Spokane",
    region: "WA",
    siteUrl: "https://realbusinessco.com",
  },
};

function config(overrides: Partial<ClientConfigInput> = {}): ClientConfigInput {
  return { ...BASE_INPUT, ...overrides };
}

describe("SECTION_VARIANTS", () => {
  it("covers hero and every orderable section, first value being the classic default", () => {
    expect(SECTION_VARIANTS.hero[0]).toBe("classic");
    expect(SECTION_VARIANTS.services[0]).toBe("grid");
    expect(SECTION_VARIANTS.gallery[0]).toBe("grid");
    expect(SECTION_VARIANTS.reviews[0]).toBe("cards");
    expect(SECTION_VARIANTS.serviceAreaMap[0]).toBe("standard");
    expect(SECTION_VARIANTS.contact[0]).toBe("standard");
  });

  it("keeps the video hero variant available", () => {
    expect(SECTION_VARIANTS.hero).toContain("video");
  });

  it("offers the harvested hero variants", () => {
    expect(SECTION_VARIANTS.hero).toContain("split-card");
    expect(SECTION_VARIANTS.hero).toContain("banner");
  });

  it("accepts a harvested hero variant via config", () => {
    const result = defineClient(
      config({ layout: { sections: { hero: { variant: "split-card" } } } }),
    );
    expect(result.layout.sections.hero.variant).toBe("split-card");
  });
});

describe("layout.sections variants", () => {
  it("fills every section's default variant when layout.sections is omitted", () => {
    const result = defineClient(config());
    expect(result.layout.sections).toEqual({
      hero: { variant: "classic" },
      services: { variant: "grid" },
      gallery: { variant: "grid" },
      reviews: { variant: "cards" },
      serviceAreaMap: { variant: "standard" },
      contact: { variant: "standard" },
    });
  });

  it("keeps existing configs valid and their legacy layout.variant readable", () => {
    const result = defineClient(config({ layout: { variant: "B", sectionOrder: ["services", "contact"] } }));
    expect(result.layout.variant).toBe("B");
    expect(result.layout.sectionOrder).toEqual(["services", "contact"]);
  });

  it('maps legacy layout.variant "B" onto hero variant "video"', () => {
    const result = defineClient(config({ layout: { variant: "B" } }));
    expect(result.layout.sections.hero.variant).toBe("video");
  });

  it('maps legacy layout.variant "A" onto hero variant "classic"', () => {
    const result = defineClient(config({ layout: { variant: "A" } }));
    expect(result.layout.sections.hero.variant).toBe("classic");
  });

  it("lets an explicit hero variant win over the legacy layout.variant", () => {
    const result = defineClient(
      config({ layout: { variant: "B", sections: { hero: { variant: "classic" } } } }),
    );
    expect(result.layout.sections.hero.variant).toBe("classic");
  });

  it("accepts a partial layout.sections and defaults the rest", () => {
    const result = defineClient(
      config({ layout: { sections: { services: { variant: "grid" } } } }),
    );
    expect(result.layout.sections.services.variant).toBe("grid");
    expect(result.layout.sections.hero.variant).toBe("classic");
    expect(result.layout.sections.reviews.variant).toBe("cards");
  });

  it("rejects an unknown variant value with a readable error", () => {
    expect(() =>
      defineClient(
        config({
          layout: {
            // @ts-expect-error — deliberately invalid variant
            sections: { hero: { variant: "totally-custom-html" } },
          },
        }),
      ),
    ).toThrow(/layout\.sections\.hero\.variant/);
  });

  it("rejects an unknown section key under layout.sections", () => {
    expect(() =>
      defineClient(
        config({
          layout: {
            // @ts-expect-error — deliberately unknown section
            sections: { pricing: { variant: "table" } },
          },
        }),
      ),
    ).toThrow();
  });
});
