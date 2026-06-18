# Integrating Tools into `hirobius-ops` (Command Center)

> **What this is.** `hirobius-ops` (deployed at ops-dusky.vercel.app, Supabase-backed)
> is the hub everything ties into. This is the **repeatable pattern** for wrapping a
> standalone tool into the dashboard so a **button triggers it → it does work →
> results land in Supabase → the board renders them**.
>
> Part 1 is the generic recipe (use it for *any* tool). Part 2 is the worked
> example: the lead-gen + AI-agent pipeline from `hirobius/clients`.
>
> Last updated: 2026-06-17.

---

## Part 1 — The generic pattern (works for any tool)

Every "wrap a tool into the dashboard" integration is the same four parts:

```
[ Button/form in dashboard ]
        │  POST (authed)
        ▼
[ API route ]  ──(short work: do it inline)──►  [ Supabase table ]  ──►  [ Board renders ]
        │
        └──(long work: enqueue)──►  rows with status='queued'
                                      ▲
                          [ worker / cron ] drains queued→done in small batches
```

1. **Data model** — a Supabase table for the tool's outputs, with a **`status`
   lifecycle** column and a **natural unique key** (for idempotent re-runs).
2. **Trigger** — a button/form in the dashboard that POSTs to an API route.
3. **Runner** — a server-side API route (or background worker) that runs the
   tool's logic with its secrets and writes rows to Supabase.
4. **Render** — the board reads the table (Supabase realtime or poll) and shows
   results + status.

### Decisions baked in (apply to every tool)

- **Serverless timeouts (~10–60s).** Keep each invocation small. If the work can
  exceed that (bulk sweeps, multi-step LLM loops), **don't** do it in one request —
  use the **status-queue pattern**: the button inserts rows as `queued`, and a
  worker/cron drains `queued → done` in small batches. The board shows live status.
- **Secrets are server-only.** Tool API keys + the Supabase **service-role key**
  live in the ops project's env and are used **only in server code** (API routes /
  workers), never shipped to the client.
- **Reuse, don't rewrite.** Port the tool's core logic into `lib/<tool>/` as
  framework-agnostic functions (pure logic + `fetch`); the API route is a thin
  wrapper. (Or publish the logic as a shared npm package and import it.)
- **Idempotency.** Upsert on a natural key so re-runs don't duplicate rows.
- **Auth the triggers.** Protect the API routes (dashboard session or a secret
  header) so they aren't open endpoints.
- **Realtime.** Use a Supabase realtime subscription (or short polling) so the
  board updates as rows change status.

### Generic checklist

- [ ] Supabase table `<tool>_items` with `status` + a unique natural key
- [ ] `lib/<tool>/` — ported core logic, pure + testable
- [ ] `app/api/<tool>/route.ts` — validate input → run logic → write via service-role client
- [ ] Dashboard button/form → calls the route → optimistic update / refresh
- [ ] Env vars added to the ops Vercel project (server-only)
- [ ] If work > ~30s: split into **enqueue** (route) + **worker** (cron/queue)
- [ ] Board subscribes (realtime) or polls to live-update

### Stack assumptions (confirm for hirobius-ops)

- **Next.js App Router** → routes live at `app/api/<tool>/route.ts`. (Adjust for
  Pages Router or another framework.)
- **Supabase** via `@supabase/supabase-js`; service-role key server-side only.

---

## Part 2 — Worked example: lead-gen + AI-agent pipeline

Wrapping the two tools from `hirobius/clients` (the Places **lead puller** and the
**AI agent pipeline**) into the dashboard.

### Buttons (staged so each call fits a timeout)

- **v1 — "Pull leads"** → `POST /api/pull-leads` `{ niche, metro, count }`
  - Runs Places sourcing (one page, ~20 results — fits in-timeout).
  - Upserts rows to `leads` (status `sourced`, dedupe on `place_id`).
  - Board refreshes → leads appear. **Ships first.**
