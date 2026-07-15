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
| Elms Sans | **TBC** | Sans (assumed) | 👍 liked | Couldn't confirm this exact name on Google Fonts or Fontshare — confirm spelling/foundry (voice-dictation capture). |
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

## Currently wired — arborist preview switcher

The `apps/pnw-arborist` preview has a live display-font switcher (preview-only,
hidden at go-live). Packs available today (display / body):

1. Fraunces / Inter — **default**
2. Cormorant Garamond / EB Garamond
3. Playfair Display / Inter
4. Quintessential / EB Garamond
5. Kings / Inter

_To add:_ Molle, Mr Dafoe, Felipa, Mrs Sheppards, Niconne, Dr Sugiyama, Smooch,
Norican, Bilbo (Google — ready to wire in); Satoshi (needs Fontshare link); Elms
Sans (confirm source first).

## Live art-direction decisions

### apps/pnw-arborist (bespoke one-off — light editorial serif)

- **Direction:** warm editorial serif, generous negative space, numbered service
  index, one dark full-bleed stat band, dependency-free scroll reveal.
- **Palette:** paper `#f2eee3` · ink `#1b241d` · muted `#5f665b` · forest accent
  `#2c5637` (deep `#1d3b26`) · dark band `#141d17`.
- **Type:** display = Fraunces (under review via switcher); body/labels = Inter;
  letter-spaced uppercase eyebrows.
- **Motifs:** thin forest vertical rule under hero; italic forest accent on the
  last words of the hero headline; hairline row dividers with hover indent.

## Open questions / to-try

- Pick the winning display pack for arborist, then bake it as default + decide
  whether to keep or drop the switcher.
- Confirm "Elms Sans" source; decide if Satoshi becomes the standard body sans.
- If a font direction proves repeatable, promote it to a shared template
  variant (`packages/*`) instead of per-site bespoke.
