import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ClientConfig } from "@hirobius/schema";
import {
  DEFAULT_SERVICES_SUBTITLE,
  DEFAULT_SERVICES_TITLE,
  servicesCopy,
} from "./services-copy.js";

const cfg = (copy: Record<string, unknown>) => ({ copy }) as unknown as ClientConfig;

describe("servicesCopy", () => {
  it("returns today's defaults byte-for-byte when unset", () => {
    expect(servicesCopy(cfg({}))).toEqual({
      title: "What We Do",
      subtitle: "Professional service, done right the first time.",
    });
    expect(DEFAULT_SERVICES_TITLE).toBe("What We Do");
    expect(DEFAULT_SERVICES_SUBTITLE).toBe("Professional service, done right the first time.");
  });

  it("uses overrides when set", () => {
    expect(servicesCopy(cfg({ servicesTitle: "Our Work", servicesSubtitle: "Built to last." }))).toEqual({
      title: "Our Work",
      subtitle: "Built to last.",
    });
  });

  it("overrides each field independently", () => {
    expect(servicesCopy(cfg({ servicesTitle: "Our Work" }))).toEqual({
      title: "Our Work",
      subtitle: DEFAULT_SERVICES_SUBTITLE,
    });
  });
});

describe("services variants", () => {
  for (const v of ["grid", "alternating", "cards"]) {
    it(`${v}.astro has no hard-coded default copy and uses the helper`, () => {
      const src = readFileSync(new URL(`../components/services/${v}.astro`, import.meta.url), "utf8");
      expect(src).not.toContain("What We Do");
      expect(src).not.toContain("Professional service, done right the first time.");
      expect(src).toContain("servicesCopy");
    });
  }
});
