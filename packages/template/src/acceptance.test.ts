import { describe, expect, it } from "vitest";
import { defineClient, PALETTE_PRESET_IDS } from "@hirobius/schema";
import type { ClientConfigDraft, ClientConfigInput } from "@hirobius/schema";
import { checkClientAcceptance } from "./acceptance.js";
import { contrastRatio, WCAG_AA_NORMAL_TEXT } from "./lib/contrast.js";
import { resolvePalette } from "./lib/theme.js";

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
  form: {
    provider: "web3forms",
    accessKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    hcaptchaSiteKey: "real-hcaptcha-site-key",
  },
  seo: {
    title: "Real Business Co | Spokane",
    description: "Spokane's real business.",
    city: "Spokane",
    region: "WA",
    siteUrl: "https://realbusinessco.com",
    ogImage: "/photos/og.jpg",
  },
};

function config(overrides: Partial<ClientConfigInput> = {}): ReturnType<typeof defineClient> {
  return defineClient({ ...BASE_INPUT, ...overrides });
}

describe("checkClientAcceptance", () => {
  it("passes a fully real, complete config", () => {
    expect(checkClientAcceptance(config(), { realData: true })).toEqual([]);
  });

  it("ignores placeholder data when realData is not set (preview sites)", () => {
    const previewConfig = config({
      business: { ...BASE_INPUT.business, phone: "(555) 010-0000", email: "hello@biz.example" },
      form: { provider: "web3forms", accessKey: "00000000-0000-0000-0000-000000000000" },
      seo: { ...BASE_INPUT.seo, siteUrl: "https://biz.example" },
    });
    expect(checkClientAcceptance(previewConfig)).toEqual([]);
  });

  it("flags a .example email once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ business: { ...BASE_INPUT.business, email: "hello@biz.example" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("placeholder-email");
  });

  it("flags a .example siteUrl once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ seo: { ...BASE_INPUT.seo, siteUrl: "https://biz.example" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("placeholder-site-url");
  });

  it("flags an example.com email once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ business: { ...BASE_INPUT.business, email: "hello@example.com" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("placeholder-email");
  });

  it("flags an example.com siteUrl once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ seo: { ...BASE_INPUT.seo, siteUrl: "https://example.com" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("placeholder-site-url");
  });

  it("flags the 555 area code convention once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ business: { ...BASE_INPUT.business, phone: "(555) 010-0000" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("placeholder-phone");
  });

  it("flags the 555-01xx exchange convention once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ business: { ...BASE_INPUT.business, phone: "(509) 555-0100" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("placeholder-phone");
  });

  it("flags an all-zeros form key once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ form: { provider: "web3forms", accessKey: "00000000-0000-0000-0000-000000000000" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("placeholder-form-key");
  });

  it("flags a REPLACE_WITH-style form key once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ form: { provider: "web3forms", accessKey: "REPLACE_WITH_WEB3FORMS_ACCESS_KEY" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("placeholder-form-key");
  });

  it("flags a missing hcaptchaSiteKey once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ form: { provider: "web3forms", accessKey: BASE_INPUT.form.accessKey } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("missing-hcaptcha-key");
  });

  it("does not flag a missing seo.ogImage — the build generates a fallback card (issue #105)", () => {
    const issues = checkClientAcceptance(
      config({ seo: { ...BASE_INPUT.seo, ogImage: undefined } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).not.toContain("missing-og-image");
  });

  it("flags a stub business name once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ business: { ...BASE_INPUT.business, name: "Acme Co" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("placeholder-name");
  });

  it("flags a non-https siteUrl once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ seo: { ...BASE_INPUT.seo, siteUrl: "http://realbusinessco.com" } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("insecure-site-url");
  });

  it("flags a sectionOrder entry whose data is empty, regardless of realData", () => {
    const issues = checkClientAcceptance(
      config({ layout: { sectionOrder: ["services", "gallery", "contact"] }, gallery: [] }),
    );
    expect(issues.map((i) => i.code)).toContain("incomplete-section");
  });

  it("passes a gallery section once photos are present", () => {
    const issues = checkClientAcceptance(
      config({
        layout: { sectionOrder: ["services", "gallery", "contact"] },
        gallery: [{ src: "/photos/one.jpg", alt: "A finished job" }],
      }),
    );
    expect(issues).toEqual([]);
  });

  it("flags a variant B layout with no hero.videoSrc, regardless of realData", () => {
    const issues = checkClientAcceptance(config({ layout: { variant: "B", sectionOrder: ["contact"] } }));
    expect(issues.map((i) => i.code)).toContain("empty-video-hero");
  });

  it("passes a variant B layout once hero.videoSrc is set", () => {
    const issues = checkClientAcceptance(
      config({
        layout: { variant: "B", sectionOrder: ["contact"] },
        hero: { videoSrc: "/photos/hero.mp4" },
      }),
    );
    expect(issues).toEqual([]);
  });

  describe("token contrast (issue #79)", () => {
    it("passes every shipped preset's primary/on-primary and fg/bg pairing", () => {
      for (const palettePreset of PALETTE_PRESET_IDS) {
        const issues = checkClientAcceptance(config({ brand: { palettePreset } }));
        expect(issues.map((i) => i.code), `preset "${palettePreset}"`).not.toContain("low-contrast-cta");
        expect(issues.map((i) => i.code), `preset "${palettePreset}"`).not.toContain("low-contrast-hero");
      }
    });

    it("flags a low-contrast primary/on-primary override", () => {
      const issues = checkClientAcceptance(
        config({
          brand: {
            palettePreset: "junk-removal",
            cssVarOverrides: { "--brand-on-primary": "#f26419" },
          },
        }),
      );
      expect(issues.map((i) => i.code)).toContain("low-contrast-cta");
    });

    it("flags a low-contrast fg/bg override (would break the hero and body text)", () => {
      const issues = checkClientAcceptance(
        config({
          brand: {
            palettePreset: "junk-removal",
            cssVarOverrides: { "--brand-fg": "#161616", "--brand-bg": "#1a1a1a" },
          },
        }),
      );
      expect(issues.map((i) => i.code)).toContain("low-contrast-hero");
    });

    describe("free palettes (full six-key cssVarOverrides, issue #145)", () => {
      it("flags an illegible free palette even though the base preset is legible", () => {
        // `palettePreset` must still be a stock id, but a full six-key
        // cssVarOverrides completely replaces every preset token — so
        // "landscaping" here is a red herring. If the gate were (wrongly)
        // checking the *preset*'s own tokens instead of the *resolved*
        // (override-merged) palette, this would pass clean; it must not.
        const issues = checkClientAcceptance(
          config({
            brand: {
              palettePreset: "landscaping",
              cssVarOverrides: {
                "--brand-primary": "#ffffff",
                "--brand-on-primary": "#f5f5f5",
                "--brand-bg": "#e5e5e5",
                "--brand-fg": "#dddddd",
                "--brand-muted": "#e0e0e0",
                "--brand-accent": "#c9a227",
              },
            },
          }),
        );
        const codes = issues.map((i) => i.code);
        expect(codes).toContain("low-contrast-cta");
        expect(codes).toContain("low-contrast-hero");
        expect(codes).toContain("low-contrast-muted");
      });

      it("passes a legible free palette that matches no stock preset", () => {
        const issues = checkClientAcceptance(
          config({
            brand: {
              palettePreset: "landscaping",
              cssVarOverrides: {
                "--brand-primary": "#5b2a86",
                "--brand-on-primary": "#ffffff",
                "--brand-bg": "#faf7ff",
                "--brand-fg": "#241934",
                "--brand-muted": "#ece4f7",
                "--brand-accent": "#e0b400",
              },
            },
          }),
        );
        expect(issues).toEqual([]);
      });
    });
  });
});

