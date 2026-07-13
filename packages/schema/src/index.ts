import { z } from "zod";
import { PALETTE_PRESET_IDS, FONT_IDS, type PalettePresetId } from "./presets.js";
import { CONTENT_PACKS } from "./content-packs.js";
import { SECTION_VARIANTS } from "./section-variants.js";

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

/**
 * E.164-ish phone. Stored canonical; the template builds the `tel:` href.
 * Requires a 10-digit NANP number (optionally `+1`-prefixed) with a valid
 * area code lead digit (2-9) — deliberately does NOT enforce the exchange
 * (NXX) digit, since the fleet's intentional `555-01xx` placeholders use a
 * leading `0` there.
 */
const phone = z
  .string()
  .trim()
  .regex(/^[+]?[\d().\-\s]+$/, "phone has invalid characters")
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    const tenDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    return tenDigits.length === 10 && /^[2-9]/.test(tenDigits);
  }, "phone must be a 10-digit US/Canada number (area code can't start with 0 or 1), optionally prefixed with +1");

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
   * Scroll-motion intensity, applied dependency-free (CSS + one
   * IntersectionObserver island; no GSAP, no Lenis):
   * - `none`   — fully static; no reveal, rise, or pulse. Content renders as-is.
   * - `subtle` — reveal-on-enter for sections/cards + a hero entrance cascade.
   * - `rich`   — adds per-card stagger within a section and pulsing service-area
   *              markers on top of `subtle`.
   * Always `prefers-reduced-motion`-guarded and no-JS-safe (content is visible
   * by default; motion only hides-then-reveals once the island confirms motion
   * is wanted). Default `rich` — the factory starts expressive; dial down to
   * `subtle`/`none` per client. See docs/adr/0001-motion-foundation.md.
   */
  motion: z.enum(["none", "subtle", "rich"]).default("rich"),
});

