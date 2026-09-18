import { describe, expect, it } from "vitest";
import {
  DESIGN_PROFILES,
  paletteOverrideIsContrastSafe,
  pickContrastSafeProfile,
  pickDesign,
  seededRng,
  stableLeadId,
  type DesignSeedLead,
} from "./design-genome.js";
import { defineClient } from "./index.js";
import { leadToConfig, type LeadRow } from "./lead-to-config.js";
import { SKIN_IDS } from "./skins.js";
import type { PaletteTokens } from "./presets.js";

function lead(overrides: Partial<DesignSeedLead> = {}): DesignSeedLead {
  return { name: "Franchise Suds", city: "Seattle", ...overrides };
}

describe("stableLeadId", () => {
  it("prefers placeId over slug and name-city", () => {
    expect(stableLeadId({ placeId: "ChIJ123", slug: "franchise-suds", name: "Franchise Suds", city: "Seattle" })).toBe(
      "ChIJ123",
    );
  });

  it("falls back to slug when placeId is absent/null", () => {
    expect(stableLeadId({ placeId: null, slug: "franchise-suds", name: "Franchise Suds", city: "Seattle" })).toBe(
      "franchise-suds",
    );
  });

  it("falls back to name-city when neither placeId nor slug is set", () => {
    expect(stableLeadId({ name: "Franchise Suds", city: "Seattle" })).toBe("Franchise Suds-Seattle");
  });
});

