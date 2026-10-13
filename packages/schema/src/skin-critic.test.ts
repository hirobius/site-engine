import { describe, expect, it } from "vitest";
import { contrastRatio } from "./design-genome.js";
import { FONT_PAIRINGS, type PaletteTokens } from "./presets.js";
import { SKINS, SKIN_IDS, type SkinId } from "./skins.js";

/**
 * The computable half of `docs/SKIN-CRITIC.md`, run over every shipped skin
 * except `classic` (the defaults placeholder). A new skin can't land without
 * clearing it, so the rubric is a gate rather than a step to remember. The
 * judgment half (brief fit, `/impeccable critique` on the gallery render)
 * stays a manual step in `docs/AUTHORING-SKINS.md`.
 *
 * Beyond the rubric's own pairs, `primary` is checked as TEXT on `bg` and
 * `muted`: the template renders `text-primary` for service titles, hero
 * eyebrows and contact links, so a CTA-only primary (e.g. bright amber with
 * dark button text) would pass the CTA pair and still be unreadable there.
 */

const PALETTE_KEYS: (keyof PaletteTokens)[] = [
  "--brand-primary",
  "--brand-accent",
  "--brand-bg",
  "--brand-fg",
  "--brand-muted",
  "--brand-on-primary",
];

function hsl(hex: string): { h: number; s: number; l: number } {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const SERIF_HEADING = /serif/i;

const authored = SKIN_IDS.filter((id): id is Exclude<SkinId, "classic"> => id !== "classic");

describe.each(authored)("skin critic rubric — %s", (id) => {
  const skin = SKINS[id];
  const brand = skin.brand;
  const palette = brand.cssVarOverrides as Partial<PaletteTokens> | undefined;
  const c = (a: keyof PaletteTokens, b: keyof PaletteTokens) => contrastRatio(palette![a]!, palette![b]!);

  it("pins a complete palette, so no trade preset can mix into an unvetted pair", () => {
    expect(palette).toBeDefined();
    for (const key of PALETTE_KEYS) expect(palette?.[key], key).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("1 hierarchy: a real font pairing, CTA >= 6:1, and a shape/motion change vs classic", () => {
    expect(brand.fontPairing).toBeDefined();
    expect(brand.fontPairing).not.toBe("system");
    expect(c("--brand-primary", "--brand-on-primary")).toBeGreaterThanOrEqual(6);
    const classic = SKINS.classic.brand;
    expect(
      brand.radius !== classic.radius || brand.shadow !== classic.shadow || brand.motion !== classic.motion,
    ).toBe(true);
  });

  it("2 contrast: gated pairs >= 4.5, primary as text >= 4.5, accent >= 3", () => {
    expect(c("--brand-fg", "--brand-bg")).toBeGreaterThanOrEqual(4.5);
    expect(c("--brand-fg", "--brand-muted")).toBeGreaterThanOrEqual(4.5);
    expect(c("--brand-primary", "--brand-bg")).toBeGreaterThanOrEqual(4.5);
    expect(c("--brand-primary", "--brand-muted")).toBeGreaterThanOrEqual(4.5);
    expect(c("--brand-accent", "--brand-bg")).toBeGreaterThanOrEqual(3);
    expect(c("--brand-accent", "--brand-muted")).toBeGreaterThanOrEqual(3);
  });

  it("2 contrast: a CTA on the inverted classic/video hero stays visible (primary vs fg >= 3)", () => {
    if (skin.sections.hero !== "classic" && skin.sections.hero !== "video") return;
    expect(c("--brand-primary", "--brand-fg")).toBeGreaterThanOrEqual(3);
  });

  it("4 type coherence: the fallback font matches the pairing's heading character", () => {
    const heading = FONT_PAIRINGS[brand.fontPairing!].heading;
    expect(brand.font).toBeDefined();
    if (SERIF_HEADING.test(heading) && !/sans-serif\s*$/i.test(heading)) {
      expect(brand.font).toBe("slab");
    } else {
      expect(brand.font).not.toBe("slab");
    }
  });

  it("5 palette harmony: muted reads as a tint of bg (hue within 30deg unless both are near-neutral)", () => {
    const bg = hsl(palette!["--brand-bg"]!);
    const muted = hsl(palette!["--brand-muted"]!);
    if (bg.s < 0.1 && muted.s < 0.15) return;
    expect(hueGap(bg.h, muted.h)).toBeLessThanOrEqual(30);
  });
});
