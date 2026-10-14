# ADR-0005 — Skins are directions; the factory shares HDS's names, not its package

**Status:** Accepted (2026-10-12, Adrian)
**Scope:** `packages/template` (the token spine, the brand bridge, the name-contract module, its snapshot, test and refresh script)
**Related:** ADR-0003 (skins are the unit of variety), ADR-0004 (inspiration intake; its 2026-10-12 addendum carries the 21st.dev rule), hds ADR-035 (<https://github.com/hirobius/hds/blob/main/docs/adr/035-directions-brands-preferences.md>) and its glossary (<https://github.com/hirobius/hds/blob/main/GLOSSARY.md>)

## Context

The fleet had three words for one idea. HDS called a curated art direction a
demo tenant, this repo calls it a skin, and hds#628's "Ceiling" builds are the
same thing again. Meanwhile this repo's token spine, forked from
`@hirobius/design-system@0.13.0` on 2026-07-09 (#42), declared the fork
"deliberate and final: HDS is paused" (#180, 2026-07-16). HDS is not paused: it
ships daily, its settled decision (hds#124) says the website engine "consumes
the published token layer; never forks it", and nobody had reconciled the two.
The fork's other reasons still hold: the factory consumes no React, the
package would add 69 dependencies, client sites ship light-only, and an HDS
release must never restyle a client site (README → "Fleet rebuild drift").

The brand bridge (`packages/template/src/lib/brand-overlay.ts`) was vendored
from HDS's `@hirobius/design-system/brand` and has since grown two factory
dials. Shadow rewrites `--semantic-shadow-*`, names HDS publishes; spacing
density writes `--semantic-spacing-section-y` and `-y-lg`, names HDS has no
token for. Nothing checked that the names the two sides share still agree.

## Decision

1. **A skin is a direction.** hds ADR-035 names the three layers the whole fleet
   uses: a **direction** (a curated, reviewed art direction any client can
   select; here a `SKINS` entry chosen by `design`), a **brand** (one client's
   identity; here `brand.palettePreset` plus `brand.cssVarOverrides` in
   `apps/<slug>/client.config.ts`, sourced from the ops lead row, never
   upstreamed anywhere), and a **preference** (the viewer's theme and density;
   the factory ships light-only and has none). `docs/AUTHORING-SKINS.md` and
   `docs/SKIN-CRITIC.md` keep the word skin for the mechanism; the concept is a
   direction.
2. **Values stay fleet-owned; names are HDS's.** `packages/template/src/styles/tokens.css`
   keeps its own values, versioned with `@hirobius/template`. Every custom
   property it declares, and every one the bridge writes, must exist in the
   published package's `variables.css`, recorded in
   `packages/template/hds-contract.snapshot.json` and held by
   `packages/template/src/hds-contract.test.ts`. The only exceptions are the
   factory-owned dial variables, listed by name in
   `packages/template/src/hds-contract.ts` (today `--semantic-spacing-section-y`
   and `--semantic-spacing-section-y-lg`; a later dial adds its names there, a
   reviewed diff), and the `--brand-*` palette keys both bridges write for the
   consumer's own stylesheet. The same test fails if HDS ever publishes a
   factory-owned name, so an accidental collision cannot pass, and it fails if a
   component reads an HDS-namespaced name the spine does not declare, since the
   factory ships no HDS stylesheet to fall back on.
   `packages/template/scripts/refresh-hds-contract.ts`
   (`pnpm template:snapshot-hds`) refreshes the snapshot from npm with the same
   parsers the test uses; a red test after a refresh is a drift to decide on,
   never to silence.
3. **The bridge is a contract.** `brand-overlay.ts` is HDS's `BrandPalette` and
   its writes, plus the factory dials. The test holds both halves: every field
   HDS's bridge accepts stays on ours, every variable HDS's bridge writes, ours
   writes too. A palette that themes an HDS app therefore themes a client site
   the same way.
4. **The levers are one vocabulary.** hds ADR-035 carries the table mapping the
   factory's dials (`radius`, `spacingDensity`, `fontPairing`, `shadow`,
   `motion`, the `primary` + `accent` pair) onto HDS's knobs; the table also
   names `typeScale`, which is not yet a factory dial (#86). This repo keeps its
   enums; the shared names are what the two sides cite.

## Rejected alternatives

- **Re-add `@hirobius/design-system` as a dependency.** Every HDS release would
  become a fleet event, for a package whose React half the factory never
  imports. The names are the useful part, and a snapshot carries them.
- **Rename `skin` to `direction` in code and config.** `design: "warm-editorial"`
  is the shipped config key, ops's vendored schema mirrors it, and ADR-0004's
  playbook is written around it. The concept is settled by the glossary; the
  identifier rename is churn with no reader.

## Consequences

- `tokens.css` drops `--primitive-typography-size-7xl`: HDS removed it in the
  type-ramp rework and nothing here referenced it, so the one visible change is
  one fewer unused declaration in every app's emitted CSS. The file's header no
  longer says HDS is paused.
- `pnpm test` fails when a name the template relies on leaves the published
  contract, with the refresh command in the message.
- When HDS adds a supporting-accent token (the hds#628 proposal), the bridge
  maps `accent` onto it and the 2026-07-08 "no HDS home" note on
  `--brand-accent` closes; until then `--brand-accent` stays a factory palette
  key.
