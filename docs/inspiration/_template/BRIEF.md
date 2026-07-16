# Inspiration brief — {{direction name}}

Fill this out to start a new brief (see `docs/inspiration/README.md`). This
feeds `docs/AUTHORING-SKINS.md` — the deterministic playbook that turns one
completed brief into **one** additive `packages/schema/src/skins.ts` entry.
Leave a field blank if it truly doesn't apply; don't pad it with prose the
extraction step can't act on.

> Not sure this brief should become a skin at all? Check `docs/adr/
> 0004-inspiration-intake.md` point 1 first — if this is really "make one
> client's site look like X," it's a custom-component request, not a brief.

## 0. Direction name & slug

- **Direction name** (short, human-readable): `__________`
- **Folder slug** (kebab-case, becomes `docs/inspiration/<slug>`, and — if
  this becomes a skin — informs the `SKINS["<slug>"]` id; a layout adjective
  or vibe word, never a client/business name): `__________`

## 1. Reference links

One row per reference. Screenshot each with Playwright at authoring time
(`docs/AUTHORING-SKINS.md` step 1) rather than relying on the live link
staying up.

| URL | What to look at (hero / palette / type / whole page) | Notes |
| --- | --- | --- |
| `__________` | `__________` | `__________` |
| `__________` | `__________` | `__________` |

## 2. Dropped assets

List what's in `assets/` and what each one is for. Images: viewed directly.
Video: sampled as frames (ffmpeg) at authoring time.

| File (`assets/…`) | Type (image / video) | What it shows |
| --- | --- | --- |
| `__________` | `__________` | `__________` |

## 3. Target vibe

- **Adjectives** (3–6 words that describe the feel — e.g. "warm, editorial,
  unhurried" or "industrial, high-contrast, confident"): `__________`
- **One-sentence description** (how should a visitor feel in the first 2
  seconds?): `__________`
- **Explicitly NOT this** (a direction to rule out, if the references could
  be read two ways): `__________`

## 4. Palette leanings

- **Warm / cool / neutral:** `__________`
- **Light / dark base:** `__________`
- **Any specific colors the references keep repeating** (hex if you have it,
  description if not): `__________`
- **Existing trade preset this is closest to, if any** (`landscaping` /
  `junk-removal` / `pressure-washing` / `concrete-fencing` — a skin's
  `cssVarOverrides` can still diverge from all four, per ADR-0003 §3):
  `__________`

## 5. Type feel

- **Serif / sans / slab / display:** `__________`
- **Closest existing `FONT_PAIRINGS` id, if any** (`system` / `editorial` /
  `modern` / `industrial` / `slab` — see `packages/schema/src/presets.ts`):
  `__________`
- **If none fit:** describe the heading vs. body contrast you want; new font
  work is a deliberate, separate decision (`docs/AUTHORING-SKINS.md` maps to
  *existing* pairings only — a genuinely new pairing is flagged, not invented
  mid-playbook).

## 6. Spacing & shape

- **Tight / comfortable / airy:** `__________`
- **Sharp / soft / round corners:** `__________`
- **Shadow character** (flat / soft / hard, or "no strong opinion"):
  `__________`

## 7. Motion feel

- **Static / subtle / expressive:** `__________`
- **Anything specific** (e.g. "the hero image should feel like it settles
  into place," "no per-card stagger — keep it calm"): `__________`

## 8. Sections to emphasize

- **Which sections carry this direction's identity most** (hero / services /
  gallery / reviews / serviceAreaMap / contact): `__________`
- **Any must-have hero feel** (e.g. "asymmetric split like a magazine
  spread," "full-bleed and dramatic," "centered and calm"): `__________`
- **Does this need a section variant that doesn't exist yet?** If yes, name
  it and note which reference shows it — `docs/AUTHORING-SKINS.md` will flag
  it as a `docs/HARVESTING.md` follow-up rather than inventing markup inline.
  `__________`

## 9. Anything else

Free text for whatever doesn't fit above. Keep it short — this is an input to
a deterministic playbook, not a design document in itself.

`__________`