describe("pickDesign — determinism", () => {
  it("returns byte-identical output for the same lead id, every call", () => {
    const first = pickDesign(lead({ placeId: "ChIJ_stable_1" }));
    const second = pickDesign(lead({ placeId: "ChIJ_stable_1" }));
    const third = pickDesign(lead({ placeId: "ChIJ_stable_1" }));
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("keys off placeId, not off name/city, once placeId is set", () => {
    const a = pickDesign({ placeId: "ChIJ_fixed", name: "Business A", city: "Spokane" });
    const b = pickDesign({ placeId: "ChIJ_fixed", name: "Business B", city: "Tacoma" });
    expect(b).toEqual(a);
  });

  it("a different lead id can (and generally does) produce a different pick", () => {
    const a = pickDesign(lead({ placeId: "ChIJ_alpha" }));
    const b = pickDesign(lead({ placeId: "ChIJ_zeta" }));
    // Not a hard guarantee for any two arbitrary ids (pools are finite), but
    // true for this pair — documents that identity, not chance, drives it.
    expect(b).not.toEqual(a);
  });
});

describe("pickDesign — spread", () => {
  const picks = Array.from({ length: 60 }, (_, i) => pickDesign(lead({ placeId: `ChIJ_synthetic_${i}` })));

  it("visits every shipped skin across many leads", () => {
    const skinsSeen = new Set(picks.map((p) => p.design));
    for (const id of SKIN_IDS) {
      expect(skinsSeen.has(id)).toBe(true);
    }
  });

  it("visits multiple font pairings, not one dominant value", () => {
    const pairingsSeen = new Set(picks.map((p) => p.brand.fontPairing));
    expect(pairingsSeen.size).toBeGreaterThanOrEqual(3);
  });

  it("visits multiple hero variants", () => {
    const heroesSeen = new Set(picks.map((p) => p.layout.sections.hero.variant));
    expect(heroesSeen.size).toBeGreaterThanOrEqual(2);
  });

  it("visits multiple radius/shadow/motion values (brand dials aren't frozen)", () => {
    expect(new Set(picks.map((p) => p.brand.radius)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(picks.map((p) => p.brand.shadow)).size).toBeGreaterThanOrEqual(2);
    expect(new Set(picks.map((p) => p.brand.motion)).size).toBeGreaterThanOrEqual(2);
  });

  it("produces a good spread of distinct overall combos across many leads", () => {
    const signatures = new Set(picks.map((p) => JSON.stringify(p)));
    expect(signatures.size).toBeGreaterThanOrEqual(5);
  });

  it("never picks the video hero (no lead row carries a video asset)", () => {
    for (const p of picks) {
      expect(p.layout.sections.hero.variant).not.toBe("video");
    }
  });
});

describe("contrast safety", () => {
  it("meets AA on every shipped DESIGN_PROFILES override (none set one today, so vacuously true)", () => {
    for (const profile of DESIGN_PROFILES) {
      expect(paletteOverrideIsContrastSafe(profile.brand.cssVarOverrides)).toBe(true);
    }
  });

  it("flags a known low-contrast pair (issue #79's junk-removal near-black-on-near-black, ~1.07:1)", () => {
    // Same shape as issue #79's real bug (--brand-on-primary #0d0d0d against
    // --brand-fg #161616, ~1.07:1) applied to the primary/on-primary pair
    // this checker actually validates.
    const bad: Partial<PaletteTokens> = {
      "--brand-primary": "#161616",
      "--brand-on-primary": "#0d0d0d",
    };
    expect(paletteOverrideIsContrastSafe(bad)).toBe(false);
  });

  it("doesn't judge a pair the override only partially specifies (no visibility into the trade base)", () => {
    const partial: Partial<PaletteTokens> = {
      "--brand-on-primary": "#0d0d0d",
      "--brand-fg": "#161616",
    };
    // fg/on-primary isn't one of CONTRAST_TOKEN_PAIRS, and neither checked
    // pair (primary/on-primary, fg/bg, fg/muted) is fully specified here —
    // deferred to checkClientAcceptance, which sees the resolved palette.
    expect(paletteOverrideIsContrastSafe(partial)).toBe(true);
  });

  it("passes a real, vetted bundle (warm-editorial's own cream+sage palette)", () => {
    const good: Partial<PaletteTokens> = {
      "--brand-primary": "#4f6350",
      "--brand-bg": "#faf6ee",
      "--brand-fg": "#2a2420",
      "--brand-muted": "#ede2ce",
      "--brand-on-primary": "#faf6ee",
    };
    expect(paletteOverrideIsContrastSafe(good)).toBe(true);
  });

  it("pickContrastSafeProfile never returns a profile whose override fails AA, across many seeds", () => {
    const goodProfile = {
      id: "good",
      brand: {
        cssVarOverrides: { "--brand-primary": "#4f6350", "--brand-on-primary": "#faf6ee" } as Partial<PaletteTokens>,
      },
    };
    const badProfile = {
      id: "bad",
      brand: {
        cssVarOverrides: { "--brand-primary": "#161616", "--brand-on-primary": "#0d0d0d" } as Partial<PaletteTokens>,
      },
    };
    const pool = [goodProfile, badProfile];

    for (let i = 0; i < 100; i++) {
      const rng = seededRng(`seed-${i}`);
      const picked = pickContrastSafeProfile(rng, pool);
      expect(picked.id).not.toBe("bad");
    }
  });

  it("pickContrastSafeProfile falls back to the full pool if every entry is unsafe (never throws)", () => {
    const onlyBad = [
      {
        id: "bad",
        brand: {
          cssVarOverrides: { "--brand-primary": "#161616", "--brand-on-primary": "#0d0d0d" } as Partial<PaletteTokens>,
        },
      },
    ];
    const rng = seededRng("whatever");
    expect(() => pickContrastSafeProfile(rng, onlyBad)).not.toThrow();
    expect(pickContrastSafeProfile(rng, onlyBad).id).toBe("bad");
  });
});

describe("pickDesign output validates end to end", () => {
  const FRANCHISE_SUDS: LeadRow = {
    name: "Franchise Suds of Seattle",
    slug: "franchise-suds-of-seattle",
    category: "Pressure washing service",
    city: "Seattle",
    region: "WA",
  };

  it("every synthetic lead's leadToConfig output validates through defineClient()", () => {
    for (let i = 0; i < 20; i++) {
      const row: LeadRow = { ...FRANCHISE_SUDS, placeId: `ChIJ_e2e_${i}`, slug: `lead-${i}` };
      const { config } = leadToConfig(row);
      expect(() => defineClient(config)).not.toThrow();
      expect(config.brand.palettePreset).toBe("pressure-washing");
    }
  });

  it("matches pickDesign(lead)'s pick exactly for a config with no explicit artDirection", () => {
    const row: LeadRow = { ...FRANCHISE_SUDS, placeId: "ChIJ_match_check" };
    const picked = pickDesign(row);
    const { config } = leadToConfig(row);
    expect(config.layout.sections.hero.variant).toBe(picked.layout.sections.hero.variant);
    expect(config.brand.fontPairing).toBe(picked.brand.fontPairing);
    expect(config.brand.radius).toBe(picked.brand.radius);
  });
});
