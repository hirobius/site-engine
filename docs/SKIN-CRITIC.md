# Skin critic rubric

The taste rubric a **critic agent** scores a proposed skin against, in the
loop `docs/AUTHORING-SKINS.md` wires in as its Step 7. Issue #177 (slice of
epic #173, amplification move ②) — "the single biggest 'just knows how to
look good' lever." Read `docs/AUTHORING-SKINS.md` first; this document is the
rubric that step calls out to, not a standalone process.

**The boundary this rubric exists inside:** a fix this rubric prescribes is
always a change to the skin's **`SKINS["<id>"]` entry** — `fontPairing`,
`cssVarOverrides`, `radius`, `shadow`, `motion`, or a section-variant pin.
**Never** a markup edit, a new CSS property, or a schema field. If a finding
can't be fixed by changing one of those config values, it isn't this rubric's
to fix — flag it as an open question the same way `AUTHORING-SKINS.md` Step 2
already tells you to (config-only guardrail, `CLAUDE.md`'s "one rule that
matters" one level up).

## Why a rubric, not vibes

Six dimensions, each with a **computable or closed-enum pass criterion** and
a **concrete failure example** — so two different critic runs (or a human and
an agent) reach the same verdict on the same skin. A dimension with no
concrete test is not in this rubric; "make it feel more premium" is not a
scoring criterion anywhere below.

Every criterion below is checkable against values already in a `Skin`
(`packages/schema/src/skins.ts`) plus `contrastRatio()`
(`packages/template/src/lib/contrast.ts`) — nothing here requires a new tool.

---

## 1. Hierarchy — does the eye know where to land?

**What it's for:** the hero headline and the CTA should read as the obvious
focal points; a skin that doesn't touch anything but color makes the same
layout with a new coat of paint, not a new hierarchy.

**Pass criteria (all three):**
- `brand.fontPairing` is set and is **not** `"system"` — heading and body
  resolve to genuinely different type families (`FONT_PAIRINGS` in
  `packages/schema/src/presets.ts`). `"system"` is a legitimate choice only
  when the brief explicitly asks for a flat, single-family, minimal-contrast
  look — if so, say that in the skin's doc comment; don't leave it silently
  unset.
- CTA contrast (`--brand-primary` / `--brand-on-primary`, via
  `contrastRatio()`) is **≥ 6:1** — comfortably above the 4.5:1 legal AA
  floor `acceptance.ts` already gates. A CTA that only just clears AA reads
  timid, not confident; the AA floor is a legibility gate, not a taste target.
- At least one of `radius` / `shadow` / `motion` differs from `classic`'s
  values (`radius: "md"`, `shadow: "soft"`, `motion: "rich"`). A skin whose
  `brand` block is only `cssVarOverrides` recolors `classic` without changing
  its shape or feel — see the failure example below.

**Failure example:** a "sunset-coast" skin sets a new `cssVarOverrides`
palette but leaves `radius`, `shadow`, and `motion` unset (so they resolve to
`classic`'s `md`/`soft`/`rich`) and skips `fontPairing` entirely. Every
section renders with `classic`'s exact geometry, shadows, and type — only the
hex values changed. Fix: pick a `fontPairing` that matches the brief's type
impression (Step 2's mapping table) and pin at least one shape/motion field
deliberately.

## 2. Contrast — legible under the resolved palette, not just the CI floor

**What it's for:** `acceptance.ts`'s `CONTRAST_TOKEN_PAIRS` already hard-gates
three pairs at build time; the critic re-verifies those **and** the pairs the
template plausibly renders but doesn't formally gate yet — the same
hand-verification `warm-editorial`'s doc comment models.

**Pass criteria:**
- `--brand-primary`/`--brand-on-primary`, `--brand-fg`/`--brand-bg`, and
  `--brand-fg`/`--brand-muted` all clear `WCAG_AA_NORMAL_TEXT` (4.5:1) via
  `contrastRatio()` — required, mirrors `AUTHORING-SKINS.md` Step 3 exactly.
- `--brand-accent` is hand-checked against both `--brand-bg` and
  `--brand-muted` even though neither pair is in `CONTRAST_TOKEN_PAIRS`
  today. Target ≥ 3:1 if accent is ever used for text/icons (WCAG AA
  large-text/UI-component floor) — below that, flag accent as
  decorative-only-safe in the doc comment, don't silently ship it as if it
  were text-safe.
- Every ratio computed is recorded in the skin's doc comment (Step 3's
  existing requirement) — a rubric pass with no recorded numbers doesn't
  count as a pass, it counts as unverified.

**Failure example:** a skin picks a pastel accent (`#f4d9c4`) against the
warm-editorial-family `--brand-bg` (`#faf6ee`) — ratio ≈ 1.2:1. Nothing in
`CONTRAST_TOKEN_PAIRS` catches this today (accent isn't gated), so it ships
invisible-on-hover accent text until a human notices. Fix: darken/saturate
the accent hex until accent/bg and accent/muted both clear 3:1, re-verify,
record the new ratios.

## 3. Whitespace / vertical rhythm — honest about the current gap

**What it's for:** a roomy editorial brief and a tight utilitarian brief
should not resolve to the same perceived density. **`SkinBrand` does not
expose `spacingDensity` yet** (ADR-0004's open question 1, `BrandSchema` has
it, `skins.ts`'s `SkinBrand` interface doesn't) — this dimension can only be
graded honestly against what a skin *can* control today: `radius` + `shadow`
as a proxy for density, and documentation completeness for the rest.

**Pass criteria (both):**
- `radius`/`shadow` are internally consistent with the brief's spacing
  impression: an "airy"/"roomy" brief leans soft edges (`radius: "lg"` or
  `"xl"`, `shadow: "flat"` or `"soft"`) — soft boundaries read as breathing
  room; a "tight"/"dense" brief leans crisp edges (`radius: "none"` or
  `"sm"`, `shadow: "hard"`) — sharp boundaries substitute for the space the
  skin can't yet dial down directly.
- If the brief's spacing impression (Step 1 scratch notes) is strongly
  "tight" or "airy" (not "comfortable" — the schema default), the skin's doc
  comment **names the `spacingDensity` gap as a flagged follow-up**, per
  `AUTHORING-SKINS.md` Step 2's own instruction. A skin that ships without
  this note when the brief clearly wanted a spacing dial it can't reach is an
  incomplete critique pass, not a silent no-op.

**Failure example:** the brief's §3 says "roomy, breathing, uncluttered
editorial spread" but the skin ships `radius: "none"`, `shadow: "hard"` (both
read as dense/utilitarian) and the doc comment never mentions
`spacingDensity`. The rendered gallery card will look tighter than the brief
asked for with no trace of why. Fix: switch to `radius: "lg"`/`"xl"` +
`shadow: "flat"`/`"soft"`, and add the gap note.

## 4. Type-pairing coherence — the two font fields must agree with each other

**What it's for:** `fontPairing` drives the live site; `font` is only the
single-stack fallback `og-image.ts` reads when it can't render two stacks
(see `skins.ts`'s `SkinBrand` doc comment). If they point at different
typographic characters, the OG image (what a shared link actually shows in a
social preview) looks like a different skin than the site.

**Pass criteria (both):**
- `fontPairing`'s **heading** stack (`FONT_PAIRINGS[id].heading` in
  `presets.ts`) matches the brief's type impression: `editorial` (Fraunces
  serif) for literary/warm briefs, `modern` (Space Grotesk) for
  geometric/tech briefs, `industrial` (Archivo grotesk) for
  utilitarian/trade briefs, `slab` (Roboto Slab) for sturdy/blue-collar
  briefs, `system` only for a deliberately flat brief (see Dimension 1).
- `font` (the fallback `FontId`) is the closest built-in single stack to that
  same heading character — serif/slab pairing → `font: "slab"` (the only
  built-in serif-ish `FontId`), sans pairing → `font: "inter"` / `"geist"` /
  `"work-sans"`. `warm-editorial`'s `font: "slab"` alongside
  `fontPairing: "editorial"` is the model: no single built-in `FontId` is
  Fraunces, so `slab` is the closest serif fallback, not a mismatched sans.

**Failure example:** a skin sets `fontPairing: "editorial"` (Fraunces serif
heading) but `font: "inter"` (sans fallback). The live site's hero reads
serif/editorial; the OG image and any og-image-only render read plain sans —
two different typographic identities for the same skin. Fix: set
`font: "slab"` (or whichever built-in serif/slab `FontId` is closest) to
match the pairing's heading character.

## 5. Palette harmony — one family, not two clashing presets glued together

**What it's for:** every individual pair can clear AA (Dimension 2) while the
palette as a whole still reads incoherent — e.g. a pastel background next to
a neon accent. AA measures legibility, not harmony; this dimension measures
harmony.

**Pass criteria (both, computed from hex → HSL):**
- `--brand-muted`'s hue is within **~30°** of `--brand-bg`'s hue — muted
  should read as a tinted variant of the background (a slightly deeper/
  warmer version of the same surface), not an unrelated color family.
  `warm-editorial`'s bg `#faf6ee` (hue ≈ 43°) and muted `#ede2ce` (hue ≈
  40°) — 3° apart — is the model.
