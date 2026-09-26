import { z } from "zod";

/**
 * SiteSpec — the data behind a BESPOKE-tier site (se#153, se#207).
 *
 * The bespoke tier is art-directed: hand-authored pages with their own type
 * system, parallax and literal design tokens that deliberately do not pass
 * `purity.ts`. Its pages therefore cannot be expressed as a `ClientConfig`, and
 * this is NOT an attempt to make them. `client.config.ts` stays the pure
 * ClientConfig — the business facts — per ADR-0003 §4; a SiteSpec carries only
 * the art direction and the per-client copy that was previously inline
 * literals in `src/pages/*.astro`.
 *
 * DELIBERATELY NOT exported from `src/index.ts`.
 * `packages/schema/scripts/refresh-ops-snapshot.ts` snapshots
 * `shapeOf(ClientConfigSchema)` and `presetsShape()`. A standalone module that
 * `ClientConfigSchema` never references cannot move `ops-shape.snapshot.json`
 * or trip `ops-drift.test.ts`, so the bespoke tier carries zero ops re-sync
 * burden. Importing this from `index.ts` would silently forfeit that.
 *
 * Copy fields are TEMPLATES, not sentences. They interpolate `{name}` (the
 * business name) and `{city}` from the ClientConfig at render time, so the spec
 * never restates a business fact that already lives in `client.config.ts` —
 * which is what keeps the two from drifting.
 */

/** A `{placeholder}` template. Rendered with `renderSpecTemplate()`. */
const templateString = z.string().min(1);

const wordmarkSchema = z.object({
  /** Plain first half of the wordmark, e.g. "PNW". */
  lead: z.string().min(1),
  /** Emphasised second half, rendered inside a `<span>`, e.g. "Arborist". */
  accent: z.string().min(1),
});

const headlineSchema = z.object({
  lead: templateString,
  /** Rendered inside `<span class="accent">`. */
  accent: templateString,
});

const statSchema = z.object({
  /** The big number/word, e.g. "4.9★" or "24/7". */
  k: z.string().min(1),
  /** Its label, e.g. "Google rating". */
  l: z.string().min(1),
});

/** A Lucide icon id, as vendored per-app in that app's `Icon.astro`. */
const iconIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "icon id must be kebab-case");

const featureSchema = z.object({
  icon: iconIdSchema,
  title: z.string().min(1),
  text: z.string().min(1),
});

const stepSchema = z.object({
  icon: iconIdSchema,
  title: z.string().min(1),
  text: z.string().min(1),
});

/** One of the V2 hero's three trust badges. `k` is the bold lead value —
 * empty string for a badge with no number (e.g. "Free estimates"). */
const heroTrustItemSchema = z.object({
  icon: iconIdSchema,
  k: z.string(),
  l: z.string().min(1),
});

/** A Pexels search for one photo slot: `scripts/fetch-photos.mjs` reads the
 * same shape from `photo-queries.json` at runtime (se#208). */
const photoQuerySchema = z.object({
  query: z.string().min(1),
  orientation: z.enum(["portrait", "landscape", "square"]),
});

/**
 * The V1 `:root` block, as the CSS custom properties themselves.
 *
 * Modelled as the property names rather than a parallel vocabulary on purpose:
 * `src/styles/design.css` is a direct projection of this object, so there is no
 * mapping layer to get wrong and no second name for the same value.
 */
const designSchema = z.record(
  z.string().regex(/^--[a-z0-9-]+$/, "design keys are CSS custom properties, e.g. --accent"),
  z.string().min(1),
);

