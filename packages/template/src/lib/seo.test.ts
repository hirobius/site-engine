import { describe, expect, it } from "vitest";
import { defineClient } from "@hirobius/schema";
import type { ClientConfigInput } from "@hirobius/schema";
import { localBusinessJsonLd, metaTags, openingHoursSpecification, robotsTxt } from "./seo.js";

describe("openingHoursSpecification", () => {
  it("expands a day range and converts 12h to 24h", () => {
    const spec = openingHoursSpecification([{ days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" }]);
    expect(spec).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "https://schema.org/Monday",
          "https://schema.org/Tuesday",
          "https://schema.org/Wednesday",
          "https://schema.org/Thursday",
          "https://schema.org/Friday",
        ],
        opens: "08:00",
        closes: "18:00",
      },
    ]);
  });

  it("handles a single day and a comma-separated list", () => {
    expect(openingHoursSpecification([{ days: "Sat", hours: "9:00 AM – 2:00 PM" }])).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["https://schema.org/Saturday"],
        opens: "09:00",
        closes: "14:00",
      },
    ]);
    expect(openingHoursSpecification([{ days: "Mon, Wed, Fri", hours: "7:00 AM – 5:00 PM" }])).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["https://schema.org/Monday", "https://schema.org/Wednesday", "https://schema.org/Friday"],
        opens: "07:00",
        closes: "17:00",
      },
    ]);
  });

  it("handles noon and midnight correctly", () => {
    expect(openingHoursSpecification([{ days: "Sun", hours: "12:00 AM – 12:00 PM" }])).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["https://schema.org/Sunday"],
        opens: "00:00",
        closes: "12:00",
      },
    ]);
  });

  it("omits rows it can't parse instead of guessing", () => {
    expect(openingHoursSpecification([{ days: "Sun", hours: "Closed" }])).toEqual([]);
    expect(openingHoursSpecification([{ days: "Sat", hours: "By appointment" }])).toEqual([]);
    expect(openingHoursSpecification([{ days: "Holidays", hours: "9:00 AM – 5:00 PM" }])).toEqual([]);
  });

  it("mixes parseable and unparseable rows", () => {
    const spec = openingHoursSpecification([
      { days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" },
      { days: "Sun", hours: "Closed" },
    ]);
    expect(spec).toHaveLength(1);
    expect(spec[0]!.opens).toBe("08:00");
  });
});

describe("robotsTxt", () => {
  it("allows everything and points at the sitemap", () => {
    expect(robotsTxt("https://pressurepros.com")).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://pressurepros.com/sitemap-index.xml\n",
    );
  });
});

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
  copy: {
    heroHeadline: "Headline",
    heroSub: "Sub",
    about: "About us.",
  },
  form: {
    provider: "web3forms",
    accessKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  },
  seo: {
    title: "Acme",
    description: "Acme description",
    city: "Your City",
    region: "ST",
    siteUrl: "https://example.com",
  },
};

const BASE_CONFIG = defineClient(BASE_INPUT);

describe("metaTags", () => {
  it("derives og:site_name from the business name and defaults og:locale to en_US", () => {
    const meta = metaTags(BASE_CONFIG);
    expect(meta.ogSiteName).toBe("Acme Service Co.");
    expect(meta.ogLocale).toBe("en_US");
  });
});

describe("localBusinessJsonLd", () => {
  it("sets an @id derived from siteUrl", () => {
    const jsonLd = localBusinessJsonLd(BASE_CONFIG);
    expect(jsonLd["@id"]).toBe("https://example.com#business");
  });
});
