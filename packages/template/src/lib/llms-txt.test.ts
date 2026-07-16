import { describe, expect, it } from "vitest";
import { defineClient } from "@hirobius/schema";
import type { ClientConfigInput } from "@hirobius/schema";
import { isPlaceholderEmail, isPlaceholderPhone, isPlaceholderSiteUrl } from "../acceptance.js";
import { llmsTxt } from "./llms-txt.js";

const REAL_INPUT: ClientConfigInput = {
  slug: "real-business-co",
  business: {
    name: "Real Business Co",
    phone: "(509) 838-4200",
    email: "hello@realbusinessco.com",
    hours: [
      { days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" },
      { days: "Sat", hours: "9:00 AM – 2:00 PM" },
    ],
    serviceAreas: ["Spokane", "Spokane Valley", "Liberty Lake"],
  },
  brand: { palettePreset: "pressure-washing" },
  layout: { sectionOrder: ["services", "contact"] },
  services: [
    { title: "House Washing", description: "Soft-wash exterior cleaning that protects siding." },
    { title: "Driveway Cleaning", description: "Hot-water pressure washing that lifts oil stains." },
  ],
  copy: {
    heroHeadline: "Spokane's Trusted Pressure Washing",
    heroSub: "Fast, friendly, and fully insured.",
    about: "Real Business Co has served the Spokane area since 2015.",
  },
  form: {
    provider: "web3forms",
    accessKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    hcaptchaSiteKey: "real-hcaptcha-site-key",
  },
  seo: {
    title: "Real Business Co | Spokane Pressure Washing",
    description: "Spokane's trusted pressure washing company.",
    city: "Spokane",
    region: "WA",
    siteUrl: "https://realbusinessco.com",
    ogImage: "/photos/og.jpg",
  },
};

const REAL_CONFIG = defineClient(REAL_INPUT);

describe("llmsTxt", () => {
  const output = llmsTxt(REAL_CONFIG);

  it("includes the business name as the H1", () => {
    expect(output).toContain("# Real Business Co");
  });

  it("includes every service with its description", () => {
    expect(output).toContain("House Washing: Soft-wash exterior cleaning that protects siding.");
    expect(output).toContain("Driveway Cleaning: Hot-water pressure washing that lifts oil stains.");
  });

  it("includes every service area", () => {
    for (const area of REAL_CONFIG.business.serviceAreas) {
      expect(output).toContain(area);
    }
  });

  it("includes every hours row", () => {
    expect(output).toContain("Mon–Fri: 8:00 AM – 6:00 PM");
    expect(output).toContain("Sat: 9:00 AM – 2:00 PM");
  });

  it("includes phone, email, and site URL", () => {
    expect(output).toContain(REAL_CONFIG.business.phone);
    expect(output).toContain(REAL_CONFIG.business.email);
    expect(output).toContain(REAL_CONFIG.seo.siteUrl);
  });

  it("points at the sitemap", () => {
    expect(output).toContain("https://realbusinessco.com/sitemap-index.xml");
  });

  it("contains no placeholder contact data — pure derivation from real config", () => {
    expect(isPlaceholderPhone(REAL_CONFIG.business.phone)).toBe(false);
    expect(isPlaceholderEmail(REAL_CONFIG.business.email)).toBe(false);
    expect(isPlaceholderSiteUrl(REAL_CONFIG.seo.siteUrl)).toBe(false);
  });

  it("is a plain-text derivation with no stub scaffolding", () => {
    expect(output).not.toMatch(/TODO|PLACEHOLDER|\[object Object\]|undefined/i);
  });
});
