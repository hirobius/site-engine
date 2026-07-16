import type { FontId, FontPairingId } from "./presets.js";
import type { SectionVariantId } from "./section-variants.js";

/**
 * Design skins (issue #140, ADR-0003 §3).
 *
 * A skin is an override-only preset pinning `layout.sections.<id>.variant`
 * choices + `brand` token defaults — one coherent art direction selected by a
 * single closed-enum config key (`design`). Mechanism only: this ships one
 * placeholder skin (`classic`) that reproduces today's defaults exactly, so
 * there is a working enum value + test to build real skins against (starting
 * with warm-editorial, #141). Adding a skin here is a design decision (like
 * adding a palette preset), not a config-only edit — keep this set curated.
 *
 * Every field is optional: a skin only needs to pin what its art direction
 * actually cares about. Fields it omits fall through to whatever the config
 * (or the ordinary schema defaults) already say — same "explicit wins, preset
 * fills gaps" contract as `content-packs.ts`.
 */

export const SKIN_IDS = ["classic"] as const;
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
 * trade presets; `font`/`fontPairing` cover its "type scale" axis.
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
};
