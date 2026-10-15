# ADR-0006 — A generated client site is a seed, not a live link to HDS

**Status:** Accepted (2026-10-14, Adrian)
**Scope:** `packages/template` (`src/styles/tokens.css`, `hds-contract.snapshot.json`), every `apps/<client>` site
**Related:** ADR-0005 (the factory shares HDS's names, not its package)

## Context

The template keeps its own token values in `packages/template/src/styles/tokens.css`,
forked from `@hirobius/design-system`, and holds only HDS's custom-property names to
`hds-contract.snapshot.json` (ADR-0005). The 2026-10-14 audit flagged this as a "frozen
token file". It is intentional. A live client site is a delivered product: an HDS
release that changes a colour, radius or spacing value must never change what a
client's customers see without Adrian choosing it for that client.

What was not intentional is that the names snapshot was refreshed by hand. It sat at
HDS 0.24.1 after 0.25.0 shipped.

## Decision

- **A generated site is a seed.** At generation it takes the current token values. After
  that it never follows HDS automatically. There is no package dependency, no Dependabot
  and no auto-sync from HDS into `tokens.css` or any `apps/<client>`.
- **Restyling a live client is always a per-client decision by Adrian.**
- **Only the names snapshot refreshes automatically.**
  `.github/workflows/hds-snapshot-refresh.yml` runs weekly, regenerates
  `hds-contract.snapshot.json` from the latest published HDS and opens a PR with the
  name-contract test result. It changes names only; `tokens.css` and the client apps are
  untouched. A red contract test on that PR is a real name drift for a person to decide on.

## Consequences

- Live sites are stable across HDS releases by construction.
- The name contract stays current within a week of an HDS release, so the template and
  the brand bridge keep speaking HDS's vocabulary.
- Adopting new HDS values in the template is a deliberate template change, reviewed with
  the visual regression check, and reaches existing clients only when Adrian chooses.
