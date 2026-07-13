# Multi-page local SEO — scope doc

**Status:** Draft, awaiting Adrian sign-off
**Author:** ralph (Claude), 2026-07-13
**Tracks:** issue #107
**Tier decision (already made, 2026-07-12):** multi-page is a **paid tier above
the one-pager**. Per-service pages ship first; per-area pages are phase 2. The
one-pager stays the base package and the default ops-agent output. This doc
answers scope questions 1–6 on that basis and proposes a schema extension —
**no schema or template code changes ship from this doc.** Build issues are
filed only after this doc is signed off.

---

## 1. Config shape

**Decision: a top-level `pages` collection, not `services[].page?`.**

```ts
services: [
  { title: "Driveway Washing", description: "...", icon: "...", pageSlug: "driveway-washing" },
  // pageSlug is the ONLY new field on ServiceSchema — links a service card to
  // its detail page. Omitting it means "one-pager only" for that service.
],
pages: {
  services: [
    {
      slug: "driveway-washing",       // -> /services/driveway-washing/
      serviceRef: "Driveway Washing", // must match a services[].title (build-time check)
      seo: { title, description },    // canonical + city/region inherited from root seo
      copy: { intro, body, faq? },    // area-specific / service-specific prose — see §5
    },
  ],
  areas: [
    {
      slug: "lacey-wa",                // -> /areas/lacey-wa/
      city: "Lacey", region: "WA",
      seo: { title, description },
      copy: { intro, body },
    },
  ],
},
```

Why a top-level collection over `services[].page?`:

- **One page shape, one place to enumerate for routing/sitemap/nav.** Astro's
  file-based routing needs a flat list to `getStaticPaths()` over
  (`src/pages/services/[slug].astro`, `src/pages/areas/[slug].astro`). A
  top-level collection maps 1:1 onto that; `services[].page?` would require
  filtering `services` for the ones with a `page` key, which is the same
  operation with worse locality.
- **Areas have no natural home in `services[]`.** `areas[]: { city, seo, copy }`
  from the issue's own question 1 doesn't nest under `services` at all — a
  top-level `pages` collection gives both entity types one consistent parent
  instead of one nested + one root-level.
- **Matches the ADR-0002 precedent** (`section-variants.ts`): keep the closed,
  enumerable set at the root, reference it by id/slug from the content it
  augments (`services[].pageSlug` is the same shape as
  `layout.sections.<id>.variant` — a thin reference, not inline duplication).
- **Stays config-locked per the CLAUDE.md one rule.** `pages.services[]` and
  `pages.areas[]` are fixed-shape array items (slug + seo + copy), not
  free-form page bodies. No markdown/HTML field, no arbitrary section list per
  page — each page type renders through one fixed Astro template
  (`[slug].astro`) reading `copy.intro` / `copy.body` / `copy.faq` into fixed
  slots, same discipline as the one-pager's sections.
- **`services[].pageSlug` is optional.** A client can have some services with
  detail pages and some without (e.g. a low-intent add-on service that isn't
  worth its own URL) — matches "per-service pages first, ranked by intent,"
  not "every service must have a page."

## 2. Tier boundary

**Decided by Adrian (2026-07-12):** multi-page is a paid upsell tier. Restated
here with the mechanics that decision implies:

- **Default ops-agent output stays the one-pager.** `pages` is undefined/empty
  by default; `defineClient()` treats it exactly like `gallery`/`reviews`
  today — optional, empty-array-safe, zero behavior change for every existing
  client config. This is a strictly additive schema change (see §7 on the ops
  re-sync).
- **The upsell trigger is manual, not agent-inferred.** The ops agent does not
  decide a client "should" have multi-page based on lead signals — that's a
  sales conversation. `pages` gets populated when a human (Adrian, or the
  agent operating on an explicit brief flag) decides to build the upsell.
- **Follow-up build issue should scope a `--with-pages` (or similar) flag on
  `new-client`** so scaffolding a multi-page site is still a scripted path,
  not hand-rolled routing — consistent with CLAUDE.md's "scaffold with the
  script, never by hand-copying files."
