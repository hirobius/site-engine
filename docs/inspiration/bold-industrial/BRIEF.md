# Inspiration brief — Bold industrial

Filled from the polish + skins batch plan (Adrian's direction, 2026-10-07),
not from dropped references: the plan's three-skin table is this brief's
source. Feeds `docs/AUTHORING-SKINS.md`; the resulting entry is
`SKINS["bold-industrial"]` in `packages/schema/src/skins.ts`.

## 0. Direction name & slug

- **Direction name**: Bold industrial
- **Folder slug**: `bold-industrial`

## 1. Reference links

| URL | What to look at (hero / palette / type / whole page) | Notes |
| --- | --- | --- |
| (none) — the reference is the polish + skins batch plan (2026-10-07), its skins table row for `bold-industrial` | whole direction | No external sites were named; nothing was captured. |

## 2. Dropped assets

| File (`assets/…`) | Type (image / video) | What it shows |
| --- | --- | --- |
| (none) | — | — |

## 3. Target vibe

- **Adjectives**: loud, utilitarian, high-contrast, confident, tough
- **One-sentence description**: a visitor should feel they've found a crew
  that pours concrete and hauls debris for a living — site signage, not a
  boutique.
- **Explicitly NOT this**: polished corporate or editorial; no soft pastel
  surfaces, no rounded friendliness.

## 4. Palette leanings

- **Warm / cool / neutral:** neutral-warm (concrete grey) with one hot accent
- **Light / dark base:** light base, dark (charcoal) CTA blocks and footer
- **Any specific colors the references keep repeating**: charcoal +
  safety amber
- **Existing trade preset this is closest to, if any**: `concrete-fencing` /
  `junk-removal` in spirit; the skin pins its own `cssVarOverrides`

## 5. Type feel

- **Serif / sans / slab / display:** heavy grotesk sans, display-weight
  headings
- **Closest existing `FONT_PAIRINGS` id, if any**: `industrial` (Archivo +
  Inter)
- **If none fit:** n/a

## 6. Spacing & shape

- **Tight / comfortable / airy:** tight (`spacingDensity: "compact"`)
- **Sharp / soft / round corners:** sharp (`radius: "none"`)
- **Shadow character**: hard (solid, no-blur offset)

## 7. Motion feel

- **Static / subtle / expressive:** subtle
- **Anything specific**: reveal on enter, no per-card stagger — the type does
  the shouting. Type scale `display` (bigger, tighter, 800).

## 8. Sections to emphasize

- **Which sections carry this direction's identity most**: hero and services
- **Any must-have hero feel**: big centered headline on the muted surface —
  the `banner` hero
- **Does this need a section variant that doesn't exist yet?** No — `banner`
  hero and `alternating` services (wide image/text rows that read as a
  portfolio of jobs) already exist.

## 9. Anything else

- Primary is charcoal, so a CTA on the inverted `classic`/`video` hero (fg
  surface) would vanish; the skin pins `banner` and its genome profile
  (`industrial-bold`) draws `banner` only.
- Footer small print (on-primary at 60% over the `bg-fg` footer) measured
  4.17:1 with the first amber (#f5b400); nudged to #f5c200 (4.54:1) so it
  clears AA without moving any gated pair below it. Ratios are recorded in
  the skin's doc comment.
