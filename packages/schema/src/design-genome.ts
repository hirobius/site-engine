import type { FontId, FontPairingId } from "./presets.js";
import type { PaletteTokens } from "./presets.js";
import { SKINS, type SkinId } from "./skins.js";
import type { SectionVariantId } from "./section-variants.js";

/**
 * The seeded per-lead design selector (issue #148, part of #128's visual
 * variety epic).
 *
 * `leadToConfig` (`lead-to-config.ts`) used to emit a flat, no-op design for
 * every lead — `design: "classic"`, `font: "system"`, `radius: "md"`, hero
 * `"classic"` — so two same-trade leads rendered identical sites. The pieces
 * to fix that (skins, section variants, font pairings, brand dials) were all
 * built and unused. `pickDesign` is the missing keystone: a **pure,
 * deterministic** function, seeded on a stable lead id, that assigns a
 * coherent bundle of those pieces per lead — reproducible (same lead forever
 * renders the same look, no surprise redesigns on a re-generate) but varied
 * across the fleet.
 *
 * ## Curated pools, not free random
 *
 * `DESIGN_PROFILES` below is a small, hand-authored set of *coherent bundles*
 * — skin + font pairing + radius + shadow + motion + spacing density, plus a
 * short list of hero variants that read as intentional with that bundle
 * (e.g. the `warm-editorial` skin's own vetted cream+sage palette pairs with
 * the `editorial`/`slab` type, restrained `flat` shadows, and the
 * `split-card`/`banner` heroes — not with `industrial`'s Archivo or a bare
 * `classic` hero). This is the "font vibe ↔ skin" constraint the issue calls
 * for: two independent axes (`pickFrom(rng, ALL_FONTS)` +
 * `pickFrom(rng, ALL_SKINS)`) would happily draw an incoherent combo; picking
 * a *profile* first can't.
 *
 * `palettePreset` itself is deliberately **not** an axis here — it stays
 * trade-driven exactly as today (`leadToConfig`'s `mapCategoryToTrade`). A
 * skin can still carry its own bespoke `cssVarOverrides` bundle (only
 * `warm-editorial` does today) that displaces the trade palette for sites
 * that land on it — that's the existing, already-contrast-vetted skin
 * mechanism (`skins.ts`), not a new palette pool this module invents.
 *
 * `"video"` is deliberately excluded from every profile's hero-variant pool:
 * it renders an empty dark hero without `hero.videoSrc`
 * (`packages/template/src/acceptance.ts`'s `empty-video-hero` check), and no
 * lead row carries a video asset — picking it here would fail the
 * build-time acceptance gate on every generated site.
 *
 * ## Contrast safety
 *
 * A profile may in the future pin its own `cssVarOverrides` (beyond what its
 * skin already contributes). `pickContrastSafeProfile` pre-filters the pool
 * to entries whose *own* override bundle passes `paletteOverrideIsContrastSafe`
 * before drawing — a candidate that fails is never returned, i.e. "rejected
 * and re-rolled" without needing a retry loop. This is defense-in-depth, not
 * the only gate: `packages/template/src/acceptance.ts`'s
 * `checkClientAcceptance` (issue #145) is the real build-time backstop that
 * sees the fully-resolved palette (trade preset + every override layered on
 * top) and fails the build outright.
 *
 * `packages/schema` cannot import `packages/template/src/lib/contrast.ts`
 * directly — `template` depends on `schema`, not the other way around, so
 * that import would be circular. `relativeLuminance`/`contrastRatio`/
 * `meetsAAContrast` below are a deliberate, tiny, dependency-free duplicate
 * of that module's pure WCAG math (this is the "schema's equivalent" the
 * issue allows for) — if the formula ever changes, update both.
 */

// ---------------------------------------------------------------------------
// WCAG contrast math (duplicated from packages/template/src/lib/contrast.ts —
// see the doc comment above for why this can't just import it).
// ---------------------------------------------------------------------------

/** WCAG AA threshold for normal-size text (18px and under bold). */
export const WCAG_AA_NORMAL_TEXT = 4.5;

function expandHex(hex: string): string {
  const stripped = hex.replace("#", "");
  return stripped.length === 3
    ? stripped
        .split("")
        .map((c) => c + c)
        .join("")
    : stripped;
}

