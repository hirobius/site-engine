import { describe, expect, it } from "vitest";
import { contrastRatio, meetsAAContrast, relativeLuminance, WCAG_AA_NORMAL_TEXT } from "./contrast.js";

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("expands 3-digit hex the same as its 6-digit equivalent", () => {
    expect(relativeLuminance("#0d0")).toBeCloseTo(relativeLuminance("#00dd00"), 10);
  });
});

describe("contrastRatio", () => {
  it("is 1:1 for identical colors", () => {
    expect(contrastRatio("#161616", "#161616")).toBeCloseTo(1, 5);
  });

  it("is ~21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("is symmetric regardless of argument order", () => {
    expect(contrastRatio("#f26419", "#0d0d0d")).toBeCloseTo(contrastRatio("#0d0d0d", "#f26419"), 10);
  });

  it("flags junk-removal's pre-fix hero pairing (issue #79) as near-unreadable", () => {
    // Hero.astro rendered `bg-fg text-on-primary`: junk-removal's
    // --brand-fg (#161616) behind --brand-on-primary (#0d0d0d) text.
    const ratio = contrastRatio("#161616", "#0d0d0d");
    expect(ratio).toBeLessThan(1.2);
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });

  it("passes junk-removal's fg/bg pairing (the correct hero pairing post-fix)", () => {
    expect(contrastRatio("#161616", "#ffffff")).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });
});

describe("meetsAAContrast", () => {
  it("matches the 4.5:1 threshold", () => {
    expect(meetsAAContrast("#161616", "#0d0d0d")).toBe(false);
    expect(meetsAAContrast("#161616", "#ffffff")).toBe(true);
  });
});
