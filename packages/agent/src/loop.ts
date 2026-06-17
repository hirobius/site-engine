/**
 * Loop engineering — the core primitive.
 *
 * "Loop engineering" is the discipline of designing the iterative act → observe →
 * decide cycle an LLM system runs in, rather than tuning a single prompt. The
 * engineering lives in the loop's *controls and instrumentation*: stopping
 * conditions, feedback incorporation, convergence detection, budgets, and a
 * trace of every iteration you can measure and debug.
 *
 * This generic `refineLoop` captures that pattern once. The pipeline uses it for
 * the generate → judge → regenerate cycle; the same primitive would drive any
 * "produce → evaluate → retry-with-feedback" loop.
 */

export interface IterationTrace<T> {
  iteration: number;
  output: T;
  /** Eval score for this iteration, if the evaluator produced one. */
  score?: number;
  passed: boolean;
  /** The evaluator's feedback — fed into the next iteration. */
  feedback: string;
  /** Wall-clock time for produce+evaluate this iteration. */
  ms: number;
}

export interface LoopResult<T> {
  /** Best output seen (the passing one, or the highest-scored if none passed). */
  value: T;
  iterations: number;
  /** true if an iteration passed the evaluator within the budget. */
  converged: boolean;
  /** Why the loop stopped — for observability. */
  stopReason: "converged" | "max_iterations" | "plateau";
  traces: IterationTrace<T>[];
}

export interface LoopOptions<T> {
  /** Hard ceiling on iterations — the primary budget control. */
  maxIterations: number;
  /** Produce a candidate. Receives the previous iteration's feedback (if any). */
  produce: (feedback: string | undefined, iteration: number) => Promise<T>;
  /** Evaluate a candidate. `passed` ends the loop; `score` enables plateau detection. */
  evaluate: (value: T) => Promise<{ passed: boolean; score?: number; feedback: string }>;
  /** Stop early if the score improves by less than this between iterations. */
  minImprovement?: number;
  /** Per-iteration hook (for streaming/observability). */
  onIteration?: (trace: IterationTrace<T>) => void;
}

export async function refineLoop<T>(opts: LoopOptions<T>): Promise<LoopResult<T>> {
  const traces: IterationTrace<T>[] = [];
  let feedback: string | undefined;
  let best: { value: T; score: number } | undefined;

  for (let i = 1; i <= opts.maxIterations; i++) {
    const start = Date.now();
    const output = await opts.produce(feedback, i);
    const verdict = await opts.evaluate(output);

    const trace: IterationTrace<T> = {
      iteration: i,
      output,
      score: verdict.score,
      passed: verdict.passed,
      feedback: verdict.feedback,
      ms: Date.now() - start,
    };
    traces.push(trace);
    opts.onIteration?.(trace);

    const score = verdict.score ?? 0;
    if (!best || score > best.score) best = { value: output, score };

    if (verdict.passed) {
      return { value: output, iterations: i, converged: true, stopReason: "converged", traces };
    }

    // Convergence guard: bail if the model has stopped meaningfully improving.
    if (opts.minImprovement !== undefined && traces.length >= 2) {
      const prev = traces[traces.length - 2]!.score ?? 0;
      if (score - prev < opts.minImprovement) {
        return { value: best.value, iterations: i, converged: false, stopReason: "plateau", traces };
      }
    }

    feedback = verdict.feedback;
  }

  return {
    value: best!.value,
    iterations: traces.length,
    converged: false,
    stopReason: "max_iterations",
    traces,
  };
}
