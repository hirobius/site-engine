# Ops handoff — the single brief to build the `ops` side

> **What this is.** One self-contained brief to execute in a Claude Code session
> scoped to **`hirobius/ops`**. It covers everything the `hirobius/clients`
> decisions imply for ops, in execution order:
>
> - **Part A — Move the runtime engine into ops** (lead-gen + AI agent), and
>   vendor the `ClientConfig` contract.
> - **Part B — Add the Duda render/publish step** (the production render target).
> - **Part C — Record the architecture decision** in `ops/docs/ARCHITECTURE.md`.
>
> Background in `hirobius/clients`: `docs/DUDA-DELIVERY.md` (full `ClientConfig →
> Duda` mapping + spike), `docs/OPS-INTEGRATION.md` (the generic wrap-a-tool
> recipe + `leads` table). This file restates everything ops needs to act alone.
>
> Source date: 2026-06-18.

---

## 0. The end state (one paragraph)

Each repo gets one job. **`clients`** = the Astro reference templates +
the **`ClientConfig` contract** (`packages/schema`, source of truth). **`ops`** =
the **runtime engine** (lead-gen + AI agent), the **Duda render target**, and the
**dashboard** that triggers it all. The engine emits a validated `ClientConfig`;
`renderToDuda(config)` turns it into a live Duda site. Production sites ship on
**Duda** (rented, white-label); self-hosted Astro is the reference/portfolio path
only.

```
ops dashboard:  pull leads → generate site (agent) → render to Duda → publish
                 │              │                       │              │
                 ▼              ▼                       ▼              ▼
              ops/lib/      ops/lib/agent          ops/lib/        Duda site
              lead-gen      (+ ops/lib/schema)     render-duda     goes live
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
  routes in Part B replace it) or keep as a dev-only script.

### Env vars (ops Vercel project, server-only)

```
ANTHROPIC_API_KEY        # the agent pipeline
OUTSCRAPER_API_KEY       # managed lead sourcing (replaces GOOGLE_PLACES_API_KEY)
```

Used only in API routes / workers, never shipped to the client.

### Safe sequencing (do not skip)

1. **Build** `ops/lib/lead-gen` (ported config + Outscraper wrapper), **move** the
   agent + vendored schema into `ops/lib/`, rewrite imports.
2. **Verify in ops:** it typechecks and runs (see API routes in Part B; or a quick
   `tsx` smoke call) with the env vars set.
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

## Part B — Add the Duda render/publish step

Extends the lead pipeline (`leads` table + pull-leads + generate-site from
`docs/OPS-INTEGRATION.md`). Generate ends at `status='scored'` with a generated
`config`; Duda is the next stage.

### B1. Supabase migration

```sql
alter table leads add column if not exists duda_site_name text unique;
-- lifecycle: sourced → generating → scored → rendered → sent → won/lost
-- (preview_url and sent_at already exist)
```

### B2. Env vars (server-only)

```
DUDA_API_USER        # Duda white-label API username (HTTP Basic)
DUDA_API_PASSWORD    # Duda white-label API password (HTTP Basic)
DUDA_TPL_LANDSCAPING / DUDA_TPL_JUNK / DUDA_TPL_PRESSURE / DUDA_TPL_CONCRETE
                     # the 4 pre-built per-preset Duda template ids (created during the spike)
```

### B3. The render target — `ops/lib/render-duda/`

Framework-agnostic TS (deps: native `fetch`), same posture as the moved engine.

```ts
import type { ClientConfig } from "@/lib/schema"; // vendored contract

const TEMPLATE_BY_PRESET: Record<ClientConfig["brand"]["palettePreset"], string> = {
  landscaping: process.env.DUDA_TPL_LANDSCAPING!,
  "junk-removal": process.env.DUDA_TPL_JUNK!,
  "pressure-washing": process.env.DUDA_TPL_PRESSURE!,
  "concrete-fencing": process.env.DUDA_TPL_CONCRETE!,
};

/** Creates an UNPUBLISHED Duda site from the matching preset template and
 *  injects all content from the config. Returns the site handle + preview URL. */
export async function renderToDuda(config: ClientConfig): Promise<{
  dudaSiteName: string;
  previewUrl: string;
}>;

/** Flips an existing site live and attaches the domain. Billed-on-"yes" step. */
export async function publishDudaSite(dudaSiteName: string, domain: string): Promise<void>;
```

Implementation = the §B6 mapping, in order. **Spike first** (see `clients` →
`docs/DUDA-DELIVERY.md` for acceptance criteria): build one Duda template, prove
`renderToDuda` against the demo config, resolve the risks in §B6 — *gate before
wiring the board.*

### B4. API route — `app/api/render-site/route.ts` (Next.js App Router)

```ts
import { createClient } from "@supabase/supabase-js";
import { renderToDuda } from "@/lib/render-duda";

