# AGENTS.md — `hirobius/clients`

> **Org architecture (source of truth):** `hirobius/ops` → `docs/ARCHITECTURE.md`.
> Read that first — it defines the multi-repo system, naming, contracts, and the
> rename/retire runbook. This file is **this repo's lane** within it.

## Role
`hirobius/clients` is the **reference site factory + the `ClientConfig` contract**.
The runtime engine (lead-gen + AI agent) **moves to `ops`** — see below.

- **Contract (stays here, the seam):** `packages/schema` (`ClientConfig` +
  `defineClient`). Canonical source of truth; the Astro factory and the agent both
  consume it. `ops` vendors a copy and re-syncs on the rare contract change.
- **Astro reference factory (stays here):** `packages/template` (components,
  theming, SEO/JSON-LD), `apps/*` (`_template`, `_gallery`, demo),
  `scripts/new-client` + `eject-client`. This is the **reference render target**
  (demo + portfolio), **not** production.
- **Runtime engine (MOVES to `ops`):** `packages/agent` (enrich→generate→judge +
  the `refineLoop` loop primitive) moves to `ops/lib/agent`. **Lead sourcing is
  being replaced** by a managed scraper (Outscraper) — the self-built
  `scripts/lead-gen` puller is **retired**; only its query definitions (METROS +
  KEYWORDS) get ported. Their only runtime home is the `ops` dashboard.
  Migration brief: `docs/OPS-HANDOFF.md`. Until that lands they remain here as the
  source — do not delete before `ops` is building.

**Delivery:** production sites ship on **Duda** (`docs/DUDA-DELIVERY.md`). The
engine emits a `ClientConfig`; a render target turns it into a site — Astro
(reference) or Duda (production). Funnel: **leads (CRM in `ops`) → become →
clients (their sites, rendered via Duda).**

## Contracts this repo owns (the seams — agree before parallel work)
- **`ClientConfig`** (`packages/schema`) — the data contract the agent emits and
  every render target consumes (Astro + Duda). Both sides import it; don't fork.
- **`ClientConfig → Duda` mapping** — `docs/DUDA-DELIVERY.md` (production render target).
- **Wrap-a-tool recipe** — `docs/OPS-INTEGRATION.md` (how the engine plugs into `ops`).
- **Sites build/deploy telemetry** — owned here, surfaced on the `ops` board.

## Boundaries (do-not-cross)
- **Move, don't duplicate:** the runtime engine (`packages/agent`,
  `scripts/lead-gen`) is framework-agnostic TS (deps: `@anthropic-ai/sdk`, `zod`,
  native `fetch`) → it **moves to `ops/lib/<tool>/`** (single home), with `ops` API
  routes as thin wrappers. No long-lived copy in both repos. The `ClientConfig`
  contract (`packages/schema`) is the exception: it stays here and `ops` vendors it.
- **Secrets are server-only:** `ANTHROPIC_API_KEY`, `OUTSCRAPER_API_KEY`,
  `SUPABASE_*` live in API routes/workers, never the client.
- **UI components** live in `design-system` (future); apps import, never fork.
- **Config-only client builds:** see `CLAUDE.md` — building a client edits only
  `apps/<slug>/client.config.ts` + photos, never `packages/*`.

## Key docs in this repo
| File | What |
|---|---|
| `CLAUDE.md` | client-build rules (config-only is the gate) |
| `docs/PROJECT-CONTEXT.md` | full session/handoff context |
| `docs/AI-ENGINEERING.md` | the agent architecture + AI-eng glossary + interview map |
| `docs/DUDA-DELIVERY.md` | production delivery: `ClientConfig` → Duda mapping + spike |
| `docs/OPS-HANDOFF.md` | **the single brief to build the `ops` side** (move engine + Duda render + dashboard) |
| `docs/OPS-INTEGRATION.md` | the generic wrap-a-tool-into-`ops` recipe |
| `docs/HANDOFF.md`, `docs/INTAKE.md` | client handoff + intake |

## Multi-agent coordination
- **One agent per repo lane.** This lane = the reference factory + the contract
  (the runtime engine moves to the `ops` lane).
- The **contracts above are the seams** — agree them before parallel work in
  `ops` / `design-system`.
- **After the org rename** (ARCHITECTURE.md runbook): re-scope agent sessions and
  re-point Vercel git integration + MCP repo scopes. GitHub auto-redirects git
  remotes, but those integrations do **not** follow automatically.
