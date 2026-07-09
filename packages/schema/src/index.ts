import { z } from "zod";
import { PALETTE_PRESET_IDS, FONT_IDS } from "./presets.js";

/**
 * Client configuration schema.
 *
 * This is the single source of truth for a client site. Everything the template
 * renders comes from here — there is zero hardcoded business content in the
 * components. A site that needs something this schema can't express is, by
 * policy, a custom-component engagement (a different price tier), not a config
 * tweak. Keep that boundary here: resist adding free-form "html" escape hatches.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** E.164-ish phone. Stored canonical; the template builds the `tel:` href. */
const phone = z
  .string()
  .trim()
  .min(7, "phone looks too short")
  .regex(/^[+]?[\d().\-\s]+$/, "phone has invalid characters");

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color like #1a2b3c");

/** A relative path under the app's `public/` dir, e.g. `/photos/hero.jpg`. */
const publicPath = z
  .string()
  .startsWith("/", "must be an absolute path under public/, e.g. /photos/x.jpg");

// ---------------------------------------------------------------------------
// Sections of the config
// ---------------------------------------------------------------------------

export const BusinessHoursSchema = z.object({
  /** e.g. "Mon–Fri", "Sat", "Sun" */
  days: z.string().min(1),
  /** e.g. "8:00 AM – 6:00 PM" or "Closed" */
  hours: z.string().min(1),
});

export const BusinessSchema = z.object({
  name: z.string().min(1),
  phone,
  email: z.string().email(),
  /** Display address is optional — many service businesses are mobile-only. */
  address: z.string().optional(),
  hours: z.array(BusinessHoursSchema).min(1, "list at least one hours row"),
  /** Cities / regions served, used for copy and LocalBusiness areaServed. */
  serviceAreas: z.array(z.string().min(1)).min(1),
});

export const BrandSchema = z.object({
  palettePreset: z.enum(PALETTE_PRESET_IDS),
  /**
   * Per-client overrides of the resolved palette tokens. Keys are `--brand-*`
   * custom properties; values are hex colors. This is the sanctioned
   * customization surface — preset + overrides, nothing else.
   */
  cssVarOverrides: z
    .record(z.string().regex(/^--brand-[a-z-]+$/), hexColor)
    .default({}),
  font: z.enum(FONT_IDS).default("system"),
  /** Corner radius applied site-wide via `--brand-radius`. */
  radius: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
  /**
   * Spacing density dial — scales the whole spacing rhythm via
   * `--brand-space-scale` (see packages/schema/src/presets.ts DENSITY_SCALES).
   * Defaults to "comfortable" (scale 1), which reproduces current spacing
   * exactly — additive, does not change any existing client's output.
   */
  density: z.enum(["compact", "comfortable", "loose"]).default("comfortable"),
});

export const LayoutSchema = z.object({
  /**
   * Order of sections on the page. Unknown ids are rejected so a typo can't
   * silently drop a section. Hero and Footer are always rendered (first/last)
   * and must not appear here.
   *
   * Note: there is NO global layout variant. Per-section layout variants live on
   * their own section schema (e.g. `hero.variant`) so shifting one section can
   * never move another (Red Alert #2).
   */
  sectionOrder: z
    .array(
      z.enum(["services", "gallery", "reviews", "serviceAreaMap", "contact"]),
    )
    .default(["services", "gallery", "reviews", "serviceAreaMap", "contact"]),
});

export const ServiceSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  /** Optional icon id (template ships a small inline set) or image path. */
  icon: z.string().optional(),
  image: publicPath.optional(),
});

export const ReviewSchema = z.object({
  author: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1),
  /** Free-form, e.g. "Google", "Yelp". */
  source: z.string().optional(),
});

export const GalleryPhotoSchema = z.object({
  src: publicPath,
  alt: z.string().min(1, "alt text is required for SEO and a11y"),
});

export const CopySchema = z.object({
  heroHeadline: z.string().min(1),
  heroSub: z.string().min(1),
  /** Primary CTA label, e.g. "Get a Free Quote". */
  ctaLabel: z.string().min(1).default("Get a Free Quote"),
  about: z.string().min(1),
});

export const FormSchema = z.object({
  provider: z.literal("web3forms"),
  /** Web3Forms public access key. Safe to ship client-side. */
  accessKey: z.string().min(1),
  /**
   * hCaptcha site key. Optional only to keep local dev unblocked; CI warns when
   * missing because spam protection is a day-one requirement, not a nice-to-have.
   */
  hcaptchaSiteKey: z.string().optional(),
  /** Where Web3Forms redirects after a successful submit. */
  redirectUrl: z.string().url().optional(),
});

export const SeoSchema = z.object({
  title: z.string().min(1).max(70, "title should stay under ~70 chars"),
  description: z.string().min(1).max(180, "description should stay under ~180 chars"),
  city: z.string().min(1),
  region: z.string().min(1),
  /** Canonical production URL, e.g. https://pressurepros.com */
  siteUrl: z.string().url(),
  ogImage: publicPath.optional(),
});

export const HeroSchema = z.object({
  /**
   * Per-section layout variant, localized to the Hero (Red Alert #2). Shifting
   * the Hero must never move another section, so the variant lives here — not on
   * `layout`. `split` = responsive two-column grid; `full-bleed` = background
   * image/video with left-aligned content. Defaults to `split` (the prior global
   * "A" behaviour), so existing configs render unchanged.
   */
  variant: z.enum(["split", "full-bleed"]).default("split"),
  image: publicPath.optional(),
  /** Background video source. Used only by the `full-bleed` variant. */
  videoSrc: publicPath.optional(),
  /** Poster shown before the video loads — protects LCP. */
  videoPoster: publicPath.optional(),
});

export const MapSchema = z.object({
  /**
   * Static map image is preferred (protects LCP — no third-party iframe on
   * first paint). If `embedQuery` is set the template lazy-loads an iframe only
   * when the section scrolls into view.
   */
  staticImage: publicPath.optional(),
  embedQuery: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Root schema
// ---------------------------------------------------------------------------

export const ClientConfigSchema = z.object({
  /** URL-safe slug; doubles as the apps/<slug> directory name. */
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case, e.g. pressure-pros"),
  business: BusinessSchema,
  brand: BrandSchema,
  layout: LayoutSchema,
  hero: HeroSchema.default({}),
  services: z.array(ServiceSchema).min(1),
  copy: CopySchema,
  gallery: z.array(GalleryPhotoSchema).default([]),
  reviews: z.array(ReviewSchema).default([]),
  map: MapSchema.default({}),
  form: FormSchema,
  seo: SeoSchema,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientConfigInput = z.input<typeof ClientConfigSchema>;
export type ClientConfig = z.output<typeof ClientConfigSchema>;
export type SectionId = ClientConfig["layout"]["sectionOrder"][number];

/**
 * Validate and normalize a client config.
 *
 * Use this in every `client.config.ts`. It throws a readable error on invalid
 * config so that `pnpm build` (and therefore CI and the Vercel build) fails
 * loudly rather than shipping a broken site.
 */
export function defineClient(config: ClientConfigInput): ClientConfig {
  const result = ClientConfigSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid client config${config?.slug ? ` for "${config.slug}"` : ""}:\n${issues}`,
    );
  }
  return result.data;
}

export * from "./presets.js";