- `--brand-primary` and `--brand-accent` share a broadly consistent
  saturation/lightness *character* (both muted/desaturated "editorial"
  tones, or both saturated "energetic" tones) even where their hues differ
  deliberately. Two colors from different palette registers (one pastel, one
  neon) reads like two different skins layered on one page, not one accent
  decision.

**Failure example:** a skin pairs a warm cream `--brand-bg` (`#faf6ee`, hue
≈ 43°) with a neon teal `--brand-muted` (`#00ffee`, hue ≈ 176°) — 133° apart,
no shared family. Individually both may clear AA against `--brand-fg`, so
Dimension 2 alone wouldn't catch it. Fix: pick a muted tone within the bg's
own hue family (a deeper/duller cream, not an unrelated hue).

## 6. Motion restraint — the tier matches the brief's energy, not the factory default

**What it's for:** `brand.motion` defaults to `"rich"` (ADR-0001: "the
factory starts expressive; we dial down per client") — a restrained/luxury/
editorial brief that leaves `motion` unset silently inherits stagger + a
pulsing map-pin ring, which reads busier than the brief asked for.

**Pass criteria:**
- The motion tier matches the brief's motion impression per ADR-0001's own
  tier definitions: `"none"` (fully static) or `"subtle"` (reveal-on-enter +
  hero-rise, no stagger/pulse) for calm/quiet/restrained/luxury briefs;
  `"rich"` (`subtle` + per-card stagger + radar-ring pulse) only for briefs
  that actually read energetic/playful/expressive.