- **v2 — per-lead "Generate site"** → `POST /api/generate-site` `{ leadId }`
  - Runs the agent (enrich → generate → judge) on one lead (~30s — fits).
  - Updates the row: `config`, `eval_score`, `eval_pass`, `status='scored'`.
- **v3 (later) — one-click bulk** → button enqueues; a cron/worker drains
  `sourced → scored` in batches (the status-queue pattern from Part 1).

### Supabase schema

```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  -- sourcing (Places puller)
  place_id text unique,
  name text, category text, phone text, website text,
  city text, region text, rating numeric, review_count int,
  has_website boolean, qualified boolean, qualify_reason text,
  -- generation (AI agent)
  status text default 'sourced',   -- sourced → generating → scored → sent → won/lost
  config jsonb,                    -- the generated ClientConfig
  eval_score numeric, eval_pass boolean, eval_notes text,
  loop_iterations int,
  -- outreach
  preview_url text, sent_at timestamptz
);
create index on leads (status);
```

### Source to port from `hirobius/clients`

| Bring over | Role |
|---|---|
| `scripts/lead-gen/*` (`config.ts`, `places.ts`, `qualify.ts`, `pull-leads.ts`) | sourcing — Places API + tech-detection |
| `packages/agent/src/*` (`llm`, `types`, `schemas`, `enrich`, `generate`, `judge`, `loop`, `pipeline`) | the enrich→generate→judge pipeline + loop primitive |
| `packages/schema` (`ClientConfig` + `defineClient`) | the agent's validation contract (port or publish as a package) |

These are framework-agnostic TS (deps: `@anthropic-ai/sdk`, `zod`, native `fetch`).
In the ops repo they become `lib/lead-gen/` and `lib/agent/`; the API routes are
thin wrappers. Note: the puller defaults to single-page Places queries + a 20s
request timeout (pagination stalls behind some egress proxies).

### API route sketch (Next.js App Router)

```ts
// app/api/pull-leads/route.ts
import { createClient } from "@supabase/supabase-js";
import { pullLeads } from "@/lib/lead-gen";          // ported sourcing

export async function POST(req: Request) {
  const { niche, metro, count = 20 } = await req.json();
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const leads = await pullLeads({ niche, metro, max: count }); // Places, 1 page
  const rows = leads.map((l) => ({ ...l, status: "sourced" }));
  const { error } = await sb.from("leads").upsert(rows, { onConflict: "place_id" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ inserted: rows.length });
}
```

```ts
// app/api/generate-site/route.ts
import { createClient } from "@supabase/supabase-js";
import { runPipeline } from "@/lib/agent";           // ported agent

export async function POST(req: Request) {
  const { leadId } = await req.json();
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: lead } = await sb.from("leads").select("*").eq("id", leadId).single();
  if (!lead) return Response.json({ error: "lead not found" }, { status: 404 });

  const result = await runPipeline({
    name: lead.name, city: lead.city, region: lead.region,
    category: lead.category, phone: lead.phone, website: lead.website,
  });

  await sb.from("leads").update({
    status: "scored",
    config: result.config,
    eval_score: result.judge.overall,
    eval_pass: result.judge.pass,
    eval_notes: result.judge.notes,
    loop_iterations: result.loop.iterations,
  }).eq("id", leadId);

  return Response.json({ ok: true, score: result.judge.overall });
}
```

### Env vars (ops Vercel project, server-only)

```
GOOGLE_PLACES_API_KEY        # Places sourcing
ANTHROPIC_API_KEY            # the agent pipeline
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY    # server-side writes only — never client
```

### Open questions to confirm in the ops repo

1. Is `hirobius-ops` Next.js App Router? (assumed — drives the route shape)
2. Does a `leads` table already exist, or create from the schema above?
3. Existing Supabase client/helpers to reuse (auth, RLS policies)?

---

## How to execute

Open a Claude Code session **on `hirobius/hirobius-ops`** and follow Part 2 (or
Part 1 for a different tool). Bring `hirobius/clients`'s `docs/PROJECT-CONTEXT.md`
for full background on the puller + agent being ported.
