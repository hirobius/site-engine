import type { ClientConfig } from "@hirobius/schema";
import { enrich } from "./enrich.js";
import { generate } from "./generate.js";
import { judge } from "./judge.js";
import { LeadSchema, type Brief, type JudgeResult, type Lead } from "./types.js";

export interface PipelineResult {
  lead: Lead;
  brief: Brief;
  config: ClientConfig;
  judge: JudgeResult;
  /** Total generation attempts (including validate/repair retries + regenerations). */
  attempts: number;
  regenerated: boolean;
}

export interface PipelineOptions {
  /** Max judge-driven regeneration passes when the eval fails. */
  maxRegenerations?: number;
  /** Progress callback — the seam the interactive console (Phase B) streams from. */
  onStep?: (step: string, detail?: string) => void;
}

/**
 * The agent: enrich → generate (validate/repair) → judge → regenerate-if-failed.
 *
 * This is a *workflow* (code-orchestrated, deterministic control flow), not an
 * open-ended agent — the right call when the steps are known. Each stage is a
 * single bounded LLM call; the loop is ours.
 */
export async function runPipeline(input: unknown, opts: PipelineOptions = {}): Promise<PipelineResult> {
  const lead = LeadSchema.parse(input);
  const log = opts.onStep ?? (() => {});
  const maxRegen = opts.maxRegenerations ?? 1;

  log("enrich", lead.name);
  const brief = await enrich(lead);

  log("generate");
  const first = await generate(lead, brief);
  let config: ClientConfig = first.config;
  let attempts = first.attempts;

  log("judge");
  let verdict: JudgeResult = await judge(lead, config);
  let regenerated = false;

  for (let regen = 0; !verdict.pass && regen < maxRegen; regen++) {
    regenerated = true;
    log("regenerate", `eval failed (overall ${verdict.overall}/5) — retrying with feedback`);
    const retry = await generate(lead, brief, { feedback: verdict.notes });
    config = retry.config;
    attempts += retry.attempts;
    log("judge");
    verdict = await judge(lead, config);
  }

  return { lead, brief, config, judge: verdict, attempts, regenerated };
}
