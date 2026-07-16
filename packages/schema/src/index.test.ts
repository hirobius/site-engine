import { describe, expect, it } from "vitest";
import { defineClient, PALETTE_PRESET_IDS, FONT_IDS } from "./index.js";
import { FONT_PAIRING_IDS } from "./presets.js";
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

describe("defineClient", () => {
  it("accepts a valid config", () => {
    const result = defineClient(config());
    expect(result.slug).toBe("acme-co");
  });

  it("applies documented defaults", () => {
    const result = defineClient(config());
    expect(result.brand.font).toBe("system");
    expect(result.brand.fontPairing).toBeUndefined();
    expect(result.brand.radius).toBe("md");
    expect(result.brand.shadow).toBe("soft");
    expect(result.brand.spacingDensity).toBe("comfortable");
    expect(result.brand.cssVarOverrides).toEqual({});
    expect(result.layout.variant).toBe("A");
    expect(result.copy.ctaLabel).toBe("Get a Free Quote");
    expect(result.gallery).toEqual([]);
    expect(result.reviews).toEqual([]);
    expect(result.map).toEqual({});
    expect(result.hero).toEqual({});
  });

  it("throws a readable, slug-tagged error on an invalid config", () => {
    expect(() => defineClient(config({ slug: "Not Kebab" }))).toThrow(
      /Invalid client config for "Not Kebab"/,
    );
  });

  describe("slug", () => {
    it("rejects non-kebab-case slugs", () => {
      for (const bad of ["Acme_Co", "acme co", "ACME", "acme--co-", ""]) {
        expect(() => defineClient(config({ slug: bad }))).toThrow();
      }
    });

    it("accepts kebab-case slugs", () => {
      for (const good of ["acme", "acme-co", "acme-co-2"]) {
        expect(() => defineClient(config({ slug: good }))).not.toThrow();
      }
    });
  });

  describe("business.phone", () => {
    it("rejects too-short, invalid-character, or non-10-digit phone numbers", () => {
      for (const bad of [
        "123",
        "call us!",
        "555-CALL-NOW",
        "1234567",
        "12345",
        "0123456789",
        "1123456789",
        "509-838-42001",
      ]) {
        expect(() =>
          defineClient(config({ business: { ...BASE_INPUT.business, phone: bad } })),
        ).toThrow();
      }
    });

    it("accepts common phone formats", () => {
      for (const good of ["(509) 838-4200", "+1 509-838-4200", "5098384200"]) {
        expect(() =>
          defineClient(config({ business: { ...BASE_INPUT.business, phone: good } })),
        ).not.toThrow();
      }
    });

    it("accepts the fleet's intentional 555 placeholder numbers", () => {
      for (const placeholder of [
        "(555) 010-0000",
        "(512) 555-0142",
        "(509) 555-0100",
        "(555) 010-3302",
        "(555) 010-2201",
        "(555) 010-4403",
      ]) {
        expect(() =>
          defineClient(config({ business: { ...BASE_INPUT.business, phone: placeholder } })),
        ).not.toThrow();
      }
    });
  });

  describe("business.email", () => {
    it("rejects invalid emails", () => {
      expect(() =>
        defineClient(config({ business: { ...BASE_INPUT.business, email: "not-an-email" } })),
      ).toThrow();
    });
  });

  describe("business required arrays", () => {
    it("requires at least one hours row", () => {
      expect(() =>
        defineClient(config({ business: { ...BASE_INPUT.business, hours: [] } })),
      ).toThrow();
    });

    it("requires at least one service area", () => {
      expect(() =>
        defineClient(config({ business: { ...BASE_INPUT.business, serviceAreas: [] } })),
      ).toThrow();
    });

    it("requires at least one service", () => {
      expect(() => defineClient(config({ services: [] }))).toThrow();
    });
  });

  describe("layout.sectionOrder", () => {
    it("rejects unknown section ids", () => {
      expect(() =>
        defineClient(
          config({
            layout: { sectionOrder: ["services", "not-a-real-section" as never] },
          }),
        ),
      ).toThrow();
    });

    it("accepts a valid subset and order", () => {
      const result = defineClient(
        config({ layout: { sectionOrder: ["contact", "services"] } }),
      );
      expect(result.layout.sectionOrder).toEqual(["contact", "services"]);
    });

    it("defaults to the full section order when omitted", () => {
      const result = defineClient(config({ layout: {} }));
      expect(result.layout.sectionOrder).toEqual([
        "services",
        "gallery",
        "reviews",
        "serviceAreaMap",
        "contact",
      ]);
    });

    it("rejects duplicate section ids", () => {
      expect(() =>
        defineClient(config({ layout: { sectionOrder: ["services", "services"] } })),
      ).toThrow(/duplicate section id "services"/);
    });
  });

  describe("brand.palettePreset", () => {
    it("resolves every shipped preset", () => {
      for (const preset of PALETTE_PRESET_IDS) {
        expect(() =>
          defineClient(config({ brand: { palettePreset: preset } })),
        ).not.toThrow();
      }
    });

    it("rejects an unknown preset", () => {
      expect(() =>
        defineClient(config({ brand: { palettePreset: "not-a-preset" as never } })),
      ).toThrow();
    });
  });

  describe("brand.font", () => {
    it("resolves every shipped font id", () => {
      for (const font of FONT_IDS) {
        expect(() =>
          defineClient(config({ brand: { palettePreset: "pressure-washing", font } })),
        ).not.toThrow();
      }
    });
  });

  describe("brand.fontPairing", () => {
    it("is unset by default", () => {
      const result = defineClient(config({ brand: { palettePreset: "pressure-washing" } }));
      expect(result.brand.fontPairing).toBeUndefined();
    });

    it("resolves every shipped pairing id", () => {
      for (const fontPairing of FONT_PAIRING_IDS) {
        expect(() =>
          defineClient(config({ brand: { palettePreset: "pressure-washing", fontPairing } })),
        ).not.toThrow();
      }
    });

    it("rejects an unknown pairing id", () => {
      expect(() =>
        defineClient(
          config({
            brand: { palettePreset: "pressure-washing", fontPairing: "not-a-pairing" as never },
          }),
        ),
      ).toThrow();
    });
  });

  describe("brand.shadow", () => {
    it("defaults to soft", () => {
      const result = defineClient(config({ brand: { palettePreset: "pressure-washing" } }));
      expect(result.brand.shadow).toBe("soft");
    });

    it("resolves flat and hard", () => {
      for (const shadow of ["flat", "soft", "hard"] as const) {
        expect(() =>
          defineClient(config({ brand: { palettePreset: "pressure-washing", shadow } })),
        ).not.toThrow();
      }
    });

    it("rejects an unknown shadow value", () => {
      expect(() =>
        defineClient(
          config({ brand: { palettePreset: "pressure-washing", shadow: "glow" as never } }),
        ),
      ).toThrow();
    });
  });

  describe("brand.spacingDensity", () => {
    it("defaults to comfortable", () => {
      const result = defineClient(config({ brand: { palettePreset: "pressure-washing" } }));
      expect(result.brand.spacingDensity).toBe("comfortable");
    });

    it("resolves compact, comfortable, and airy", () => {
      for (const spacingDensity of ["compact", "comfortable", "airy"] as const) {
        expect(() =>
          defineClient(
            config({ brand: { palettePreset: "pressure-washing", spacingDensity } }),
          ),
        ).not.toThrow();
      }
    });

    it("rejects an unknown spacingDensity value", () => {
      expect(() =>
        defineClient(
          config({
            brand: { palettePreset: "pressure-washing", spacingDensity: "dense" as never },
          }),
        ),
      ).toThrow();
    });
  });

  describe("brand.cssVarOverrides", () => {
    it("accepts valid --brand-* keys with hex color values", () => {
      const result = defineClient(
        config({
          brand: {
            palettePreset: "pressure-washing",
            cssVarOverrides: { "--brand-primary": "#123abc" },
          },
        }),
      );
      expect(result.brand.cssVarOverrides).toEqual({ "--brand-primary": "#123abc" });
    });

    it("rejects a key that isn't --brand-*", () => {
      expect(() =>
        defineClient(
          config({
            brand: {
              palettePreset: "pressure-washing",
              cssVarOverrides: { "--not-brand": "#123abc" } as never,
            },
          }),
        ),
      ).toThrow();
    });

    it("rejects a non-hex color value", () => {
      expect(() =>
        defineClient(
          config({
            brand: {
              palettePreset: "pressure-washing",
              cssVarOverrides: { "--brand-primary": "blue" },
            },
          }),
        ),
      ).toThrow();
    });
  });

  describe("seo", () => {
    it("rejects a title over 70 chars", () => {
      expect(() =>
        defineClient(config({ seo: { ...BASE_INPUT.seo, title: "x".repeat(71) } })),
      ).toThrow();
    });

    it("accepts a title at exactly 70 chars", () => {
      expect(() =>
        defineClient(config({ seo: { ...BASE_INPUT.seo, title: "x".repeat(70) } })),
      ).not.toThrow();
    });

    it("rejects a description over 180 chars", () => {
      expect(() =>
        defineClient(config({ seo: { ...BASE_INPUT.seo, description: "x".repeat(181) } })),
      ).toThrow();
    });

    it("rejects a non-URL siteUrl", () => {
      expect(() =>
        defineClient(config({ seo: { ...BASE_INPUT.seo, siteUrl: "not-a-url" } })),
      ).toThrow();
    });
  });

  describe("form", () => {
    it("requires a non-empty accessKey", () => {
      expect(() =>
        defineClient(config({ form: { provider: "web3forms", accessKey: "" } })),
      ).toThrow();
    });

    it("rejects a provider other than web3forms", () => {
      expect(() =>
        defineClient(
          config({ form: { provider: "other" as never, accessKey: "key" } }),
        ),
      ).toThrow();
    });

    it("leaves hcaptchaSiteKey and redirectUrl optional", () => {
      const result = defineClient(config());
      expect(result.form.hcaptchaSiteKey).toBeUndefined();
      expect(result.form.redirectUrl).toBeUndefined();
    });

    it("accepts hcaptchaSiteKey and a valid redirectUrl when provided", () => {
      const result = defineClient(
        config({
          form: {
            provider: "web3forms",
            accessKey: "key",
            hcaptchaSiteKey: "hc-key",
            redirectUrl: "https://realbusinessco.com/thanks",
          },
        }),
      );
      expect(result.form.hcaptchaSiteKey).toBe("hc-key");
      expect(result.form.redirectUrl).toBe("https://realbusinessco.com/thanks");
    });
  });

  describe("map", () => {
    it("defaults to an empty object (no map configured)", () => {
      const result = defineClient(config());
      expect(result.map).toEqual({});
    });

    it("accepts a staticImage and/or embedQuery", () => {
      const result = defineClient(
        config({ map: { staticImage: "/photos/map.jpg", embedQuery: "Acme Co, Spokane WA" } }),
      );
      expect(result.map.staticImage).toBe("/photos/map.jpg");
      expect(result.map.embedQuery).toBe("Acme Co, Spokane WA");
    });

    it("rejects a staticImage path that isn't rooted under public/", () => {
      expect(() =>
        defineClient(config({ map: { staticImage: "photos/map.jpg" } })),
      ).toThrow();
    });
  });

  describe("gallery", () => {
    it("requires alt text on every photo", () => {
      expect(() =>
        defineClient(
          config({ gallery: [{ src: "/photos/a.jpg", alt: "" }] }),
        ),
      ).toThrow();
    });

    it("accepts a well-formed gallery", () => {
      const result = defineClient(
        config({ gallery: [{ src: "/photos/a.jpg", alt: "Finished driveway" }] }),
      );
      expect(result.gallery).toHaveLength(1);
    });
  });

  describe("reviews", () => {
    it("requires an integer rating between 1 and 5", () => {
      for (const rating of [0, 6, 3.5]) {
        expect(() =>
          defineClient(
            config({
              reviews: [{ author: "Jane", rating, text: "Great work." }],
            }),
          ),
        ).toThrow();
      }
    });

    it("accepts a well-formed review", () => {
      const result = defineClient(
        config({
          reviews: [{ author: "Jane", rating: 5, text: "Great work.", source: "Google" }],
        }),
      );
      expect(result.reviews).toHaveLength(1);
    });
  });

  // --- issue #87: trust/conversion fields. ---

  describe("business.gbpUrl (#87)", () => {
    it("is unset by default", () => {
      const result = defineClient(config());
      expect(result.business.gbpUrl).toBeUndefined();
    });

    it("accepts a valid Google Business Profile URL", () => {
      const result = defineClient(
        config({
          business: {
            ...BASE_INPUT.business,
            gbpUrl: "https://g.page/realbusinessco",
          },
        }),
      );
      expect(result.business.gbpUrl).toBe("https://g.page/realbusinessco");
    });

    it("rejects a non-URL value", () => {
      expect(() =>
        defineClient(
          config({ business: { ...BASE_INPUT.business, gbpUrl: "not-a-url" } }),
        ),
      ).toThrow();
    });
  });

  describe("business.licensed/insured/bonded/licenseNumber (#87)", () => {
    it("are unset by default (never a fabricated false)", () => {
      const result = defineClient(config());
      expect(result.business.licensed).toBeUndefined();
      expect(result.business.insured).toBeUndefined();
      expect(result.business.bonded).toBeUndefined();
      expect(result.business.licenseNumber).toBeUndefined();
    });

    it("accepts explicit true/false flags and a license number", () => {
      const result = defineClient(
        config({
          business: {
            ...BASE_INPUT.business,
            licensed: true,
            insured: true,
            bonded: false,
            licenseNumber: "WA-LIC-12345",
          },
        }),
      );
      expect(result.business.licensed).toBe(true);
      expect(result.business.insured).toBe(true);
      expect(result.business.bonded).toBe(false);
      expect(result.business.licenseNumber).toBe("WA-LIC-12345");
    });

    it("rejects an empty licenseNumber", () => {
      expect(() =>
        defineClient(
          config({ business: { ...BASE_INPUT.business, licenseNumber: "" } }),
        ),
      ).toThrow();
    });
  });

  describe("social (#87)", () => {
    it("is unset by default", () => {
      const result = defineClient(config());
      expect(result.social).toBeUndefined();
    });

    it("accepts a partial set of valid platform URLs", () => {
      const result = defineClient(
        config({
          social: {
            facebook: "https://facebook.com/realbusinessco",
            instagram: "https://instagram.com/realbusinessco",
          },
        }),
      );
      expect(result.social).toEqual({
        facebook: "https://facebook.com/realbusinessco",
        instagram: "https://instagram.com/realbusinessco",
      });
    });

    it("rejects an invalid URL on any platform", () => {
      expect(() =>
        defineClient(config({ social: { facebook: "not-a-url" } })),
      ).toThrow();
    });
  });

  describe("brand.logo / brand.logoAlt (#87)", () => {
    it("are unset by default", () => {
      const result = defineClient(config());
      expect(result.brand.logo).toBeUndefined();
      expect(result.brand.logoAlt).toBeUndefined();
    });

    it("accepts a public-rooted logo path and non-empty alt", () => {
      const result = defineClient(
        config({
          brand: {
            palettePreset: "pressure-washing",
            logo: "/logo.svg",
            logoAlt: "Real Business Co logo",
          },
        }),
      );
      expect(result.brand.logo).toBe("/logo.svg");
      expect(result.brand.logoAlt).toBe("Real Business Co logo");
    });

    it("rejects a logo path not rooted under public/", () => {
      expect(() =>
        defineClient(
          config({ brand: { palettePreset: "pressure-washing", logo: "logo.svg" } }),
        ),
      ).toThrow();
    });

    it("rejects an empty logoAlt", () => {
      expect(() =>
        defineClient(
          config({
            brand: { palettePreset: "pressure-washing", logo: "/logo.svg", logoAlt: "" },
          }),
        ),
      ).toThrow();
    });
  });

  describe("hero.imageAlt (#87)", () => {
    it("is unset by default", () => {
      const result = defineClient(config());
      expect(result.hero.imageAlt).toBeUndefined();
    });

    it("accepts a non-empty value", () => {
      const result = defineClient(
        config({ hero: { image: "/photos/hero.jpg", imageAlt: "Crew on a job site" } }),
      );
      expect(result.hero.imageAlt).toBe("Crew on a job site");
    });

    it("rejects an empty value", () => {
      expect(() =>
        defineClient(config({ hero: { image: "/photos/hero.jpg", imageAlt: "" } })),
      ).toThrow();
    });

    it("requires imageAlt when image is set", () => {
      expect(() => defineClient(config({ hero: { image: "/photos/hero.jpg" } }))).toThrow(
        /imageAlt is required when image is set/,
      );
    });

    it("stays valid when both image and imageAlt are omitted", () => {
      expect(() => defineClient(config({ hero: {} }))).not.toThrow();
    });
  });

  describe("services[].price / services[].imageAlt (#87)", () => {
    it("are unset by default", () => {
      const result = defineClient(config());
      expect(result.services[0]!.price).toBeUndefined();
      expect(result.services[0]!.imageAlt).toBeUndefined();
    });

    it("accepts a free-form price string", () => {
      for (const price of ["$150", "$150–$300", "Starting at $99", "Free estimate"]) {
        const result = defineClient(
          config({ services: [{ title: "Washing", description: "We wash things.", price }] }),
        );
        expect(result.services[0]!.price).toBe(price);
      }
    });

    it("rejects a price over 40 chars", () => {
      expect(() =>
        defineClient(
          config({
            services: [
              { title: "Washing", description: "We wash things.", price: "x".repeat(41) },
            ],
          }),
        ),
      ).toThrow();
    });

    it("accepts a non-empty imageAlt paired with image", () => {
      const result = defineClient(
        config({
          services: [
            {
              title: "Washing",
              description: "We wash things.",
              image: "/photos/service.jpg",
              imageAlt: "Freshly pressure-washed driveway",
            },
          ],
        }),
      );
      expect(result.services[0]!.imageAlt).toBe("Freshly pressure-washed driveway");
    });

    it("rejects an empty imageAlt", () => {
      expect(() =>
        defineClient(
          config({
            services: [
              { title: "Washing", description: "We wash things.", imageAlt: "" },
            ],
          }),
        ),
      ).toThrow();
    });

    it("requires imageAlt when image is set", () => {
      expect(() =>
        defineClient(
          config({
            services: [
              { title: "Washing", description: "We wash things.", image: "/photos/service.jpg" },
            ],
          }),
        ),
      ).toThrow(/imageAlt is required when image is set/);
    });

    it("stays valid when both image and imageAlt are omitted", () => {
      expect(() =>
        defineClient(config({ services: [{ title: "Washing", description: "We wash things." }] })),
      ).not.toThrow();
    });
  });
});
