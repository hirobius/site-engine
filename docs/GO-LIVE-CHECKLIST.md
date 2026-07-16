# Go-Live Checklist — the facts a site needs before `SITE_LIVE=true`

`docs/INTAKE.md` is the worksheet for *building* a preview — it maps every
question to a `client.config.ts` field. This doc is narrower: it's the
checklist for the moment a preview becomes a **real client site**, so the
same handful of facts don't get hand-rediscovered on every build
(crystal-panes, pnw-arborist, septic-response all shipped previews with the
same missing-facts list — see issue #151).

Every item below is a real field in `packages/schema/src/index.ts`
(`ClientConfigSchema`) or a real check in
`packages/template/src/acceptance.ts` (`checkClientAcceptance`). Nothing here
is invented process — if a fact you need isn't listed, it isn't in the schema
yet (see **Not yet in scope** at the bottom) and adding it is a schema change,
not an intake step.

## Why this exists — the enforcement, not just the doc

A preview is allowed to ship placeholder data (`apps/_template`'s stub phone
`(555) 010-0000`, `hello@biz.example`, an all-zeros Web3Forms key) — that's
normal for cold outreach. `armAcceptanceGate` (`packages/template/src/build-gate.ts`)
arms `checkClientAcceptance`'s placeholder checks the moment `SITE_LIVE=true`
or `VERCEL_ENV=production`, so a build with any item below still unresolved
**fails at build time**, before it ever reaches Vercel. `pnpm go-live <slug>`
runs that armed build locally first for exactly this reason. §1–§2 below are
the intake-facts half of that gate — work through them *before* running
`pnpm go-live`, not after it fails. (`checkClientAcceptance` also runs checks
that aren't intake facts and so aren't §1/§2 checklist items — an
unconditional WCAG AA contrast check on the resolved palette, and a
video-hero check that `hero.videoSrc` is set whenever
`layout.sections.hero.variant` is `"video"`. Both run on every build,
preview included; if either fails, the fix is a `brand`/`layout` config
change, not a missing intake fact. The claims/compliance guardrail in §5 is
a middle case: detection runs on every build too, but it only warns in
preview and only fails once armed — same split as the placeholder checks in
§1/§2, so it gets its own section there instead of being lumped in here.)

## 1. Required — the build will not go live without these

Most fields here are non-optional in `ClientConfigSchema` itself (Zod rejects
a config missing them, in preview or production). A few — flagged
"(gate-only)" — are schema-*optional* but `checkClientAcceptance` still
rejects an armed (go-live) build that omits or fakes them; Zod alone lets
them through. Everything marked "(placeholder gate)" is additionally checked
for fakeness once `realData` is armed — a syntactically valid but fake value
(a `.example` email, an all-zeros form key) passes Zod but still fails the
armed build.

- [ ] **Business name** (`business.name`) — real legal/trade name, not a stub
      like "Acme" / "New Client" / "Test Business" (placeholder gate).
- [ ] **Phone** (`business.phone`) — real 10-digit US/Canada number. Not a
      `555` area code or `555-01XX` exchange — both are the fleet's reserved
      placeholder pattern and fail the gate.
- [ ] **Email** (`business.email`) — real inbox the business actually reads
      leads from. Not `*.example` / `example.com` (placeholder gate).
- [ ] **Hours** (`business.hours`, at least one row) — real days + hours, not
      "call for hours." Include 24/7 emergency service as its own row if the
      trade offers it.
- [ ] **Service areas** (`business.serviceAreas`, at least one) — real
      cities/regions; feeds the visible copy and the `LocalBusiness`
      `areaServed` JSON-LD.
- [ ] **Services** (`services`, at least one) — real title + description per
      service actually offered.
- [ ] **Copy** (`copy.heroHeadline`, `copy.heroSub`, `copy.about`) — written
      for this business, not generic filler.
- [ ] **Form provider key** (`form.accessKey`) — a real Web3Forms UUID-shaped
      access key. A scaffold string (`REPLACE_WITH_WEB3FORMS_ACCESS_KEY`) or
      an all-zeros key both fail the gate — only a real key passes.
- [ ] **hCaptcha site key** (`form.hcaptchaSiteKey`, gate-only — schema
      allows omitting it) — required once the site is real; the armed build
      fails a real config with no key even though Zod alone would accept it.
      Skipping it fills the client's inbox with spam.
- [ ] **Production site URL** (`seo.siteUrl`) — the real `https://` domain the
      site will live at. Not `*.example` and not `http://` (placeholder gate
      requires `https://`).
- [ ] **SEO title** (`seo.title` ≤ 70 chars) — real, business-specific title.
- [ ] **SEO description** (`seo.description` ≤ 180 chars) — real, not
      boilerplate.
- [ ] **SEO city / region** (`seo.city`, `seo.region`) — real, matches
      `business.serviceAreas`.
- [ ] **Section data matches `layout.sectionOrder`** — `checkClientAcceptance`
      fails the build (in preview *and* production — this check is
      unconditional, not gated on `realData`) if a section is listed in
      `sectionOrder` but its data is empty: `gallery` needs ≥1 photo,
      `reviews` needs ≥1 review, `serviceAreaMap` needs `map.embedQuery` or
      `map.staticImage`. (`contact` needs `form`, which `ClientConfigSchema`
      already requires at the root — this one can't actually fail.) If a fact
      for `gallery`/`reviews`/`serviceAreaMap` genuinely isn't ready, drop
      that id from `sectionOrder` rather than shipping it empty.
- [ ] **Hero photo, if set, is optimized** (`hero.image` is schema-optional —
      the build does not require a hero photo at all). *If* you set it, it
      must resolve to a file under `src/assets/photos/`, not only `public/`;
      a `public/`-only hero image fails the armed build (protects LCP — see
      issue #81). In practice ship a real hero photo anyway — a site with no
      hero image looks unfinished even though nothing enforces its presence.

## 2. Optional but recommended — schema allows omission, go-live shouldn't

These are valid to leave unset per the schema (no build failure either way),
but a client site missing them reads as unfinished:

- [ ] **Address** (`business.address`) — skip only if the business is
      genuinely mobile-only with no public location.
- [ ] **Gallery photos** (`gallery`, with alt text — required per photo when
      present) — real project photos, not stock. `GalleryPhotoSchema` rejects
      a photo with no `alt`.
- [ ] **Reviews** (`reviews`) — real customer reviews only, and only with the
      reviewer's **written permission to publish their name and words on the
      site**. Each entry needs `author`, `rating` (1–5), `text`, optional
      `source` (e.g. "Google"). Never write a review that wasn't actually
      given, and never publish one you don't have permission for — the
      schema has nowhere to record that permission, so track it outside
      `client.config.ts` (e.g. the intake thread) and only copy the review
      text in once you have it.
- [ ] **OG image** (`seo.ogImage`) — a real 1200×630 social-share image, not
      the generated favicon monogram.
- [ ] **Static map or map query** (`map.staticImage` / `map.embedQuery`) —
      only required if `serviceAreaMap` is in `sectionOrder` (see §1).
- [ ] **Redirect URL after submit** (`form.redirectUrl`) — optional; falls
      back to the built-in `/thanks` page when unset.

## 3. Golden rule #5 — never fabricate a business fact

Per `CLAUDE.md`'s golden rules: phone numbers, hours, service areas, reviews,
and addresses **come from intake only**. If a required field above is
genuinely unknown at build time:

- Leave the intentional placeholder in place (the `apps/_template` stub
  values) and list the field as a `TODO` comment in `client.config.ts`.
- Do **not** invent a plausible-looking value to get the build green — a
  fabricated hour, review, or address is worse than an honest placeholder,
  and the whole point of the armed gate in §"Why this exists" is that it will
  catch (most of) the syntactically-obvious cases, but it cannot catch a
  fabricated value that merely *looks* real (a made-up but real-shaped phone
  number, an invented review). The gate is a backstop, not a substitute for
  sourcing every fact from the client.

## 4. Not yet in scope (tracked separately, do not improvise)

Issue #87 (`feat(schema): trust/conversion fields`) landed in #171: license #
(`business.licenseNumber`), the licensed/insured/bonded flags
(`business.licensed`/`insured`/`bonded`), a Google Business Profile URL
(`business.gbpUrl`), social links (`social`), and a logo (`brand.logo` /
`logoAlt`) all now have a real `ClientConfigSchema` field — see §1/§2 above
and `packages/schema/src/index.ts`. Two items from the original ask still
have **no** schema field, so there is still no config path for them — do not
add ad hoc fields or free-text workarounds:

- **Insurance carrier name and certification records** — no
  `ClientConfigSchema` field exists yet. `business.insured` is a plain
  boolean (verified-or-not), not a place to record *which* carrier; there is
  similarly no certifications field. A future schema change, not this
  checklist.
- **Domain registration (Porkbun) / DNS** — covered by the separate go-live
  runbook referenced from issue #151, not by this checklist or by
  `ClientConfigSchema`.

## 5. Claims & compliance — don't assert what you can't verify (issue #149)

Golden rule #5 (§3 above) covers fabricated *facts* — a phone number, a
review that was never given. This section covers the adjacent *claims*
layer: assertions that carry real false-advertising / FTC exposure even when
every other fact on the site is genuine. Building the arborist and septic
previews (2026-07-16) shipped, then had to correct, exactly this — "fully
insured," "certified," and loose review/stat framing with no data to back
them.

- [ ] **"Licensed," "insured," "bonded"** — only use these words in
      `copy.*`, `seo.title`/`seo.description`, or a `services[]` entry once
      the matching field is verified at intake: `business.licensed: true`
      (or a real `business.licenseNumber`) for "licensed,"
      `business.insured: true` for "insured"/"fully insured,"
      `business.bonded: true` for "bonded." No verified flag → no claim.
      Soften instead — e.g. "free, no-obligation estimates."
- [ ] **"Certified," "guaranteed," "#1," "best"** — `ClientConfigSchema` has
      no field that can verify any of these (see §4 above), so they should
      not appear in generated copy at all today. If a client genuinely holds
      a certification, name the *specific* credential from real intake
      material and treat it as a factual claim to source, not marketing
      shorthand — until then, leave it out.
- [ ] **Reviews are the factual aggregate, not a cherry-picked slice** — show
      the real rating and count, and link to the real Google profile
      (`business.gbpUrl`). Don't display only 5-star reviews while hiding
      lower ones (FTC's 2024 consumer-review rule). A hand-picked
      `reviews[]` array of real, permission-cleared testimonials (§2 above)
      is fine; a *curated-to-look-perfect* one is not.
- [ ] **Stats are labeled to their source** — "233 Google reviews," not a
      bare "233 reviews" with no source, and never a number that isn't the
      real `rating`/review count from the lead row.

**Enforcement:** `checkClientAcceptance` (`packages/template/src/acceptance.ts`)
scans `copy.heroHeadline`, `copy.heroSub`, `copy.about`, `copy.ctaLabel`,
`seo.title`, `seo.description`, and every `services[].title`/`description`
for the tokens `insured`/`licensed`/`bonded`/`certified`/`guaranteed`/`#1`/`best`
(case-insensitive; deliberately *not* `reviews[].text`, since a review is the
customer's own words, not our claim). A match with no matching verified field
only `console.warn`s in a preview build; once `armAcceptanceGate` arms
`realData` (`SITE_LIVE=true` / `VERCEL_ENV=production`, same trigger as §1's
placeholder gate), it's a build-blocking issue
(`unverified-claim-licensed`/`-insured`/`-bonded`/`-certified`/`-guaranteed`/
`-number-one`/`-best`). The reviews/stats bullets above are a human-review
checklist item, not (yet) machine-checked — `checkClientAcceptance` can
confirm a claim token is unverified, but it can't judge whether a reviews
section is cherry-picked.

## Where this fits in the build

1. Fill `docs/INTAKE.md` to write the config (`apps/<slug>/client.config.ts`).
2. Build the preview (`pnpm --filter @hirobius/<slug> build`) — the
   placeholder gate is unarmed here, so intentional stub data is fine.
3. Work this checklist before `pnpm go-live <slug>` — every unchecked box in
   §1 is something the armed build will reject, and any risky claim token
   from §5 left unverified will reject it too.
4. Run `pnpm go-live <slug>` — it re-runs the armed build
   (`SITE_LIVE=true`) locally first; a config still missing an item above
   fails here with the specific `checkClientAcceptance` code, not on Vercel.
