# Ops handoff — the single brief to build the `ops` side

> **What this is.** One self-contained brief to execute in a Claude Code session
> scoped to **`hirobius/ops`**. It covers everything the `hirobius/clients`
> decisions imply for ops, in execution order:
>
> - **Part A — Move the runtime engine into ops** (lead-gen + AI agent), and
>   vendor the `ClientConfig` contract.
> - **Part B — Render via the Astro factory** (production render path).
> - **Part C — Record the architecture decision** in `ops/docs/ARCHITECTURE.md`.
>
> Background in `hirobius/clients`: `docs/OPS-INTEGRATION.md` (the generic
> wrap-a-tool recipe + `leads` table). This file restates everything ops needs to
> act alone.
>
> Source date: 2026-06-18.
>
> **Execution status (2026-07-02, from ops):** this brief has been executed —
> **Part A done** (engine vendored: `lib/agent` verbatim, `lib/schema`, new
> Outscraper `lib/lead-gen`; verified offline; first live generate awaits
> `ANTHROPIC_API_KEY`). **Part B seam built** (`lib/render` emits
> `client.config.ts` + factory commands; `POST /api/render-site`; lifecycle
> `scored→rendered→published→sent`, billing on `published`). **Part C done**
> (ops `ARCHITECTURE.md` rewritten 2026-06-30). Remaining: ops live generate →
> clients cleanup (#10) → then this brief is **deleted** (transfer briefs die
> after execution).

---

## 0. The end state (one paragraph)

Each repo gets one job. **`clients`** = the Astro production templates + the
**`ClientConfig` contract** (`packages/schema`, source of truth) + the per-client
site deploys. **`ops`** = the **runtime engine** (lead-gen + AI agent) + the
**dashboard** that triggers it. The engine emits a validated `ClientConfig`; for
now a human/script runs it through the Astro factory and deploys to Vercel.

```
ops dashboard:  pull leads → generate site (agent) → [config] → render via Astro factory → deploy
                 │              │                                  (clients: new-client + Vercel)
                 ▼              ▼
              ops/lib/      ops/lib/agent
              lead-gen      (+ ops/lib/schema)
```

---

## Part A — Move the runtime engine into ops

### What moves vs. what's vendored vs. what's replaced

| From `hirobius/clients` | Action | Lands in ops |
|---|---|---|
| `scripts/lead-gen/config.ts` (METROS + KEYWORDS + qualifying signals) | **port** (query definitions only) | `ops/lib/lead-gen/config.ts` |
| `scripts/lead-gen/places.ts` + `qualify.ts` + `pull-leads.ts` (self-built scraper) | **RETIRE** — replaced by a managed scraper (see "Lead sourcing" below) | — |
| `packages/agent/src/*` | **move** | `ops/lib/agent/` |
| `packages/schema/src/*` (`ClientConfig` + `defineClient` + presets) | **vendor a copy** (stays canonical in `clients`) | `ops/lib/schema/` |

- **Decision:** we are **done building our own scraper.** Lead sourcing becomes a
  thin integration with a managed pay-as-you-go scraper that returns
  outreach-ready records (incl. emails). Keep only the *query definitions*
  (what/where to search); drop the custom Places client, the per-site
  tech-detection, and the orchestration.
- **Move** = single home in ops; the copy in `clients` is deleted afterward.
- **Vendor** = `ops` keeps its own copy of the contract because the Astro factory
  in `clients` also needs it. The contract changes rarely; re-sync on change.

### Lead sourcing — managed scraper (replaces the self-built puller)

Provider: **Outscraper** (recommended — Google Maps + email/socials, pay-as-you-go,
~$1–3 / 1,000 records, returns website **and** email). Wrap it behind a small
interface so it's swappable (e.g. Apify's Google Maps Scraper actor) without
touching callers.

```ts
// ops/lib/lead-gen/index.ts
import { buildQueries } from "./config";   // ported: `${keyword} in ${area}` list

export interface SourcedLead {
  placeId: string; name: string; phone?: string; website?: string;
  email?: string; rating?: number; reviewCount?: number;
  address?: string; region: string;
}

/** Calls the managed scraper for each query, dedupes by place id, returns
 *  outreach-ready leads. Provider behind OUTSCRAPER_API_KEY. */
export async function pullLeads(opts?: { limit?: number }): Promise<SourcedLead[]>;
```

- Send `buildQueries()` to Outscraper's Google Maps Search **with email
  enrichment** enabled; dedupe by Google place id; upsert to `leads`
  (`status='sourced'`).
- **Qualification is now optional.** Outscraper returns `website` + `email`, so the
  cheapest qualifier is just `has_website = !website`. Only rebuild the old "bad
  site = good lead" tech-detection if you want that angle for the cold-email pitch.

### Files

```
lead-gen  → ops/lib/lead-gen/   : config.ts (ported), index.ts (Outscraper wrapper, new)
agent     → ops/lib/agent/      : index.ts, llm.ts, types.ts, schemas.ts, enrich.ts,
                                  generate.ts, judge.ts, loop.ts, pipeline.ts (+ README)
schema    → ops/lib/schema/     : index.ts, presets.ts   (vendored copy of the contract)
```

All framework-agnostic TS. Deps: `@anthropic-ai/sdk`, `zod`, native `fetch`.

### Import rewrites

- In the moved `agent`, change `import … from "@hirobius/schema"` →
  `import … from "@/lib/schema"` (the vendored contract).
