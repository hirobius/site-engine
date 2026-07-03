# Realtor template family — spec + ClientConfig extension

The factory's first template family is exterior-cleaning-shaped
(Hero/Services/Gallery/Reviews/**ServiceAreaMap**/Contact). Realtors need a
different section vocabulary. This is the target both aura swings and the
eventual Astro build aim at, so they converge.

## Sections (top → bottom)

1. **Hero** — agent name + market, a confident one-line positioning ("Selling
   [Metro]'s [neighborhood] homes for 12 years"), agent portrait or a hero
   property shot, primary CTA (**"What's my home worth?"** or "Book a call").
2. **Featured listings** — 3–6 property cards (photo, price, beds/baths/sqft,
   address, status badge: Active / Pending / Sold). Optional "View all listings"
   → IDX/MLS (v2; a link out is fine for v1).
3. **Agent bio / About** — headshot, story, credentials, license #, brokerage,
   service areas. Warmth + authority.
4. **Proof / stats** — a rail of 3–4 numbers (homes sold, avg days on market,
   list-to-sale %, years in business). One stat may use the accent.
5. **Neighborhoods / communities** — the areas they specialize in, each a
   card/band (name, one line, image). Local-expert signal.
6. **Testimonials** — 2–4 client quotes (name, transaction type, optional photo).
   Reuses the existing `ReviewSchema`.
7. **Home-valuation CTA / lead capture** — the money section: a band with the
   valuation offer + a short form (name, email, address). Reuses `FormSchema`.
8. **Contact / footer** — phone, email, brokerage, license #, social, fair-housing
   + equal-opportunity disclaimer (compliance).

Optional later: mortgage/affordability calculator, buyer & seller guide pages,
blog. Keep v1 one-page.

## ClientConfig extension (`packages/schema/src/index.ts`)

Additive — existing service-business configs keep working. New section ids +
schemas; reuse `ReviewSchema` (testimonials), `FormSchema` (valuation capture),
`SeoSchema`, `HeroSchema`.

```ts
// New section ids (add to the sectionOrder enum)
z.enum([
  // ...existing service ids stay valid...
  "featuredListings", "agentBio", "stats", "neighborhoods", "valuation",
])

export const ListingSchema = z.object({
  photo: AssetPath,
  price: z.string().min(1),               // "$685,000" — string, not number (formatting varies)
  beds: z.number().int().nonnegative(),
  baths: z.number().nonnegative(),
  sqft: z.number().int().positive().optional(),
  address: z.string().min(1),
  status: z.enum(["active", "pending", "sold"]).default("active"),
  url: z.string().url().optional(),
});

export const AgentSchema = z.object({
  name: z.string().min(1),
  headshot: AssetPath.optional(),
  bio: z.string().min(1),
  credentials: z.array(z.string()).default([]),
  licenseId: z.string().min(1),           // required for compliance
  brokerage: z.string().min(1),
  yearsExperience: z.number().int().nonnegative().optional(),
});

export const StatSchema = z.object({
  value: z.string().min(1),               // "218" / "11 days" / "99.4%"
  label: z.string().min(1),
});

export const NeighborhoodSchema = z.object({
  name: z.string().min(1),
  blurb: z.string().min(1),
  photo: AssetPath.optional(),
});

export const ValuationSchema = z.object({
  headline: z.string().min(1).default("What's your home worth?"),
  sub: z.string().min(1),
  // form fields reuse FormSchema (Web3Forms + hCaptcha, same as ContactForm)
});
```

Add a `realtor` **palette preset** in `presets.ts` (still monochrome + the
electric-blue accent — realtors read premium, not colorful) so `brand.palettePreset`
selects it.

## Build order
1. aura swings (Elizabeth reskin) → pick a winner (uses the sections above).
2. Port winner into `packages/template` as realtor Astro components + wire the
   ClientConfig extension above.
3. Add a `realtor` preset; scaffold `apps/<agent-slug>` via `new-client`.
4. Fill `client.config.ts` in-session (see `generate-client-config` skill).
