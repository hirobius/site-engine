import { describe, expect, it } from "vitest";
import { defineClient } from "./index.js";
import { SKINS, SKIN_IDS } from "./skins.js";
import type { ClientConfigDraft, ClientConfigInput } from "./index.js";

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
  layout: {},
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

function config(overrides: Partial<ClientConfigDraft> = {}): ClientConfigDraft {
  return { ...BASE_INPUT, ...overrides } as ClientConfigDraft;
}

describe("design skins", () => {
  it("every listed skin id resolves to a definition", () => {
    for (const id of SKIN_IDS) {
      expect(SKINS[id]).toBeDefined();
    }
  });

  it("omitting design renders byte-identical to not having the field at all", () => {
    const withField = defineClient(config());
    const withoutField = { ...config() } as Record<string, unknown>;
    delete withoutField.design;
    const without = defineClient(withoutField as ClientConfigDraft);
    expect(withField).toEqual(without);
  });

  it("design: classic reproduces the ordinary schema defaults exactly", () => {
    const plain = defineClient(config());
    const skinned = defineClient(config({ design: "classic" }));
    expect(skinned).toEqual(plain);
  });

  it("pins every section variant + brand default the classic skin declares", () => {
    const result = defineClient(config({ design: "classic" }));
    expect(result.layout.sections.hero.variant).toBe("classic");
    expect(result.layout.sections.services.variant).toBe("grid");
    expect(result.layout.sections.gallery.variant).toBe("grid");
    expect(result.layout.sections.reviews.variant).toBe("cards");
    expect(result.layout.sections.serviceAreaMap.variant).toBe("standard");
    expect(result.layout.sections.contact.variant).toBe("standard");
    expect(result.brand.radius).toBe("md");
    expect(result.brand.shadow).toBe("soft");
    expect(result.brand.motion).toBe("rich");
  });

  it("lets an explicit section variant override the skin's pin", () => {
    const result = defineClient(
      config({
        design: "classic",
        layout: { sections: { hero: { variant: "video" } } },
      }),
    );
    expect(result.layout.sections.hero.variant).toBe("video");
    // Untouched sections still get the skin's pin.
    expect(result.layout.sections.services.variant).toBe("grid");
  });

  it("lets an explicit brand field override the skin's pin", () => {
    const result = defineClient(
      config({
        design: "classic",
        brand: { palettePreset: "pressure-washing", shadow: "hard" },
      }),
    );
    expect(result.brand.shadow).toBe("hard");
    expect(result.brand.radius).toBe("md");
  });

  it("throws a readable error on an unknown design id", () => {
    expect(() =>
      defineClient(config({ design: "not-a-skin" as never })),
    ).toThrow(/Unknown design/);
  });

  it("the design key never reaches the validated output — no stray field", () => {
    const result = defineClient(config({ design: "classic" }));
    expect(result).not.toHaveProperty("design");
  });

  it("the deprecated layout.variant: 'B' hero mapping pre-empts the skin's hero pin (legacy resolves before the skin merges)", () => {
    // applyLegacyHeroVariant runs before applyDesignSkin in defineClient, so
    // by the time the skin sees layout.sections.hero it's already explicitly
    // "video" — pickSectionVariant treats that the same as a hand-written
    // override and leaves it alone. Documents the precedence rather than
    // asserting it's the only sane choice; see index.ts's defineClient.
    const result = defineClient(
      config({ design: "classic", layout: { variant: "B" } }),
    );
    expect(result.layout.sections.hero.variant).toBe("video");
    // Other sections are untouched by the legacy bridge, so they still get
    // the skin's pin.
    expect(result.layout.sections.services.variant).toBe("grid");
  });

  it("composes with a contentPack: skin pins section variants, pack fills services", () => {
    const result = defineClient({
      ...config(),
      contentPack: "pressure-washing",
      design: "classic",
      services: undefined,
    } as ClientConfigDraft);
    expect(result.services.length).toBeGreaterThan(0);
    expect(result.layout.sections.hero.variant).toBe("classic");
  });
});

describe("warm-editorial skin (issue #141)", () => {
  it("pins the editorial hero + font pairing + warm palette + brand dials", () => {
    const result = defineClient(config({ design: "warm-editorial" }));
    expect(result.layout.sections.hero.variant).toBe("split-card");
    // Only variant each section has today — pinned anyway (see skins.ts doc
    // comment), so this also documents "no new section components" (#141's
    // constraint) rather than silently relying on the schema default.
    expect(result.layout.sections.services.variant).toBe("grid");
    expect(result.layout.sections.gallery.variant).toBe("grid");
    expect(result.layout.sections.reviews.variant).toBe("cards");
    expect(result.layout.sections.serviceAreaMap.variant).toBe("standard");
    expect(result.layout.sections.contact.variant).toBe("standard");

    expect(result.brand.fontPairing).toBe("editorial");
    expect(result.brand.font).toBe("slab");
    expect(result.brand.cssVarOverrides).toEqual({
      "--brand-primary": "#4f6350",
      "--brand-accent": "#9a4f2c",
      "--brand-bg": "#faf6ee",
      "--brand-fg": "#2a2420",
      "--brand-muted": "#ede2ce",
      "--brand-on-primary": "#faf6ee",
    });
    expect(result.brand.radius).toBe("lg");
    expect(result.brand.shadow).toBe("flat");
    expect(result.brand.motion).toBe("subtle");
  });

  it("is visibly distinct from the classic skin (different hero, palette, and brand dials)", () => {
    const classicResult = defineClient(config({ design: "classic" }));
    const warmResult = defineClient(config({ design: "warm-editorial" }));
    expect(warmResult.layout.sections.hero.variant).not.toBe(classicResult.layout.sections.hero.variant);
    expect(warmResult.brand.cssVarOverrides).not.toEqual(classicResult.brand.cssVarOverrides);
    expect(warmResult.brand.fontPairing).not.toBe(classicResult.brand.fontPairing);
    expect(warmResult.brand.shadow).not.toBe(classicResult.brand.shadow);
    expect(warmResult.brand.motion).not.toBe(classicResult.brand.motion);
  });

  it("lets an explicit brand.cssVarOverrides override the skin's palette", () => {
    const result = defineClient(
      config({
        design: "warm-editorial",
        brand: { palettePreset: "pressure-washing", cssVarOverrides: { "--brand-bg": "#ffffff" } },
      }),
    );
    expect(result.brand.cssVarOverrides).toEqual({ "--brand-bg": "#ffffff" });
  });

  it("renders byte-identical to today when design is omitted (additive)", () => {
    const withoutDesign = defineClient(config());
    const withClassic = defineClient(config({ design: "classic" }));
    expect(withoutDesign).toEqual(withClassic);
    // ...and is NOT the same as warm-editorial, proving the new skin actually
    // changes output rather than being a no-op.
    const withWarm = defineClient(config({ design: "warm-editorial" }));
    expect(withoutDesign).not.toEqual(withWarm);
  });
});
