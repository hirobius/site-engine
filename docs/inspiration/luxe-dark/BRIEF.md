# Inspiration brief — Luxe dark

Filled from the polish + skins batch plan (Adrian's direction, 2026-10-07),
not from dropped references: the plan's three-skin table is this brief's
source. Feeds `docs/AUTHORING-SKINS.md`; the resulting entry is
`SKINS["luxe-dark"]` in `packages/schema/src/skins.ts`.

## 0. Direction name & slug

- **Direction name**: Luxe dark
- **Folder slug**: `luxe-dark`

## 1. Reference links

| URL | What to look at (hero / palette / type / whole page) | Notes |
| --- | --- | --- |
| (none) — the reference is the polish + skins batch plan (2026-10-07), its skins table row for `luxe-dark` | whole direction | No external sites were named; nothing was captured. |

## 2. Dropped assets

| File (`assets/…`) | Type (image / video) | What it shows |
| --- | --- | --- |
| (none) | — | — |

## 3. Target vibe

- **Adjectives**: premium, dark, quiet, elegant, confident
- **One-sentence description**: a visitor should feel they've walked into a
  high-end studio — dark, calm, one touch of gold.
- **Explicitly NOT this**: nightclub-loud or neon; no busy motion.

## 4. Palette leanings

- **Warm / cool / neutral:** warm
- **Light / dark base:** dark (the factory's first dark skin)
- **Any specific colors the references keep repeating**: near-black
  background, warm-white text, raised-charcoal muted surfaces, gold primary
- **Existing trade preset this is closest to, if any**: none; the skin pins
  its own `cssVarOverrides`

## 5. Type feel

- **Serif / sans / slab / display:** high-contrast display serif headings,
  sans body
- **Closest existing `FONT_PAIRINGS` id, if any**: none of the five that
  existed fit, so the plan added `luxe` (Playfair Display + Inter) as a
  deliberate schema extension shipped with this skin (`docs/AUTHORING-SKINS.md`
  Step 2). Playfair over Cormorant Garamond because Cormorant tops out at 700
  and the `display` type scale sets headings at 800.
- **If none fit:** see above.

## 6. Spacing & shape

- **Tight / comfortable / airy:** airy (`spacingDensity: "airy"`)
- **Sharp / soft / round corners:** crisp (`radius: "sm"`)
- **Shadow character**: soft

## 7. Motion feel

- **Static / subtle / expressive:** subtle
- **Anything specific**: reveal on enter, no per-card stagger. Type scale
  `display` (bigger, tighter, 800).

## 8. Sections to emphasize

- **Which sections carry this direction's identity most**: hero and reviews
- **Any must-have hero feel**: copy column beside an elevated photo card —
  the `split-card` hero
- **Does this need a section variant that doesn't exist yet?** No —
  `split-card` hero and `masonry` reviews (testimonials as a collage) already
  exist.

## 9. Anything else

Dark-surface findings from authoring this skin, shipped as known gaps:

- **The inverted `bg-fg` footer renders light.** On a dark skin `fg` is the
  warm white, so the footer (and any other inverted `bg-fg` section) becomes
  a light band at the bottom of a dark page.
- **Shadows are invisible on dark.** The shared shadow color is a dark slate,
  so the `soft` tier barely registers on the near-black page; depth comes from
  the raised-charcoal `muted` surface and card borders instead.
- **Owner:** the dial-value design pass (plan PR 7), which reviews the shadow
  and density tiers across all skins, dark surfaces especially.
- The gold primary on the warm-white `fg` surface is 2.06:1, so a CTA on the
  inverted `classic`/`video` hero would vanish; the skin pins `split-card`
  and its genome profile draws `split-card` only.