- **Pricing recommendation:** see §8.

## 3. Nav

One-pagers have no header nav today (`Document.astro` → no nav component;
confirmed in `packages/template/src/components/`). Multi-page needs one, and
it's a **fleet-visible template change** (touches `packages/template`, not a
per-client override) — same drift/versioning discipline as any `packages/*`
change per the README's template-update policy.

- **New `packages/template` component**: `Nav.astro`, rendered by
  `Document.astro` only when `config.pages` is non-empty (one-pagers keep
  today's no-nav header unchanged — this is additive, not a restyle of every
  site). Reuses the existing semantic token set (`--color-primary/fg/bg`,
  `--font-heading`) so it inherits each client's resolved palette for free,
  same as every other component.
- **Nav content is derived, not configured.** Links = home + `pages.services[]`
  (by title/slug) + `pages.areas[]` (by city/slug), in the order they appear
  in the config arrays. No separate `nav: [...]` field — a second source of
  truth for the same links would drift from `pages` immediately.
- **New variant surface, closed set per ADR-0002 convention**: if nav needs a
  style axis later (e.g. `standard` vs a condensed mobile-drawer treatment),
  it goes through `SECTION_VARIANTS` the same way every other section did —
  not a new ad hoc mechanism.
- Mobile: a drawer/hamburger pattern is close to unavoidable once there are
  6+ service pages + N area pages; scope that as part of the nav component
  build, not deferred.

## 4. SEO mechanics

- **Per-page title/description/canonical**: `pages.services[].seo` /
  `pages.areas[].seo` reuse the existing `SeoSchema` shape (title ≤70,
  description ≤180) minus `siteUrl` (inherited from root `seo.siteUrl` — one
  canonical origin per client, not re-specified per page) and minus
  `city`/`region` for service pages (inherited from root) but **present** for
  area pages, since the area *is* the city/region being targeted.
- **JSON-LD per page**: extend `packages/template/src/lib/seo.ts`.
  - Service pages emit a `Service` node (`@type: "Service"`, `provider` →
    the existing `LocalBusiness` node via `@id` reference, `areaServed` from
    `business.serviceAreas`, `name`/`description` from the page).
  - Area pages emit the existing `LocalBusiness` JSON-LD with `areaServed`
    narrowed to that one city, plus a `Service` list for what's offered there.
  - Both link back to the root `LocalBusiness` `@id` (already emitted by
    `localBusinessJsonLd()` at `${seo.siteUrl}#business`) rather than
    duplicating the full business node — avoids conflicting/duplicate
    `LocalBusiness` entities across pages, which is a known local-SEO
    footgun.
- **Sitemap**: `@astrojs/sitemap` (already wired in `astro.config.ts`) crawls
  Astro's build output automatically — new static routes under
  `/services/<slug>/` and `/areas/<slug>/` need **no sitemap config change**,
  only the routes existing. `robots.txt` (`packages/template/src/lib/seo.ts`
  → `robotsTxt()`) is already route-agnostic (`Allow: /`).
- **Hub-and-spoke internal linking**: the home page's `ServicesGrid` section
  gets an optional link-through when a service has a `pageSlug` (spoke →
  hub already exists via nav; hub → spoke needs this). Area pages get a
  reciprocal "other areas we serve" list rendered from `pages.areas[]`
  (excluding self) — the standard local-SEO internal-linking pattern, and
  cheap since it's derived from config, not authored per page.
- **OG image**: `ogImageIntegration()` today generates one fallback card from
  the root config (`og-image.ts`). Per-page OG images are **out of scope for
  v1** — pages inherit the root `seo.ogImage` fallback; a per-page card is a
  nice-to-have, not required to ship the tier.

## 5. Doorway-page risk

This is the sharpest edge in the whole feature and the reason Adrian phased
area pages behind service pages.

- **Per-service pages are lower risk**: each service already has a real,
  distinct `description` in the schema, and a service detail page naturally
  differentiates on *what* (the work, materials, process) rather than *where*
  — Google's doorway-page guidance is specifically about pages that differ
  only in geography with templated boilerplate around a swapped city name.