export const SiteSpecSchema = z.object({
  /** Matches the app directory name; also the localStorage key prefix. */
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  /** Display name for the page's own doc comment. Not user-facing copy. */
  client: z.string().min(1),

  wordmark: wordmarkSchema,
  /** The real Google Business Profile URL, so the rating claim stays checkable. */
  googleUrl: z.string().url(),
  /** Trade line before the city, e.g. "Certified Arborists". */
  tradeEyebrow: z.string().min(1),
  /** Hero image alt. Template: `{name}`, `{city}`. */
  heroAlt: templateString,
  headline: headlineSchema,
  bandHeadline: headlineSchema,
  /** Exactly three — the layout is a 3-column grid. */
  stats: z.tuple([statSchema, statSchema, statSchema]),
  /** Trails the service-area list, e.g. " — and the surrounding Eastside.". */
  regionPhrase: z.string().min(1),
  formPlaceholder: z.string().min(1),
  /** Footer blurb. Template: `{name}`, `{city}`. */
  footerDescription: templateString,

  images: z.object({
    /** Public-relative, without the leading slash, e.g. "photos/hero.jpg". */
    hero: z.string().min(1),
    band: z.string().min(1),
    /** V2's own hero slot — a different crop/scene from the V1 hero (se#208). */
    v2Hero: z.string().min(1),
  }),

  /**
   * The non-flat content the V2 "Modern" page (`src/pages/v2.astro`) needs
   * beyond `client.config.ts` — cards, features and steps as arrays, plus the
   * few V2-only copy strings. `serviceIcons` cycles by index across
   * `client.services`, same as V1's numbered index needs no icon.
   */
  content: z.object({
    serviceIcons: z.array(iconIdSchema).min(1),
    /** Exactly four — the "why us" grid is a 4-column layout. */
    features: z.tuple([featureSchema, featureSchema, featureSchema, featureSchema]),
    /** Exactly three — the "how it works" row is a 3-column layout. */
    steps: z.tuple([stepSchema, stepSchema, stepSchema]),
    /** V2 hero eyebrow, before " · {city}, {region}" (not templated — city is
     * appended separately, unlike `tradeEyebrow`'s V1 usage). */
    heroEyebrow: z.string().min(1),
    /** Exactly three — the hero's trust-badge row. */
    heroTrust: z.tuple([heroTrustItemSchema, heroTrustItemSchema, heroTrustItemSchema]),
    servicesHeading: z.string().min(1),
    servicesIntro: z.string().min(1),
    featuresHeading: z.string().min(1),
    areaHeading: z.string().min(1),
    /** V2's own footer line, after "{b.name} — ". Template: `{city}`. Not the
     * same string as `footerDescription` — the two variants word it slightly
     * differently, so they stay separate rather than force a false merge. */
    footerNote: templateString,
  }),

  /**
   * Section-level micro-copy that reads the same on every bespoke app today
   * (se#208) — kept as spec data rather than literals so a future app can
   * still override it without touching `v2.astro`.
   */
  sectionHeadings: z.object({
    servicesEyebrow: z.string().min(1),
    featuresEyebrow: z.string().min(1),
    stepsEyebrow: z.string().min(1),
    stepsHeading: z.string().min(1),
    serviceAreaEyebrow: z.string().min(1),
    contactEyebrow: z.string().min(1),
    contactHeading: z.string().min(1),
    footerExplore: z.string().min(1),
    footerTagline: z.string().min(1),
  }),

  /** Pexels queries for the three photo slots. Each app's `site.spec.ts`
   * imports the SAME `photo-queries.json` that `scripts/fetch-photos.mjs`
   * reads at runtime (via `resolveJsonModule`, no duplication) — that script
   * must stay a plain, standalone `.mjs` with no TypeScript toolchain, so the
   * data lives in JSON rather than a `.ts` export. */
  photoQueries: z.object({
    hero: photoQuerySchema,
    band: photoQuerySchema,
    v2Hero: photoQuerySchema,
  }),

  design: designSchema,
});

export type SiteSpec = z.infer<typeof SiteSpecSchema>;

/**
 * Validate a spec at module load, so a malformed one fails the BUILD rather
 * than rendering a half-empty page. Mirrors `defineClient()`.
 */
export function defineSiteSpec(input: unknown): SiteSpec {
  return SiteSpecSchema.parse(input);
}

/**
 * Fill `{name}` / `{city}` from the ClientConfig.
 *
 * Throws on an unknown placeholder rather than leaving `{typo}` visible on a
 * client-facing page — a silently un-substituted token is the failure mode
 * this is here to prevent.
 */
export function renderSpecTemplate(
  template: string,
  vars: { name: string; city: string },
): string {
  return template.replace(/\{([a-z]+)\}/g, (_match, key: string) => {
    if (key === "name") return vars.name;
    if (key === "city") return vars.city;
    throw new Error(
      `renderSpecTemplate: unknown placeholder {${key}} — supported: {name}, {city}`,
    );
  });
}
