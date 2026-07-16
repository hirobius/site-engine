import type { FontId, FontPairingId } from "./presets.js";
import type { SectionVariantId } from "./section-variants.js";

/**
 * Design skins (issue #140 mechanism, ADR-0003 §3; first real skin #141).
 *
 * A skin is an override-only preset pinning `layout.sections.<id>.variant`
 * choices + `brand` token defaults — one coherent art direction selected by a
 * single closed-enum config key (`design`). `classic` is the placeholder that
 * reproduces today's defaults exactly, so there is always a byte-identical
 * fallback; `warm-editorial` is skin #1 — a real, curated art direction (see
 * its own doc comment below). Adding a skin here is a design decision (like
 * adding a palette preset), not a config-only edit — keep this set curated.
 *
 * Every field is optional: a skin only needs to pin what its art direction
 * actually cares about. Fields it omits fall through to whatever the config
 * (or the ordinary schema defaults) already say — same "explicit wins, preset
 * fills gaps" contract as `content-packs.ts`.
 */

export const SKIN_IDS = ["classic", "warm-editorial"] as const;
export type SkinId = (typeof SKIN_IDS)[number];

/** Section variant pins a skin can make. Keys mirror `SECTION_VARIANTS`. */
export interface SkinSections {
  hero?: SectionVariantId<"hero">;
  services?: SectionVariantId<"services">;
  gallery?: SectionVariantId<"gallery">;
  reviews?: SectionVariantId<"reviews">;
  serviceAreaMap?: SectionVariantId<"serviceAreaMap">;
  contact?: SectionVariantId<"contact">;
}

/**
 * Brand token defaults a skin can pin — every `BrandSchema` field that has an
 * ordinary Zod default (i.e. every field a config can omit). `palettePreset`
 * is deliberately excluded: it's `BrandSchema`'s one required field (the
 * trade palette is picked per client, not per skin) and stays a config-only
 * choice, same axis as `contentPack`. `cssVarOverrides` lets a future skin
 * pin the "palette family" ADR-0003 point 1 calls for beyond the four
 * trade presets; `font`/`fontPairing` pin a heading↔body font pairing
 * (typeface only). Correction (#141 review): that is NOT the "type scale"
 * axis ADR-0003 point 1 also names — a type scale is font sizes /
 * line-heights / a modular scale, and the schema has no mechanism for that
 * yet (issue #86, deferred). Until #86 lands, a skin can only pin typeface;
 * "type scale" stays an open follow-up, not something `font`/`fontPairing`
 * should be read as covering.
 */
export interface SkinBrand {
  font?: FontId;
  fontPairing?: FontPairingId;
  cssVarOverrides?: Record<string, string>;
  radius?: "none" | "sm" | "md" | "lg" | "xl";
  shadow?: "flat" | "soft" | "hard";
  motion?: "none" | "subtle" | "rich";
}

export interface Skin {
  sections: SkinSections;
  brand: SkinBrand;
}

export const SKINS: Record<SkinId, Skin> = {
  /**
   * Reproduces `packages/schema`'s ordinary defaults verbatim (the first
   * value of every `SECTION_VARIANTS` tuple + `BrandSchema`'s `.default()`s)
   * so picking `design: "classic"` — or omitting `design` entirely — renders
   * byte-identical.
   */
  classic: {
    sections: {
      hero: "classic",
      services: "grid",
      gallery: "grid",
      reviews: "cards",
      serviceAreaMap: "standard",
      contact: "standard",
    },
    brand: {
      radius: "md",
      shadow: "soft",
      motion: "rich",
    },
  },

  /**
   * Skin #1 (issue #141, ADR-0003 §5's named candidate): ports the validated
   * "warm-editorial" art direction from the realtor preview kit (#23 — Fraunces
   * + Inter, cream + sage, editorial hero) into the factory using ONLY the
   * config surface #140 shipped. No new section components: `split-card`
   * ("content column + elevated photo card", `hero/split-card.astro`) is the
   * closest existing hero vocabulary to #23's editorial hero — a true
   * magazine-style asymmetric hero (pull-quote rail, masthead byline) isn't in
   * `SECTION_VARIANTS` yet, so it's a follow-up (harvest it only once a skin
   * actually needs it, per `docs/HARVESTING.md`), not something to invent here.
   * The other sections have exactly one variant each today, so pinning them
   * is a no-op vs. the schema default — done anyway, same as `classic`, so
   * the skin stays self-documenting and forward-safe if a second variant
   * lands for one of them later.
   *
   * `cssVarOverrides` is a bespoke cream + sage palette (not one of the four
   * trade `PALETTE_PRESETS` — this is the "palette family beyond the four
   * trade presets" ADR-0003 §3 calls `cssVarOverrides` out for). Contrast
   * verified AA on every pair the template actually renders text on
   * (`checkClientAcceptance` / `contrastRatio`, see `acceptance.test.ts`):
   * primary/on-primary 6.03:1, fg/bg 14.20:1, fg/muted 11.93:1. `--brand-accent`
   * isn't one of `CONTRAST_TOKEN_PAIRS` (the template never renders body text
   * directly on it today), but was still hand-verified AA against both
   * surfaces it could plausibly sit on — accent/bg 5.52:1, accent/muted
   * 4.64:1 — so a future accent-text usage doesn't inherit a silent failure.
   *
   * `shadow: "flat"` (borders carry depth, no glossy drop shadows) and
   * `motion: "subtle"` (reveal-on-enter, no per-card stagger/pulse) read as
   * restrained print-editorial rather than the factory's default expressive
   * feel; `radius: "lg"` keeps corners soft/inviting instead of sharp, which
   * a cream + sage palette wants.
   *
   * `fontPairing: "editorial"` covers #23's Fraunces + Inter ask exactly (it
   * already existed from issue #155 — no new font work needed here).
   * `font: "slab"` is only the nominal single-stack fallback `og-image.ts`
   * reads when it can't render `fontPairing`'s two stacks (the closest
   * built-in serif to Fraunces) — neither field is a **type scale** (font
   * sizes / line-heights / a modular scale). The schema has no type-scale
   * mechanism yet; that's issue #86, deferred, and out of scope here. ADR-0003
   * §1's "type scale" axis for this skin is a follow-up, not delivered by
   * this PR — flagging it plainly rather than letting `fontPairing` stand in
   * for it.
   */
  "warm-editorial": {
    sections: {
      hero: "split-card",
      services: "grid",
      gallery: "grid",
      reviews: "cards",
      serviceAreaMap: "standard",
      contact: "standard",
    },
    brand: {
      font: "slab",
      fontPairing: "editorial",
      cssVarOverrides: {
        "--brand-primary": "#4f6350",
        "--brand-accent": "#9a4f2c",
        "--brand-bg": "#faf6ee",
        "--brand-fg": "#2a2420",
        "--brand-muted": "#ede2ce",
        "--brand-on-primary": "#faf6ee",
      },
      radius: "lg",
      shadow: "flat",
      motion: "subtle",
    },
  },
};
