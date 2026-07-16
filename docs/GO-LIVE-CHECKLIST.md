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
runs that armed build locally first for exactly this reason. This checklist
is the human-readable mirror of that gate — work through it *before* running
`pnpm go-live`, not after it fails.

## 1. Required — the build will not go live without these

Every field here is non-optional in `ClientConfigSchema`, and everything
marked "(placeholder gate)" is additionally checked by `checkClientAcceptance`
once `realData` is armed — a syntactically valid but fake value (a `.example`
email, an all-zeros form key) passes Zod but still fails the armed build.

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
- [ ] **hCaptcha site key** (`form.hcaptchaSiteKey`) — required once the site
      is real (optional only in preview/local dev); the gate fails a real
      build with no key. Skipping it fills the client's inbox with spam.
- [ ] **Production site URL** (`seo.siteUrl`) — the real `https://` domain the
      site will live at. Not `*.example` and not `http://` (placeholder gate
      requires `https://`).
- [ ] **SEO title/description/city/region** (`seo.title` ≤ 70 chars,
      `seo.description` ≤ 180 chars, `seo.city`, `seo.region`) — real, and
      within the length limits (Zod enforces the limits; you supply the
      content).
- [ ] **Section data matches `layout.sectionOrder`** — `checkClientAcceptance`
      fails the build if a section is listed in `sectionOrder` but its data is
      empty: `gallery` needs ≥1 photo, `reviews` needs ≥1 review, `serviceAreaMap`
      needs `map.embedQuery` or `map.staticImage`, `contact` needs `form`. If a
      fact for one of these genuinely isn't ready, drop that id from
      `sectionOrder` rather than shipping it empty.
- [ ] **Hero photo is optimized** (`hero.image`) — must resolve to a file
      under `src/assets/photos/`, not only `public/`; a `public/`-only hero
      image fails the armed build (protects LCP — see issue #81).

## 2. Optional but recommended — schema allows omission, go-live shouldn't

These are valid to leave unset per the schema (no build failure either way),
but a client site missing them reads as unfinished:

- [ ] **Address** (`business.address`) — skip only if the business is
      genuinely mobile-only with no public location.
- [ ] **Gallery photos** (`gallery`, with alt text — required per photo when
      present) — real project photos, not stock. `GalleryPhotoSchema` rejects
      a photo with no `alt`.
- [ ] **Reviews** (`reviews`) — real customer reviews only. Each entry needs
      `author`, `rating` (1–5), `text`, optional `source` (e.g. "Google").
      Never write a review that wasn't actually given.
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

The original ask for this checklist also named license #, insurance carrier,
certifications, testimonial-publish permission, and a Google Business Profile
URL/rating. None of those have a `ClientConfigSchema` field today, so there is
no config path for them yet — do not add ad hoc fields or free-text workarounds
for them:

- **License #, insurance carrier, certifications, GBP/social links, logo** —
  schema additions tracked in issue #87 (`feat(schema): trust/conversion
  fields`). Until that lands, this information has nowhere to go in
  `client.config.ts`.
- **Unverifiable trust claims** ("fully insured," "licensed," "certified,"
  "#1," cherry-picked reviews) — the claims/compliance guardrail is tracked in
  issue #149. Until it lands, don't let generated copy assert any claim you
  don't have a documented, verifiable source for, even informally — soften to
  defensible language instead (e.g. "free, no-obligation estimates").
- **Domain registration (Porkbun) / DNS** — covered by the separate go-live
  runbook referenced from issue #151, not by this checklist or by
  `ClientConfigSchema`.

## Where this fits in the build

1. Fill `docs/INTAKE.md` to write the config (`apps/<slug>/client.config.ts`).
2. Build the preview (`pnpm --filter @hirobius/<slug> build`) — the
   placeholder gate is unarmed here, so intentional stub data is fine.
3. Work this checklist before `pnpm go-live <slug>` — every unchecked box in
   §1 is something the armed build will reject.
4. Run `pnpm go-live <slug>` — it re-runs the armed build
   (`SITE_LIVE=true`) locally first; a config still missing an item above
   fails here with the specific `checkClientAcceptance` code, not on Vercel.
