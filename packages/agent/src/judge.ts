import type { ClientConfig } from "@hirobius/schema";
import { MODELS, callStructuredTool } from "./llm.js";
import { JUDGE_SCHEMA } from "./schemas.js";
import { JudgeResultSchema, type JudgeResult, type Lead } from "./types.js";

const SYSTEM = `You are a strict QA reviewer for local-business websites. Score the generated site content against the original lead. Be critical: reward concrete, locally-specific, conversion-oriented copy; penalize generic filler, fabricated facts, missing city references, and SEO-limit violations. "pass" is true only if overall >= 4 AND no individual score is below 3. Put specific, actionable fixes in notes so a regeneration pass can act on them.`;

/**
 * Stage 3 — LLM-as-judge eval.
 *
 * A separate model call with an independent rubric scores the generated config.
 * This is the part most portfolios skip: a measurable quality gate that can
 * trigger an automatic regeneration. Runs on the strong model for judgment.
 */
export async function judge(lead: Lead, config: ClientConfig): Promise<JudgeResult> {
  const raw = await callStructuredTool({
    model: MODELS.strong,
    system: SYSTEM,
    user: [
      `Original lead:\n${JSON.stringify(lead, null, 2)}`,
      `Generated config:\n${JSON.stringify(config, null, 2)}`,
    ].join("\n\n"),
    toolName: "record_evaluation",
    toolDescription: "Record the quality evaluation scorecard.",
    inputSchema: JUDGE_SCHEMA,
    maxTokens: 1024,
    cacheSystem: true,
  });
  return JudgeResultSchema.parse(raw);
}