describe("design: warm-editorial skin (issue #141)", () => {
  // Full acceptance run, not just the palette — proves the skin resolves to
  // a config that would actually ship clean: real business data, a complete
  // section set, AND passing contrast. `design` isn't part of
  // `ClientConfigInput` (it's stripped in `applyDesignSkin` before it reaches
  // `ClientConfigSchema`), so this builds straight off `BASE_INPUT` rather
  // than through the `config()` helper above, which is typed to that
  // narrower input shape.
  function warmEditorialConfig(overrides: Partial<ClientConfigInput> = {}) {
    return defineClient({
      ...BASE_INPUT,
      ...overrides,
      design: "warm-editorial",
    } as ClientConfigDraft);
  }

  it("resolves to a fully acceptable config — no placeholder, section, or contrast issues", () => {
    const issues = checkClientAcceptance(warmEditorialConfig(), { realData: true });
    expect(issues).toEqual([]);
  });

  it("passes AA contrast on its own cream + sage palette specifically", () => {
    const issues = checkClientAcceptance(warmEditorialConfig());
    const codes = issues.map((i) => i.code);
    expect(codes).not.toContain("low-contrast-cta");
    expect(codes).not.toContain("low-contrast-hero");
    expect(codes).not.toContain("low-contrast-muted");
  });

  it("passes AA contrast on --brand-accent too, even though it isn't a CONTRAST_TOKEN_PAIRS entry", () => {
    // checkClientAcceptance's gate doesn't check accent (the template never
    // renders body text directly on it today — see CONTRAST_TOKEN_PAIRS in
    // acceptance.ts), so the previous test above passing clean does NOT
    // prove the accent is legible. Verify it directly with the same
    // contrastRatio machinery the gate itself uses, against both surfaces
    // it could plausibly sit on, so a future accent-text usage doesn't
    // inherit a silent failure (issue #141 review finding).
    const palette = resolvePalette(warmEditorialConfig());
    expect(contrastRatio(palette["--brand-accent"], palette["--brand-bg"])).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT,
    );
    expect(contrastRatio(palette["--brand-accent"], palette["--brand-muted"])).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT,
    );
  });

  it("is visibly distinct from every stock trade preset's resolved palette", () => {
    const warmIssues = checkClientAcceptance(warmEditorialConfig());
    expect(warmIssues).toEqual([]);
    const warmConfig = warmEditorialConfig();
    for (const palettePreset of PALETTE_PRESET_IDS) {
      const stockConfig = config({ brand: { palettePreset } });
      expect(warmConfig.brand.cssVarOverrides).not.toEqual(stockConfig.brand.cssVarOverrides);
    }
  });
});