- **Per-area pages are the actual doorway risk** and get a harder gate:
  - `pages.areas[].copy.intro` / `copy.body` get a **minimum-length +
    non-duplication acceptance check**, extending `checkClientAcceptance()`
    (`packages/template/src/acceptance.ts`) the same way the existing
    placeholder/contrast checks work — schema `.min(1)` catches empty, not
    templated-and-swapped. Concretely: `copy.body` on every area page must
    (a) meet a minimum word count (proposed: 150 words — enough to force
    actual area-specific content, not a copy-pasted paragraph with the city
    name swapped) and (b) not be textually near-identical to another area
    page's body (a simple normalized-token-overlap check across
    `pages.areas[]`, not full NLP — enough to catch the lazy-template case
    the guard exists to prevent).
  - This is a **build-gate check**, same posture as the `.example` URL / all-
    zeros form-key catches added for issue #37/#78 — schema validates shape,
    acceptance validates "is this real," armed on `SITE_LIVE`/`VERCEL_ENV`
    exactly like the existing `realData` checks.
  - Area page content is real work per client (the intake conversation needs
    to produce actual area-specific detail — neighborhoods served, a
    landmark, a local job example), which is *why* it's phase 2 and priced
    accordingly (see §8) — it's not a checkbox, it's billable content work.

## 6. Interaction with #33 and #41

*(Caveat: `gh` wasn't reachable from this sandbox session, so this section is
drafted from in-repo references to #33/#41 — `content-packs.ts`'s comment
"there is no FAQ section in `ClientConfigSchema` yet (tracked in #33)" and
this issue's own refs list. Confirm against the live issue bodies before
build work starts.)*

- **#33 (section kit)**: page bodies (`pages.services[].copy`,
  `pages.areas[].copy`) should draw on whatever fixed section vocabulary #33
  lands (e.g. an FAQ block) rather than this doc inventing a parallel one.
  Concretely: if #33 ships a `faq: [{ question, answer }]` shape, service/area
  pages reuse that exact shape for their optional `copy.faq`, not a
  bespoke one. **Sequencing implication: #33's section vocabulary should land
  (or at least freeze its shape) before the per-service-page build issue is
  scoped**, so the page schema doesn't get designed twice.
- **#41 (Keystatic)**: multi-page content (`pages.*.copy`) is exactly the kind
  of longer-form, edited-after-launch content Keystatic targets — a client
  wanting to update their "Lacey WA" area page copy without a code change is
  a stronger case for a CMS than editing `client.config.ts` hours/phone
  fields. **This doc does not block on #41** — `pages.*.copy` ships as plain
  config fields first (consistent with "config is the contract, day one"),
  and becomes a Keystatic-editable collection later if/when #41 lands,
  without a schema shape change (Keystatic would read/write the same Zod
  shape, not a different one).

## 7. Schema draft — canonical → ops re-sync implications

Per CLAUDE.md, `packages/schema` remains canonical here even though
`packages/agent`/`scripts/lead-gen` are frozen and live in `ops`. Any schema
change here must be re-synced to `ops/lib/schema` (`index.mjs`, `presets.mjs`)
via `pnpm schema:snapshot-ops`, guarded by `ops-drift.test.ts`. This section
lists exactly what a build issue would add, so the re-sync scope is known
up front:

