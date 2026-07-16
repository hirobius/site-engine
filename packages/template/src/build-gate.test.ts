import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { defineClient } from "@hirobius/schema";
import type { ClientConfigInput } from "@hirobius/schema";
import { armAcceptanceGate } from "./build-gate.js";

const OPTIMIZED_APP_DIR = fileURLToPath(new URL("./__fixtures__/hero-image/optimized", import.meta.url));
const UNOPTIMIZED_APP_DIR = fileURLToPath(new URL("./__fixtures__/hero-image", import.meta.url));

const PLACEHOLDER_INPUT: ClientConfigInput = {
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
  form: { provider: "web3forms", accessKey: "REPLACE_WITH_WEB3FORMS_ACCESS_KEY" },
  seo: {
    title: "Acme Service Co. | Your City",
    description: "Placeholder scaffold description.",
    city: "Your City",
    region: "ST",
    siteUrl: "https://example.com",
  },
};

const client = defineClient(PLACEHOLDER_INPUT);

const withHeroClient = defineClient({
  ...PLACEHOLDER_INPUT,
  hero: { image: "/photos/hero.jpg", imageAlt: "Crew servicing a customer's property" },
});

const REAL_INPUT: ClientConfigInput = {
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
  copy: { heroHeadline: "Headline", heroSub: "Sub", about: "About us." },
  hero: { image: "/photos/hero.jpg", imageAlt: "Real Business Co crew on site" },
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

const realClient = defineClient(REAL_INPUT);

const ENV_KEYS = ["SITE_LIVE", "VERCEL_ENV"] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("armAcceptanceGate", () => {
  it("does not throw for placeholder data in an unarmed (preview) build", () => {
    expect(() => armAcceptanceGate(client)).not.toThrow();
  });

  it("throws for placeholder data once SITE_LIVE=true", () => {
    process.env.SITE_LIVE = "true";
    expect(() => armAcceptanceGate(client)).toThrow(/checkClientAcceptance found/);
  });

  it("throws for placeholder data once VERCEL_ENV=production", () => {
    process.env.VERCEL_ENV = "production";
    expect(() => armAcceptanceGate(client)).toThrow(/checkClientAcceptance found/);
  });

  it("does not arm for VERCEL_ENV=preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(() => armAcceptanceGate(client)).not.toThrow();
  });
});

describe("armAcceptanceGate — hero.image optimization (issue #81)", () => {
  it("warns but does not throw in an unarmed (preview) build when hero.image has no src/assets/photos match", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => armAcceptanceGate(withHeroClient, UNOPTIMIZED_APP_DIR)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("hero.image"));
    warn.mockRestore();
  });

  it("does not warn when hero.image resolves under src/assets/photos", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    armAcceptanceGate(withHeroClient, OPTIMIZED_APP_DIR);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("throws once SITE_LIVE=true when hero.image has no src/assets/photos match", () => {
    process.env.SITE_LIVE = "true";
    expect(() => armAcceptanceGate(realClient, UNOPTIMIZED_APP_DIR)).toThrow(/unoptimized-hero-image/);
  });

  it("does not throw once SITE_LIVE=true when hero.image resolves under src/assets/photos", () => {
    process.env.SITE_LIVE = "true";
    expect(() => armAcceptanceGate(realClient, OPTIMIZED_APP_DIR)).not.toThrow();
  });
});
