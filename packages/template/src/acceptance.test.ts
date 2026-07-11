import { describe, expect, it } from "vitest";
import { defineClient } from "@hirobius/schema";
import type { ClientConfigInput } from "@hirobius/schema";
import { checkClientAcceptance } from "./acceptance.js";

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

  it("flags a missing seo.ogImage once realData is true", () => {
    const issues = checkClientAcceptance(
      config({ seo: { ...BASE_INPUT.seo, ogImage: undefined } }),
      { realData: true },
    );
    expect(issues.map((i) => i.code)).toContain("missing-og-image");
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
});
