import { afterEach, describe, expect, it } from "vitest";
import { defineClient } from "@hirobius/schema";
import type { ClientConfigInput } from "@hirobius/schema";
import { armAcceptanceGate } from "./build-gate.js";

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
