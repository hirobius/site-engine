import type { APIRoute } from "astro";
import { robotsTxt } from "@hirobius/template/lib/seo.js";
import { client } from "../../client.config";

export const GET: APIRoute = () =>
  new Response(robotsTxt(client.seo.siteUrl), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
