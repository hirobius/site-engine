# Authoring a skin from a brief

The deterministic playbook an agent (or Adrian) follows to turn **one**
completed `docs/inspiration/<name>/BRIEF.md` into **one** additive entry in
`packages/schema/src/skins.ts`, gated the same way every other
`packages/schema` change is. Read `docs/adr/0004-inspiration-intake.md` first
— this doc is that ADR's mechanism made concrete, step by step. Read
`docs/adr/0003-skins-design-packs.md` and `packages/schema/src/skins.ts`
itself before starting; both explain *why* the target shape below is exactly
what it is. Read `docs/SKIN-CRITIC.md` too — it's the rubric Step 7 (the
critic loop) scores every proposed skin against.

**The rule this playbook exists to enforce:** a skin is an override-only
preset on the **existing** config surface. Nothing here ever adds a schema
field, writes bespoke markup, or produces per-client output. If a step below
can't be satisfied with what already exists, **stop and flag it** — same
"don't invent an escape hatch" instinct as `CLAUDE.md`'s config-only rule for
client sites, one level up the stack.

## Prerequisites

- A completed brief at `docs/inspiration/<name>/BRIEF.md` (see
  `docs/inspiration/README.md`). If it's not filled in, stop — this playbook
  extracts from a brief, it doesn't write one.
- Read `packages/schema/src/skins.ts` end to end, including the doc comments
  on `SkinBrand` and both existing entries (`classic`, `warm-editorial`).
  They record real prior decisions (e.g. why `font`/`fontPairing` are NOT a
  "type scale" — issue #86, deferred) that this playbook assumes.
- Confirm the brief doesn't already overlap an existing skin. If `classic` or
  `warm-editorial` already covers the vibe, stop — a duplicate skin is not
  "more variety," it's maintenance for nothing (ADR-0003 §1: "2–4 skins, each
  deliberate").

## Step 1 — Extract from the references

Work through the brief's reference list and dropped assets. Capture concrete
values (hex colors, a font-family read, a spacing impression, a motion
description), not adjectives — adjectives already live in the brief's §3.

| Reference type | How to extract |
| --- | --- |
| Links | `WebFetch` the page for a first read, then a **Playwright screenshot** for the actual visual — hero framing, palette, type, spacing. Fetching text alone misses everything this playbook needs. Whatever Chromium install the authoring session has is fine; this repo's own documented Playwright convention is the pinned `mcr.microsoft.com/playwright:v1.60.0-noble` container (README.md's visual-regression section) — reach for that if the session doesn't already have a browser available. Don't assume a specific host path (e.g. `/opt/pw-browsers`) exists; that's an environment detail, not a repo convention. |
| Images (`assets/*.png`, `*.jpg`, …) | View directly (multimodal read) — pull palette, type character, spacing/shape, hero framing straight from the image. |
| Video (`assets/*.mp4`, …) | Sample frames with `ffmpeg` (e.g. `ffmpeg -i clip.mp4 -vf fps=1 frame-%03d.png`), then treat the frames like dropped images above. Motion *character* (settle vs. snap, calm vs. energetic) comes from watching a couple seconds, not a single frame. |

Write down, per reference: 2–4 dominant colors (as hex, eyeballed or
color-picked), a type impression (serif/sans/slab/display, weight, whether
headings contrast with body), a spacing impression (tight/comfortable/airy),
a shape impression (sharp/soft/round corners, flat/soft/hard shadows), and a
motion impression if video. This is scratch work for step 2 — it does not
get committed anywhere.

## Step 2 — Map to the EXISTING config surface only

Translate the extracted values into `SkinBrand` / `SkinSections` fields —
**never anything outside this list**:

