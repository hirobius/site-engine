import { MODELS, callStructuredTool } from "./llm.js";
import { BRIEF_SCHEMA } from "./schemas.js";
import { BriefSchema, type Brief, type Lead } from "./types.js";

const SYSTEM = `You are a local-marketing analyst. Given a raw business lead, produce a concise brief that a copywriter will use to build a one-page website. Pick the closest visual preset and an appropriate font. Never invent facts not supported by the lead — infer only what's reasonable for the trade.`;

/**
 * Stage 1 — enrichment. Turns a sparse lead into a normalized brief.
 * Runs on the fast/cheap model: this is high-volume, low-stakes work.
 */
export async function enrich(lead: Lead): Promise<Brief> {
  const raw = await callStructuredTool({
    model: MODELS.fast,
    system: SYSTEM,
    user: `Lead:\n${JSON.stringify(lead, null, 2)}`,
    toolName: "record_brief",
    toolDescription: "Record the structured brief for this business.",
    inputSchema: BRIEF_SCHEMA,
    maxTokens: 1024,
  });
  // Zod is the contract — parse() throws on anything the model got wrong.
  return BriefSchema.parse(raw);
}
