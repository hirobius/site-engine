/**
 * @hirobius/agent — the AI pipeline that turns a lead into a validated site
 * config, with an LLM-as-judge quality gate.
 *
 * This is the "brain" layer of the portfolio flagship. The site template/schema
 * is the render target; the lead puller is the ingestion source; this package is
 * the applied-AI engineering (structured output, validate/repair, evals,
 * model tiering, prompt caching).
 */
export { runPipeline } from "./pipeline.js";
export type { PipelineResult, PipelineOptions, LoopStep } from "./pipeline.js";
export { refineLoop } from "./loop.js";
export type { LoopResult, LoopOptions, IterationTrace } from "./loop.js";
export { enrich } from "./enrich.js";
export { generate } from "./generate.js";
export { judge } from "./judge.js";
export { MODELS } from "./llm.js";
export * from "./types.js";
