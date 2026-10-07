import { describe, expect, it } from "vitest";
import {
  DESIGN_PROFILES,
  paletteOverrideIsContrastSafe,
  pickContrastSafeProfile,
  pickDesign,
  resolveProfileBrand,
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
      expect(paletteOverrideIsContrastSafe(profile.deltas.cssVarOverrides)).toBe(true);
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
      deltas: {
        cssVarOverrides: { "--brand-primary": "#4f6350", "--brand-on-primary": "#faf6ee" } as Partial<PaletteTokens>,
      },
    };
    const badProfile = {
      id: "bad",
      deltas: {
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
        deltas: {
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

// Re-roll guard (skins batch, prerequisite for appending a 6th profile).
// `pickFrom` indexes by `floor(rng() * pool.length)`, so growing the pool
// changes the pick for most leads even when existing entries keep their
// order. Persisting the picked profile id on the lead (and passing it back
// as `designProfileId`) must make the pick immune to pool growth.
describe("pickDesign — persisted designProfileId survives pool growth", () => {
  const extra = {
    id: "test-appended-sixth",
    skin: "classic",
    deltas: { font: "system", fontPairing: "system" },
    heroVariants: ["classic"],
  } as const;
  const grownPool = [...DESIGN_PROFILES, extra];
  const ids = Array.from({ length: 200 }, (_, i) => `ChIJ_reroll_${i}`);

  it("reports the picked profile id so the caller can persist it", () => {
    const pick = pickDesign(lead({ placeId: "ChIJ_report" }));
    expect(DESIGN_PROFILES.map((p) => p.id)).toContain(pick.profileId);
  });

  it("documents the hazard: without a persisted id, growing the pool re-rolls some leads", () => {
    const rerolled = ids.filter(
      (placeId) => pickDesign(lead({ placeId })).profileId !== pickDesign(lead({ placeId }), grownPool).profileId,
    );
    expect(rerolled.length).toBeGreaterThan(0);
  });

  it("with the persisted id, every lead keeps its exact pick after the pool grows", () => {
    for (const placeId of ids) {
      const original = pickDesign(lead({ placeId }));
      const rebuilt = pickDesign(lead({ placeId, designProfileId: original.profileId }), grownPool);
      expect(rebuilt).toEqual(original);
    }
  });

  it("an unknown persisted id (profile retired) falls back to the seeded draw", () => {
    const seeded = pickDesign(lead({ placeId: "ChIJ_retired" }));
    expect(pickDesign(lead({ placeId: "ChIJ_retired", designProfileId: "no-such-profile" }))).toEqual(seeded);
  });

  it("leadToConfig returns designProfileId and honors it on re-generate", () => {
    const row: LeadRow = {
      name: "Pinned Wash",
      slug: "pinned-wash",
      category: "Pressure washing service",
      city: "Spokane",
      region: "WA",
      placeId: "ChIJ_pinned",
    };
    const first = leadToConfig(row);
    expect(first.designProfileId).toBe(pickDesign(row).profileId);
    const again = leadToConfig({ ...row, designProfileId: first.designProfileId });
    expect(again.config).toEqual(first.config);
  });

  it("an explicit artDirection reports no designProfileId (nothing seeded to persist)", () => {
    const result = leadToConfig({
      name: "Art Directed",
      slug: "art-directed",
      category: "Landscaping",
      city: "Boise",
      region: "ID",
      artDirection: "warm-editorial",
    });
    expect(result.designProfileId).toBeUndefined();
  });
});

// Genome unification (skins batch PR 2): profiles are thin {id, skin, deltas}
// wrappers over SKINS. This pins the resolved brand of every pre-existing
// profile so the refactor (and later skin edits) can't silently change a pick.
describe("DESIGN_PROFILES resolve to the same brand bundles as before unification", () => {
  const expected: Record<string, Record<string, string>> = {
    "classic-clean": { font: "system", fontPairing: "system", radius: "md", shadow: "soft", motion: "rich", spacingDensity: "comfortable" },
    // Re-pointed to the crisp-modern skin in PR 4: flat shadows + airy density now.
    "crisp-modern": { font: "geist", fontPairing: "modern", radius: "sm", shadow: "flat", motion: "subtle", spacingDensity: "airy" },
    "industrial-bold": { font: "work-sans", fontPairing: "industrial", radius: "none", shadow: "hard", motion: "subtle", spacingDensity: "compact" },
    "warm-editorial-classic": { font: "slab", fontPairing: "editorial", radius: "lg", shadow: "flat", motion: "subtle", spacingDensity: "comfortable" },
    "warm-editorial-airy": { font: "slab", fontPairing: "editorial", radius: "xl", shadow: "flat", motion: "none", spacingDensity: "airy" },
  };

  it("keeps the first five profiles in their original order", () => {
    expect(DESIGN_PROFILES.slice(0, 5).map((p) => p.id)).toEqual(Object.keys(expected));
  });

  for (const [id, brand] of Object.entries(expected)) {
    it(`${id} resolves to its original dials`, () => {
      const profile = DESIGN_PROFILES.find((p) => p.id === id);
      expect(profile).toBeDefined();
      const resolved = resolveProfileBrand(profile!);
      for (const [k, v] of Object.entries(brand)) expect(resolved[k as keyof typeof resolved]).toBe(v);
    });
  }
});

describe("genome wiring — bold-industrial (skins batch PR 3)", () => {
  it("the industrial-bold profile now draws the bold-industrial skin, banner hero only", () => {
    const profile = DESIGN_PROFILES.find((p) => p.id === "industrial-bold");
    expect(profile?.skin).toBe("bold-industrial");
    expect(profile?.heroVariants).toEqual(["banner"]);
    expect(resolveProfileBrand(profile!).typeScale).toBe("display");
  });
});

describe("genome wiring — crisp-modern (skins batch PR 4)", () => {
  it("the crisp-modern profile draws the crisp-modern skin with its original hero list", () => {
    const profile = DESIGN_PROFILES.find((p) => p.id === "crisp-modern");
    expect(profile?.skin).toBe("crisp-modern");
    expect(profile?.heroVariants).toEqual(["banner", "classic"]);
    expect(resolveProfileBrand(profile!).typeScale).toBe("compact");
  });
});

describe("genome wiring — luxe-dark (skins batch PR 5)", () => {
  it("appends luxe-dark as the sixth profile, after the original five", () => {
    expect(DESIGN_PROFILES.map((p) => p.id)).toEqual([
      "classic-clean",
      "crisp-modern",
      "industrial-bold",
      "warm-editorial-classic",
      "warm-editorial-airy",
      "luxe-dark",
    ]);
    expect(DESIGN_PROFILES[5]?.skin).toBe("luxe-dark");
  });
});
