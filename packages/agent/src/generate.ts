import {
  defineClient,
  type ClientConfig,
  type ClientConfigInput,
} from "@hirobius/schema";
import { MODELS, callStructuredTool } from "./llm.js";
import { GENERATED_CONTENT_SCHEMA } from "./schemas.js";
import { GeneratedContentSchema, type Brief, type GeneratedContent, type Lead } from "./types.js";

const SYSTEM = `You write conversion-focused copy for local service businesses and assemble it into a structured site config. Rules:
- Headlines name the service AND the city. Copy is concrete, not generic filler.
- Never fabricate phone numbers, reviews, or facts not present in the lead.
- Respect SEO limits: title <= 70 chars, description <= 180 chars.
- Choose the palette preset and font that fit the trade.`;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "client";
}

/** Assemble generated content + the raw lead into a full ClientConfig input. */
function assemble(lead: Lead, content: GeneratedContent): ClientConfigInput {
  return {
    slug: slugify(lead.name),
    business: {
      name: lead.name,
      phone: lead.phone ?? "(000) 000-0000",
      email: lead.email ?? "owner@example.com",
      hours: [
        { days: "Mon–Fri", hours: "8:00 AM – 6:00 PM" },
        { days: "Sat", hours: "9:00 AM – 2:00 PM" },
        { days: "Sun", hours: "Closed" },
      ],
      serviceAreas: content.serviceAreas,
    },
    brand: { palettePreset: content.palettePreset, font: content.font, radius: "lg" },
    layout: { variant: "A", sectionOrder: ["services", "gallery", "reviews", "serviceAreaMap", "contact"] },
    services: content.services,
    copy: {
      heroHeadline: content.heroHeadline,
      heroSub: content.heroSub,
      ctaLabel: content.ctaLabel,
      about: content.about,
    },
    reviews: content.reviews,
    map: { embedQuery: `${lead.city}, ${lead.region}` },
    form: { provider: "web3forms", accessKey: "REPLACE_WITH_WEB3FORMS_ACCESS_KEY" },
    seo: {
      title: content.seoTitle,
      description: content.seoDescription,
      city: lead.city,
      region: lead.region,
      siteUrl: `https://${slugify(lead.name)}.example`,
    },
  };
}

export interface GenerateResult {
  config: ClientConfig;
  content: GeneratedContent;
  attempts: number;
}

/**
 * Stage 2 — generation with a validate/repair loop.
 *
 * The model emits structured content; we assemble + run `defineClient` (Zod).
 * If validation fails (e.g. a too-long SEO title), we feed the exact errors
 * back and let the model fix them. This is the load-bearing reliability pattern:
 * the build-time schema gate is the same one the whole site factory uses.
 */
export async function generate(
  lead: Lead,
  brief: Brief,
  opts: { maxAttempts?: number; feedback?: string } = {},
): Promise<GenerateResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  let repairNote = opts.feedback ?? "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const user = [
      `Lead:\n${JSON.stringify(lead, null, 2)}`,
      `Brief:\n${JSON.stringify(brief, null, 2)}`,
      repairNote ? `Fix these problems from the previous attempt:\n${repairNote}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw = await callStructuredTool({
      model: MODELS.strong,
      system: SYSTEM,
      user,
      toolName: "record_site_content",
      toolDescription: "Record the site content for this business.",
      inputSchema: GENERATED_CONTENT_SCHEMA,
      maxTokens: 4096,
      cacheSystem: true,
    });

    const parsed = GeneratedContentSchema.safeParse(raw);
    if (!parsed.success) {
      repairNote = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
      continue;
    }

    try {
      const config = defineClient(assemble(lead, parsed.data));
      return { config, content: parsed.data, attempts: attempt };
    } catch (err) {
      // defineClient throws a human-readable list of Zod issues — feed it back.
      repairNote = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(`generate: config did not validate after ${maxAttempts} attempts.\nLast errors:\n${repairNote}`);
}
