# Pipeline runbook — lead → gated preview

**Goal:** turn one real local business that has **no website** into a **gated
preview link** you can send in cold outreach. This is the path to the first
paying client. Everything here runs from **this repo** (site-engine); the LLM
copy-writer and Outscraper live in ops but are not required for a run — the
Claude Code session *is* the agent.

This doc is the context so the prompt stays short. The canonical prompt is at
the bottom — paste it into a fresh session and it does the rest.

---

## The path (7 steps)

| # | Step | Command / action |
|---|---|---|
| 1 | **Get a lead** | `pnpm pull-leads` (Outscraper), **or** supply one real lead by hand: business name, city/region, trade, Google Business Profile URL, public phone. |
| 2 | **Map to a config** | Deterministic: `leadToConfig(lead)` (`packages/schema/src/lead-to-config.ts`) → a `ClientConfig` JSON. Or the session writes the config directly from the lead's real facts. |
| 3 | **Scaffold** | `pnpm new-client <slug> --name "Business Name" --preset <preset>` — presets: `landscaping`, `junk-removal`, `pressure-washing`, `concrete-fencing`. Copies `apps/_template`. |
| 4 | **Fill the config** | `pnpm render-site <slug> --config <json>` (writes + re-validates), **or** edit `apps/<slug>/client.config.ts` directly. **Only** this file + photos. |
| 5 | **Verify (ship gate)** | `pnpm --filter @hirobius/<slug> check && pnpm --filter @hirobius/<slug> build` — both **0 errors**. The build runs Zod via `defineClient()`; a bad config fails here, not in prod. |
| 6 | **Imagery (optional)** | `PEXELS_API_KEY=<key> node apps/<slug>/scripts/fetch-photos.mjs` — run where the network can reach `api.pexels.com` (local machine or Vercel build; **blocked in the remote sandbox**). No key → ship photo-less, like the existing previews. |
| 7 | **Deploy a gated preview** | `pnpm deploy-preview <slug>` → prints the `?key=` link. Stays gated (`SITE_LIVE` unset). Never `--prod`; the script enforces preview-only. |

---

## Keys (what each step needs)

| Step | Env var | Present in remote sandbox | If missing |
|---|---|---|---|
| Pull leads | `OUTSCRAPER_API_KEY` | ✅ set | supply a lead by hand |
| LLM bespoke copy (ops engine) | `ANTHROPIC_API_KEY` | ❌ unset | the Claude session writes the copy |
| Imagery | `PEXELS_API_KEY` (+ egress) | ❌ unset / blocked | ship photo-less (#14) |
| Deploy preview | `VERCEL_TOKEN` | ✅ set | create at vercel.com/account/tokens |
| Gate secret | `PREVIEW_TOKEN` / `PREVIEW_USER`/`PASS` | auto | `deploy-preview` generates + persists them |

Keys are set by the human in the environment/CLI — **never** written to a
`.env` file, never pasted into chat.

---

## Golden-rule guardrails (non-negotiable)

1. **Never invent business facts.** Phone, address, hours, service areas,
   reviews, and claims come from the real lead or are a clearly-marked stub —
   never fabricated. `reviews: []` when there is no real review source. No
   "insured / licensed / bonded / certified / guaranteed / #1 / best" in copy
   unless a backing `business.*` field verifies it (the #149 acceptance gate
   enforces this at go-live). See `apps/monroe-street-power-wash` for the
   correct stubbed-preview shape.
2. **Previews stay gated.** A preview is *not* go-live. Go-live requires
   `SITE_LIVE=true` **and** a real `form.accessKey`, real `seo.siteUrl`, and no
   placeholders — the acceptance + claims gates block it otherwise.
3. **Config + photos only.** Do **not** touch `packages/*` or any `.astro`
   component when building a site — those are fleet-wide. If a request can't be
   expressed in the config schema, STOP and flag it (custom-component tier).
4. **`astro.config.ts` stays byte-identical to `apps/_template`** (the
   `astro-config-gate` test). Don't add build hooks to an app config.
5. **Green `check` + `build` is the gate.** Don't ship a site that isn't green.

---

## Canonical prompt (paste this into a fresh session)

> Run the next lead through the pipeline per `docs/PIPELINE-RUNBOOK.md`: get one
> real no-website lead (pull via `pnpm pull-leads`, or I'll give you one),
> scaffold it with `new-client`, and fill its `client.config.ts` from the
> lead's **real** public facts — never invent, stub every unknown. Verify
> `check` + `build` are green, then produce a **gated** preview link with
> `deploy-preview`. Follow the runbook's golden-rule guardrails. Stop and flag
> any missing key or any fact you can't source.

That's all the context an agent needs — the runbook carries the rest.
