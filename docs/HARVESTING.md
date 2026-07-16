# Harvesting section variants

How a section design from an external source becomes a config-selectable
variant in `packages/template` — with the same guarantee as everything else in
the factory: **agents building client sites pick variants via a closed enum in
`client.config.ts`; they never touch markup.** See ADR-0002 for the design.

> **Skins are the unit, variants are the rail (ADR-0003):** harvest a variant
> only in service of a skin's section vocabulary — ~3 variants per section
> max, pruned when no skin uses them. Don't grow this library for its own sake.

## Sources (three sanctioned types)

| Type | Rule |
| --- | --- |
| Open-source Astro themes | Code may be ported. **MIT / Apache-2.0 / BSD / CC0 only** — record theme name, repo URL, commit SHA, and license in `packages/template/ATTRIBUTIONS.md` plus a header comment in the variant file. GPL and marketplace/paid themes are rejected. |
| Tailwind-UI-style patterns | **Layout ideas only, re-implemented from scratch — never copy code.** Note the inspiration in the file header; no attribution obligation. |
| Reference sites Adrian points at | Same as above: from-scratch re-implementation of the layout idea only. |

## The conversion contract (every port must pass all of these)

1. **Props:** `{ config: ClientConfig }` only. No other props, no slots.
2. **Content:** every text/image slot maps to an **existing** schema field
   (`copy.*`, `business.*`, `hero.*`, `services[]`, `reviews[]`, `gallery[]`,
   `map.*`). Missing field → cut the element, or open a separate deliberate
   schema-extension issue first. **Never extend the schema inside a harvest PR.**
3. **Color:** strip all literals (hex / rgb / hsl / oklch / named / Tailwind
   palette classes incl. `bg-white`/`text-black`) → semantic utilities only
   (`bg-bg`, `bg-fg`, `bg-muted`, `bg-primary`, `text-fg`, `text-on-fg`,
   `text-on-primary`, opacity modifiers). A genuinely NEW surface/text pairing
   needs a `CONTRAST_TOKEN_PAIRS` entry in `acceptance.ts` — or avoid it.
4. **Typography:** `font-heading` / `font-body` only. No font files, no imports.
5. **Radius:** `rounded-theme` (+ `rounded-full` for pills/avatars) only.
6. **Images:** `ResponsiveImage` / astro:assets only; no remote URLs, no CSS
   `url()`; alt text from config.
7. **Motion:** reuse `.rise` / `.reveal` + the Motion island. No new `<script>`,
   no `client:` islands, no new keyframes outside `theme.css`.
8. **Dependencies:** none. No `@import`, no external `<link>`, no CDN anything.
9. **Degrade gracefully** when optional fields are absent (`hero.image`,
   `service.icon`, …) — `SECTION_REQUIREMENTS` stays per-section, never
   per-variant.
10. **Structure:** shared `Section.astro` wrapper unless full-bleed; exactly one
    `h1` (hero) or `h2` (sections); lazy-load below-fold imagery.
11. **Naming:** variant id is a short kebab-case **layout adjective**
    (`split-card`, `banner`) — never a trade name. The id is identical as enum
    value, filename, dispatcher key, and gallery label.

Most of #3–#8 is enforced deterministically by
`packages/template/src/purity.test.ts` — it sweeps every component and fails
`pnpm test` on violations. Script/external-URL exceptions are the explicit
allowlists in `purity.ts`; editing them is a reviewed diff.

### Shared partials within a section

When two or more variants of the same section repeat identical markup (e.g.
a CTA block, a background-image treatment), extract it to
`components/<section>/_<name>.astro` — the leading underscore marks it as an
internal atom, never itself a `SECTION_VARIANTS` entry or dispatcher target.
Rule #1's `{ config: ClientConfig }`-only prop shape applies to the
harvestable **variant** files (what the dispatcher's closed enum can select);
a shared partial may take a small additional prop when the variants it
serves render on genuinely different surfaces (e.g. a `tone` toggle for
dark-hero vs. light-hero CTA styling) — swept by the same purity gate either
way. Extracting is still a refactor, not a harvest: it must reproduce the
existing variants' rendered HTML byte-for-byte (see "prove the refactor
invisible" below); it never restyles or changes behavior.

## Touch list per NEW VARIANT of an existing section

1. `packages/schema/src/section-variants.ts` — add the enum value (+ a test row
   in `section-variants.test.ts`). The ops-drift test goes red:
2. `pnpm schema:snapshot-ops` **and** re-sync ops's vendored
   `lib/schema/index.mjs` in the same session (schema is canonical here).
3. `packages/template/src/components/<section>/<variant>.astro` — the component,
   with provenance header.
4. Dispatcher `components/<Section>.astro` — one import + one map entry (the
   `satisfies` check fails `astro check` if you forget).
5. `packages/template/src/index.ts` — `SECTION_VARIANT_COMPONENTS` entry
   (`registry.test.ts` fails if you forget or the file is missing).
6. `packages/template/ATTRIBUTIONS.md` — provenance row.
7. Gallery picks it up automatically from `SECTION_VARIANTS`; run the
   **Visual Baseline Seed** action to seed that section's
   `variants-<section>.png` (only that image changes).
8. `pnpm check && pnpm test && pnpm build` workspace-wide; bump
   `@hirobius/template` version — a template release is a fleet event.

## A section's FIRST harvest (adds the dispatcher)

Additionally: move the current single file to
`components/<section>/<first-variant>.astro` (that variant id is already first
in its `SECTION_VARIANTS` tuple = the default), add the dispatcher under the
original filename so app imports don't change, and update
`SECTION_VARIANT_COMPONENTS`. Prove the refactor invisible: build one client
app before/after — HTML must be identical (modulo the CSS bundle hash, which
grows by the new variants' utilities).

## Per NEW SECTION TYPE (deliberate, bigger — not a harvest)

`sectionOrder` enum + data sub-schema + `SECTION_VARIANTS` key + ops re-sync;
`SECTION_REQUIREMENTS` (+ contrast pairs) in `acceptance.ts`; dispatcher +
first variant + both registries; every app's `index.astro` `SECTIONS` map;
gallery blocks + baselines. File it as its own issue first.
