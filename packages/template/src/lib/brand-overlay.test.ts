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
