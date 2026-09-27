# Inspiration intake ("the pot")

How Adrian (or anyone) hands the fleet a reference — links, screenshots, video
— and turns it into fleet-wide visual variety **without** breaking the
config-only moat. Read `docs/adr/0004-inspiration-intake.md` first: the short
version is **inspiration feeds skin authoring, not per-client bespoke
generation.** One brief here produces at most one new entry in the shared
`SKINS` registry (`packages/schema/src/skins.ts`) that *every* client can then
pick via `design: "…"` — never a one-off for a single site.

This is MVP-1 of epic #173. MVP-2 (`docs/AUTHORING-SKINS.md`) is the
deterministic playbook that turns a brief written here into a skin PR.

## What goes here

One folder per idea, under `docs/inspiration/<name>/`:

```
docs/inspiration/
  _template/
    BRIEF.md              <- copy this to start a new brief
  <name>/
    BRIEF.md               reference links, vibe/adjectives, target sections
    assets/
      screenshot-1.png      dropped images (moodboard, reference screenshots)
      clip.mp4               dropped video (design-time reference only)
```

- **`<name>`** is a short kebab-case slug for the *direction*, not a client —
  a layout adjective or vibe word (`coastal-minimal`, `industrial-bold`),
  same naming instinct as `docs/HARVESTING.md`'s variant ids. Never a client
  or business name; a brief informs a skin every client can use.
- **`BRIEF.md`** is the filled-in template below — reference links, dropped
  assets, target vibe/adjectives, palette leanings, which sections to
  emphasize, any must-have hero feel.
- **`assets/`** holds dropped images/video used as extraction input only.
  These are **design-time references, never shipped to a client site** —
  `docs/AUTHORING-SKINS.md`'s extraction step reads them to derive palette/
  type/spacing/motion values, then the brief's job is done. Keep files
  reasonably sized (screenshots/short clips, not raw camera dumps) — this
  folder lives in git, same as the rest of `docs/`.

## Starting a new brief

```bash
mkdir -p docs/inspiration/<name>/assets
cp docs/inspiration/_template/BRIEF.md docs/inspiration/<name>/BRIEF.md
# drop reference links into BRIEF.md, images/video into assets/, fill in the vibe section
```

To pull a reference straight into `assets/`, use the S3 (epic #173) capture
helper:

```bash
# desktop 1440x900 + mobile 390x844 screenshot per link -> assets/link-<host>-<n>[-mobile].png
pnpm inspiration:capture <name> --url https://example.com [--url …] [--full-page]
# sample frames from a dropped clip -> assets/<clip>-frame-001.png, …
pnpm inspiration:capture <name> --video docs/inspiration/<name>/assets/clip.mp4 [--fps 1]
```

It needs Chromium (`pnpm --filter @hirobius/gallery exec playwright install chromium`)
for links and `ffmpeg` for video (or run inside
`mcr.microsoft.com/playwright:v1.60.0-noble`), and fails with that fix named
when either is missing. S5 (later, ops) replaces the folder with a drop-zone
UI + Supabase storage. The manual path above still works end-to-end without
either.

## What happens to a brief

An agent (or Adrian) follows `docs/AUTHORING-SKINS.md` exactly to turn one
brief into **one** additive `packages/schema/src/skins.ts` entry, gated by
`/code-review`, the purity gate, and the WCAG AA contrast check — same rigor
as any other `packages/schema` change. A brief that doesn't clearly justify a
new, distinct art direction (or that an existing skin already covers) doesn't
get forced into one — see ADR-0004 point 1.

## What this is not

- **Not a per-client design request.** If a brief is really "make *this one
  client's* site look like X," that's the custom-component engagement
  `CLAUDE.md`'s "one rule that matters" already defines — flag it, don't
  route it through here.
- **Not a place to drop business facts.** Phone numbers, hours, addresses,
  reviews still come from `docs/INTAKE.md` per client. A brief is about
  *look*, never business content.
- **Not a code source.** If a reference link's *layout* (not its business
  content) is worth porting as a new section variant, that still goes through
  `docs/HARVESTING.md`'s full conversion contract (license check, semantic
  tokens, purity gate) — a brief can call out that a variant is needed, but
  authoring the variant itself is a harvest, not a skin-authoring step.

## Cross-links

- `docs/adr/0004-inspiration-intake.md` — the decision this convention
  implements, and its guardrails.
- `docs/AUTHORING-SKINS.md` — the playbook that consumes a brief.
- `docs/adr/0003-skins-design-packs.md` — why skins are the unit of variety
  at all, and why bespoke is rejected.
- `docs/HARVESTING.md` — the section-variant conversion contract a brief may
  point to, but does not replace.
