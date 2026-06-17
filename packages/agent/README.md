# @hirobius/agent

The AI pipeline — **lead → validated site config → quality score**. This is the
"brain" of the portfolio flagship; the Astro template is its render target and
the lead puller is its ingestion source.

## Pipeline

```
Lead ──▶ enrich ──▶ generate ──▶ judge ──▶ (regenerate if failed) ──▶ Result
        (Haiku)     (Opus,        (Opus,
                     validate/     LLM-as-
                     repair loop)  judge)
```

| Stage | What it demonstrates (AI-eng) |
|---|---|
| **enrich** | Model tiering — cheap/fast model for high-volume normalization |
| **generate** | **Structured output via forced tool use** + a **Zod validate/repair loop** (the same `defineClient` gate the whole factory uses) + **prompt caching** on the system prompt |
| **judge** | **LLM-as-judge eval** — an independent rubric scores the output and can trigger an automatic regeneration |
| **pipeline** | A **workflow** (code-orchestrated), not an open-ended agent — the right tier when the steps are known |

## Run it

```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm agent --name "Rojo Moss Removal" --city Seattle --region WA
# or feed a lead row from the puller:
ANTHROPIC_API_KEY=sk-ant-... pnpm agent --lead ./lead.json
```

Prints each step live, then the validated `client.config.ts` object + the eval
scorecard. The output config is drop-in for `apps/<slug>/client.config.ts`.

## Why these choices (interview-ready)

- **Forced tool use** (`tool_choice: {type:"tool"}`) guarantees the model returns
  JSON in our shape; **Zod** then enforces the real contract and the **repair
  loop** feeds validation errors back until it passes (or gives up loudly).
- **LLM-as-judge** turns "is this good?" into a measurable gate — the basis for
  an eval harness (Phase C) that tracks quality across prompt versions.
- **Model tiering** (Opus for generate/judge, Haiku for enrich) is the core
  cost/latency lever.
- **Prompt caching** on the large, stable system prompts cuts cost across a batch
  of leads.

See `docs/AI-ENGINEERING.md` for the full architecture + glossary.
