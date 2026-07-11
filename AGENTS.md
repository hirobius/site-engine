# AGENTS.md — `hirobius/clients`

> **Org architecture (source of truth):** `hirobius/ops` → `docs/ARCHITECTURE.md`.
> Read that first — it defines the multi-repo system, naming, contracts, and the
> rename/retire runbook. This file is **this repo's lane** within it.

## Role
`hirobius/clients` is the **production site factory + the `ClientConfig` contract**.
The runtime engine (lead-gen + AI agent) **moves to `ops`** — see below.

- **Contract (stays here, the seam):** `packages/schema` (`ClientConfig` +
  `defineClient`). Canonical source of truth; the Astro factory and the agent both
  consume it. `ops` vendors a copy and re-syncs on the rare contract change.
- **Astro production factory (stays here):** `packages/template` (components,
  theming, SEO/JSON-LD), `apps/*` (`_template`, `_gallery`, demo),
  `scripts/new-client` + `eject-client`. **This is the production render target**
  (one Vercel project per client).
- **Runtime engine (MOVES to `ops`):** `packages/agent` (enrich→generate→judge +
  the `refineLoop` loop primitive) moves to `ops/lib/agent`. **Lead sourcing is
  being replaced** by a managed scraper (Outscraper) — the self-built
  `scripts/lead-gen` puller is **retired**; only its query definitions (METROS +
  KEYWORDS) get ported. Their only runtime home is the `ops` dashboard.
  Migration brief: `docs/OPS-HANDOFF.md`. Until that lands they remain here as the
  source — do not delete before `ops` is building.

**Delivery:** production sites ship on **self-hosted Astro** (this repo, one Vercel
project per client). The engine emits a `ClientConfig`; the Astro factory renders
it. The contract is render-agnostic, so the delivery platform stays swappable.
Funnel: **leads (CRM in `ops`) → become → clients (their Astro sites).**

## Contracts this repo owns (the seams — agree before parallel work)
- **`ClientConfig`** (`packages/schema`) — the data contract the agent emits and
  the render target consumes. Both sides import it; don't fork.
- **Wrap-a-tool recipe** — `docs/OPS-INTEGRATION.md` (how the engine plugs into `ops`).
- **Sites build/deploy telemetry** — owned here, surfaced on the `ops` board.
- **Schema-drift guard** — `packages/schema/src/ops-drift.test.ts` compares a
  normalized shape (field keys/nesting/kind, via `src/shape.ts`) of the
  canonical `ClientConfigSchema` + `presets.ts` against
  `packages/schema/ops-shape.snapshot.json`, a frozen snapshot of the last
  known-synced `ops/lib/schema`. It runs as part of `pnpm test` (wired into
  `ralph/gate.sh` + `ci.yml` already). **After re-syncing `ops/lib/schema`**
  to match a canonical change, refresh the snapshot: `pnpm schema:snapshot-ops`.
  If that test fails on an unrelated PR, the two copies have drifted — sync
  `ops` first, don't just regenerate the snapshot to silence it.

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
| `docs/BACKEND-STATUS.md` | backend build status + roadmap + critical path |
| `docs/OPS-HANDOFF.md` | **the single brief to build the `ops` side** (move engine + Astro render + dashboard) |
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

## Ralph quality bar

REPO_TYPE: production
QUALITY BAR: Site factory is production. Never touch live client output without a passing build.

Rules for any autonomous loop in this repo:
- One issue per PR. Small steps. Never push to main.
- The gate (ralph/gate.sh) must pass before any PR. No exceptions.
- Fight entropy: leave the code better than you found it.
- No shortcut that creates debt someone else pays for.
- Merges are HUMAN-approved: `ralph-approved` on the PR, or the issue
  pre-tagged `ralph-auto` (batch approval). Never merge yourself.

Loop mechanics (see `ralph/README.md` for the full contract):

- Labels: `ralph-ready` (queue, human) · `p0`–`p3` (priority, human) ·
  `ralph-auto`/`ralph-approved` (merge approval, human) · `ralph-wip`
  (claimed, loop) · `ralph-parked`/`needs-adrian` (parked with reason, loop) ·
  `ralph-selfheal-attempted` (gate's one bounded repair, spent).
- Selection is deterministic (`ralph/next.sh`: priority label, then issue #);
  claims are atomic (`refs/heads/ralph/claim-<n>`); the loop's exit codes are
  a contract (`ralph/run.sh` header). Agents never touch `ralph-*` labels,
  claim refs, or `ralph/{.lock,runs.jsonl,logs/}` — the harness owns those.
- The engine is org-level: workflows are thin callers into
  `hirobius/ralph/.github/workflows/ralph-{run,gate}-reusable.yml@main`.
