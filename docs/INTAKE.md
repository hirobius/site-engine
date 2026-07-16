# Client Intake — {{Business Name}}

Fill this out per client. Every field maps 1:1 to `client.config.ts`, so a
completed intake is a paint-by-numbers build. Leave a field blank only if it
truly doesn't apply; mark anything you're waiting on as `TODO`.

> Building the *preview*? This worksheet is enough — placeholder facts are
> fine here. Before flipping the site live, work through
> `docs/GO-LIVE-CHECKLIST.md` — it lists exactly which of these fields must
> be real (not a stub) before `SITE_LIVE=true`, and why the armed build
> rejects placeholders.

> Builder note: copy answers straight into `apps/<slug>/client.config.ts`. Do not
> invent values that aren't here. If the client asks for something with no field
> below, it's a custom-component request — flag it, don't improvise.

## 0. Slug & trade

- **Slug** (kebab-case, becomes `apps/<slug>` + Vercel project): `__________`
- **Trade preset** (one of `landscaping` / `junk-removal` / `pressure-washing` /
  `concrete-fencing`): `__________`

## 1. Business

- **Name:** `__________`
- **Phone** (as displayed, e.g. `(512) 555-0142`): `__________`
- **Email** (where leads should land): `__________`
- **Address** (optional — skip if mobile-only): `__________`
- **Hours** (one row per line, e.g. `Mon–Fri | 8:00 AM – 6:00 PM`):
  - `__________ | __________`
  - `__________ | __________`
  - `__________ | __________`
- **Service areas** (cities/regions, comma-separated): `__________`

## 2. Brand

- **Preset:** (from §0)
- **Color overrides** (optional; hex per `--brand-*` token — leave blank to use
  the preset as-is): `--brand-primary: ____`, `--brand-accent: ____`, …
- **Font** (`system` / `inter` / `geist` / `work-sans` / `slab`): `__________`
- **Corner radius** (`none` / `sm` / `md` / `lg` / `xl`): `__________`

## 3. Layout

- **Hero variant** (`A` = image + side content, `B` = full-bleed video): `____`
- **Section order** (reorder/remove; default is all five):
  `services, gallery, reviews, serviceAreaMap, contact`

## 4. Services (1+; 3–6 is typical)

For each: **title**, **one-sentence description**, optional **photo filename**.
1. `__________` — `__________________________`
2. `__________` — `__________________________`
3. `__________` — `__________________________`

## 5. Copy

- **Hero headline** (name the service + the place): `__________`
- **Hero subhead** (one sentence on the promise): `__________`
- **CTA label** (default "Get a Free Quote"): `__________`
- **About** (short paragraph, why locals trust them): `__________`

## 6. Gallery (optional)

List photo filenames + **alt text** (required for SEO/a11y) for each:
- `gallery-1.jpg` — `__________`
- `gallery-2.jpg` — `__________`

## 7. Reviews (optional but recommended)

For each: **author**, **rating 1–5**, **text**, optional **source** (Google/Yelp):
1. `____` | `5` | `__________________` | `Google`
2. `____` | `5` | `__________________` | `Google`

## 8. Service-area map

- **Static map image** (preferred — filename in `public`): `__________`
- **OR map embed query** (e.g. `Austin, TX`): `__________`

## 9. Form (Web3Forms)

- **Web3Forms access key:** `__________`
- **hCaptcha site key** (required for production — fights inbox spam): `__________`
- **Redirect URL after submit** (optional): `__________`

## 10. SEO

- **Title** (≤ 70 chars): `__________`
- **Description** (≤ 180 chars): `__________`
- **City:** `__________`  **Region/State:** `____`
- **Production URL** (`siteUrl`): `https://__________`
- **OG image** (filename in `public`, optional): `__________`

## 11. Assets checklist

- [ ] Hero photo (1600px max, ~200KB) → `src/assets/photos/hero.jpg`
- [ ] Service photos → `src/assets/photos/`
- [ ] Gallery photos (compressed at intake) → `src/assets/photos/`
- [ ] OG image (1200×630) → `public/photos/og.jpg`
- [ ] Favicon → `public/favicon.svg` (a monogram in the preset's brand color is
      generated at `new-client` time; drop a real logo here to override it)

## 12. Handoff terms (fill `docs/HANDOFF.md` at launch)

- **Launch date:** `__________`
- **Free change window:** 7 days (standard)
- **Change fee after window:** `__________`
- **Domain / hosting ownership note:** `__________`