function channelLuminance(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a hex color (`#rgb` or `#rrggbb`), 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const full = expandHex(hex);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** WCAG contrast ratio between two hex colors, from 1 (no contrast) to 21. */
export function contrastRatio(a: string, b: string): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when a hex pair meets WCAG AA for normal-size text (>= 4.5:1). */
export function meetsAAContrast(a: string, b: string): boolean {
  return contrastRatio(a, b) >= WCAG_AA_NORMAL_TEXT;
}

/**
 * Token pairs the template actually renders text on top of — mirrors
 * `packages/template/src/acceptance.ts`'s `CONTRAST_TOKEN_PAIRS`. Keep the two
 * in sync if a component introduces a new surface/text pairing.
 */
const CONTRAST_TOKEN_PAIRS: Array<[keyof PaletteTokens, keyof PaletteTokens]> = [
  ["--brand-primary", "--brand-on-primary"],
  ["--brand-fg", "--brand-bg"],
  ["--brand-fg", "--brand-muted"],
];

/**
 * A candidate `cssVarOverrides` bundle is contrast-safe when every pair in
 * `CONTRAST_TOKEN_PAIRS` it *fully* specifies meets AA. A pair where the
 * bundle only sets one side (or neither) is skipped here — this module has
 * no visibility into the trade palette that would fill the other side, so it
 * can't judge that pair in isolation; `checkClientAcceptance` sees the fully
 * resolved palette and is the real backstop for that case.
 */
export function paletteOverrideIsContrastSafe(overrides: Partial<PaletteTokens> | undefined): boolean {
  if (!overrides) return true;
  return CONTRAST_TOKEN_PAIRS.every(([a, b]) => {
    const colorA = overrides[a];
    const colorB = overrides[b];
    if (!colorA || !colorB) return true;
    return meetsAAContrast(colorA, colorB);
  });
}

// ---------------------------------------------------------------------------
// Seeded PRNG: xmur3 hash -> mulberry32 generator.
// ---------------------------------------------------------------------------

/**
 * xmur3 string hash — turns an arbitrary string into a 32-bit seed function.
 * Calling the returned function advances and returns a new hashed value each
 * time (used once here to derive `mulberry32`'s seed).
 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next(): number {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 PRNG — fast, small, good-enough-for-this deterministic generator. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a deterministic `[0, 1)` generator from an arbitrary seed string. */
export function seededRng(seed: string): () => number {
  const hash = xmur3(seed);
  return mulberry32(hash());
}

function pickFrom<T>(rng: () => number, pool: readonly T[]): T {
  if (pool.length === 0) {
    throw new Error("pickFrom: pool is empty");
  }
  const index = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
  // Safe: index is clamped to [0, pool.length - 1] and pool is non-empty.
  return pool[index] as T;
}

// ---------------------------------------------------------------------------
// Lead identity
// ---------------------------------------------------------------------------

/** The minimum a lead needs to carry for a stable, reproducible design seed. */
export interface DesignSeedLead {
  placeId?: string | null;
  slug?: string | null;
  name: string;
  city: string;
  /**
   * The `DesignProfile.id` this lead was first assigned, persisted on the lead
   * row and passed back on every rebuild. When it names a profile still in the
   * pool, it wins over the seeded draw — so growing `DESIGN_PROFILES` never
   * re-rolls a lead that already has a design. Absent/unknown → seeded draw.
   */
  designProfileId?: string | null;
}

/**
 * Stable id to seed the design PRNG on: `place_id` when the lead has one
 * (the Google Places id — stable across re-pulls of the same business),
 * falling back to `slug`, falling back to `name-city`. Never the row's
 * primary key or any other value that could change between a lead's first
 * pull and a later re-generate — that would make the "same lead forever
 * renders the same look" guarantee false.
 */
export function stableLeadId(lead: DesignSeedLead): string {
  return lead.placeId ?? lead.slug ?? `${lead.name}-${lead.city}`;
}

// ---------------------------------------------------------------------------
// Curated design profiles
// ---------------------------------------------------------------------------

/** Brand dials a profile pins — same fields `leadToConfig` layers into `brand`. */
export interface DesignProfileBrand {
  font: FontId;
  fontPairing: FontPairingId;
  radius: "none" | "sm" | "md" | "lg" | "xl";
  shadow: "flat" | "soft" | "hard";
  motion: "none" | "subtle" | "rich";
  spacingDensity: "compact" | "comfortable" | "airy";
  /** Only present when the profile's skin (or deltas) pins it. */
  typeScale?: "standard" | "compact" | "display";
  /**
   * Optional bespoke palette bundle a profile pins directly (beyond whatever
   * its `skin` already contributes). None of the shipped profiles below set
   * this — the two shipped skins already cover the palette axis — but the
   * field exists so a future profile can, and `pickContrastSafeProfile`
   * guards it the same way regardless.
   */
  cssVarOverrides?: Partial<PaletteTokens>;
}

export interface DesignProfile {
  id: string;
  /** The canonical bundle (`SKINS`) this profile starts from. */
  skin: SkinId;
  /**
   * What this profile changes on top of its skin's brand pins. A profile is a
   * thin variation of a skin, not a second registry of full bundles — the
   * skin owns the art direction; `resolveProfileBrand` layers these on top.
   */
  deltas: Partial<DesignProfileBrand>;
  /** Hero variants that read as intentional with this profile's skin/type. */
  heroVariants: readonly SectionVariantId<"hero">[];
}

/**
 * The curated pool. Each entry is a skin plus a few hand-picked deltas — see
 * the module doc comment for why this is profiles-first rather than
 * independent per-axis draws. Keep this set curated (same posture as
 * `SKINS`/`PALETTE_PRESETS`): adding an entry is a design decision.
 *
 * ORDER IS LOAD-BEARING: append only. A lead without a persisted
 * `designProfileId` is drawn by position, so reordering re-rolls it — and
 * even appending re-rolls such leads (see `pickDesign`).
 */
export const DESIGN_PROFILES: readonly DesignProfile[] = [
  {
    id: "classic-clean",
    skin: "classic",
    deltas: { font: "system", fontPairing: "system" },
    heroVariants: ["classic", "banner"],
  },
  {
    id: "crisp-modern",
    skin: "classic",
    deltas: {
      font: "geist",
      fontPairing: "modern",
      radius: "sm",
      shadow: "hard",
      motion: "subtle",
      spacingDensity: "compact",
    },
    heroVariants: ["banner", "classic"],
  },
  {
    id: "industrial-bold",
    // Banner only: the skin's charcoal primary would vanish as a CTA on the
    // classic hero's inverted fg surface (see SKINS["bold-industrial"]).
    skin: "bold-industrial",
    deltas: {},
    heroVariants: ["banner"],
  },
  {
    id: "warm-editorial-classic",
    skin: "warm-editorial",
    deltas: {},
    heroVariants: ["split-card", "banner"],
  },
  {
    id: "warm-editorial-airy",
    skin: "warm-editorial",
    deltas: { radius: "xl", motion: "none", spacingDensity: "airy" },
    heroVariants: ["split-card"],
  },
] as const;

/**
 * A profile's full brand dials: its skin's pins with the profile's deltas on
 * top. The skin's `cssVarOverrides` is left out — `defineClient` applies the
 * skin's palette itself via `design` — so only a profile's own override
 * bundle travels with the pick. Throws if the pair leaves a required dial
 * unset (a curated-pool authoring error, caught by the genome tests).
 */
export function resolveProfileBrand(profile: Pick<DesignProfile, "id" | "skin" | "deltas">): DesignProfileBrand {
  const { cssVarOverrides: _skinPalette, ...skinBrand } = SKINS[profile.skin].brand;
  const merged = { ...skinBrand, ...profile.deltas };
  for (const key of ["font", "fontPairing", "radius", "shadow", "motion", "spacingDensity"] as const) {
    if (merged[key] === undefined) {
      throw new Error(`Design profile "${profile.id}" leaves brand.${key} unset — pin it on the skin or in deltas`);
    }
  }
  return merged as DesignProfileBrand;
}

/**
 * Draw a profile from `pool`, guaranteed never to return one whose own
 * `cssVarOverrides` fails `paletteOverrideIsContrastSafe` — pre-filtering
 * (rather than pick-check-retry) means this is a single deterministic draw,
 * no loop, and can never return a rejected candidate. Falls back to the full
 * pool only if every entry is unsafe (should never happen for a curated
 * pool — that would mean the pool itself needs fixing, not the draw).
 * Exported so the reroll behavior itself can be unit-tested with an
 * injected pool, independent of `DESIGN_PROFILES`'s real (already-safe)
 * contents.
 */
export function pickContrastSafeProfile<T extends { deltas: { cssVarOverrides?: Partial<PaletteTokens> } }>(
  rng: () => number,
  pool: readonly T[],
): T {
  const safePool = pool.filter((profile) => paletteOverrideIsContrastSafe(profile.deltas.cssVarOverrides));
  return pickFrom(rng, safePool.length > 0 ? safePool : pool);
}

// ---------------------------------------------------------------------------
// pickDesign
// ---------------------------------------------------------------------------

export interface DesignPick {
  /** The picked `DesignProfile.id` — persist it on the lead as `designProfileId`. */
  profileId: string;
  design: SkinId;
  brand: Omit<DesignProfileBrand, "cssVarOverrides"> & { cssVarOverrides?: Partial<PaletteTokens> };
  layout: {
    sections: {
      hero: { variant: SectionVariantId<"hero"> };
    };
  };
}

/**
 * Pure, deterministic per-lead design pick (issue #148). Same lead id ->
 * identical output, every run, forever. Draws a coherent profile from
 * `DESIGN_PROFILES` (contrast-guarded) then an on-brand hero variant from
 * that profile's own short list — two draws off one seeded generator, so the
 * result is fully determined by `stableLeadId(lead)`.
 *
 * Pool growth: the profile draw indexes by `floor(rng() * pool.length)`, so
 * appending a profile re-rolls most leads even with existing entries kept in
 * order. A persisted `lead.designProfileId` pins the profile instead. The
 * profile draw is still consumed, so the hero draw sees the same second
 * value and lands on the same variant. `pool` is injectable for tests.
 */
export function pickDesign(lead: DesignSeedLead, pool: readonly DesignProfile[] = DESIGN_PROFILES): DesignPick {
  const rng = seededRng(stableLeadId(lead));
  const drawn = pickContrastSafeProfile(rng, pool);
  const pinned = lead.designProfileId ? pool.find((p) => p.id === lead.designProfileId) : undefined;
  const profile = pinned ?? drawn;
  const heroVariant = pickFrom(rng, profile.heroVariants);
  return {
    profileId: profile.id,
    design: profile.skin,
    brand: resolveProfileBrand(profile),
    layout: { sections: { hero: { variant: heroVariant } } },
  };
}
