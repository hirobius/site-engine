# Inspiration brief — Crisp modern

Filled from the polish + skins batch plan (Adrian's direction, 2026-10-07),
not from dropped references: the plan's three-skin table is this brief's
source. Feeds `docs/AUTHORING-SKINS.md`; the resulting entry is
`SKINS["crisp-modern"]` in `packages/schema/src/skins.ts`.

## 0. Direction name & slug

- **Direction name**: Crisp modern
- **Folder slug**: `crisp-modern`

## 1. Reference links

| URL | What to look at (hero / palette / type / whole page) | Notes |
| --- | --- | --- |
| (none) — the reference is the polish + skins batch plan (2026-10-07), its skins table row for `crisp-modern` | whole direction | No external sites were named; nothing was captured. |

## 2. Dropped assets

| File (`assets/…`) | Type (image / video) | What it shows |
| --- | --- | --- |
| (none) | — | — |

## 3. Target vibe

- **Adjectives**: calm, precise, clean, modern, trustworthy
- **One-sentence description**: a visitor should feel the business is
  organized and reliable — a tidy page with one confident accent.
- **Explicitly NOT this**: loud or industrial; no warm editorial cream.

## 4. Palette leanings

- **Warm / cool / neutral:** cool
- **Light / dark base:** light (near-white)
- **Any specific colors the references keep repeating**: near-white surface,
  ink text, a single blue
- **Existing trade preset this is closest to, if any**: none in particular;
  the skin pins its own `cssVarOverrides`

## 5. Type feel

- **Serif / sans / slab / display:** geometric sans
- **Closest existing `FONT_PAIRINGS` id, if any**: `modern` (Space Grotesk +
  Inter)
- **If none fit:** n/a

## 6. Spacing & shape

- **Tight / comfortable / airy:** airy (`spacingDensity: "airy"`)
- **Sharp / soft / round corners:** crisp, slightly softened
  (`radius: "sm"`)
- **Shadow character**: flat (borders carry depth)

## 7. Motion feel

- **Static / subtle / expressive:** subtle
- **Anything specific**: reveal on enter, no per-card stagger. Type scale
  `compact` (smaller, calmer headings) — restraint does the work.

## 8. Sections to emphasize

- **Which sections carry this direction's identity most**: hero and services
- **Any must-have hero feel**: the `classic` hero (photo under an ink
  overlay), calm and centered
- **Does this need a section variant that doesn't exist yet?** No — `classic`
  hero and `cards` services already exist.

## 9. Anything else

- The CTA has to read on the classic hero's ink overlay as well as on the
  near-white page, which is why fg is near-black ink rather than slate (see
  the skin's doc comment for the ratios).
