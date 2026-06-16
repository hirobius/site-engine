# AI Engineering — Living Architecture & Learning Map

> **Purpose.** One artifact that (a) explains how the AI system fits together, (b)
> teaches the terminology and patterns an *applied AI engineer* is expected to
> speak to, and (c) maps both onto the portfolio/learning plan. Update it as we
> build — every component links to the concept it demonstrates and a one-liner
> you can say out loud in an interview.
>
> Last updated: 2026-06-16.

---

## 1. The big picture

We run **two lanes** on one domain (local-service marketing sites):

- **Lane 1 — the business** (cash): bulk client sites, delivered cheaply (static/Duda).
- **Lane 2 — the flagship AI system** (portfolio): an agent that turns a *lead*
  into a *validated site* with a *quality gate*. Same data, different purpose.

This doc is about **Lane 2** — the part that proves "applied AI engineer."

```mermaid
flowchart LR
  L[Lead\nscripts/lead-gen] --> E[enrich\nHaiku]
  E --> G[generate\nOpus + validate/repair]
  G --> J[judge\nOpus LLM-as-judge]
  J -->|pass| R[(Validated\nClientConfig)]
  J -->|fail| G
  R --> T[Render\n@hirobius/template]
  subgraph packages/agent  the brain
    E
    G
    J
  end
```

ASCII, for terminals:

```
 Lead ─▶ enrich ─▶ generate ─▶ judge ─┬─ pass ─▶ ClientConfig ─▶ render (Astro template)
 (puller) (Haiku)  (Opus,      (Opus,  │
                    validate/   eval)   └─ fail ─▶ back to generate (with feedback)
                    repair)
```

**The data contract that ties it together:** every stage moves toward a single
typed object — `ClientConfig` (the Zod schema in `packages/schema`). The LLM's
job is to fill it; `defineClient()` is the gate that proves it's valid. *Same
gate the whole site factory uses* — the AI can't produce anything the build
wouldn't accept.

---

## 2. Components → concepts → interview one-liners

| Component | File | Concept it demonstrates | Say this in an interview |
|---|---|---|---|
| **Model tiering** | `llm.ts` `MODELS` | Cost/latency vs. quality tradeoff | "Haiku for high-volume enrichment, Opus for generation and judging — I don't pay Opus prices for work a small model does well." |
| **Structured output** | `llm.ts` `callStructuredTool` | Forced tool use / function calling | "I force a single tool with `tool_choice`, so the model *must* return arguments matching my JSON schema instead of free text I'd have to parse." |
| **Schema as contract** | `packages/schema` + `generate.ts` | Validation, single source of truth | "The JSON schema shapes the model; **Zod** is the real contract. The model's output is validated by the exact same `defineClient()` the production build runs." |
| **Validate/repair loop** | `generate.ts` | Reliability / self-correction | "On a validation failure I feed the precise Zod errors back and let the model fix them — bounded retries, then it fails loudly. No silently-broken output." |
| **LLM-as-judge** | `judge.ts` | **Evals** | "A separate model call scores the result against a rubric and can trigger a regeneration. That scorecard is the seed of an offline eval harness." |
| **Workflow vs agent** | `pipeline.ts` | Knowing which tier to use | "This is a *workflow* — deterministic, code-orchestrated steps — not an open-ended agent. I reach for agents only when the trajectory is genuinely unknown." |
| **Prompt caching** | `llm.ts` `cacheSystem` | Cost control at scale | "The large, stable system prompts are cached, so a batch of leads pays the prompt cost roughly once." |
| **Ingestion** | `scripts/lead-gen` | Tool/data integration | "Leads come from the Google Places API with tech-detection to flag bad/no-site businesses — the system's data source." |
| **Render target** | `packages/template` | End-to-end delivery | "The validated config renders to a real static site — the pipeline produces a shippable artifact, not just text." |

---

## 3. Roadmap (where this is going)