- If the brief's motion impression is calm/restrained and the skin leaves
  `motion` unset, that is a **fail**, not a pass-by-omission — an omitted
  field inherits `classic`'s `"rich"`, which is exactly the mismatch this
  dimension exists to catch. Pin it explicitly.

**Failure example:** a brief for a "quiet, understated boutique real-estate"
vibe doesn't set `brand.motion`, so it resolves to `"rich"` — per-card
stagger and a pulsing service-area pin on a skin that's supposed to read
restrained. Fix: pin `motion: "subtle"` (or `"none"` if the brief is
extremely minimal) explicitly in the `SKINS` entry.

---

## Deterministic half: what `impeccable` actually provides today

Investigated for real against the pinned `impeccable@3` binary (`npx --yes
impeccable@3 --help` / `detect --help`), not assumed from ops#209's framing:

- **`detect` is the only scan subcommand that exists.** The CLI's command
  list is `detect`, `ignores`, `help`, `install`, `link`, `update`, `check` —
  there is **no `critique` or `polish` subcommand** (`npx impeccable@3
  critique --help` / `polish --help` both fail with `Unknown command`,
  confirmed on `impeccable@3.2.1`, the version the repo already pins in
  `design-quality.ts`).
- `critique`/`polish` are referenced in ops#209 and issue #175 as slash-command
  **skills** (`impeccable install` fetches a provider-specific skill bundle —
  Claude Code slash commands, in this repo's case — from `impeccable.style`),
  not CLI subcommands. `impeccable install` was attempted here and failed
  with `Download failed: HTTP 403` — `impeccable.style` isn't reachable from
  this sandboxed session's network allowlist, so the skill bundle (and
  whatever `critique`/`polish` skills it would install) could not be
  inspected or wired in this pass. This is a gap for a human (or a
  network-unrestricted session) to close, not something this loop can fake.
- **The deterministic half this loop actually wires is `detect`** — reusing
  `runImpeccableDetect()` (`packages/template/src/design-quality.ts`, #176)
  against the rendered skin page, same offline-safe skip contract (no
  network/npx → `{ skipped: true, reason }`, never a hard failure). `detect`'s
  46 rules catch a real but different set of problems than this rubric
  (overused AI-default fonts, bounce/elastic easing, layout-property
  animation, cramped padding, "AI slop" gradient/border tells, WCAG contrast)
  — run it **alongside** this rubric, not instead of it. `scripts/
  skin-critique.ts` (optional, see `AUTHORING-SKINS.md` Step 7) wraps this
  for a rendered gallery page.
- **If `critique`/`polish` skills become installable later** (network access
  changes, or Adrian installs them in an unrestricted session), re-run this
  investigation and fold them in as an additional deterministic pass — don't
  assume this doc's "doesn't exist" finding is permanent; it's a snapshot of
  what a `impeccable.style`-blocked sandbox could confirm on 2026-07-16.

## Reporting format (what the critic agent returns)

For each of the six dimensions: **PASS** or **FAIL**, the specific pass
criterion that failed (quote it), and — for a FAIL — the exact config field +
new value that would fix it (never a markup suggestion). A dimension the
critic can't evaluate (e.g. no brief motion impression was recorded in Step
1) is **UNKNOWN**, not a silent pass — surface it as an open question the
same way `AUTHORING-SKINS.md` Step 2 surfaces an unmappable brief request.

The loop (`AUTHORING-SKINS.md` Step 7) applies every FAIL's prescribed fix to
the `SKINS["<id>"]` entry, then re-runs both halves. **Pass = zero FAILs on
both the deterministic sweep and all six rubric dimensions** (UNKNOWNs are
resolved — either by recording the missing scratch-work from Step 1 and
re-scoring, or by an explicit note in the PR body — before opening the PR).
