# Lead puller

> ⚠️ **DEPRECATED — being retired.** We are done building our own scraper. Lead
> sourcing moves to a managed pay-as-you-go scraper (**Outscraper**) in
> `ops/lib/lead-gen`, which returns outreach-ready records **including emails**
> (this Places puller returns none). Only the query definitions in `config.ts`
> (METROS + KEYWORDS) get ported; `places.ts` / `qualify.ts` / `pull-leads.ts` are
> retired. See `docs/OPS-HANDOFF.md` → "Lead sourcing". Kept here for reference
> until the `clients` cleanup PR removes it.


Sources qualified leads for cold-outreach spec sites. Beachhead: **exterior
cleaning** (pressure/soft washing, roof & gutter, moss removal) across the **WA+OR
core metros**. Edit `config.ts` to change niche or geography.

This is your **canonical lead layer** — platform-agnostic. The output feeds
whatever you render specs in (Duda, the Astro factory, etc.), so you're never
locked to one platform for the part that's actually your moat.

## What it does

1. Builds one Google Places text query per `metro-area × keyword`.
2. Pulls businesses via the **Places API (New)** (official API — not Maps
   scraping, which violates Google's ToS).
3. Dedupes by Google place id.
4. **Tech-detects** each business's site and flags it qualified if any of:
   `no_website`, `site_down`, `no_https`, `not_mobile`, `parked`, `no_contact`.
5. Writes `out/leads.csv` + `out/leads.json` (qualified first).

## Size the pipeline first (no key needed)

```bash
pnpm pull-leads --dry-run
```

Prints the query count, expected request volume, and cost estimate.

## Run it for real

1. In Google Cloud, enable **Places API (New)** and create an API key.
2. Run:
   ```bash
   GOOGLE_PLACES_API_KEY=xxxx pnpm pull-leads
   ```

Flags:
- `--max-per-query N` — results per query (default 60, the API max).
- `--limit N` — stop after N unique businesses (handy for a cheap test run).
- `--no-qualify` — skip site inspection (sourcing only, faster/cheaper).
- `--out DIR` — output directory (default `scripts/lead-gen/out`).

Cheap test: `GOOGLE_PLACES_API_KEY=xxxx pnpm pull-leads --limit 50`.

## Output columns

`place_id, name, primary_type, phone, address, website, rating, review_count,
lat, lng, region, has_website, qualified, reason`

## Cost & compliance notes

- Places API (New) Text Search bills per request (~$0.032 each — verify current
  pricing). The dry-run estimates total cost up front.
- Google restricts long-term caching of most Place fields (place **IDs** may be
  stored indefinitely). Refresh business details before publishing anything.
- For cold email, keep it compliant (CAN-SPAM/CASL): identify yourself and honor
  opt-outs. Deliverability — not lead supply — is the real constraint.