export async function POST(req: Request) {
  const { leadId } = await req.json();
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: lead } = await sb.from("leads").select("*").eq("id", leadId).single();
  if (!lead?.config) return Response.json({ error: "lead has no generated config" }, { status: 409 });

  const { dudaSiteName, previewUrl } = await renderToDuda(lead.config);

  await sb.from("leads").update({
    status: "rendered",
    duda_site_name: dudaSiteName,
    preview_url: previewUrl,
  }).eq("id", leadId);

  return Response.json({ ok: true, previewUrl });
}
```

### B5. Board buttons

- **"Render preview site"** (on a `scored` lead) → `POST /api/render-site {leadId}`
  → site appears as `rendered` with a clickable `preview_url`.
- **"Publish + attach domain"** (later, after the client says yes) →
  `POST /api/publish-site {leadId, domain}` → `publishDudaSite(...)`,
  set `status='sent'`, `sent_at=now()`. Closes the spec-site loop: previews are
  free, you bill on publish.

### B6. `ClientConfig → Duda` mapping (condensed)

Full table + spike acceptance criteria: `clients` → `docs/DUDA-DELIVERY.md`.

| `ClientConfig` | Duda mechanism |
|---|---|
| `business.{name,phone,email,address?}` | Business data fields |
| `business.hours[] {days,hours}` | Business data schedule (verify: strings vs structured) |
| `business.serviceAreas[]` | Business data areas + LocalBusiness `areaServed` |
| `brand.palettePreset` | Selects the pre-built Duda template |
| `brand.cssVarOverrides` (`--brand-*`) | Site global colors via API ⚠️ risk #1 |
| `brand.font` | Site global font (map 5 font ids → Duda fonts) |
| `brand.radius` | Template CSS ⚠️ likely not per-site via API |
| `layout.variant` (A/B) | Template choice (A image hero / B video hero) |
| `layout.sectionOrder[]` | Frozen to canonical order in the template ⚠️ |
| `services[]` | Duda Collection `services` (upload `image`, map `icon`) |
| `gallery[]` {src,alt} | Duda Collection / gallery widget (upload + alt) |
| `reviews[]` | Duda Collection `reviews` |
| `copy.{heroHeadline,heroSub,ctaLabel,about}` | Content injection into named regions |
| `hero.{image,videoSrc,videoPoster}` | Upload assets → hero widget |
| `map.{staticImage?,embedQuery?}` | Duda native map widget (supersedes both) |
| `form.*` (web3forms + hCaptcha) | **Drop** → Duda native form + spam protection; recipient = `business.email` |
| `seo.{title,description,ogImage?}` | Per-page SEO + OG |
| `seo.{city,region,siteUrl}` | LocalBusiness schema + custom domain |
| LocalBusiness JSON-LD | Duda auto-schema, else header custom-code ⚠️ risk #2 |

**Wins:** drop Web3Forms/hCaptcha; drop `astro:assets` + the repo photo-bloat
problem; no per-client Vercel project / preview middleware; clients self-edit
hours/prices; no fleet-rebuild drift.

**Risks to validate (the spike):** (1) per-site colors/font via API; (2) custom
JSON-LD injection; (3) `sectionOrder` frozen on Duda; (4) collection binding incl.
images + alt; (5) form notifications + redirect.

---

## Part C — Record the decision in `ops/docs/ARCHITECTURE.md` (paste-ready)

```md
### Client-site delivery + repo split

- **Production render target: Duda** (rented, white-label, managed). One Duda site
  per client, created from a per-preset template via the Duda API.
- **Reference render target: Astro** (`hirobius/clients` → `packages/template`,
  `apps/*`). Demo + portfolio. NOT the production fleet.
- **The contract: `ClientConfig`** (`hirobius/clients` → `packages/schema`,
  canonical). The agent emits it; every render target consumes it. `ops` vendors a
  copy (`ops/lib/schema`); don't fork the meaning.
- **Runtime engine lives in `ops`:** `ops/lib/lead-gen` (sourcing) +
  `ops/lib/agent` (enrich→generate→judge) + `ops/lib/render-duda` (render target),
  triggered from the ops board. (Moved out of `clients`.)

Flow: `lead → enrich → generate → judge → ClientConfig → renderToDuda → preview →
(on "yes") publish + domain`.

Detail: `hirobius/clients` → `docs/DUDA-DELIVERY.md`.
```

---

## Execution order (checklist)

- [ ] Confirm `hirobius-ops` is Next.js App Router + Supabase (assumed by the routes).
- [ ] **Part A:** copy lead-gen + agent + vendored schema into `ops/lib/`, rewrite
      imports, set `ANTHROPIC_API_KEY` + `OUTSCRAPER_API_KEY`, verify it runs.
- [ ] Confirm/create the `leads` table (`docs/OPS-INTEGRATION.md`); run §B1 migration.
- [ ] **Spike** the Duda render (`docs/DUDA-DELIVERY.md`): one template, prove
      `renderToDuda` on the demo config, resolve risks #1/#2 — *gate.*
- [ ] **Part B:** add `ops/lib/render-duda` + `/api/render-site` + board buttons;
      set `DUDA_*` env + the 4 template ids.
- [ ] **Part C:** record the decision in `ops/docs/ARCHITECTURE.md`.
- [ ] Back in `clients`: open the cleanup PR that deletes `packages/agent` +
      `scripts/lead-gen` (keep `packages/schema`). **Only after ops is green.**

---

## Open questions to confirm

1. Duda API exact endpoints/fields: create-from-template, business data,
   collections, content injection, SEO, custom code, publish.
2. Can global colors + font be set **per site** via API (risk #1)?
3. Is site-wide custom header HTML injectable via API (JSON-LD, risk #2)?
4. Duda plan tier for API + white-label + expected volume, and the **per-site
   monthly cost** (the number the recurring care plan must cover).
5. ops stack: App Router confirmed? Existing Supabase client / RLS helpers to reuse?