- **Phase A — core agent** ✅ *(this commit)* — `enrich → generate(validate/repair) → judge`, CLI.
- **Phase B — interactive console** — a web app (`apps/studio`) that **streams** each
  step live (tool calls, the judge's scores, the rendered preview). Adds:
  *streaming UX, server endpoints, an interactive surface recruiters can click*.
- **Phase C — eval harness** — run the pipeline over a labeled set of businesses,
  track scores across prompt/model versions. Adds: *offline evals, regression
  tracking, the "I measure quality" story most portfolios lack*.
- **Phase D — deploy + case study** — live demo + a written Problem→Approach→
  Decisions→Outcome page.

Each phase deepens one box of the architecture without rebuilding it.

---

## 4. Glossary (the vocabulary to own)

- **LLM / token / context window** — the model; its unit of text; how much it can
  "see" at once. Know the rough numbers for the models you use.
- **Prompt engineering** — shaping behavior via instructions/examples. *System
  prompt* = persistent role/rules; *few-shot* = examples in the prompt.
- **Structured output** — constraining the model to emit a fixed shape (JSON
  schema). Two routes: **forced tool use** (what we use) and the API's
  structured-outputs format. Always validate after.
- **Tool use / function calling** — the model emits a request to call a named
  function with typed args; your code runs it and returns the result. `tool_choice`
  forces *which* tool (or *any*/*none*).
- **Agent vs. workflow** — *workflow*: you orchestrate fixed steps. *Agent*: the
  model decides its own next action in a loop. Start at the simplest tier that works.
- **RAG (retrieval-augmented generation)** — fetch relevant context (vector/keyword
  search) and put it in the prompt so the model answers from *your* data. *(Not in
  Phase A; a natural Phase C+ addition — e.g. retrieve similar businesses/examples.)*
- **Embeddings / vector DB** — numeric representations of text for similarity
  search; the storage that powers RAG.
- **Eval / LLM-as-judge** — measuring output quality. *Offline evals* run on a
  fixed dataset; *online evals* sample production. A judge model scoring a rubric
  is one technique.
- **Prompt caching** — reusing the computed prefix of a stable prompt to cut cost/
  latency. Invalidated by any byte change in the cached prefix.
- **Repair loop / self-correction** — feeding validation errors back for a retry.
- **Streaming** — receiving tokens as they're generated (SSE); essential for
  responsive UIs and long outputs.
- **Guardrails** — input/output checks (schema validation, content filters,
  refusal handling) that keep a system safe and well-formed.
- **Observability / tracing** — logging each step (inputs, outputs, tokens, cost,
  latency) so you can debug and measure. *(Phase B/C.)*
- **Idempotency / determinism** — same input → same effect; matters for retries
  and evals. LLMs aren't deterministic, which is *why* validation + evals matter.

---

## 5. Map to the portfolio / target roles

From the Portfolio + Learning Plan (Piece 3 = "an applied-AI product"; Part 6 =
the Klaviyo senior track):

| Plan requirement | Where this system delivers it |
|---|---|
| LLM + tool use + a real UI | `packages/agent` + Phase B console |
| **A lightweight eval** ("how you measured quality") | `judge.ts` now → Phase C harness |
| RAG | Phase C add-on (retrieve example sites / similar businesses) |
| Backend depth (FastAPI, queues) — *Klaviyo Part 6* | Phase B/C: wrap the pipeline behind an API + a job queue for batch runs |
| Evals/quality obsession, prompt/model versioning | Phase C: track scores per prompt version |
| Observability (OpenTelemetry) | Phase B: trace each stage (tokens, cost, latency) |

The point from the plan holds: **one deep artifact** you keep hardening beats
seven shallow ones. This is that artifact.

---

## 6. "Walk me through your project" (practice answer)

> "It's an agentic pipeline that turns a raw local-business lead into a validated,
> ready-to-ship marketing site. Leads come from the Google Places API with
> tech-detection to find businesses with bad or no websites. A cheap model
> enriches each lead into a brief; a stronger model generates the site copy and
> structure as **structured output via forced tool use**; I validate it against a
> **Zod schema with a repair loop**, so anything malformed gets fixed or fails
> loudly — never ships broken. Then an **LLM-as-judge** scores it on a rubric and
> can trigger a regeneration. It's a **workflow**, not an open-ended agent,
> because the steps are known. I tier models for cost, cache the stable prompts,
> and the whole thing produces a real static site, not just text. Next I'm adding
> a streaming console and an eval harness to track quality across prompt versions."

That paragraph hits: ingestion, tool use, structured output, validation,
self-correction, evals, workflow-vs-agent judgment, cost levers, and end-to-end
delivery — the applied-AI checklist, grounded in something real.
