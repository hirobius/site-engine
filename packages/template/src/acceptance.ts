import type { ClientConfig, SectionId } from "@hirobius/schema";

/**
 * Shared acceptance checks for a generated client site.
 *
 * Zod (`defineClient`) validates *shape* (a phone looks like a phone, a title
 * fits 70 chars). It can't catch *semantically* fake data — a syntactically
 * valid `.example` URL or an all-zeros form key are both schema-legal. This
 * layer catches what shipped anyway on Monroe Street Power Wash: a `.example`
 * site URL and an all-zeros Web3Forms key reaching a real client's build.
 *
 * Each `apps/<slug>` acceptance test calls `checkClientAcceptance` with its own
 * config. Placeholder checks are opt-in via `realData` because every preview
 * site in this fleet (see `apps/_template`'s stub phone `(555) 010-0000`)
 * intentionally ships fictional contact info until intake lands — flip
 * `realData: true` in that app's test once the real business data replaces it.
 */

export interface AcceptanceIssue {
  code: string;
  message: string;
}

export interface AcceptanceOptions {
  /** Set true once real business data has replaced intake placeholders. */
  realData?: boolean;
}

const PLACEHOLDER_EMAIL_DOMAIN = /\.example$/i;
const PLACEHOLDER_NAME = /\b(acme|new client|test business)\b/i;

/** Fleet convention for fake phones: area code 555, or the FCC-reserved
 *  555-01XX exchange (see `apps/_template`'s stub `(555) 010-0000`). */
function isPlaceholderPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  const local = digits.slice(-10);
  const areaCode = local.slice(0, 3);
  const exchange = local.slice(3, 6);
  const line = local.slice(6);
  return areaCode === "555" || (exchange === "555" && /^01/.test(line));
}

/** All-zeros Web3Forms key, with or without UUID dashes. */
function isPlaceholderFormKey(accessKey: string): boolean {
  const alphanumeric = accessKey.replace(/-/g, "");
  return alphanumeric.length > 0 && /^0+$/.test(alphanumeric);
}

const SECTION_REQUIREMENTS: Record<SectionId, (config: ClientConfig) => boolean> = {
  services: (c) => c.services.length > 0,
  gallery: (c) => c.gallery.length > 0,
  reviews: (c) => c.reviews.length > 0,
  serviceAreaMap: (c) => Boolean(c.map.embedQuery || c.map.staticImage),
  contact: (c) => Boolean(c.form),
};

/**
 * Check a resolved `ClientConfig` for issues the schema can't express.
 * Returns an empty array when the config is acceptable.
 */
export function checkClientAcceptance(
  config: ClientConfig,
  options: AcceptanceOptions = {},
): AcceptanceIssue[] {
  const issues: AcceptanceIssue[] = [];

  if (options.realData) {
    if (PLACEHOLDER_EMAIL_DOMAIN.test(config.business.email)) {
      issues.push({
        code: "placeholder-email",
        message: `business.email is a placeholder .example address: ${config.business.email}`,
      });
    }
    if (PLACEHOLDER_EMAIL_DOMAIN.test(config.seo.siteUrl)) {
      issues.push({
        code: "placeholder-site-url",
        message: `seo.siteUrl is a placeholder .example domain: ${config.seo.siteUrl}`,
      });
    }
    if (isPlaceholderPhone(config.business.phone)) {
      issues.push({
        code: "placeholder-phone",
        message: `business.phone looks like a placeholder number: ${config.business.phone}`,
      });
    }
    if (isPlaceholderFormKey(config.form.accessKey)) {
      issues.push({
        code: "placeholder-form-key",
        message: "form.accessKey is a placeholder (all-zeros) Web3Forms key",
      });
    }
    if (PLACEHOLDER_NAME.test(config.business.name)) {
      issues.push({
        code: "placeholder-name",
        message: `business.name looks like a stub name: ${config.business.name}`,
      });
    }
    if (!config.seo.siteUrl.startsWith("https://")) {
      issues.push({
        code: "insecure-site-url",
        message: `seo.siteUrl must be a real https URL: ${config.seo.siteUrl}`,
      });
    }
  }

  for (const section of config.layout.sectionOrder) {
    if (!SECTION_REQUIREMENTS[section](config)) {
      issues.push({
        code: "incomplete-section",
        message: `layout.sectionOrder includes "${section}" but its required data is missing/empty`,
      });
    }
  }

  return issues;
}
