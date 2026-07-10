import { describe, expect, it } from "vitest";
import {
  ClientConfigSchema,
  defineClient,
  type ClientConfigInput,
  FONT_IDS,
  PALETTE_PRESET_IDS,
} from "./index.js";

/**
 * Coverage for the canonical `ClientConfig` contract — the seam between the
 * agent and every render target, vendored verbatim into `hirobius/ops`. A
 * regression here silently propagates to every client site, so this suite
 * pins the guarantees `defineClient()` / the Zod schema actually make.
 *
 * These tests assert *current* behavior only. Where a plausible-looking rule
 * is NOT enforced (see the `sectionOrder` duplicate note), that gap is
 * documented rather than silently changed — tightening the contract is a
 * schema change that must re-sync to ops's vendored copy, not a test edit.
 */

/** A minimal config that passes validation; specs override slices of it. */
function validInput(): ClientConfigInput {
  return {
    slug: "pressure-pros",
    business: {
      name: "Pressure Pros",
      phone: "+1 (555) 010-1234",
      email: "hello@pressurepros.com",
      hours: [{ days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" }],
      serviceAreas: ["Springfield", "Shelbyville"],
    },
    brand: { palettePreset: "pressure-washing" },
    layout: {},
    services: [{ title: "Driveway Washing", description: "Spotless in one pass." }],
    copy: {
      heroHeadline: "Your curb appeal, restored",
      heroSub: "Fast, insured, guaranteed.",
      about: "Family-owned and local.",
    },
    form: { provider: "web3forms", accessKey: "abc123" },
    seo: {
      title: "Pressure Pros — Pressure Washing",
      description: "Professional pressure washing in Springfield.",
      city: "Springfield",
      region: "IL",
      siteUrl: "https://pressurepros.com",
    },
  };
}

describe("defineClient — happy path", () => {
  it("accepts a minimal valid config and returns normalized data", () => {
    const c = defineClient(validInput());
    expect(c.slug).toBe("pressure-pros");
    expect(c.business.name).toBe("Pressure Pros");
  });

  it("applies documented defaults for omitted fields", () => {
    const c = defineClient(validInput());
    expect(c.layout.variant).toBe("A");
    expect(c.layout.sectionOrder).toEqual([
      "services",
      "gallery",
      "reviews",
      "serviceAreaMap",
      "contact",
    ]);
    expect(c.brand.font).toBe("system");
    expect(c.brand.radius).toBe("md");
    expect(c.brand.cssVarOverrides).toEqual({});
    expect(c.copy.ctaLabel).toBe("Get a Free Quote");
    expect(c.gallery).toEqual([]);
    expect(c.reviews).toEqual([]);
    expect(c.map).toEqual({});
    expect(c.hero).toEqual({});
  });

  it("trims and preserves a canonical phone string", () => {
    const c = defineClient({
      ...validInput(),
      business: { ...validInput().business, phone: "  555-010-1234  " },
    });
    expect(c.business.phone).toBe("555-010-1234");
  });
});

describe("defineClient — error surfacing", () => {
  it("throws a readable, slug-tagged error listing each issue", () => {
    const bad = { ...validInput(), slug: "Not Valid", business: undefined } as unknown as ClientConfigInput;
    expect(() => defineClient(bad)).toThrowError(/Invalid client config for "Not Valid"/);
  });
});

describe("primitive validation", () => {
  it("rejects a non-kebab slug", () => {
    for (const slug of ["Pressure_Pros", "pressure pros", "-lead", "UPPER", "trailing-"]) {
      const r = ClientConfigSchema.safeParse({ ...validInput(), slug });
      expect(r.success, slug).toBe(false);
    }
  });

  it("accepts kebab-case slugs", () => {
    for (const slug of ["a", "pressure-pros", "junk-2-go"]) {
      const r = ClientConfigSchema.safeParse({ ...validInput(), slug });
      expect(r.success, slug).toBe(true);
    }
  });

  it("rejects an invalid phone", () => {
    const r = ClientConfigSchema.safeParse({
      ...validInput(),
      business: { ...validInput().business, phone: "call-me" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const r = ClientConfigSchema.safeParse({
      ...validInput(),
      business: { ...validInput().business, email: "not-an-email" },
    });
    expect(r.success).toBe(false);
  });

  it("requires at least one hours row and one service area", () => {
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        business: { ...validInput().business, hours: [] },
      }).success,
    ).toBe(false);
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        business: { ...validInput().business, serviceAreas: [] },
      }).success,
    ).toBe(false);
  });

  it("requires at least one service", () => {
    expect(
      ClientConfigSchema.safeParse({ ...validInput(), services: [] }).success,
    ).toBe(false);
  });
});

