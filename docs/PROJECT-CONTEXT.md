# Hirobius — Project Context & Handoff

> **Purpose:** paste or reference this file in a new chat to resume with full
> context. It captures the strategy, the repo, git state, the portfolio plan, the
> AI flagship, open decisions, and the gotchas already discovered so nothing gets
> re-litigated. Last updated: 2026-06-18.

---

## 0. TL;DR (read this first)

- **Two goals, run as a barbell:** (1) a **business** — mass-producing one-page
  marketing sites for local-service businesses; (2) a **portfolio** to land an
  **Applied AI Engineer** role. Same domain feeds both.
- **Business delivery decision (DECIDED — 2026-06-18):** production sites ship on
  **self-hosted Astro** (this repo, one Vercel project per client) — it's already
  built, free, and the most direct path from a generated `ClientConfig` to a live
  site. We **own the data + automation layer** (the moat), and keep the
  `ClientConfig` contract render-agnostic so the delivery platform stays swappable.
  (We evaluated a managed platform earlier this session and chose self-hosting —
  rationale is in git history; don't re-litigate without new volume signals.)
- **Portfolio flagship:** an **AI agent pipeline** (`packages/agent`) that turns a
  business lead into a validated, ready-to-ship site config with an LLM-as-judge
  quality gate + **loop engineering**. This is the centerpiece for AI-apps roles.
- **Repo:** `hirobius/clients` (GitHub; renamed from `hirobius/sites`). Monorepo:
  Astro 5 + Tailwind v4 + TS + pnpm + Turborepo.
- **Current build state:** factory + demo + gallery + lead-puller + AI agent all
  built and typecheck green. Two PRs open; agent work committed locally (unpushed,
  pending a branch decision).

---

## 1. Strategy (decisions already made)

- **Delivery (decided → self-hosted Astro):** Astro wins for us — it's built,
  free, full control, and the most direct path from a generated `ClientConfig` to a
  live site. Keep a **canonical lead/content store + the automation pipeline** as
  the proprietary layer (the moat), and keep the `ClientConfig` contract
  render-agnostic so the delivery platform stays a swappable detail if we ever
  outgrow self-hosting at volume.
- **Repo split (decided):** the **runtime engine moves to `ops`** — `scripts/lead-gen`
  + `packages/agent` → `ops/lib/` (their only runtime home is the dashboard). This
  repo keeps the **Astro reference factory** + the **`ClientConfig` contract**
  (`packages/schema`, source of truth; `ops` vendors a copy). One job per repo, no
  duplicated engine. Migration brief: **`docs/OPS-HANDOFF.md`**.
- **Niche (beachhead):** **exterior cleaning** — pressure/soft washing, roof &
  gutter, moss removal. Climate-aligned for the **Pacific Northwest (WA+OR core)**,
  fragmented, web-unsophisticated, recurring demand.
- **Pricing rec:** **build fee + recurring care plan** (~$79/mo). Recurring is
  non-negotiable because a hosted platform costs monthly. One-time-only only works
  if the client takes over hosting.
- **Lead-acquisition motion:** cold "spec site" outreach — auto-generate a tailored
  preview per lead (Vercel preview deploys are free + basic-auth gated), cold-email
  the preview link, publish + bill on "yes." Deliverability is the real constraint,
  not lead supply.
- **Portfolio target role:** **AI Engineer (apps)** — agents, tool use, RAG,
  structured output, evals, orchestration. Barbell: cheap business lane + one deep
  flagship AI build.

---

## 2. Repo structure (`hirobius/clients`)

```
packages/
  schema/      @hirobius/schema   — Zod ClientConfig + defineClient() + 4 trade presets
  template/    @hirobius/template — Astro section components, theming, SEO/JSON-LD
  agent/       @hirobius/agent    — AI pipeline (lead → validated config → eval)  ★flagship
apps/
  _template/            canonical client app (copied by new-client)
  _gallery/             internal preset/section preview (head start on design-system piece)
  demo-pressure-pros/   working demo (sharp-generated placeholder photos; Playwright smoke)
  monroe-street-power-wash/    cold-outreach preview (+ acceptance test suite)
  preview-clearout-junk/       cold-outreach preview
  preview-evergreen-lawn/      cold-outreach preview
  preview-solidline-concrete/  cold-outreach preview
scripts/
  new-client.ts         scaffold a client + print Vercel CLI commands
  eject-client.ts       flatten a client into a standalone handoff repo
  lead-gen/             Places-API lead puller (canonical lead layer)
docs/
  HANDOFF.md            client handoff (7-day window + change fee)
  INTAKE.md             per-client intake questionnaire (maps 1:1 to schema)
  AI-ENGINEERING.md     ★ living architecture + AI-eng glossary + interview prep
  BACKEND-STATUS.md     ★ backend build status + roadmap + critical path
  OPS-HANDOFF.md        ★ single brief to build the ops side (move engine + Astro render + dashboard)
  OPS-INTEGRATION.md    generic wrap-a-tool-into-ops recipe
  PROJECT-CONTEXT.md    ← this file
CLAUDE.md               agent guardrails (config-only, never touch packages/* when building a client)
```

**Stack:** Astro 5 (static) · Tailwind v4 · TypeScript · pnpm workspaces ·
Turborepo · Zod · astro:assets · Web3Forms + hCaptcha · Vercel · `@anthropic-ai/sdk`.

**Verify:** `pnpm install && pnpm build` (green) · `pnpm check` (tsc + astro check, 0 errors).

---

## 3. Git / PR state (important)

> ⚠️ **Superseded (2026-07-10).** The specific PR/branch snapshot below is a
> 2026-06-18 point-in-time and is stale — PR #2/#3/#4 and the "local-only agent
> commits" no longer describe reality. **Live git/PR state is GitHub itself; live
> project state is `status.json` + `docs/BACKEND-STATUS.md`; open work is tracked
> as GitHub Issues in this repo** (see CLAUDE.md → Fleet hub). The repo is now
> `hirobius/site-engine`. Kept below as history; full retirement of this section
> is tracked in #20.

- **Repo:** `hirobius/clients` (old `hirobius/sites` URLs redirect).
- **`main`:** contains the full monorepo (PR #2 merged).
- **`claude/hirobius-clients-monorepo-j6k3sd`** (dev branch):
  - **PR #3 (OPEN):** visual-regression safety net. https://github.com/hirobius/clients/pull/3
    - ⚠️ The `visual` CI job is **red until baselines are seeded** in the pinned
      Playwright container (one command in README → Visual regression). Expected.
  - **LOCAL-ONLY commits (unpushed):** the **AI agent** (`packages/agent`) + **loop
    engineering** + `docs/AI-ENGINEERING.md`. Pending a branch decision.
- **`claude/lead-gen-pnw`:**
  - **PR #4 (OPEN):** the lead puller (`scripts/lead-gen`). https://github.com/hirobius/clients/pull/4
- **Commit identity:** use `Claude <noreply@anthropic.com>`. Commit **signing is
  not available in the sandbox**, so commits show "Unverified" until pushed — this
  is harmless (author/email are correct).

**Pending decision:** push the agent commits to their **own branch + PR**
(`claude/agent-pipeline`, recommended) vs. onto the dev branch / PR #3.

---

## 4. Portfolio inventory (what we're building)

Three tracks: **AI-Apps**, **Design-Eng**, **GRC/cleared**.

### A. Flagship AI system — *AI-Apps track* (centerpiece, = plan's Piece 3)
| Piece | Status |
|---|---|
| `packages/agent` — enrich→generate→judge pipeline + loop engineering | ✅ built (Phase A) |
| `apps/studio` — interactive **streaming** console | ⏳ Phase B |
| Eval harness (score across prompt/model versions) | ⏳ Phase C |
| Deploy + written case study | ⏳ Phase D |

### B. Site factory + ops — *Design-Eng / "ships systems"*
`packages/schema`, `packages/template`, `apps/_template`, `apps/demo-pressure-pros`,
`apps/_gallery` (✅), `new-client`/`eject-client` (✅), CI + visual-regression (✅).

### C. Lead-gen — *data layer*
`scripts/lead-gen` — Places API + tech-detection (✅, PR #4).

### D. Existing work to fold in (don't rebuild)
- **Apply Board** (shipped React/MUI/Supabase) → **write up** (Piece 1, highest ROI).
- **Hirobius design system** → formalize using `apps/_gallery` (Piece 2).
- **Portfolio site + 2 interactive prototypes** (Piece 4, todo).

### E. Proposed (optional)
- **KONG game + multi-LLM** (GPT/Claude/Gemini) — one project covering "interactive"
  + "many LLM APIs". Keep separate from the Claude-first flagship.
- **AI-assisted GRC tool** — bridges the cleared/GRC track with AI (LLM maps
  controls→evidence, drafts policy, flags gaps).

---

## 5. The AI flagship — `packages/agent` (detail)

**Pipeline:** `enrich (Haiku) → generate (Opus, structured output via forced tool
use + Zod validate/repair) → judge (Opus LLM-as-judge) → regenerate-on-fail`, all
run on an instrumented **loop primitive** (`loop.ts` `refineLoop`).

**Files:** `llm.ts` (Anthropic client, model tiering, `callStructuredTool`),
`types.ts` (Zod schemas: Lead/Brief/GeneratedContent/JudgeResult), `schemas.ts`
(JSON Schemas for tool inputs), `enrich.ts`, `generate.ts` (assemble + validate/
repair), `judge.ts`, `loop.ts` (refineLoop: budgets, stop reasons, traces),
`pipeline.ts`, `cli.ts`, `index.ts`.

**AI-eng concepts demonstrated:** model tiering · structured output / forced tool
use · Zod-as-contract + validate/repair loop · LLM-as-judge evals · **loop
engineering** (budgets, convergence/plateau stop, per-iteration traces) ·
workflow-vs-agent judgment · prompt caching. Full map + glossary + interview
answers in **`docs/AI-ENGINEERING.md`**.

**Models (current, per Claude API reference):** `claude-opus-4-8` (strong),
`claude-haiku-4-5` (fast). SDK `@anthropic-ai/sdk` 0.69.0. Typechecks clean.

**Run it (needs `ANTHROPIC_API_KEY`):**
```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm agent --name "Rojo Moss Removal" --city Seattle --region WA
# or: pnpm agent --lead ./lead.json
```
Output = a drop-in `client.config.ts` + loop trace + eval scorecard.

**Roadmap:** Phase B (streaming web console = the clickable demo recruiters judge)
→ Phase C (eval harness) → Phase D (deploy + case study).

---

## 6. Lead-gen status — **switching to a managed scraper**

- **Decision (2026-06-18): done building our own scraper.** The self-built
  `scripts/lead-gen` (Places API client + tech-detection + orchestration) is
  **retired**. Lead sourcing becomes a thin integration with a managed
  pay-as-you-go scraper that returns outreach-ready records **including emails**
  (Places gives no email; cold-email is the whole motion).
- **Provider: Outscraper** (recommended — Google Maps + email/socials,
  ~$1–3 / 1,000 records). Wrapped behind a swappable interface (Apify as the
  fallback). Built in `ops/lib/lead-gen` during the migration — see
  `docs/OPS-HANDOFF.md` → "Lead sourcing".
- **Keep only the query definitions:** `config.ts` METROS (WA+OR core metros, 37
  areas) + KEYWORDS (7 exterior-cleaning terms) → fed to the scraper as queries.
- **Why not keep Places:** it was already ~free at our volume, but it returns no
  email and the per-site tech-detection was blocked by sandbox egress. A managed
  scraper hands us emails + handles ToS/IP-bans for cents per record.
- **Env:** `OUTSCRAPER_API_KEY` (replaces `GOOGLE_PLACES_API_KEY`), server-only.
- **Reminder (our own README):** deliverability — not lead supply — is the real
  constraint. Don't over-invest in sourcing; invest in sending/warmup.

---

## 7. Gotchas / learnings (don't re-discover these)

- **Vercel preview gate = Routing Middleware** (`apps/<slug>/middleware.ts`), NOT
  Astro middleware (which doesn't run on static output). Verified against Vercel
  docs. Basic-auth via `PREVIEW_USER`/`PREVIEW_PASS`, prod passes through, noindex
  lives in the middleware (vercel.json can't be env-scoped). Not yet live-deployed.
- **Tailwind v4 ignores `node_modules`** → each app's `global.css` uses `@source`
  to opt the symlinked template package in; `eject-client` rewrites it.
- **Playwright browser download is firewalled in the sandbox** → the smoke test and
  visual-regression run in **CI**, not locally. Visual baselines must be seeded
  once in the pinned `mcr.microsoft.com/playwright` container, then committed.
- **Node global `fetch` + Places pagination stalls** behind the egress proxy → the
  puller defaults to single-page queries + a 20s request timeout.
- **Env vars** go in the Claude Code **web environment settings** (`.env` format,
  no quotes), **not** GitHub secrets (those only reach CI). Changes take effect on
  a **new session**, not mid-session.
- **Commit signing** unavailable in sandbox → "Unverified" badge is expected;
  author/email (`Claude <noreply@anthropic.com>`) are correct.
- **Live deploy / real Vercel + real lead pull** can't be fully done from the
  sandbox without the user's tokens/keys and an active (non-idle) session.

---

## 8. Open tasks (the tracker — prefix `HC-`)

> ⚠️ **Retired (2026-07-10).** The `HC-` list is a legacy 2026-06-18 tracker and
> **no longer exists as a live board.** Open work is tracked as **GitHub Issues in
> this repo** (CLAUDE.md → Fleet hub), which also sync to `ops/ops/tasks`; current
> project state is `status.json` + `docs/BACKEND-STATUS.md`. The items below are
> kept only as historical record — do not treat any as open. Full retirement of
> this file is tracked in #20.

- [ ] **HC-01** Push agent commits to own branch + PR `claude/agent-pipeline` *(needs OK)*
- [ ] **HC-02** Run Phase A live on a real lead (set `ANTHROPIC_API_KEY`)
- [ ] **HC-03** Build Phase B — `apps/studio` interactive streaming console
- [ ] **HC-04** Phase C — eval harness (score across prompt/model versions)
- [ ] **HC-05** Phase D — deploy flagship + write case study
- [ ] **HC-06** Re-run the PNW lead sweep cleanly (raise budget ~$15, run while active)
- [ ] **HC-07** Seed visual-regression baselines in the Playwright container; get PR #3 green + merge
- [ ] **HC-08** Merge PR #4 (lead puller)
- [ ] **HC-09** Live-deploy demo to Vercel `--prod`; verify the middleware preview gate
- [ ] **HC-10** Write up **Apply Board** case study (Piece 1)
- [ ] **HC-11** Formalize **design system** via `apps/_gallery` (Piece 2)
- [ ] **HC-12** Build **portfolio site** + 2 interactive prototypes (Piece 4)
- [ ] **HC-13** (optional) KONG game + multi-LLM showcase
- [ ] **HC-14** (optional) AI-assisted GRC tool (cleared/GRC track)
- [ ] **HC-15** Learning: Azure **AI-102** anchor cert; DeepLearning.AI (RAG/Agents/Evals); Python+SDK basics
- [ ] **HC-16** Decide photo object storage before ~client 20 (S3/R2/Vercel Blob)
- [ ] **HC-17** Wire `new-client` to append launched clients to `apps/_gallery` fleet list; tag `@hirobius/template` v0.1.0

> The live backlog now lives in **`docs/BACKEND-STATUS.md`** (status + critical path).
> The `HC-` list above is legacy; treat BACKEND-STATUS as the source of truth.

---

## 9. Commands cheat sheet

```bash
pnpm install
pnpm build            # turbo build all (invalid Zod config fails here)
pnpm check            # tsc (packages) + astro check (apps)
pnpm new-client <slug> --name "Business" --preset <preset>   # presets: landscaping|junk-removal|pressure-washing|concrete-fencing
pnpm eject-client <slug>                                      # standalone handoff repo
GOOGLE_PLACES_API_KEY=... pnpm pull-leads [--dry-run|--limit 50]
ANTHROPIC_API_KEY=... pnpm agent --name "..." --city "..." --region "ST"
```

---

## 10. Immediate next decisions

The critical path is in **`docs/BACKEND-STATUS.md §4`**. The first move:

1. **Run the agent live on ONE real lead** — prove it produces a good `ClientConfig`.
2. **Deploy the demo/first site live on Vercel** + verify the preview gate (was HC-09).
3. Then: outreach + billing (the biggest unbuilt pieces, BACKEND-STATUS §G/§H).
```
