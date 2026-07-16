import type { ClientConfig, SectionId } from "@hirobius/schema";
import type { PaletteTokens } from "@hirobius/schema/presets";
import { contrastRatio, WCAG_AA_NORMAL_TEXT } from "./lib/contrast.js";
import { resolvePalette } from "./lib/theme.js";

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
 * intentionally ships fictional contact info until intake lands. `realData`
 * doesn't need to be hand-flipped anymore — `armAcceptanceGate` (`build-gate.ts`)
 * calls this with `realData` keyed off `SITE_LIVE`/`VERCEL_ENV` from every app's
 * `astro.config.ts`, so a real build fails automatically the moment placeholder
 * data would otherwise ship (issue #78 — the #37 guard was dormant fleet-wide
 * because nothing armed it).
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
const WEB3FORMS_KEY_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fleet convention for fake phones: area code 555, or the FCC-reserved
 *  555-01XX exchange (see `apps/_template`'s stub `(555) 010-0000`). Exported
 *  (with `isPlaceholderEmail`/`isPlaceholderSiteUrl` below) so this stays the
 *  one fleet-wide placeholder convention instead of being re-derived —
 *  currently reused by `lib/llms-txt.test.ts`, which runs these detectors
 *  against the text `llmsTxt()` actually emits, not just the input config. */
export function isPlaceholderPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  const local = digits.slice(-10);
  const areaCode = local.slice(0, 3);
  const exchange = local.slice(3, 6);
  const line = local.slice(6);
  return areaCode === "555" || (exchange === "555" && /^01/.test(line));
}

/** `example.com`, not just the `.example` TLD (see `apps/_template`'s stub
 *  `hello@example.com`, which the original `.example`-only check missed). */
function hasPlaceholderDomain(domain: string): boolean {
  return PLACEHOLDER_EMAIL_DOMAIN.test(domain) || domain.toLowerCase() === "example.com";
}

/** See `isPlaceholderPhone` above — exported for the same reason. */
export function isPlaceholderEmail(email: string): boolean {
  return hasPlaceholderDomain(email.split("@").pop() ?? "");
}

/** See `isPlaceholderPhone` above — exported for the same reason. */
export function isPlaceholderSiteUrl(siteUrl: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(siteUrl).hostname;
  } catch {
    return false;
  }
  return hasPlaceholderDomain(hostname);
}

/** All-zeros Web3Forms key (with or without UUID dashes), or anything that
 *  isn't UUID-shaped at all — real Web3Forms keys are UUIDs, so a scaffold
 *  string like `REPLACE_WITH_WEB3FORMS_ACCESS_KEY` (see `apps/_template`)
 *  is caught even though it isn't all zeros. */
function isPlaceholderFormKey(accessKey: string): boolean {
  const alphanumeric = accessKey.replace(/-/g, "");
  if (alphanumeric.length > 0 && /^0+$/.test(alphanumeric)) return true;
  return !WEB3FORMS_KEY_SHAPE.test(accessKey);
}

/**
 * issue #149: risky, unverifiable marketing-claim tokens — real
 * false-advertising / FTC exposure when asserted without a documented
 * source (see docs/GO-LIVE-CHECKLIST.md's claims/compliance section).
 * `isVerified` is keyed off the *actual* fields issue #87 landed in
 * `BusinessSchema` (`licensed`/`insured`/`bonded`/`licenseNumber` — see
 * `packages/schema/src/index.ts`). There is no schema field for a
 * certification, a formal guarantee, or a ranking claim, so those tokens
 * have no way to be verified today and always flag when present; the fix is
 * softer copy, not a fabricated field.
 */
const CLAIM_TOKENS: Array<{
  code: string;
  pattern: RegExp;
  claim: string;
  isVerified: (config: ClientConfig) => boolean;
  hint: string;
}> = [
  {
    code: "unverified-claim-licensed",
    pattern: /\blicensed\b/i,
    claim: "licensed",
    isVerified: (c) => c.business.licensed === true || Boolean(c.business.licenseNumber),
    hint: "set business.licensed: true (and ideally business.licenseNumber) once verified at intake, or soften the copy",
  },
  {
    code: "unverified-claim-insured",
    pattern: /\binsured\b/i,
    claim: "insured",
    isVerified: (c) => c.business.insured === true,
    hint: "set business.insured: true once verified at intake, or soften the copy",
  },
  {
    code: "unverified-claim-bonded",
    pattern: /\bbonded\b/i,
    claim: "bonded",
    isVerified: (c) => c.business.bonded === true,
    hint: "set business.bonded: true once verified at intake, or soften the copy",
  },
  {
    code: "unverified-claim-certified",
    pattern: /\bcertified\b/i,
    claim: "certified",
    isVerified: () => false,
    hint: "ClientConfigSchema has no certification field yet (see docs/GO-LIVE-CHECKLIST.md §4) — remove the claim or soften the copy",
  },
  {
    code: "unverified-claim-guaranteed",
    pattern: /\bguarantee[ds]?\b/i,
    claim: "guarantee(d)",
    isVerified: () => false,
    hint: 'ClientConfigSchema has no way to verify a guarantee — remove the claim or soften to e.g. "free, no-obligation estimates"',
  },
  {
    code: "unverified-claim-number-one",
    pattern: /#\s?1\b/,
    claim: "#1",
    isVerified: () => false,
    hint: "a ranking claim needs a citable source — remove it or cite the source directly in copy",
  },
  {
    code: "unverified-claim-best",
    pattern: /\bbest\b/i,
    claim: "best",
    isVerified: () => false,
    hint: 'a superlative claim needs a citable source — remove it or soften to e.g. "highly rated"',
  },
];

