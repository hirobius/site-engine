import { describe, expect, it } from "vitest";
import { brandOverlayVars, type BrandPalette } from "./brand-overlay.js";

const BASE_PALETTE: BrandPalette = {
  primary: "#2f6f3e",
  onPrimary: "#ffffff",
  bg: "#f7f8f3",
  fg: "#1f2a1c",
  muted: "#e7ecdd",
};

describe("brandOverlayVars shadow dial (#157)", () => {
  it("omits shadow keys when shadow is unset — default path unchanged", () => {
    const vars = brandOverlayVars(BASE_PALETTE);
    expect(vars).not.toHaveProperty("--semantic-shadow-subtle");
    expect(vars).not.toHaveProperty("--semantic-shadow-floating");
    expect(vars).not.toHaveProperty("--semantic-shadow-overlay");
  });

  it("omits shadow keys when shadow is explicitly 'soft'", () => {
    const vars = brandOverlayVars({ ...BASE_PALETTE, shadow: "soft" });
    expect(vars).not.toHaveProperty("--semantic-shadow-subtle");
  });

  it("'flat' sets all three tiers to none", () => {
    const vars = brandOverlayVars({ ...BASE_PALETTE, shadow: "flat" });
    expect(vars["--semantic-shadow-subtle"]).toBe("none");
    expect(vars["--semantic-shadow-floating"]).toBe("none");
    expect(vars["--semantic-shadow-overlay"]).toBe("none");
  });

  it("'hard' sets three distinct solid offset shadows, increasing by tier", () => {
    const vars = brandOverlayVars({ ...BASE_PALETTE, shadow: "hard" });
    expect(vars["--semantic-shadow-subtle"]).toContain("2px 2px 0 0");
    expect(vars["--semantic-shadow-floating"]).toContain("4px 4px 0 0");
    expect(vars["--semantic-shadow-overlay"]).toContain("6px 6px 0 0");
    // No blur radius in any tier — the "hard" idiom vs. soft's blurred sets.
    expect(vars["--semantic-shadow-subtle"]).not.toMatch(/\dpx \dpx \dpx \dpx/);
  });

  it("shadow dial doesn't disturb unrelated vars", () => {
    const withShadow = brandOverlayVars({ ...BASE_PALETTE, shadow: "hard" });
    const without = brandOverlayVars(BASE_PALETTE);
    expect(withShadow["--semantic-accent-rest"]).toBe(without["--semantic-accent-rest"]);
    expect(withShadow["--semantic-color-surface-page"]).toBe(without["--semantic-color-surface-page"]);
  });
});

describe("brandOverlayVars spacingDensity dial (#86)", () => {
  it("omits spacing keys when spacingDensity is unset — default path unchanged", () => {
    const vars = brandOverlayVars(BASE_PALETTE);
    expect(vars).not.toHaveProperty("--semantic-spacing-section-y");
    expect(vars).not.toHaveProperty("--semantic-spacing-section-y-lg");
  });

  it("omits spacing keys when spacingDensity is explicitly 'comfortable'", () => {
    const vars = brandOverlayVars({ ...BASE_PALETTE, spacingDensity: "comfortable" });
    expect(vars).not.toHaveProperty("--semantic-spacing-section-y");
  });

  it("'compact' tightens both tiers below the comfortable default", () => {
    const vars = brandOverlayVars({ ...BASE_PALETTE, spacingDensity: "compact" });
    expect(vars["--semantic-spacing-section-y"]).toBe("var(--primitive-space-12)");
    expect(vars["--semantic-spacing-section-y-lg"]).toBe("var(--primitive-space-16)");
  });

  it("'airy' loosens both tiers above the comfortable default", () => {
    const vars = brandOverlayVars({ ...BASE_PALETTE, spacingDensity: "airy" });
    expect(vars["--semantic-spacing-section-y"]).toBe("var(--primitive-space-24)");
    expect(vars["--semantic-spacing-section-y-lg"]).toBe("var(--primitive-space-32)");
  });

  it("spacingDensity dial doesn't disturb unrelated vars", () => {
    const withDensity = brandOverlayVars({ ...BASE_PALETTE, spacingDensity: "airy" });
    const without = brandOverlayVars(BASE_PALETTE);
    expect(withDensity["--semantic-accent-rest"]).toBe(without["--semantic-accent-rest"]);
    expect(withDensity["--semantic-shadow-subtle"]).toBe(without["--semantic-shadow-subtle"]);
  });
});
