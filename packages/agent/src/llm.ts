import Anthropic from "@anthropic-ai/sdk";

/**
 * Model tiering — a core applied-AI cost/latency lever.
 *
 * `strong` (Opus) for generation + judging where quality matters; `fast`
 * (Haiku) for the cheap, high-volume enrichment step. Same idea you'd defend in
 * an interview: don't pay Opus prices for work a small model does well.
 */
export const MODELS = {
  strong: "claude-opus-4-8",
  fast: "claude-haiku-4-5",
} as const;

/** Reads ANTHROPIC_API_KEY (or an `ant auth login` profile) from the env. */
export const anthropic = new Anthropic();

export interface StructuredToolCall {
  model: string;
  system: string;
  user: string;
  /** Tool name + JSON-Schema the model must fill — this is how we force valid JSON. */
  toolName: string;
  toolDescription: string;
  inputSchema: Anthropic.Tool["input_schema"];
  maxTokens?: number;
  /** Cache the (stable, large) system prompt across many leads. */
  cacheSystem?: boolean;
}

/**
 * Structured output via forced tool use.
 *
 * We define one tool whose `input_schema` is the shape we want, then set
 * `tool_choice` to that tool so the model MUST return arguments matching it.
 * The returned `input` is parsed JSON — the caller validates it with Zod
 * (Zod is the real contract; the schema here just shapes the model's output).
 */
export async function callStructuredTool({
  model,
  system,
  user,
  toolName,
  toolDescription,
  inputSchema,
  maxTokens = 4096,
  cacheSystem = false,
}: StructuredToolCall): Promise<unknown> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: cacheSystem
      ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
      : system,
    tools: [{ name: toolName, description: toolDescription, input_schema: inputSchema }],
    tool_choice: { type: "tool", name: toolName },
    messages: [{ role: "user", content: user }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Model returned no tool call (stop_reason: ${response.stop_reason})`);
  }
  return toolUse.input;
}
