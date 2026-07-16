import type { ClientConfig } from "@hirobius/schema";
import { absoluteUrl } from "./seo.js";

/**
 * `/llms.txt` body — a token-cheap, canonical summary for AI-assistant
 * discovery (issue #110). Pure derivation from the validated `ClientConfig`,
 * same trust boundary as `robotsTxt`/`localBusinessJsonLd`: every field
 * already passed Zod + `checkClientAcceptance`, so there is no fabrication
 * surface here — just formatting. Loosely follows the llmstxt.org
 * conventions (H1 name, blockquote summary, H2 sections) without pulling in
 * a dependency for it.
 */
export function llmsTxt(config: ClientConfig): string {
  const { business, services, copy, seo } = config;

  const lines: string[] = [];
  lines.push(`# ${business.name}`, "", `> ${seo.description}`, "", copy.about, "");

  lines.push("## Services");
  for (const service of services) {
    lines.push(`- ${service.title}: ${service.description}`);
  }
  lines.push("");

  lines.push("## Service Areas");
  lines.push(business.serviceAreas.join(", "));
  lines.push("");

  lines.push("## Hours");
  for (const row of business.hours) {
    lines.push(`- ${row.days}: ${row.hours}`);
  }
  lines.push("");

  lines.push("## Contact");
  lines.push(`- Phone: ${business.phone}`);
  lines.push(`- Email: ${business.email}`);
  lines.push(`- Website: ${seo.siteUrl}`);
  lines.push("");

  lines.push("## Links");
  lines.push(`- Sitemap: ${absoluteUrl(seo.siteUrl, "/sitemap-index.xml")}`);

  return lines.join("\n") + "\n";
}
