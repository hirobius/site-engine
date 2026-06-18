# Ops handoff — Duda delivery (architecture + pipeline step)

> **What this is.** A single, self-contained brief to execute in a Claude Code
> session scoped to **`hirobius/ops`**. It carries two deliverables that came out
> of the `hirobius/clients` Duda-delivery decision:
>
> 1. **Record the architecture decision** in `ops/docs/ARCHITECTURE.md` (org
>    source of truth).
> 2. **Add the Duda render/publish step** to the ops pipeline (extends the
>    existing lead-gen + AI-agent integration).
>
> Full background lives in `hirobius/clients`:
> `docs/DUDA-DELIVERY.md` (the `ClientConfig → Duda` mapping + spike) and
> `docs/OPS-INTEGRATION.md` (the original wrap-a-tool recipe + `leads` table).
> This file restates everything an ops session needs so it can execute alone.
>
> Source date: 2026-06-18.

---

## 0. The decision in one paragraph

Production client sites ship on **Duda** (rented, white-label, managed), not a
self-hosted Astro fleet. The **moat is the engine** — `packages/schema`
(`ClientConfig` contract) + `scripts/lead-gen` (Places sourcing) +
`packages/agent` (enrich→generate→judge) — which is platform-agnostic and ported
into `ops/lib/`. The Astro stack in `clients` is the **reference render target**
(demo + portfolio), not the production fleet. The engine emits a validated
`ClientConfig`; a render target turns it into a site. **`renderToDuda(config)`**
is the production render target, called from the ops board.

---

## 1. For `ops/docs/ARCHITECTURE.md` (paste-ready)

Add/merge this under the delivery/contracts section:

```md
### Client-site delivery

- **Production render target: Duda** (rented, white-label, managed). One Duda
  site per client, created from a per-preset template via the Duda API.
- **Reference render target: Astro** (`hirobius/clients` → `packages/template`,
  `apps/*`). Demo + portfolio + where the schema was proven. NOT the production
  fleet — do not scale it past the demo.
- **The contract: `ClientConfig`** (`hirobius/clients` → `packages/schema`). The
  agent emits it; every render target consumes it. Do not fork it.
- **Engine (moat, platform-agnostic):** schema + lead-gen + agent. Sourced in
  `clients`, ported into `ops/lib/`, triggered from the ops board.

Flow: `lead → enrich → generate → judge → ClientConfig → renderToDuda → preview
→ (on "yes") publish + domain`.

Mapping + spike detail: `hirobius/clients` → `docs/DUDA-DELIVERY.md`.
```

---

## 2. Pipeline step to add (the build work)

This extends the existing ops integration (`leads` table + pull-leads +
generate-site). The generate step ends at `status='scored'` with a generated
`config`; Duda is the next stage.

### 2a. Supabase migration

```sql
-- add a stable Duda site handle (natural key for idempotent re-render/publish)
alter table leads add column if not exists duda_site_name text unique;

-- lifecycle gains a 'rendered' state:
-- sourced → generating → scored → rendered → sent → won/lost
-- (preview_url and sent_at already exist on the table)
```

### 2b. Env vars (ops Vercel project, server-only)

```
DUDA_API_USER        # Duda white-label API username (HTTP Basic)
DUDA_API_PASSWORD    # Duda white-label API password (HTTP Basic)
```

Same handling rule as `ANTHROPIC_API_KEY` / `GOOGLE_PLACES_API_KEY`: used only in
API routes / workers, never shipped to the client.

### 2c. Port the render target — `ops/lib/render-duda/`

Framework-agnostic TS (deps: native `fetch`), mirroring `ops/lib/lead-gen` and
`ops/lib/agent`. Public surface:

```ts
import type { ClientConfig } from "@/lib/schema"; // ported ClientConfig contract

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

Implementation = the steps in §3 mapping, in order. Per-preset Duda template ids
are config/env, not hardcoded.

### 2d. API route — `app/api/render-site/route.ts` (Next.js App Router)

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

### 2e. Board buttons

- **"Render preview site"** (on a `scored` lead) → `POST /api/render-site {leadId}`
  → site appears as `rendered` with a clickable `preview_url`.
- **"Publish + attach domain"** (later, on `rendered` → after the client says yes)
  → `POST /api/publish-site {leadId, domain}` → `publishDudaSite(...)`,
  set `status='sent'`, `sent_at=now()`. This closes the spec-site outreach loop:
  unpublished previews are free, you bill on publish.

---

## 3. `ClientConfig → Duda` mapping (condensed)

Source of truth for the left column: `hirobius/clients` →
`packages/schema/src/index.ts`. Full table + the spike's acceptance criteria are
in `docs/DUDA-DELIVERY.md`. Condensed for implementation:

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
| `form.*` (web3forms + hCaptcha) | **Drop** → Duda native form + built-in spam protection; recipient = `business.email` |
| `seo.{title,description,ogImage?}` | Per-page SEO + OG |
| `seo.{city,region,siteUrl}` | LocalBusiness schema + custom domain |
| LocalBusiness JSON-LD | Duda auto-schema, else header custom-code ⚠️ risk #2 |

**Wins:** drop Web3Forms/hCaptcha; drop `astro:assets` + the repo photo-bloat
problem; no per-client Vercel project / preview middleware; clients self-edit
hours/prices; no fleet-rebuild drift.

**Risks to validate (the spike):** (1) per-site colors/font via API; (2) custom
JSON-LD injection; (3) `sectionOrder` is frozen on Duda; (4) collection binding
incl. images + alt; (5) form notifications + redirect. Spike acceptance criteria:
`docs/DUDA-DELIVERY.md`.

---

## 4. Execution checklist (ops session)

- [ ] Confirm `hirobius-ops` is Next.js App Router + Supabase (assumed by §2d).
- [ ] Confirm the `leads` table from `docs/OPS-INTEGRATION.md` exists; run §2a.
- [ ] Add `DUDA_*` env vars (§2b) + the four preset template ids.
- [ ] **Spike first** (`docs/DUDA-DELIVERY.md`): build one Duda template, prove
      `renderToDuda` against the demo config, resolve risks #1/#2 — *gate before
      wiring the board.*
- [ ] Port `ops/lib/render-duda/` (§2c) + add `/api/render-site` (§2d).
- [ ] Add the "Render preview site" board button (§2e); "Publish + domain" later.
- [ ] Record the decision in `ops/docs/ARCHITECTURE.md` (§1).

---

## 5. Open questions to confirm

1. Duda API exact endpoints/fields: create-from-template, business data,
   collections, content injection, SEO, custom code, publish.
2. Can global colors + font be set **per site** via API (risk #1)?
3. Is site-wide custom header HTML injectable via API (JSON-LD, risk #2)?
4. Duda plan tier for API + white-label + expected volume, and the **per-site
   monthly cost** (the number the recurring care plan must cover).
5. ops stack: App Router confirmed? Existing Supabase client/RLS helpers to reuse?
