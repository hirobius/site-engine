import { describe, expect, it } from "vitest";
import { defineClient, PALETTE_PRESET_IDS } from "./index.js";
import { CONTENT_PACKS } from "./content-packs.js";
import type { ClientConfigDraft } from "./index.js";

const BASE_DRAFT: ClientConfigDraft = {
  slug: "acme-co",
  business: {
    name: "Real Business Co",
    phone: "(509) 838-4200",
    email: "hello@realbusinessco.com",
    hours: [{ days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" }],
    serviceAreas: ["Spokane"],
  },
  brand: { palettePreset: "landscaping" },
  layout: {},
  contentPack: "landscaping",
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

describe("content packs", () => {
  it("every palette preset has a matching content pack", () => {
    for (const id of PALETTE_PRESET_IDS) {
      expect(CONTENT_PACKS[id]).toBeDefined();
      expect(CONTENT_PACKS[id].services.length).toBeGreaterThan(0);
    }
  });

  it("fills services, ctaLabel, and sectionOrder from the pack when a config omits them", () => {
    const result = defineClient(BASE_DRAFT);
    expect(result.services).toEqual(CONTENT_PACKS.landscaping.services);
    expect(result.copy.ctaLabel).toBe(CONTENT_PACKS.landscaping.ctaLabel);
    expect(result.layout.sectionOrder).toEqual(CONTENT_PACKS.landscaping.sectionOrder);
  });

  it("never fabricates business-fact copy — heroHeadline/heroSub/about stay whatever the config set", () => {
    const result = defineClient(BASE_DRAFT);
    expect(result.copy.heroHeadline).toBe("Headline");
    expect(result.copy.heroSub).toBe("Sub");
    expect(result.copy.about).toBe("About us.");
  });

  it("lets an explicit services array override the pack", () => {
    const result = defineClient({
      ...BASE_DRAFT,
      services: [{ title: "Custom Service", description: "Something specific to this client." }],
    });
    expect(result.services).toEqual([
      { title: "Custom Service", description: "Something specific to this client." },
    ]);
  });

  it("lets an explicit ctaLabel override the pack", () => {
    const result = defineClient({
      ...BASE_DRAFT,
      copy: { ...BASE_DRAFT.copy, ctaLabel: "Call Now" },
    });
    expect(result.copy.ctaLabel).toBe("Call Now");
  });

  it("lets an explicit sectionOrder override the pack", () => {
    const result = defineClient({
      ...BASE_DRAFT,
      layout: { sectionOrder: ["contact", "services"] },
    });
    expect(result.layout.sectionOrder).toEqual(["contact", "services"]);
  });

  it("resolves a pack for every shipped trade", () => {
    for (const contentPack of PALETTE_PRESET_IDS) {
      const result = defineClient({ ...BASE_DRAFT, contentPack });
      expect(result.services.length).toBeGreaterThan(0);
      expect(result.copy.ctaLabel).toBe(CONTENT_PACKS[contentPack].ctaLabel);
    }
  });

  it("still requires services when no contentPack is given (unchanged behavior)", () => {
    const withoutPack = { ...BASE_DRAFT } as Record<string, unknown>;
    delete withoutPack.contentPack;
    expect(() => defineClient(withoutPack as ClientConfigDraft)).toThrow(/services/);
  });
});
