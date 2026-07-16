# DESIGN MANIFEST — visual details for AI reference

> **Purpose.** A short, living shortlist of Adrian's visual preferences — fonts,
> palettes, motifs — so any AI session designing a client site (especially the
> bespoke one-offs) has a reference instead of re-guessing. Keep it **short and
> current**: add what's liked, prune what's rejected, note the source so it's
> actually loadable. This is a preference registry, not a spec.
>
> _Last updated: 2026-07-15._

## Font shortlist (candidates to try)

Fonts Adrian has flagged to explore. **Source matters** — Google Fonts load via a
`<link>`; Fontshare needs its own CSS link or self-hosting; "TBC" needs the exact
name/foundry confirmed before use.

| Font | Source | Category | Status | Notes |
|---|---|---|---|---|
| Satoshi | Fontshare | Sans (geometric) | 👍 liked | Clean modern body/UI sans. Not on Google Fonts — needs Fontshare `<link>` or self-host. |
| Elms Sans | Google Fonts | Sans | 👍 liked | Confirmed on the Google Fonts API. Candidate body/UI sans (alongside Satoshi). |
| Fraunces | Google Fonts | Serif (display, optical, italic) | ✅ in use | Current arborist default display. Variable, high-contrast, has real italics. |
| Cormorant Garamond | Google Fonts | Serif (display, high-contrast) | candidate | Elegant, safe "premium serif". |
| Playfair Display | Google Fonts | Serif (display) | candidate | Classic editorial. |
| Quintessential | Google Fonts | Display (calligraphic caps) | 🔎 trying | Single weight; great at hero scale, thin/weak in body; italics synthesized. |
| Kings | Google Fonts | Script (display) | 🔎 trying | Flowing script; display-only, not for body. |
| Molle | Google Fonts | Script (cursive, italic-only) | 👀 shortlist | Decorative; hero/accent use only. |
| Mr Dafoe | Google Fonts | Script (formal) | 👀 shortlist | Sudtipos "Mr" family; elegant signature feel. |
| Felipa | Google Fonts | Display (calligraphic) | 👀 shortlist | Decorative display. |
| Mrs Sheppards | Google Fonts | Script (formal calligraphy) | 👀 shortlist | Ornate; sparing use. |
| Niconne | Google Fonts | Script (semi-formal) | 👀 shortlist | Lighter script; a bit more legible than the ornate ones. |
| Dr Sugiyama | Google Fonts | Script (formal calligraphy) | 👍 liked | Sudtipos; elegant flourished signature feel. |
| Smooch | Google Fonts | Script (fine, connected) | 👀 shortlist | Delicate thin script; hero/accent only. |
| Norican | Google Fonts | Script (brush) | 👀 shortlist | Casual brush script; friendlier, less formal. |
| Bilbo | Google Fonts | Script (light handwriting) | 👀 shortlist | Thin handwriting; hero/accent only. |

**Read:** most of the shortlist are decorative **script/display** faces — beautiful
as an oversized hero/wordmark accent, but they need a clean **body** partner
(Satoshi / Inter / EB Garamond) for legibility. Pair, don't solo.

## Currently wired — arborist preview font explorer

The `apps/pnw-arborist` preview has a live font explorer (preview-only, hidden at
go-live): **two independent dropdowns** so any display face pairs with any body.
Choices persist in localStorage and apply before first paint.

- **Display (15):** Quintessential _(default)_, Fraunces, Cormorant Garamond,
  Playfair Display, Kings, Molle, Mr Dafoe, Felipa, Mrs Sheppards, Niconne,
  Dr Sugiyama, Smooch, Norican, Bilbo, Satoshi.
- **Body (4):** Elms Sans _(default)_, Inter, EB Garamond, Satoshi (Fontshare).
- Satoshi is available in **both** slots (sans display or body).

Everything on the shortlist is now wired. Satoshi loads from Fontshare — verify it
renders on the live deploy (couldn't reach `api.fontshare.com` from the sandbox).

## Live art-direction decisions

### apps/pnw-arborist (bespoke one-off — light editorial serif)

- **Direction:** warm editorial serif, generous negative space, numbered service
  index, one dark full-bleed stat band, dependency-free scroll reveal.
- **Palette:** paper `#f2eee3` · ink `#1b241d` · muted `#5f665b` · forest accent
  `#2c5637` (deep `#1d3b26`) · dark band `#141d17`.
- **Type (chosen):** display = **Quintessential**, body = **Elms Sans**
  (letter-spaced uppercase eyebrows). Set as the app default; still swappable in
  the preview explorer.
- **Motifs:** thin forest vertical rule under hero; italic forest accent on the
  last words of the hero headline; hairline row dividers with hover indent.
- **Imagery slots:** hero (`public/photos/hero.jpg`, portrait) + dark band
  (`public/photos/canopy.jpg`, landscape). Present files replace forest-gradient
  placeholders automatically; missing files fall back cleanly.

## Imagery

- `apps/pnw-arborist/scripts/fetch-photos.mjs` (and the same script in
  `apps/septic-response`) downloads a curated photo per slot from Pexels.
  **STANDALONE ONLY as of the #150 landing fix** — it is NOT wired into
  `astro.config.ts` as a build hook. `packages/template`'s astro-config-gate
  test requires every app's `astro.config.ts` to be a byte-for-byte copy of
  `apps/_template`'s, so no per-app build hooks are possible without a
  `packages/template` change (out of scope for a bespoke one-off). Run it
  manually before a build: `PEXELS_API_KEY=xxx node scripts/fetch-photos.mjs`.
  Non-fatal: no key or any error → warns and keeps placeholders.
- **Runs from a machine that can reach `api.pexels.com`** — the dev sandbox's
  egress can't (blocked by the egress allowlist); a normal workstation or CI
  runner can.
- Free key: https://www.pexels.com/api/new/ (56 chars, no prefix — a `vcp_…`
  string is a *Vercel* token, not Pexels).
- Pexels imagery is stock — swap for the client's OWN photos before go-live.

## Open questions / to-try

- Pick the winning display pack for arborist, then bake it as default + decide
  whether to keep or drop the switcher.
- Confirm "Elms Sans" source; decide if Satoshi becomes the standard body sans.
- If a font direction proves repeatable, promote it to a shared template
  variant (`packages/*`) instead of per-site bespoke.
