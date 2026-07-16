# Hirobius — Backend Status & Architecture

> **Narrative-only.** This document describes the current state and shape of
> the backend — what exists, what's a gap, how the pieces fit together — for
> orientation. It is **not** a task tracker: open work is tracked as
> **GitHub Issues** in this repo (see `CLAUDE.md` → Fleet hub). Strategy/why
> lives in `PROJECT-CONTEXT.md`. It reconciled and superseded the old `HC-`
> checklist that used to live in `PROJECT-CONTEXT.md §8` (retired; see #20).
>
> Last updated: 2026-07-02.
>
> **2026-07-02 ops sync (authoritative):** ops executed the handoff — engine
> vendored (`lib/agent` verbatim, `lib/schema`, new Outscraper `lib/lead-gen`),
> verified offline; first live generate awaits `ANTHROPIC_API_KEY`. The Astro
> render seam is built in ops (`lib/render` + `POST /api/render-site`; lifecycle
> `scored→rendered→published→sent`, billing on `published`). The `leads` table
> exists in ops Supabase (stub rows only). Ops's frozen Duda code is removed once
> **#8** closes (factory live + preview gate verified). The engine here is
> **frozen** pending **#10**; **#17** migrated to ops; **#16** reframed as a
> public portfolio artifact. Task source of truth = GitHub Issues (#8–#19).

## Legend

- ✅ **Done** (built + working)
- ⬜ **Built, not validated** (code exists, never run for real)
- 🟡 **Specced, not built** (design exists in a doc; no code)
- 🔴 **GAP** (not captured anywhere until now)
- 🔵 **External gate** (needs an account / manual setup before code can run)
- ❓ **Unknown** (must confirm in the `ops` repo — not visible from `clients`)

---

## 0. Where we are (the honest one-paragraph)

**Pre-revenue.** What EXISTS: the AI agent pipeline (Phase A — typechecks, never
run on a real lead), the `ClientConfig` contract, and the **Astro production
factory + demo** (built, but never deployed live). Everything that turns this into
a **business** — managed lead sourcing, the ops backend wiring, a live deploy,
**cold outreach, billing** — is still to build. **0 paying clients, 0 leads saved,
nothing deployed live.** Production renders on self-hosted Astro. The architecture
is sound and documented; the backend is mostly unbuilt.

---

## 1. The target pipeline (end to end)

```
[ source leads ] → [ AI generates site config ] → [ render: Astro ] → [ cold outreach ]
   Outscraper          ops/lib/agent                 new-client+Vercel     EMAIL (no plan yet)
       │                    │                              │                      │
       ▼                    ▼                              ▼                      ▼
   leads table         config + eval                 preview deploy        reply / "yes"
                                                                                  │
                                                          [ close + bill ] ◄──────┘
                                                           Stripe (no plan yet) → publish + domain
```

Render = self-hosted **Astro** (the factory is built). Two of the six stages
(**outreach, billing**) had no design at all.

---

## 2. Backend build-out by subsystem

*A snapshot of what exists per subsystem, not a punch list — anything still
open is tracked as a GitHub Issue, not implicitly slated here.*

### A. Data layer — Supabase (`ops`)
| Piece | Status | Notes |
|---|---|---|
| `leads` table (sourced→…→won/lost, + config/eval/preview fields) | ✅ | Exists in ops Supabase (upsert on `place_id`; board reads it). Only stub rows (`stub-` prefix) until live sourcing. |
| `clients` / `subscriptions` entity (a won lead becomes a paying client) | 🔴 | No model for post-conversion: account, plan, live-site mapping, MRR. |
| Email **suppression / unsubscribe** list | 🔴 | Legally required for cold email; nowhere today. |
| RLS / auth policies | ❓ | Confirm in `ops`. |

### B. Lead sourcing
| Piece | Status | Notes |
|---|---|---|
| Outscraper integration → `ops/lib/lead-gen/index.ts` | ⬜ 🔵 | **Built in ops (2026-07-02)**; not yet run live. Needs **Outscraper account + `OUTSCRAPER_API_KEY`**. Returns website **+ email**. |
| Query defs (METROS + KEYWORDS) ported from `config.ts` | 🟡 | Only part of the old scraper that survives. |
| Self-built Places puller | ✅→🗑️ | Built, now **retired** (replaced by Outscraper). |

### C. AI generation engine
| Piece | Status | Notes |
|---|---|---|
| Agent pipeline (enrich→generate→judge→`refineLoop`) | ✅ ⬜ | Built in `clients/packages/agent`, typechecks; **never run on a real lead.** |
| `ClientConfig` contract | ✅ | `packages/schema`; vendor a copy to `ops/lib/schema`. |
| Run live on ONE real lead (validate Phase A) | ⬜ | The single most important proof. (was HC-02) |
| **Image sourcing for auto-gen spec sites** (stock by trade — Pexels/Unsplash API) | 🔴 | Demo used fake placeholder photos. Real previews need real imagery; no plan. |
| Eval harness (score across prompt/model versions) | 🟡 | Phase C; portfolio + quality. |

### D. Render targets — **production = Astro now**
| Piece | Status | Notes |
|---|---|---|
| Astro factory + demo (`new-client`, `eject`, components) | ✅ | **Production render target.** Built. |
| Live Vercel deploy + preview-gate verified (one project per client) | ⬜ | Documented + CLI commands printed; never actually deployed live (was HC-09). |
| Auto-render flow (agent `ClientConfig` → scaffold app → commit → deploy) | 🟡 | Agent already emits `client.config.ts`; the scaffold+commit+deploy orchestration is semi-manual today (fine at low volume). |
| Template versioning + freeze ejected sites (fleet-drift guard) | 🟡 | Matters now that we self-host; see README policy. |

### E. API routes (Next.js App Router, `ops`)
| Piece | Status | Notes |
|---|---|---|
| `/api/pull-leads` | 🟡 | Sketched. |
| `/api/generate-site` | 🟡 | Sketched. |
| `/api/render-site` | 🟡 | Sketched. |
| `/api/publish-site` (+ domain attach) | 🟡 | Sketched. |
| Auth on the trigger routes | 🔴 ❓ | Must not be open endpoints; no plan confirmed. |
| Bulk worker / cron (status-queue pattern) | 🟡 | "v3" — after the one-at-a-time path works. |

### F. Dashboard / board UI (`ops`)
| Piece | Status | Notes |
|---|---|---|
| Leads board (table + status lifecycle) | ❓ | Confirm what exists at ops-dusky.vercel.app. |
| Action buttons (pull / generate / render / publish) | 🟡 | Specced; depend on the routes above. |
| Realtime / polling updates | 🟡 | Supabase realtime or short poll. |
| Surface loop traces + eval scorecards | 🔴 | The "I measure quality" view; not built. |

### G. Outreach / cold email — 🔴 **BIGGEST GAP** (no design anywhere)
> Your own docs say **deliverability — not lead supply — is the real constraint.**
> Yet there is zero plan for the system that actually does outreach. This is the
> highest-risk unspecced area.

| Piece | Status | Notes |
|---|---|---|
| Email provider choice | 🔴 | Cold-sequence tool (Smartlead / Instantly) vs transactional (Resend/Postmark). Likely a cold-outreach platform, not raw transactional. |
| Sending domains + inbox **warmup** | 🔴 | Separate domain(s) from the brand; weeks of warmup before volume. |
| Sequence automation (preview link + follow-ups) | 🔴 | The actual campaign. |
| Reply detection → lead status (`sent`→`replied`) | 🔴 | Close the loop back into Supabase. |
| Unsubscribe + CAN-SPAM/CASL compliance | 🔴 | Legal must-have. |
| Email verification / bounce control | 🔴 | Protects domain reputation. |

### H. Billing / payments — 🔴 **GAP**
| Piece | Status | Notes |
|---|---|---|
| Stripe: one-time build fee + recurring care plan (~$79/mo) | 🔴 | The actual revenue mechanism; nothing exists. |
| Checkout / payment link triggered on "yes" | 🔴 | Ties to the publish step. |
| Subscription lifecycle gates hosting (unpaid → unpublish?) | 🔴 | Policy + webhook handling. |
| Client/subscription data model | 🔴 | See §A. |

### I. Domains
| Piece | Status | Notes |
|---|---|---|
| Domain acquisition (buy on client's behalf) | 🔴 | Registrar API or manual. |
| Attach domain to the Vercel project on publish | 🟡 | `vercel domains add`; semi-manual at low volume. |

### J. Cross-cutting / infra
| Piece | Status | Notes |
|---|---|---|
| Secrets (server-only env vars) | 🟡 | Enumerated in `OPS-HANDOFF.md`. |
| `clients` cleanup PR (delete agent + lead-gen) | 🟡 | **Only after** ops is green. |
| Build/deploy telemetry on the ops board | 🔴 | AGENTS.md claims it; not built. |

---

## 3. HC tracker reconciliation (historical)

The old `HC-` numbered checklist (formerly `PROJECT-CONTEXT.md §8`, now
retired) was reconciled into this document on 2026-07-02: completed items
(HC-01, HC-08) and the obsolete scraper sweep (HC-06) were closed out; the
still-open backend items at the time (HC-02, HC-09, HC-16, the engine move)
and the gaps that weren't captured anywhere before (outreach, billing, the
client/subscription model, image sourcing, dashboard auth) became the
subsystem breakdown in §2 above. Nothing from that tracker remains open
outside of what §2 already reflects — current open work lives as GitHub
Issues, not as a list here.

---

## 4. The dependency chain to first revenue

The subsystems in §2 aren't independent — they chain: leads have to exist
before the agent can generate a config, a config has to render before
outreach has anything to send, and outreach has to land a reply before
billing has anything to bill. In dependency order, that's the `ops` data
layer (§A) → the agent running live on a real lead (§C) → Outscraper sourcing
(§B) → the Astro render going live (§D) → an outreach MVP (§G — the
highest-risk, least-specced link) → a billing MVP (§H) → first paying client.
**Choosing Astro shortened the render link** — §D is wiring an existing,
already-built factory rather than a render integration built from zero.
Everything past that chain — bulk automation, board polish, the eval harness,
portfolio work — is downstream of it. Current sequencing and priority for
this chain live as GitHub Issues, not as a checklist here.

---

## 5. Bottom line

The **pipeline** backend (source → generate → render → publish) is well-specced
and ~0% built. The **business** backend (outreach, billing, the client model) was
**not captured at all** and is now in §G/§H/§A — and outreach (§G) is both the
biggest gap and your stated #1 constraint. Nothing here is hard individually; the
risk is that the unbuilt list is longer than it looked, and the highest-risk piece
(cold email deliverability) had no owner.
