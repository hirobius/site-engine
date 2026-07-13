import type { APIRoute } from "astro";
import { llmsTxt } from "@hirobius/template/lib/llms-txt.js";
import { client } from "../../client.config";

export const GET: APIRoute = () =>
  new Response(llmsTxt(client), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