| Skin axis | Field | Source of truth |
| --- | --- | --- |
| Typeface pairing | `brand.fontPairing` | `packages/schema/src/presets.ts` → `FONT_PAIRINGS` (`system` / `editorial` / `modern` / `industrial` / `slab`). Pick the closest existing pairing. **Do not invent a new pairing here** — that's a separate, deliberate font-work issue, flagged not built. `brand.font` only matters as the nominal single-stack fallback (e.g. `og-image.ts`) when `fontPairing` is set — pick the built-in font id closest to the pairing's heading stack (see `warm-editorial`'s `font: "slab"` alongside `fontPairing: "editorial"`). |
| Palette | `brand.cssVarOverrides` | Six `--brand-*` keys: `primary`, `accent`, `bg`, `fg`, `muted`, `on-primary` (see `PaletteTokens` in `presets.ts`). Only set the keys the brief's palette actually diverges on — omitted keys fall through to the client's own `palettePreset`. This is the "palette family beyond the four trade presets" ADR-0003 §3 calls out. |
| Corner shape | `brand.radius` | `"none" \| "sm" \| "md" \| "lg" \| "xl"` |
| Shadow character | `brand.shadow` | `"flat" \| "soft" \| "hard"` |
| Motion feel | `brand.motion` | `"none" \| "subtle" \| "rich"` — see `docs/adr/0001-motion-foundation.md` for what each tier actually does before picking one. |
| Spacing density | `brand.spacingDensity` | **Not yet exposed on `SkinBrand`** (see caveat below) — `BrandSchema` has `"compact" \| "comfortable" \| "airy"`, but `skins.ts`'s `SkinBrand` interface doesn't include it yet. If the brief's spacing impression is strongly "tight" or "airy," note it in the skin's doc comment as a known gap and flag the `SkinBrand` extension as a follow-up (don't extend the schema inline inside a skin-authoring PR — that's a deliberate schema change, reviewed on its own). |
| Section identity | `layout.sections.<id>.variant` | One pin per section in `SkinSections` (`hero`, `services`, `gallery`, `reviews`, `serviceAreaMap`, `contact`). Pick the closest **existing** variant from `packages/schema/src/section-variants.ts` for each section the brief's §8 calls out — pin every section anyway (even ones with only one variant today), same self-documenting reasoning `warm-editorial`'s doc comment gives, so the skin stays forward-safe if a second variant lands later. |

**If the brief's §8 flags a genuinely missing section variant** (a hero
treatment, a gallery layout — nothing in `SECTION_VARIANTS` today matches),
do **not** invent one inside this playbook. Per `docs/HARVESTING.md`, a new
variant is harvested only once a skin's vibe actually needs it, as its own
deliberate PR following the full harvest touch list (license check, purity
gate, `SECTION_VARIANT_COMPONENTS` registry, visual baseline reseed). Note it
in the skin's doc comment as a named follow-up (`warm-editorial`'s comment
about the "true magazine-style asymmetric hero" is the model to follow) and
ship the skin with the closest existing variant in the meantime — a skin
doesn't have to wait on a harvest to land.

**Anything the brief asks for that doesn't map to a row above stops here.**
Do not add a schema field, a new CSS property, or bespoke markup to make it
fit. Flag it in the PR description as an open question (same as ADR-0004's
own open-questions section) and ship the skin without that piece, or don't
ship it at all if the gap is load-bearing to the vibe.

## Step 3 — Verify AA contrast

Every pair `packages/template/src/acceptance.ts`'s `CONTRAST_TOKEN_PAIRS`
checks must clear WCAG AA (`WCAG_AA_NORMAL_TEXT = 4.5:1`, from
`packages/template/src/lib/contrast.ts`) once your `cssVarOverrides` resolve:

- `--brand-primary` / `--brand-on-primary` (CTA button)
- `--brand-fg` / `--brand-bg` (body text + hero surface)
- `--brand-fg` / `--brand-muted` (muted sections + banner hero surface)

Compute these with `contrastRatio()` from the same module (a throwaway
`tsx`/node one-liner importing it is fine — this doesn't need a script) for
every pair your overrides touch, *and* hand-check any pair the template
doesn't formally gate yet but plausibly renders (see `warm-editorial`'s
`--brand-accent` note — it hand-verified accent/bg and accent/muted even
though neither is in `CONTRAST_TOKEN_PAIRS` today). Record the ratios in the
skin's doc comment, same format `warm-editorial` uses — a future reader
should never have to recompute them to trust the skin.

If a pair fails AA, adjust the offending hex (don't ship it and hope
`acceptance.test.ts` catches it later — verify before you write the entry).

## Step 4 — Verify purity (only if you touched a section variant)

