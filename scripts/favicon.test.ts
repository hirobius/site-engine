import { describe, expect, it } from "vitest";
import { PALETTE_PRESETS } from "../packages/schema/src/presets.js";
import { faviconInitial, generateFaviconSvg } from "./favicon.js";

describe("generateFaviconSvg", () => {
  it("centers the business initial on the preset primary, in the rounded-square shape", () => {
    const svg = generateFaviconSvg("Mike's Junk Removal", "junk-removal");
    expect(svg).toContain(`fill="${PALETTE_PRESETS["junk-removal"]["--brand-primary"]}"`);
    expect(svg).toContain(`fill="${PALETTE_PRESETS["junk-removal"]["--brand-on-primary"]}"`);
    expect(svg).toContain(">M<");
    expect(svg).toContain('<rect width="32" height="32" rx="6"');
  });

  it("uses the correct primary hex per preset", () => {
    for (const [preset, tokens] of Object.entries(PALETTE_PRESETS)) {
      const svg = generateFaviconSvg("Acme Co", preset as keyof typeof PALETTE_PRESETS);
      expect(svg, preset).toContain(`fill="${tokens["--brand-primary"]}"`);
    }
  });

  it("uppercases the initial and escapes XML-sensitive characters", () => {
    expect(generateFaviconSvg("acme co", "landscaping")).toContain(">A<");
    expect(faviconInitial("& Sons Landscaping")).toBe("&amp;");
  });

  it("falls back to A for an empty/whitespace name", () => {
    expect(faviconInitial("   ")).toBe("A");
    expect(faviconInitial("")).toBe("A");
  });
});