- The `cli.ts` entrypoint in `agent` is a CLI wrapper — **drop it** (the ops API
  routes replace it) or keep as a dev-only script.

### Env vars (ops Vercel project, server-only)

```
ANTHROPIC_API_KEY        # the agent pipeline
OUTSCRAPER_API_KEY       # managed lead sourcing (replaces GOOGLE_PLACES_API_KEY)
```

Used only in API routes / workers, never shipped to the client.

### Safe sequencing (do not skip)

1. **Build** `ops/lib/lead-gen` (ported config + Outscraper wrapper), **move** the
   agent + vendored schema into `ops/lib/`, rewrite imports.
2. **Verify in ops:** it typechecks and runs (a quick `tsx` smoke call) with the
   env vars set.
3. **Only after ops is green:** open a `clients` PR that **deletes** `scripts/lead-gen`
   (entirely — retired) + `packages/agent`, and their workspace wiring / root
   `package.json` scripts (`pnpm pull-leads`, `pnpm agent`). Keep `packages/schema`.
4. **Never delete from `clients` before ops has them building** — that's the only
   copy until step 2 passes.

> `clients`-side cleanup checklist (the follow-up PR there): remove
> `packages/agent` + `scripts/lead-gen`, drop their `pnpm-workspace.yaml` globs and
> root `package.json` scripts, drop `@anthropic-ai/sdk` if nothing else uses it,
> and trim `docs/AI-ENGINEERING.md` references to "now lives in ops".

---

## Part B — Render via the Astro factory (production)

After generate (`status='scored'` with a `config`), the site is rendered with the
**existing Astro factory in `clients`** — one Vercel project per client:

1. **Scaffold:** `pnpm new-client <slug> --name "…" --preset <preset>`.
2. **Fill config:** write the agent's `config` into `apps/<slug>/client.config.ts`;
   add photos (stock by trade until intake — see `BACKEND-STATUS.md §C`
   image-sourcing gap).
3. **Deploy:** `vercel link` → `vercel deploy` (preview, basic-auth gated) → on
   "yes", `vercel deploy --prod` + `vercel domains add`.

### Supabase

Lifecycle gains a `rendered` state:
`sourced → generating → scored → rendered → sent → won/lost`. `preview_url` and
`sent_at` already exist — set `preview_url` + `status='rendered'` once the preview
deploys, and `status='sent'` + `sent_at` after outreach.

### Board buttons

- **"Render site"** (on a `scored` lead) → surfaces the generated `config` + the
  printed `new-client`/Vercel commands (semi-manual at low volume), or triggers a
  deploy action once automated. Sets `status='rendered'`, `preview_url`.
- **"Publish + attach domain"** (after the client says yes) → `vercel deploy --prod`
  + `vercel domains add`; set `status='sent'`, `sent_at=now()`. Closes the spec-site
  loop: previews are free (basic-auth gated), you bill on publish.

### Automation note

At low volume the scaffold→deploy is **fine semi-manual** — the board just needs to
show the `config` + the commands. Full programmatic scaffold→commit→deploy (git +
Vercel orchestration) is a later optimization; the agent already emits a drop-in
`client.config.ts`, so most of the work is done.

---

## Part C — Record the decision in `ops/docs/ARCHITECTURE.md` (paste-ready)

```md
### Client-site delivery + repo split

- **Production render target: self-hosted Astro** (`hirobius/clients` →
  `packages/template`, `apps/*`, `new-client` + Vercel). One Vercel project per
  client.
- **The contract: `ClientConfig`** (`hirobius/clients` → `packages/schema`,
  canonical). The agent emits it; the render target consumes it. `ops` vendors a
  copy (`ops/lib/schema`); don't fork the meaning.
- **Runtime engine lives in `ops`:** `ops/lib/lead-gen` (sourcing) +
  `ops/lib/agent` (enrich→generate→judge), triggered from the ops board. (Moved out
  of `clients`.) Render happens via the Astro factory in `clients`.

Flow: `lead → enrich → generate → judge → ClientConfig → Astro factory → Vercel
deploy → preview → (on "yes") prod + domain`.
```

---

## Execution order (checklist)

- [ ] Confirm `hirobius-ops` is Next.js App Router + Supabase (assumed by the routes).
- [ ] **Part A:** build `ops/lib/lead-gen` (Outscraper) + move agent + vendor schema
      into `ops/lib/`, rewrite imports, set `ANTHROPIC_API_KEY` + `OUTSCRAPER_API_KEY`,
      verify it runs.
- [ ] Confirm/create the `leads` table (`docs/OPS-INTEGRATION.md`); add the
      `rendered` status.
- [ ] **Part B (Astro render):** surface the generated `config` + the
      `new-client`/Vercel commands on the board; deploy the first site live.
- [ ] **Part C:** record the decision in `ops/docs/ARCHITECTURE.md`.
- [ ] Back in `clients`: open the cleanup PR that deletes `packages/agent` +
      `scripts/lead-gen` (keep `packages/schema`). **Only after ops is green.**

---

## Open questions to confirm

1. ops stack: Next.js App Router confirmed? Existing Supabase client / RLS helpers
   to reuse?
2. Does a `leads` table already exist, or create it from `docs/OPS-INTEGRATION.md`?
3. Has the Astro factory been deployed live to Vercel + the preview-gate verified
   yet? (`BACKEND-STATUS.md` — was HC-09.)
4. **Outreach + billing are the biggest unbuilt pieces** (`BACKEND-STATUS.md`
   §G/§H) — sequence them right after the first real render.