```ts
// packages/schema/src/index.ts — additive only, no existing field changes

export const ServiceSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  icon: z.string().optional(),
  image: publicPath.optional(),
  /** NEW. Links this service to its detail page in `pages.services[]`.
   *  Omitted = one-pager-only service (no detail page). */
  pageSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
});

const PageSeoSchema = SeoSchema.omit({ siteUrl: true }); // canonical origin stays root-only

export const ServicePageSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  serviceRef: z.string().min(1), // must match a services[].title — cross-field check in defineClient()
  seo: PageSeoSchema.omit({ city: true, region: true }), // inherited from root seo
  copy: z.object({
    intro: z.string().min(1),
    body: z.string().min(1), // min-length doorway guard lives in acceptance.ts, not here
    faq: z.array(FaqEntrySchema).optional(), // shape TBD by #33
  }),
});

export const AreaPageSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  city: z.string().min(1),
  region: z.string().min(1),
  seo: PageSeoSchema.omit({ city: true, region: true }), // city/region duplicated as top-level fields above, not in seo
  copy: z.object({
    intro: z.string().min(1),
    body: z.string().min(1),
  }),
});

export const PagesSchema = z.object({
  services: z.array(ServicePageSchema).default([]),
  areas: z.array(AreaPageSchema).default([]),
}).default({});

// Root schema — one new optional key, everything else unchanged:
export const ClientConfigSchema = z.object({
  // ...existing fields unchanged...
  pages: PagesSchema, // defaulted to {services: [], areas: []} — every existing config parses unchanged
});
```

- **Fully additive + defaulted**, same discipline as `brand.motion`
  (ADR-0002) — every existing `apps/<slug>/client.config.ts` continues to
  parse with zero edits, `pages` defaults to empty, the one-pager render path
  is unaffected until a config actually populates `pages`.
- **Cross-field validation** (`serviceRef` must match a `services[].title`,
  `pageSlug` values must be unique, page `slug` values must be unique within
  their collection) belongs in `defineClient()`'s existing `safeParse` +
  refine pattern, not hand-rolled — same place `sectionOrder` duplicate
  detection already lives (`LayoutSchema.sectionOrder.superRefine`).
- **`ops-drift.test.ts` will fail** the moment this lands until
  `pnpm schema:snapshot-ops` re-syncs `ops-shape.snapshot.json` — flagging
  this explicitly per the issue's ask, this is not optional cleanup, it's the
  guard doing its job.
- **This block is illustrative, not final** — a build issue implementing it
  should re-derive the exact Zod shape against the schema file's current
  state at build time, not copy-paste this doc verbatim.

## 8. Tier / pricing recommendation (for Adrian's decision)

Adrian already decided the tier boundary (paid upsell, per-service first).
What's still open for Adrian to set: the number.

- **Structure recommendation**: price multi-page as an **add-on to the
  existing build fee**, not a separate recurring line — the ongoing $79/mo
  care-plan cost is the same regardless of page count (same hosting/Vercel
  project), so the marginal cost of multi-page is almost entirely the one-time
  content/build work (page copy per service, area copy per area if/when
  phase 2 ships).
- **Suggested basis for the number**: per-service-page build issue should
  come back with an actual time estimate for scaffolding + writing N service
  page bodies for a typical client (5 services, per the content packs' shipped
  defaults) — price off that, not off perceived value, since the doorway-page
  guard means area-page content especially is real writing time, not
  templating time.
- **Area pages (phase 2) should carry a premium over service pages** given
  the higher per-page content bar from §5 (min-length + non-duplication) —
  the pricing conversation for phase 2 should happen when that build issue is
  scoped, not guessed here.
- This section is a recommendation, not a decision — Adrian sets the number.

## 9. Ranked rollout

1. **Schema extension** (§7) — additive, low risk, unblocks everything else.
   Should sequence after (or alongside a frozen shape from) #33 per §6.
2. **Per-service pages** — routing (`[slug].astro` under `/services/`), nav
   component (§3), Service JSON-LD, hub-and-spoke linking from the home
   `ServicesGrid`. Higher intent, lower doorway risk (§5) — ships the tier.
3. **`new-client` / scaffolding support** for the multi-page tier (§2) —
   can land alongside or just after (2); not a hard blocker for a first
   hand-built multi-page client.
4. **Per-area pages** (phase 2, per Adrian's decision) — same routing/nav
   pattern reused from (2), but gated on the doorway-page acceptance check
   (§5) landing first. Do not ship area pages without that guard.
5. **Per-page OG images** — explicitly deferred (§4), pick up opportunistically.
6. **Keystatic integration for `pages.*.copy`** — deferred to #41's own
   timeline (§6), not part of this rollout.

Follow-up build issues are filed only after this doc is signed off, per the
DoD — step 1 (schema extension) is the natural first issue once approved.