describe("layout.sectionOrder", () => {
  it("rejects an unknown section id (a typo can't silently drop a section)", () => {
    const r = ClientConfigSchema.safeParse({
      ...validInput(),
      layout: { sectionOrder: ["services", "bogus"] },
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid subset in any order", () => {
    const r = ClientConfigSchema.safeParse({
      ...validInput(),
      layout: { sectionOrder: ["contact", "services"] },
    });
    expect(r.success).toBe(true);
  });

  it(
    "does NOT currently reject duplicate entries — documented gap, not a guarantee " +
      "(tightening this is a schema change that must re-sync to ops; see issue #53)",
    () => {
      const r = ClientConfigSchema.safeParse({
        ...validInput(),
        layout: { sectionOrder: ["services", "services"] },
      });
      expect(r.success).toBe(true);
    },
  );
});

describe("brand", () => {
  it("resolves every shipped palette preset", () => {
    for (const palettePreset of PALETTE_PRESET_IDS) {
      const r = ClientConfigSchema.safeParse({
        ...validInput(),
        brand: { palettePreset },
      });
      expect(r.success, palettePreset).toBe(true);
    }
  });

  it("rejects an unknown palette preset", () => {
    const r = ClientConfigSchema.safeParse({
      ...validInput(),
      brand: { palettePreset: "teal-dream" },
    });
    expect(r.success).toBe(false);
  });

  it("accepts every shipped font id", () => {
    for (const font of FONT_IDS) {
      const r = ClientConfigSchema.safeParse({
        ...validInput(),
        brand: { palettePreset: "landscaping", font },
      });
      expect(r.success, font).toBe(true);
    }
  });

  it("accepts a well-formed cssVarOverrides entry but rejects a bad key or color", () => {
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        brand: { palettePreset: "landscaping", cssVarOverrides: { "--brand-primary": "#abc" } },
      }).success,
    ).toBe(true);
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        brand: { palettePreset: "landscaping", cssVarOverrides: { "--not-brand": "#abcabc" } },
      }).success,
    ).toBe(false);
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        brand: { palettePreset: "landscaping", cssVarOverrides: { "--brand-primary": "blue" } },
      }).success,
    ).toBe(false);
  });
});

describe("seo limits", () => {
  it("rejects a title over 70 chars", () => {
    const r = ClientConfigSchema.safeParse({
      ...validInput(),
      seo: { ...validInput().seo, title: "x".repeat(71) },
    });
    expect(r.success).toBe(false);
  });

  it("rejects a description over 180 chars", () => {
    const r = ClientConfigSchema.safeParse({
      ...validInput(),
      seo: { ...validInput().seo, description: "x".repeat(181) },
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-URL siteUrl", () => {
    const r = ClientConfigSchema.safeParse({
      ...validInput(),
      seo: { ...validInput().seo, siteUrl: "pressurepros.com" },
    });
    expect(r.success).toBe(false);
  });
});

describe("form (required) and map (optional)", () => {
  it("requires the form block with a web3forms provider and a non-empty key", () => {
    const { form: _form, ...noForm } = validInput();
    expect(ClientConfigSchema.safeParse(noForm).success).toBe(false);
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        form: { provider: "mailchimp", accessKey: "k" },
      }).success,
    ).toBe(false);
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        form: { provider: "web3forms", accessKey: "" },
      }).success,
    ).toBe(false);
  });

  it("treats hcaptchaSiteKey and redirectUrl as optional", () => {
    const c = defineClient({
      ...validInput(),
      form: { provider: "web3forms", accessKey: "k", hcaptchaSiteKey: "hc-key" },
    });
    expect(c.form.hcaptchaSiteKey).toBe("hc-key");
    expect(c.form.redirectUrl).toBeUndefined();
  });

  it("defaults map to {} but accepts a static image or embed query", () => {
    expect(defineClient(validInput()).map).toEqual({});
    const c = defineClient({
      ...validInput(),
      map: { staticImage: "/map.png", embedQuery: "Pressure Pros, Springfield" },
    });
    expect(c.map.staticImage).toBe("/map.png");
  });
});

describe("gallery and reviews content rules", () => {
  it("requires alt text and an absolute public path on gallery photos", () => {
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        gallery: [{ src: "/photos/a.jpg", alt: "" }],
      }).success,
    ).toBe(false);
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        gallery: [{ src: "photos/a.jpg", alt: "A clean driveway" }],
      }).success,
    ).toBe(false);
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        gallery: [{ src: "/photos/a.jpg", alt: "A clean driveway" }],
      }).success,
    ).toBe(true);
  });

  it("bounds review rating to an integer 1–5", () => {
    for (const rating of [0, 6, 3.5]) {
      expect(
        ClientConfigSchema.safeParse({
          ...validInput(),
          reviews: [{ author: "Jo", rating, text: "Great" }],
        }).success,
        String(rating),
      ).toBe(false);
    }
    expect(
      ClientConfigSchema.safeParse({
        ...validInput(),
        reviews: [{ author: "Jo", rating: 5, text: "Great", source: "Google" }],
      }).success,
    ).toBe(true);
  });
});