/**
 * Copy fields the template actually renders as the business's own marketing
 * prose. Deliberately excludes `reviews[].text` — a review is the
 * *customer's* words, not a claim we're asserting, and carries its own rule
 * (written permission to publish, docs/GO-LIVE-CHECKLIST.md §2), not this one.
 */
function claimSources(config: ClientConfig): Array<{ field: string; text: string }> {
  const sources = [
    { field: "copy.heroHeadline", text: config.copy.heroHeadline },
    { field: "copy.heroSub", text: config.copy.heroSub },
    { field: "copy.about", text: config.copy.about },
    { field: "copy.ctaLabel", text: config.copy.ctaLabel },
    { field: "seo.title", text: config.seo.title },
    { field: "seo.description", text: config.seo.description },
  ];
  config.services.forEach((service, index) => {
    sources.push({ field: `services[${index}].title`, text: service.title });
    sources.push({ field: `services[${index}].description`, text: service.description });
  });
  return sources;
}

const SECTION_REQUIREMENTS: Record<SectionId, (config: ClientConfig) => boolean> = {
  services: (c) => c.services.length > 0,
  gallery: (c) => c.gallery.length > 0,
  reviews: (c) => c.reviews.length > 0,
  serviceAreaMap: (c) => Boolean(c.map.embedQuery || c.map.staticImage),
  contact: (c) => Boolean(c.form),
};

/**
 * Token pairs the template actually renders text on top of. `fg`/`bg` covers
 * both normal body text and the hero (`bg-fg text-on-fg`, where `on-fg`
 * resolves to `bg` — see `brand-overlay.ts`). Keep in sync with any new
 * surface/text pairing a component introduces (issue #79).
 */
const CONTRAST_TOKEN_PAIRS: Array<{
  code: string;
  a: keyof PaletteTokens;
  b: keyof PaletteTokens;
  label: string;
}> = [
  { code: "low-contrast-cta", a: "--brand-primary", b: "--brand-on-primary", label: "primary/on-primary (CTA button)" },
  { code: "low-contrast-hero", a: "--brand-fg", b: "--brand-bg", label: "fg/bg (body text + hero surface pairing)" },
  { code: "low-contrast-muted", a: "--brand-fg", b: "--brand-muted", label: "fg/muted (muted sections + banner hero surface)" },
];

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
    if (isPlaceholderEmail(config.business.email)) {
      issues.push({
        code: "placeholder-email",
        message: `business.email is a placeholder .example/example.com address: ${config.business.email}`,
      });
    }
    if (isPlaceholderSiteUrl(config.seo.siteUrl)) {
      issues.push({
        code: "placeholder-site-url",
        message: `seo.siteUrl is a placeholder .example/example.com domain: ${config.seo.siteUrl}`,
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
        message: `form.accessKey doesn't look like a real Web3Forms key: ${config.form.accessKey}`,
      });
    }
    if (!config.form.hcaptchaSiteKey) {
      issues.push({
        code: "missing-hcaptcha-key",
        message: "form.hcaptchaSiteKey is required once realData is true — spam protection is a go-live requirement",
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

  // issue #149: claims/compliance guardrail. Detection always runs (a
  // preview should never train an editor that these tokens are fine) —
  // only the severity is gated on `realData`, same warn/fail split as
  // `armAcceptanceGate`'s hero-image check in build-gate.ts.
  for (const source of claimSources(config)) {
    for (const token of CLAIM_TOKENS) {
      if (!token.pattern.test(source.text)) continue;
      if (token.isVerified(config)) continue;
      const message =
        `${source.field} asserts "${token.claim}" with no verified source — ${token.hint} ` +
        `(${source.field}: "${source.text}")`;
      if (options.realData) {
        issues.push({ code: token.code, message });
      } else {
        console.warn(`[checkClientAcceptance] ${message}`);
      }
    }
  }

  if (config.layout.sections.hero.variant === "video" && !config.hero.videoSrc) {
    issues.push({
      code: "empty-video-hero",
      message: 'hero variant is "video" (full-bleed video) but hero.videoSrc is missing — renders an empty dark hero',
    });
  }

  const palette = resolvePalette(config);
  for (const pair of CONTRAST_TOKEN_PAIRS) {
    const ratio = contrastRatio(palette[pair.a], palette[pair.b]);
    if (ratio < WCAG_AA_NORMAL_TEXT) {
      issues.push({
        code: pair.code,
        message: `${pair.label} contrast is ${ratio.toFixed(2)}:1, below WCAG AA's ${WCAG_AA_NORMAL_TEXT}:1 (palettePreset "${config.brand.palettePreset}")`,
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
