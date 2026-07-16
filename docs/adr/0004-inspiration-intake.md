# ADR-0004 — Inspiration intake feeds skin authoring, never bespoke output

**Status:** Accepted (2026-07-16, Adrian — epic #173, MVP-1/MVP-2)
**Scope:** a new `docs/inspiration/` intake convention + `docs/AUTHORING-SKINS.md`
playbook. No `packages/schema` or `packages/template` change in this ADR —
mechanism and gates are exactly ADR-0003's, unmodified.
**Related:** ADR-0003 (skins are the unit of variety; bespoke rejected),
`docs/HARVESTING.md` (the variant-harvest contract this pipeline still defers
to), `packages/schema/src/skins.ts` (#140 mechanism, #141 first real skin),
epic #173 (this decision's parent issue)

## Context

Adrian wants a low-friction way to hand agents inspiration — reference links,
screenshots, moodboard images, video — and get fleet-wide visual variety back
out, without re-litigating ADR-0003. The epic's own framing (#173) risked
reading as "generate a site from these references," which is precisely the
bespoke-per-client model ADR-0003 rejected (§4: "dissolves the schema
contract, the purity gate, and fleet safety"). This ADR draws the line before
any pipeline code exists: inspiration is an *input to skin authoring*, not a
new output surface.

## Decision

1. **Inspiration feeds skin authoring, not per-client generation.** A brief
   (`docs/inspiration/<name>/`) produces at most **one new entry** in the
   shared `SKINS` registry (`packages/schema/src/skins.ts`) — reviewed,
   gated, additive, selectable by every client via the existing `design`
   config key. It never produces bespoke markup, a one-off component, or a
   config field that only one client uses. If a request can't resolve to a
   skin (or an existing skin already covers it), that is a **no-op or a
   custom-component engagement**, not a reason to bend the pipeline — same
   boundary `CLAUDE.md`'s "one rule that matters" already draws for
   `client.config.ts`.
2. **The intake artifact is a folder, not a service.** `docs/inspiration/<name>/`
   holds reference links, dropped image/video assets, and a filled
   `BRIEF.md` (target vibe, adjectives, palette leanings, which sections to
   emphasize). See `docs/inspiration/README.md` for the convention and
   `docs/inspiration/_template/BRIEF.md` for the fill-in template. This is
   MVP-1.
3. **The authoring step is a deterministic playbook, not a black box.** An
   agent (or Adrian) turns one brief into a skin PR by following
   `docs/AUTHORING-SKINS.md` exactly: read brief → extract palette/type/
   spacing/motion from the references → map **only** to the existing config
   surface (`brand.fontPairing`, `brand.cssVarOverrides`, `brand.shadow`,
   `brand.radius`, `brand.spacingDensity`, `layout.sections.*.variant` pins) →
   verify AA contrast + purity → add one additive `SKINS` entry → open a
   gated PR. This is MVP-2.
4. **Every ADR-0002/0003 guardrail rides along unchanged:**
   - **Closed enum, always.** A skin is a `SkinId` in `SKIN_IDS`; there is no
     free-form "custom skin" escape hatch. Unknown ids already throw in
     `defineClient()` (enforced today by `skins.test.ts`'s "throws a readable
     error on an unknown design id").
   - **Purity gate.** Any harvested section variant a skin's vibe genuinely
     needs still goes through `docs/HARVESTING.md`'s full conversion contract
     (license check, semantic tokens only, `purity.test.ts`) — inspiration
     never justifies skipping it. Most skins need zero new variants (see
     `warm-editorial`, #141, which reused `split-card`).
   - **Contrast/acceptance gate.** Every new skin's resolved palette is
     checked against `CONTRAST_TOKEN_PAIRS` (WCAG AA, `packages/template/src/
     acceptance.ts`) before the PR opens, same as #141's hand-verified pairs.
   - **`/code-review` before every skin PR.** No skin merges without the
     standards + spec review this repo already mandates for any
     `packages/schema` change.
   - **License gate.** Any code lifted from a reference link/theme still needs
     an MIT/Apache-2.0/BSD/CC0 provenance row in
     `packages/template/ATTRIBUTIONS.md`; GPL/paid sources stay rejected.
     Colors, type pairings, and "vibe" are never a licensing question — layout
     *code* is. Reference images/video themselves are **never copied into the
     repo or a client site**; they inform token choices only (epic #173's
     non-goals).
   - **Skins apply to a raw draft, not a resolved config — the #141 gotcha.**
     `applyDesignSkin()` is override-only: an explicit field on the draft
     always wins over the skin's pin, *including* a field that only looks
     explicit because an earlier `defineClient()` call already baked in a Zod
     default. Testing or previewing a new skin against an already-resolved
     `ClientConfig` (e.g. copying a `FIXTURES` entry) makes every one of the
     skin's pins silently lose — the skin will appear to do nothing. The
     correct pattern is `apps/_gallery/src/fixtures.ts`'s `SKIN_DEMO_INPUT` /
     `withDesignSkin()`: start from a raw, mostly-empty `ClientConfigInput`
     (only `palettePreset` set on `brand`) and let `design` resolve through
     `defineClient()` for the first time. `docs/AUTHORING-SKINS.md` calls this
     out explicitly at the verification step so it isn't rediscovered the hard
     way per brief.
5. **The pipeline is design-time only.** Extraction tooling (WebFetch,
   Playwright screenshot, ffmpeg frame capture, vision on images) runs in the
   authoring session — none of it becomes a runtime dependency of any client
   site (epic #173 non-goals; consistent with `CLAUDE.md` rule 4, "do not add
   dependencies").
6. **One brief → zero or one skin, never more.** A brief that suggests
   multiple distinct directions gets filed as multiple briefs (one folder
   each). A skin PR that tries to land more than one new `SKINS` entry at once
   loses the "one reviewed, deliberate design decision" property ADR-0003 §1
   asks for — split it.

## Mechanism (how the pieces fit)

```
docs/inspiration/<name>/          <- MVP-1: the pot (this ADR)
  BRIEF.md                           reference links, vibe/adjectives, palette
  assets/                            dropped images / video (design-time only)
        |
        v
docs/AUTHORING-SKINS.md           <- MVP-2: the deterministic playbook
  read brief -> extract tokens -> map to EXISTING config surface
  -> verify AA contrast + purity -> ...
        |
        v
packages/schema/src/skins.ts      <- unchanged mechanism (#140/#141, ADR-0003)
  ONE additive SKINS["<new-id>"] entry, closed enum, override-only
        |
        v
gated PR: /code-review, purity.test.ts, acceptance.test.ts, skins.test.ts,
apps/_gallery skins.astro preview, pnpm schema:snapshot-ops (ops re-sync)
```

S3 (a later slice, not built here) adds extraction *helpers* — scripts that
capture a reference-link screenshot or video frames straight into a brief's
`assets/` — but the manual path (drop a screenshot yourself, paste a link)
already works end-to-end without them. S4 is the first real skin authored
from a real dropped brief (proof of the loop). S5 (ops) replaces the folder
with a drop-zone UI + Supabase storage; the *contract* (brief in, one skin PR
out) does not change when that lands — only where the folder lives.

## Rejected alternatives

- **Bespoke-per-client generation from the brief** (v0/Lovable-style one-off
  per site): this is exactly what ADR-0003 §4 already rejected as the fleet
  model. Restating it here because #173's own "drop links → get variety"
  framing is one implementation choice away from sliding back into it — the
  guardrail is the output type (`SKINS` entry) never the input richness.
- **A new schema field for "inspiration-derived" tokens** (e.g. a
  `design.custom` escape hatch separate from `SKINS`): defeats the closed-enum
  containment ADR-0002/0003 built purity/contrast/review gates around. Any
  token a brief produces must earn a normal `SKINS` entry through the normal
  gates — no shortcut lane.
- **An agent that authors AND merges a skin unattended:** the playbook stops
  at "open a gated PR." `/code-review` and a human (or a second agent acting
  as reviewer) stay in the loop before `packages/schema` changes — same as
  every other schema-touching change in this repo.
- **Treating reference video/images as assets to embed in a client site:**
  they are extraction input only (epic #173 non-goals) — a skin's assets are
  its `cssVarOverrides` and variant pins, not the moodboard itself.

## Non-goals

- Per-client bespoke sites or config fields — stays the paid custom-component
  tier (`CLAUDE.md`, ADR-0003 §4).
- New runtime dependencies in client output — extraction tooling is
  design-time only.
- Reproducing referenced images or code into client sites — derive palette/
  layout *ideas* only; harvested code still needs `docs/HARVESTING.md`'s
  license gate.
- Building the extraction helpers (S3), authoring a real skin from a real
  brief (S4), or the ops drop-zone UI (S5) — this ADR and its two docs cover
  MVP-1/MVP-2 (the intake convention + the playbook) only. The epic (#173)
  stays open for those slices.
- A type-scale dial for skins — still blocked on issue #86 (deferred), same
  gap `skins.ts`'s doc comments already flag for `warm-editorial`.

## Consequences

- `docs/inspiration/` is a new top-level docs folder; briefs are checked into
  this repo (git) same as any other doc — no external storage until S5.
- `docs/AUTHORING-SKINS.md` becomes the canonical playbook `/implement` and any
  future dispatched "author a skin from this brief" task follows; it
  supersedes ad hoc, undocumented skin authoring (how `warm-editorial`, #141,
  was actually done, informally).
- Adding a skin remains a **deliberate design decision reviewed like any
  other `packages/schema` change** (ADR-0003's framing, "like adding a
  palette preset") — this ADR does not lower that bar, it just gives the
  input side of it a repeatable shape.
- `SkinBrand` (`skins.ts`) does not yet expose `brand.spacingDensity`, even
  though it's part of `BrandSchema` and a plausible skin dial (a "roomy" vs.
  "tight" editorial feel). Flagged as an open design question below rather
  than silently working around it.

## Open questions for Adrian

1. `SkinBrand` is missing `spacingDensity` (`BrandSchema` has had it since the
   spacing-density slice, issue #86's sibling work) — should a follow-up issue
   add it to `skins.ts`'s `SkinBrand`/`SKINS` before S4's first real
   brief-authored skin needs it, or is per-client `brand.spacingDensity`
   override enough for now?
2. Confirmed naming: the epic body (#173) says clients pick a skin via
   `artDirection`; the shipped mechanism (#140/#141) uses `design`. This ADR
   and `docs/AUTHORING-SKINS.md` use `design` throughout, matching
   `packages/schema/src/index.ts` and `skins.ts` as they exist today. Flagging
   the mismatch in case `artDirection` was an intended rename that hasn't
   landed — if so, file it as its own schema-change issue rather than drifting
   the two names further apart.
3. Brief provenance: is a dropped reference image/video ever sensitive enough
   (a competitor's unlaunched site, a client-supplied moodboard under NDA) to
   need a `docs/inspiration/<name>/` folder kept out of a public mirror of
   this repo? Not a blocker for MVP-1/MVP-2 (repo is private today) — worth a
   one-line policy before S5 puts a drop-zone in front of non-engineers.
