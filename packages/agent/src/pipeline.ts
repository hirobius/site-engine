import type { ClientConfig } from "@hirobius/schema";
import { enrich } from "./enrich.js";
import { generate, type GenerateResult } from "./generate.js";
import { judge } from "./judge.js";
import { refineLoop } from "./loop.js";
import { LeadSchema, type Brief, type JudgeResult, type Lead } from "./types.js";

/** One slimmed iteration of the refine loop, for the result/observability. */
export interface LoopStep {
  iteration: number;
  score?: number;
  passed: boolean;
  ms: number;
}

export interface PipelineResult {
  lead: Lead;
  brief: Brief;
  config: ClientConfig;
  judge: JudgeResult;
  /** Total generation calls (including each iteration's internal validate/repair). */
  attempts: number;
  /** Loop engineering surface: how the generate→judge→regenerate loop behaved. */
  loop: {
    iterations: number;
    converged: boolean;
    stopReason: "converged" | "max_iterations" | "plateau";
    steps: LoopStep[];
  };
}

export interface PipelineOptions {
  /** Iteration budget for the generate→judge loop (the loop's main control). */
  maxIterations?: number;
  /** Stop early if the eval score improves by less than this between passes. */
  minImprovement?: number;
  /** Progress callback — the seam the interactive console (Phase B) streams from. */
  onStep?: (step: string, detail?: string) => void;
}

/**
 * The agent: enrich → [ generate (validate/repair) → judge ]loop.
 *
 * Two nested loops — loop engineering at two levels:
 *   • inner (in generate.ts): produce JSON → validate with Zod → repair on error
 *   • outer (here): produce config → judge with a rubric → regenerate on fail
 * Both share the same shape (produce → evaluate → retry-with-feedback) with
 * explicit budgets, stop reasons, and per-iteration traces.
 *
 * It's a *workflow*, not an open-ended agent: the steps are known, only the
 * iteration count is dynamic.
 */
export async function runPipeline(input: unknown, opts: PipelineOptions = {}): Promise<PipelineResult> {
  const lead = LeadSchema.parse(input);
  const log = opts.onStep ?? (() => {});

  log("enrich", lead.name);
  const brief = await enrich(lead);

  // Capture each iteration's judge verdict + attempt count alongside the loop.
  const verdicts: JudgeResult[] = [];
  let attempts = 0;

  const result = await refineLoop<GenerateResult>({
    maxIterations: 1 + (opts.maxIterations ?? 1),
    minImprovement: opts.minImprovement,
    produce: async (feedback, iteration) => {
      log(iteration === 1 ? "generate" : "regenerate", feedback ? "applying eval feedback" : undefined);
      const r = await generate(lead, brief, feedback ? { feedback } : {});
      attempts += r.attempts;
      return r;
    },
    evaluate: async (r) => {
      log("judge");
      const verdict = await judge(lead, r.config);
      verdicts.push(verdict);
      return { passed: verdict.pass, score: verdict.overall, feedback: verdict.notes };
    },
    onIteration: (t) => log("iteration", `#${t.iteration} → ${t.score}/5 ${t.passed ? "PASS" : "FAIL"} (${t.ms}ms)`),
  });

  return {
    lead,
    brief,
    config: result.value.config,
    judge: verdicts[verdicts.length - 1]!,
    attempts,
    loop: {
      iterations: result.iterations,
      converged: result.converged,
      stopReason: result.stopReason,
      steps: result.traces.map((t) => ({ iteration: t.iteration, score: t.score, passed: t.passed, ms: t.ms })),
    },
  };
}