If step 2 harvested a genuinely new variant, run `pnpm --filter
@hirobius/template test` (which includes `purity.test.ts`) before opening the
PR — it deterministically sweeps every component for literal colors, palette
classes, unallowlisted scripts/imports/external URLs. Most skins touch zero
new variants and can skip straight to step 5.

## Step 5 — Add ONE additive entry to `skins.ts`

1. Add the new id to `SKIN_IDS` (`packages/schema/src/skins.ts`).
2. Add `SKINS["<new-id>"]` with `sections` (every key from `SkinSections`,
   pinned per step 2) and `brand` (only the fields the vibe actually cares
   about — every field is optional, per the interface doc comment).
3. Write a doc comment on the new entry matching `warm-editorial`'s: name the
   source brief (`docs/inspiration/<name>/`), the variant reused for each
   section pin and why, the exact contrast ratios from step 3, and any
   flagged follow-up (missing variant, `spacingDensity` gap, anything step 2
   stopped on).
4. Add a `skins.test.ts` block for the new skin mirroring the existing
   `"warm-editorial skin (issue #NNN)"` `describe` block: pins resolve
   correctly, the skin is visibly distinct from `classic` (and from any
   near-neighbor skin), an explicit config field still overrides the skin's
   pin, and `design` unset/`"classic"` still renders byte-identical (this
   last assertion should never need touching — if it does, something leaked
   outside the new `SKINS` entry).

### The raw-draft gotcha (read before testing or previewing)

`applyDesignSkin()` is override-only: an explicit field on the input draft
always beats the skin's pin — **including a field that only looks explicit
because an earlier `defineClient()` call already baked in a Zod default.**
Test or preview a new skin against a **raw, mostly-empty `ClientConfigInput`**
(only `brand.palettePreset` set), never against an already-resolved
`ClientConfig`. `apps/_gallery/src/fixtures.ts`'s `SKIN_DEMO_INPUT` /
`withDesignSkin()` is the canonical example — copy that pattern, don't feed a
`FIXTURES` entry (which has concrete `font`, `radius`, `layout.sections.hero.
variant`, …) back in with `design` set, or the new skin will appear to do
nothing because every one of its pins loses to values that only look
hand-written. See `docs/adr/0004-inspiration-intake.md`'s guardrails section
(point 4) for the full explanation — this is the #141 gotcha the epic calls
out.

## Step 6 — Preview

`apps/_gallery/src/pages/skins.astro` already renders every `SKIN_IDS` entry
side by side (hero + services + reviews, swatches, the resolved dial values)
against the shared `SKIN_DEMO_INPUT` fixture — it picks up a new skin
automatically once `SKIN_IDS` includes it, no gallery edit needed. Build the
gallery and eyeball the new card before opening the PR:

```bash
pnpm --filter @hirobius/gallery build
pnpm --filter @hirobius/gallery dev   # or preview the static build
```

## Step 7 — Critic loop (score + iterate against `docs/SKIN-CRITIC.md`)

