# AGENTS.md — `hirobius/clients`

> **Org architecture (source of truth):** `hirobius/ops` → `docs/ARCHITECTURE.md`.
> Read that first — it defines the multi-repo system, naming, contracts, and the
> rename/retire runbook. This file is **this repo's lane** within it.

## Role
`hirobius/clients` is the **client site factory + the lead-gen / AI-engine source**.

- **Site factory (stays here):** `packages/schema` (`ClientConfig` + `defineClient`),
  `packages/template` (Astro components, theming, SEO/JSON-LD), `apps/*` (per-client
  sites, `_template`, `_gallery`, demo), `scripts/new-client` + `eject-client`.
- **Lead-gen + AI engine (source here, ported into `ops/lib/`):**
  `scripts/lead-gen` (Places puller) + `packages/agent` (enrich→generate→judge + the
  `refineLoop` loop primitive).

Funnel: **leads (CRM in `ops`) → become → clients (their sites, here).**

## Contracts this repo owns (the seams — agree before parallel work)
- **`ClientConfig`** (`packages/schema`) — the data contract the agent emits and the
  factory renders. Both sides import it; don't fork.
- **Wrap-a-tool recipe** — `docs/OPS-INTEGRATION.md` (how the engine plugs into `ops`).
- **Sites build/deploy telemetry** — owned here, surfaced on the `ops` board.

## Boundaries (do-not-cross)
- **Reuse, don't rewrite:** the engine (`packages/agent`, `scripts/lead-gen`) is
  framework-agnostic TS (deps: `@anthropic-ai/sdk`, `zod`, native `fetch`) → it is
  **ported into `ops/lib/<tool>/`**, with `ops` API routes as thin wrappers. Keep it
  portable.
- **Secrets are server-only:** `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY`,
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
| `docs/OPS-INTEGRATION.md` | the wrap-a-tool-into-`ops` recipe |
| `docs/HANDOFF.md`, `docs/INTAKE.md` | client handoff + intake |

## Multi-agent coordination
- **One agent per repo lane.** This lane = the factory + the engine source.
- The **contracts above are the seams** — agree them before parallel work in
  `ops` / `design-system`.
- **After the org rename** (ARCHITECTURE.md runbook): re-scope agent sessions and
  re-point Vercel git integration + MCP repo scopes. GitHub auto-redirects git
  remotes, but those integrations do **not** follow automatically.
