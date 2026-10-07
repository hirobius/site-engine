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

export const SKIN_IDS = ["classic", "warm-editorial", "bold-industrial", "crisp-modern", "luxe-dark"] as const;
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
 * choice, same axis as `contentPack`. `cssVarOverrides` pins a palette family
 * beyond the four trade presets (ADR-0003 point 1); a config that sets its own
 * `cssVarOverrides` is merged over the skin's one var at a time, so tweaking
 * one var never discards the skin's AA-vetted palette. `font`/`fontPairing`
 * pin the typeface; `typeScale` (issue #86) pins the heading sizes, weight and
 * tracking; `spacingDensity` pins section vertical rhythm.
 */
export interface SkinBrand {
  font?: FontId;
  fontPairing?: FontPairingId;
  cssVarOverrides?: Record<string, string>;
  radius?: "none" | "sm" | "md" | "lg" | "xl";
  shadow?: "flat" | "soft" | "hard";
  motion?: "none" | "subtle" | "rich";
  spacingDensity?: "compact" | "comfortable" | "airy";
  typeScale?: "standard" | "compact" | "display";
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
      spacingDensity: "comfortable",
      typeScale: "standard",
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
      spacingDensity: "comfortable",
    },
  },

  /**
   * Skin #2 (skins batch PR 3): bold-industrial — loud, utilitarian, built for
   * trades that sell toughness (concrete, demolition, junk removal, fencing).
   * Charcoal + safety-amber: the CTA is a charcoal block with amber type,
   * like site signage, and amber stars/accents; page surfaces are a warm
   * concrete-grey. `banner` hero (big centered headline on the muted
   * surface — the `display` type scale's natural stage) and `alternating`
   * services (wide image/text rows read as a portfolio of jobs, not a menu).
   *
   * Dials: Archivo `industrial` pairing (`work-sans` as the sans og-image
   * fallback), `radius: "none"` and `shadow: "hard"` for hard edges and
   * solid offset shadows, `typeScale: "display"` (bigger/tighter/800),
   * `spacingDensity: "compact"`, `motion: "subtle"` (reveal, no stagger —
   * the type does the shouting).
   *
   * Contrast (all six keys pinned so no trade preset mixes in), every pair
   * the template renders text on: primary/on-primary 8.96:1, fg/bg 15.42:1,
   * fg/muted 13.20:1, primary-as-text/bg 14.60:1, primary-as-text/muted
   * 12.51:1, accent/bg 4.63:1, accent/muted 3.96:1. Primary is charcoal, so
   * a CTA on the inverted classic hero (fg surface) would vanish — the skin
   * pins `banner` and its genome profile draws `banner` only.
   */
  "bold-industrial": {
    sections: {
      hero: "banner",
      services: "alternating",
      gallery: "grid",
      reviews: "cards",
      serviceAreaMap: "standard",
      contact: "standard",
    },
    brand: {
      font: "work-sans",
      fontPairing: "industrial",
      cssVarOverrides: {
        "--brand-primary": "#1f1f1f",
        "--brand-accent": "#a35a00",
        "--brand-bg": "#f3f1ec",
        "--brand-fg": "#1a1a1a",
        "--brand-muted": "#e4e0d6",
        "--brand-on-primary": "#f5b400",
      },
      radius: "none",
      shadow: "hard",
      motion: "subtle",
      spacingDensity: "compact",
      typeScale: "display",
    },
  },

  /**
   * Skin #3 (skins batch PR 4): crisp-modern — calm, precise, near-white with
   * ink type and one confident blue. For trades that sell reliability and
   * tidiness (cleaning, HVAC, pool, lawn care). `classic` hero (photo under
   * an ink overlay) and `cards` services; Space Grotesk `modern` pairing
   * (`geist` as the sans og-image fallback). Restraint does the work:
   * `shadow: "flat"` (borders, no glow), `radius: "sm"`, `motion: "subtle"`,
   * `typeScale: "compact"` (smaller, calmer headings) and
   * `spacingDensity: "airy"` (generous section rhythm).
   *
   * Contrast (all six keys pinned): primary/on-primary 6.18:1, fg/bg 18.64:1,
   * fg/muted 17.03:1, primary-as-text/bg 6.02:1, primary-as-text/muted
   * 5.50:1, accent/bg 8.49:1, accent/muted 7.76:1, and primary vs the ink fg
   * 3.10:1 so the CTA still reads on the classic hero's ink overlay. That
   * last pair is why fg is near-black ink (#0b0f19) rather than slate: the
   * blue can't be both dark enough for a 6:1 CTA and light enough to stand
   * off a slate surface.
   */
  "crisp-modern": {
    sections: {
      hero: "classic",
      services: "cards",
      gallery: "grid",
      reviews: "cards",
      serviceAreaMap: "standard",
      contact: "standard",
    },
    brand: {
      font: "geist",
      fontPairing: "modern",
      cssVarOverrides: {
        "--brand-primary": "#1a56db",
        "--brand-accent": "#1e40af",
        "--brand-bg": "#fbfcfd",
        "--brand-fg": "#0b0f19",
        "--brand-muted": "#eef2f7",
        "--brand-on-primary": "#ffffff",
      },
      radius: "sm",
      shadow: "flat",
      motion: "subtle",
      spacingDensity: "airy",
      typeScale: "compact",
    },
  },

  /**
   * Skin #4 (skins batch PR 5): luxe-dark — the factory's first dark skin.
   * Near-black page, warm-white type, raised-charcoal surfaces and a single
   * gold accent; for premium/appearance trades (detailing, salons and lash
   * studios, custom builders, high-end landscaping). `split-card` hero (copy
   * column + elevated photo card) and `masonry` reviews (testimonials as a
   * collage, not a row of equal boxes). New `luxe` pairing: Playfair Display
   * headings over Inter (`slab` as the serif og-image fallback), at the
   * `display` type scale; `radius: "sm"`, `shadow: "soft"`,
   * `motion: "subtle"`, `spacingDensity: "airy"`.
   *
   * Contrast (all six keys pinned): primary/on-primary 7.84:1, fg/bg
   * 16.19:1, fg/muted 14.24:1, primary-as-text/bg 7.86:1,
   * primary-as-text/muted 6.92:1, accent/bg 9.64:1, accent/muted 8.49:1.
   * Inverted `bg-fg` sections render near-black on warm-white (16.19:1).
   *
   * Dark-surface caveat: the shared shadow color is a dark slate, so the
   * `soft` shadows barely register on a near-black page — depth here comes
   * from the raised-charcoal `muted` surface and the `border-fg/10` card
   * borders, which is the intended look. Dark-tuned shadow tiers are part of
   * the #86 dial-value design pass, not this skin.
   */
  "luxe-dark": {
    sections: {
      hero: "split-card",
      services: "grid",
      gallery: "grid",
      reviews: "masonry",
      serviceAreaMap: "standard",
      contact: "standard",
    },
    brand: {
      font: "slab",
      fontPairing: "luxe",
      cssVarOverrides: {
        "--brand-primary": "#c9a24a",
        "--brand-accent": "#d8b56a",
        "--brand-bg": "#121110",
        "--brand-fg": "#f3ede2",
        "--brand-muted": "#211e1a",
        "--brand-on-primary": "#14110d",
      },
      radius: "sm",
      shadow: "soft",
      motion: "subtle",
      spacingDensity: "airy",
      typeScale: "display",
    },
  },
};
