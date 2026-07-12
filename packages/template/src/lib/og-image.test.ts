import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { defineClient, PALETTE_PRESET_IDS } from "@hirobius/schema";
import type { ClientConfigInput } from "@hirobius/schema";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, ogImageSvg, renderOgImagePng } from "./og-image.js";

const BASE_INPUT: ClientConfigInput = {
  slug: "acme-co",
  business: {
    name: "Acme Service Co.",
    phone: "(555) 010-0000",
    email: "hello@example.com",
    hours: [{ days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" }],
    serviceAreas: ["Your City"],
  },
  brand: { palettePreset: "pressure-washing" },
  layout: { sectionOrder: ["services", "contact"] },
  services: [{ title: "Washing", description: "We wash things." }],
  copy: { heroHeadline: "Headline", heroSub: "Sub", about: "About us." },
  form: { provider: "web3forms", accessKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6" },
  seo: {
    title: "Acme",
    description: "Acme description",
    city: "Springfield",
    region: "IL",
    siteUrl: "https://example.com",
  },
};

function config(overrides: Partial<ClientConfigInput> = {}): ReturnType<typeof defineClient> {
  return defineClient({ ...BASE_INPUT, ...overrides });
}

describe("ogImageSvg", () => {
  it("includes the business name, trade, and city/region", () => {
    const svg = ogImageSvg(config());
    expect(svg).toContain("Acme Service Co.");
    expect(svg).toContain("Pressure Washing");
    expect(svg).toContain("Springfield, IL");
  });

  it("paints the resolved brand palette, not a hardcoded one", () => {
    const svg = ogImageSvg(config({ brand: { palettePreset: "landscaping" } }));
    expect(svg).toContain("#2f6f3e"); // landscaping --brand-primary
    expect(svg).not.toContain("#0a6cb5"); // pressure-washing --brand-primary
  });

  it("respects cssVarOverrides", () => {
    const svg = ogImageSvg(
      config({ brand: { palettePreset: "pressure-washing", cssVarOverrides: { "--brand-primary": "#123456" } } }),
    );
    expect(svg).toContain("#123456");
  });

  it("escapes XML-sensitive characters in the business name", () => {
    const svg = ogImageSvg(config({ business: { ...BASE_INPUT.business, name: "Bob & Sons <Co>" } }));
    expect(svg).toContain("Bob &amp; Sons &lt;Co&gt;");
    expect(svg).not.toContain("<Co>");
  });

  it("shrinks the headline font size as the business name grows, and truncates extreme lengths", () => {
    const short = ogImageSvg(config({ business: { ...BASE_INPUT.business, name: "Acme" } }));
    const long = ogImageSvg(
      config({
        business: {
          ...BASE_INPUT.business,
          name: "A Very Long Family-Owned Business Name That Goes On For A While LLC",
        },
      }),
    );
    const shortFontSize = Number(short.match(/font-size="(\d+)" font-weight="700"/)![1]);
    const longFontSize = Number(long.match(/font-size="(\d+)" font-weight="700"/)![1]);
    expect(longFontSize).toBeLessThan(shortFontSize);
    expect(long).toContain("…");
    expect(long).not.toContain("A Very Long Family-Owned Business Name That Goes On For A While LLC");
  });
});

describe("renderOgImagePng", () => {
  it.each(PALETTE_PRESET_IDS)("rasterizes a %s card at 1200x630", async (palettePreset) => {
    const png = await renderOgImagePng(config({ brand: { palettePreset } }));
    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(OG_IMAGE_WIDTH);
    expect(metadata.height).toBe(OG_IMAGE_HEIGHT);
  });
});