Issue #177 (epic #173, amplification move ②). Once the gallery preview (Step
6) renders the proposed skin, **score it before opening a PR** — this is the
"critique/QA pass" the tools that produce good-looking output run, applied to
a skin instead of a one-off page. Two halves, both against the rendered
gallery `skins.astro` page (or the specific skin's card on it):

1. **Deterministic — `impeccable detect`.** Run `pnpm skin-critique` (wraps
   `runImpeccableDetect()` from `packages/template/src/design-quality.ts`,
   #176, over the built `apps/_gallery/dist/skins/index.html` — see
   `scripts/skin-critique.ts`). Same offline-safe contract as the
   `packages/template` gate: no network/npx available → skips with a reason,
   never blocks the loop. **Note:** `impeccable`'s CLI has no `critique` or
   `polish` subcommand (investigated for #177 — confirmed against the pinned
   `impeccable@3` binary; see `docs/SKIN-CRITIC.md`'s "Deterministic half"
   section for the full finding). `detect` — already wired by #176 — is the
   whole deterministic half available today.
2. **LLM critic — score against `docs/SKIN-CRITIC.md`.** Dispatch a critic
   sub-agent (or run the rubric yourself) against the six dimensions:
   hierarchy, contrast, whitespace/vertical rhythm, type-pairing coherence,
   palette harmony, motion restraint. Each dimension has a concrete pass
   criterion and a failure example in the rubric — score PASS/FAIL/UNKNOWN
   per dimension, not a vibe-based verdict.

**Apply fixes, then re-critique.** Every FAIL the rubric returns maps to a
specific `SKINS["<id>"]` config value — `fontPairing`, a `cssVarOverrides`
hex, `radius`, `shadow`, `motion`, or a section-variant pin. Change **only**
that value (this is still Step 5's entry, being tuned — never a markup edit;
same config-only boundary `CLAUDE.md`'s "one rule that matters" draws for
client sites, one level up). Re-run the gallery build (Step 6), re-run both
critic halves, repeat until every dimension is PASS and `impeccable detect`
(when it ran) reports zero findings against the rendered page.

**Pass = zero FAILs on both halves.** An UNKNOWN dimension (the rubric
couldn't be evaluated — e.g. the brief never recorded a motion impression in
Step 1) is not a pass by omission — resolve it (go back to the brief) or
name it explicitly as an open question in the PR body, same as any other gap
this playbook surfaces.

## Step 8 — Re-sync + verify, then open a gated PR

```bash
pnpm schema:snapshot-ops                 # re-snapshot the ops schema-drift guard
pnpm --filter @hirobius/schema test      # skins.test.ts + the rest of the schema suite
pnpm --filter @hirobius/template test    # acceptance.test.ts + purity.test.ts
pnpm check && pnpm build                 # workspace-wide: tsc/astro check + every app still builds
```

`design` is stripped before Zod (never reaches `ClientConfigSchema`), so a
byte-identical `pnpm schema:snapshot-ops` diff is expected and correct —
confirm it's a no-op, don't skip running it.

Then:

1. Run `/code-review` on the diff (mandatory before any PR touching
   `packages/schema` — see `CLAUDE.md`'s skill protocol). The critic loop
   (step 7) checks *taste*; `/code-review` checks *standards + spec* — both
   are required, neither substitutes for the other.
2. Open the PR referencing the source brief
   (`docs/inspiration/<name>/`) and the epic (#173). Note in the PR body:
   contrast ratios (step 3), any flagged follow-up from step 2 (missing
   variant, `spacingDensity` gap), confirmation the gallery preview
   (step 6) was checked, and the critic loop's (step 7) final scorecard —
   six PASS dimensions + the deterministic sweep result, or the resolved/
   named UNKNOWNs.
3. Flag the same **ops re-sync follow-up** every prior skins-mechanism PR has
   flagged (#140, #141): `hirobius/ops`'s vendored `lib/schema/` doesn't
   carry `applyDesignSkin`/`SKINS` until that mechanism re-sync lands, so the
   new entry needs the same re-sync once it does. Don't attempt the ops sync
   from a skin-authoring PR — `packages/agent` and `scripts/lead-gen` are
   frozen here (see `CLAUDE.md`), and the ops repo has its own review path.
4. If the source brief flagged a missing section variant (step 2), file that
   as its own `docs/HARVESTING.md` issue rather than leaving it only as a doc
   comment — it needs to be findable independent of this PR.

## What this playbook is not

- **Not a way to add a schema field.** Every mapping in step 2 targets a
  field that already exists on `BrandSchema`/`SkinSections`. A brief that
  needs a new one stops at step 2 and gets flagged, not built inline.
- **Not a way to skip `docs/HARVESTING.md`.** A missing section variant is
  still harvested through the full contract, as its own PR.
- **Not per-client.** The output is always one `SKINS["<id>"]` entry every
  client can select — never a config field, override, or component scoped to
  one business.
- **Not a markup tool.** The critic loop (step 7) only ever prescribes a
  `SKINS["<id>"]` config value change. A rubric finding that can't be fixed by
  changing `fontPairing`/`cssVarOverrides`/`radius`/`shadow`/`motion`/a
  section-variant pin isn't this loop's to fix — flag it, same as step 2's
  unmappable-request rule.
- **Not a substitute for `/code-review`.** The critic loop scores taste
  (hierarchy, contrast, palette, motion, …); `/code-review` (step 8) scores
  standards + spec. A skin needs both before it opens a PR.
- **Not unattended.** Step 8 ends at "open a gated PR," not "merge." A human
  (or a second agent acting as reviewer) reviews before `packages/schema`
  changes, same as any other schema PR.