export const LayoutSchema = z.object({
  /**
   * @deprecated Legacy hero variant switch. Prefer
   * `layout.sections.hero.variant` ("classic" / "video" / harvested ids);
   * `defineClient()` maps "B" onto "video" when no explicit hero variant is
   * set. Kept so existing configs (and the ops agent) stay valid; removed in
   * a future deliberate schema change.
   */
  variant: z.enum(["A", "B"]).default("A"),
  /**
   * Per-section style variants (closed enums — see section-variants.ts).
   * Fully defaulted: omitting this renders the classic design everywhere,
   * so existing configs are untouched. `.strict()` so an unknown section key
   * fails the build instead of being silently dropped.
   */
  sections: z
    .object({
      // Inlined per section (not a generic helper) so tsc can verify the
      // defaulted `{}` against each concrete enum tuple.
      hero: z
        .object({ variant: z.enum(SECTION_VARIANTS.hero).default("classic") })
        .default({}),
      services: z
        .object({ variant: z.enum(SECTION_VARIANTS.services).default("grid") })
        .default({}),
      gallery: z
        .object({ variant: z.enum(SECTION_VARIANTS.gallery).default("grid") })
        .default({}),
      reviews: z
        .object({ variant: z.enum(SECTION_VARIANTS.reviews).default("cards") })
        .default({}),
      serviceAreaMap: z
        .object({ variant: z.enum(SECTION_VARIANTS.serviceAreaMap).default("standard") })
        .default({}),
      contact: z
        .object({ variant: z.enum(SECTION_VARIANTS.contact).default("standard") })
        .default({}),
    })
    .strict()
    .default({}),
  /**
   * Order of sections on the page. Unknown ids are rejected so a typo can't
   * silently drop a section. Hero and Footer are always rendered (first/last)
   * and must not appear here.
   */
  sectionOrder: z
    .array(
      z.enum(["services", "gallery", "reviews", "serviceAreaMap", "contact"]),
    )
    .default(["services", "gallery", "reviews", "serviceAreaMap", "contact"])
    .superRefine((ids, ctx) => {
      const seen = new Set<string>();
      ids.forEach((id, index) => {
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate section id "${id}" in sectionOrder`,
            path: [index],
          });
        }
        seen.add(id);
      });
    }),
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
  image: publicPath.optional(),
  /** Used only by layout variant "B" (full-bleed video). */
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

/**
 * Optional per-site analytics (decision: Plausible, se#84 2026-07-13).
 * `domain` is the bare site hostname as registered in the Plausible dashboard
 * (e.g. "monroepressure.com" — no scheme/path); BaseHead emits the script tag
 * only when this block is present.
 */
export const AnalyticsSchema = z.object({
  provider: z.literal("plausible"),
  domain: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/i,
      "analytics.domain must be a bare hostname, e.g. monroepressure.com (no https://, no path)",
    ),
});

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
  analytics: AnalyticsSchema.optional(),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientConfigInput = z.input<typeof ClientConfigSchema>;
export type ClientConfig = z.output<typeof ClientConfigSchema>;
export type SectionId = ClientConfig["layout"]["sectionOrder"][number];

/**
 * A config that starts from a per-vertical content pack (issue #85) instead
 * of hand-writing default services and CTA copy. Picking `contentPack` relaxes
 * `services` to optional — the pack supplies it when omitted. Business facts
 * (hours, phone, service areas, about copy) are never in a pack, so they stay
 * required here same as `ClientConfigInput`.
 */
export type ClientConfigDraft =
  | ClientConfigInput
  | (Omit<ClientConfigInput, "services"> & {
      contentPack: PalettePresetId;
      services?: ClientConfigInput["services"];
    });

/**
 * Merge a content pack's defaults under a draft config. Override-only: any
 * field the draft sets explicitly wins, the pack only fills gaps. Returns a
 * plain `ClientConfigInput` (the `contentPack` key never reaches Zod — it
 * isn't part of the canonical `ClientConfigSchema` shape, so this keeps the
 * ops schema-drift guard, #75, unaffected by picking a pack).
 */
function applyContentPack(config: ClientConfigDraft): ClientConfigInput {
  if (!("contentPack" in config)) {
    return config;
  }
  const { contentPack, ...rest } = config;
  const pack = CONTENT_PACKS[contentPack];
  if (!pack) {
    throw new Error(`Unknown contentPack "${contentPack}" — expected one of ${PALETTE_PRESET_IDS.join(", ")}`);
  }
  return {
    ...rest,
    services: rest.services && rest.services.length > 0 ? rest.services : pack.services,
    copy: { ...rest.copy, ctaLabel: rest.copy.ctaLabel ?? pack.ctaLabel },
    layout: { ...rest.layout, sectionOrder: rest.layout.sectionOrder ?? pack.sectionOrder },
  };
}

/**
 * Bridge the deprecated `layout.variant` hero switch onto the variant system:
 * `"B"` means the full-bleed video hero, so it resolves to
 * `layout.sections.hero.variant = "video"` — unless the config sets an
 * explicit hero variant, which always wins. `"A"` needs no mapping; it is the
 * `"classic"` default.
 */
function applyLegacyHeroVariant(config: ClientConfigInput): ClientConfigInput {
  const layout = config.layout;
  if (!layout || layout.variant !== "B" || layout.sections?.hero?.variant) {
    return config;
  }
  return {
    ...config,
    layout: {
      ...layout,
      sections: { ...layout.sections, hero: { variant: "video" } },
    },
  };
}

/**
 * Validate and normalize a client config.
 *
 * Use this in every `client.config.ts`. It throws a readable error on invalid
 * config so that `pnpm build` (and therefore CI and the Vercel build) fails
 * loudly rather than shipping a broken site.
 */
export function defineClient(config: ClientConfigDraft): ClientConfig {
  const draft = applyLegacyHeroVariant(applyContentPack(config));
  const result = ClientConfigSchema.safeParse(draft);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid client config${draft?.slug ? ` for "${draft.slug}"` : ""}:\n${issues}`,
    );
  }
  return result.data;
}

export * from "./presets.js";
export * from "./content-packs.js";
export * from "./lead-to-config.js";
export * from "./section-variants.js";
