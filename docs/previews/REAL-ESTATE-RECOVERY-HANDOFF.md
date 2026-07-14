# Real-Estate Work — Recovery & Rebuild Handoff (Elizabeth Beard / Meridian / IRONRIDGE)

**Purpose:** a complete, self-contained context export of the recovery + rebuild
thread, written to hand-deliver into a new thread. Read top to bottom; you should
not need the original chat.

- **Date:** 2026-07-14
- **Repo:** `hirobius/site-engine` (public)
- **Working branch:** `claude/real-estate-work-recovery-j4coq1` (pushed)
- **Owner:** Adrian (adrian@hirobius.com)
- **Current status:** All three sites **rebuilt to match the originals** from
  Adrian's screenshots, typography corrected to the spec fonts, committed +
  pushed. Two known deltas remain (real photography; EB "Selling" page). See §5–§7.

---

## 1. What Adrian asked for

Recover the real-estate site work he built earlier as **claude.ai Artifacts** —
"Elizabeth Beard and the couple other sites" (Meridian, IRONRIDGE) — and bring
them into the `site-engine` repo. Original intent word: **"as-is."**

---

## 2. The three sites

All three are spec/showcase real-estate concepts from the **realtor preview kit**
(tracked in site-engine issues **#23**, **#24**). They exist to demonstrate range
and win real-estate + adjacent local clients.

| Site | Skin | Market | Structure |
|---|---|---|---|
| **Elizabeth Beard — Spokane Real Estate** | Warm-serif editorial (cream `#F4EFE7` + deep-sage accent, olive-green dark bands) | Spokane, WA & North Idaho · **eXp Realty** · MA, SRES | Multi-page, hash-routed: Home / About / Buying / Selling / Referrals / Journal / Contact |
| **Meridian — Modern Real Estate (concept)** | Modern-grotesk (paper + clay `#C6613F`, near-black inversion) | Spokane & the Inland NW (speculative brand) | Home / Buy / Sell / Build / Contact |
| **IRONRIDGE — Residential (concept)** | Rugged, dark theme (near-black + ember `#C7501E`), heavy uppercase | Colorado Front Range, Golden CO (speculative brand) | Home / Buy / Sell / Invest / Contact |

### Source artifacts (Adrian's account; live)
- Elizabeth Beard (latest 07-05): `claude.ai/code/artifact/c9adf062-1ad3-480f-87d1-a2947f616734`
- Meridian (latest 07-05): `claude.ai/code/artifact/c903fc21-598f-4ceb-859b-4fb6f2d2070c`
- IRONRIDGE (latest 07-05): `claude.ai/code/artifact/a016dada-e51a-4161-8e7d-5a7c7ed7f96a`
- (Earlier 07-03 iterations exist for each; the 07-05 versions are canonical.)

---

## 3. The retrieval blocker (why the ORIGINAL html couldn't be pulled)

Confirmed exhaustively — the exact original artifact HTML is **unreachable from
any agent environment** and was never committed anywhere:

1. A claude.ai artifact page is an **empty loader shell**; the real HTML loads at
   runtime from `<uuid>.frame.claudeusercontent.com`.
2. That content host is **hard-blocked by the sandbox egress policy**
   (`403 CONNECT tunnel failed` — a firewall rule the agent can't change).
3. WebFetch (authenticated) returns **HTTP 403 for every artifact**.
4. `/public/artifacts/<id>/{content,raw,embed}` all return the shell;
   `/api/frame/<id>` hits a Cloudflare bot challenge; the app-JS host
   `assets-proxy.anthropic.com` is also egress-blocked (so a headless browser
   can't boot the viewer either).
5. Swept every branch of site-engine/ops/hds/Ralph by filename + content — never
   committed.

**What worked instead:** Adrian took **full-page screenshots** of all three
artifacts (browser Cmd+Shift+4 / Cmd+Shift+3) and uploaded them. The rebuild was
done from those. (DevTools → Network → "Copy response" would yield exact bytes
but Adrian couldn't get it working; screenshots were the unblock.)

**Permanent fix if exact artifact bytes are ever needed:** allowlist
`claudeusercontent.com` in the environment's network egress policy, then an agent
can fetch artifacts directly.

---

## 4. What was recovered vs missing

**Recovered onto the branch** (from the unmerged `claude/realtor-starter` branch):
- `docs/realtor-template.md` — realtor section vocabulary + `ClientConfig`
  extension spec (`ListingSchema`, `AgentSchema`, `StatSchema`,
  `NeighborhoodSchema`, `ValuationSchema`) + build order.
- `docs/aura-hirobius-core.md` — **the structured design system** (warm skin):
  exact palette, type roles, spacing, and the signature-pattern library. Best
  single design reference.
- `docs/hirobius-core-brief.md` — prose brief; names the intended fonts.
- `claude-config/skills/generate-client-config/SKILL.md` — in-session config gen.

**Missing:** `docs/realtor-preview-kit.md` (v3, referenced by #23 — on no branch);
original realtor **lead data** (lost; realtors were dropped as a prospecting
niche, so this line is a **showcase/spec** play, not lead-gen).

---

## 5. What was built and shipped (current deliverable)

Three self-contained, single-file HTML previews in **`docs/previews/`**, rebuilt
to match the screenshots:

- `elizabeth-beard.html` — 7 pages, warm-serif editorial. Includes the
  credential-stat rail (Top 15% · MA·SRES · WA+ID · homes-sold), "Your *Spokane*
  realtor," the three-ways cards, forest featured-listing band (South Hill
  sample), the Spokane Home Guide lead magnet, the closings list, the About
  timeline + quote band + expect-grid + testimonials + areas, Buying steps + FAQ,
  Referrals, Journal (6 posts), Contact + newsletter. Real contact details from
  the original: 661.313.0575 · ElizabethBeardHomes@gmail.com ·
  @elizabethmbeard.realestate · eXp Realty.
- `meridian.html` — 5 pages. Stats $218M / 14 days / 99.1% / 40+, three-ways
  (Buy/Sell/Build), The Latah Residence ($1,150,000), "A home isn't a
  transaction" dark view, Sell "Recently placed" board, Build "We speak builder
  and buyer," dark CTAs. Contact: 509.000.0000 · studio@meridian.homes · Kendall
  Yards, Spokane.
- `ironridge.html` — 5 pages. Full-bleed mountain hero, stats $412M/640+/18/27,
  three-ways (Buy/Sell/Invest), 1841 Ridgeline Rd file ($1,240,000, spec grid),
  "Recently closed" board (Boulder/Lyons/Golden/Nederland), the ember "We don't
  sell dreams" band. Contact: 720.000.0000 · hello@ironridge.co · Golden, CO.
- `README.md` — provenance + swap-in instructions.

**Typography** was corrected to the Hirobius spec fonts (all Google-hosted, free
fallbacks the spec itself names — the commercial primaries Canela/Clash
Display/Satoshi live on Fontshare, which the build env is firewalled from):
- Elizabeth Beard: **Cormorant Garamond** (warm serif)
- Meridian: **Space Grotesk** (grotesk skin)
- IRONRIDGE: **Archivo** (heavy weight for the rugged look)
- Labels everywhere: **Geist Mono**; body: **Inter**

Photography is rendered as tonal CSS placeholders with matching labels/crops (the
originals use real photos; stock hosts are blocked in the build env).

### Commits on `claude/real-estate-work-recovery-j4coq1`
1. `5cb9eb8` — recover realtor kit docs from `claude/realtor-starter`
2. `c25cde3` — first rebuild from spec (rejected as too generic)
3. `8805291` — this handoff doc (earlier version)
4. `f8170ff` — rebuild all three to match the screenshots
5. `9febafa` — switch to spec fonts (Cormorant / Space Grotesk / Geist Mono)

---

## 6. Known deltas from the originals (the only open gaps)

1. **Real photography.** Originals use real photos (Elizabeth's B&W portrait,
   warm interiors, the Colorado mountain hero, forest cabins). Rebuilds use tonal
   placeholders in the exact slots (labelled/cropped). **To finish:** drop real
   image files into `docs/previews/` (or an `assets/` subfolder) and wire them
   into the slots. Build env blocks stock hosts, so images must be committed, not
   linked.
2. **EB "Selling" page.** The only page Adrian didn't screenshot; reconstructed
   in-system from the Selling card + valuation pattern. Swap to the real content
   when a screenshot is available.
3. **Exact fonts.** If the originals used the paid Canela / Clash Display /
   Satoshi, that's a one-`@font-face`-block swap later.

---

## 7. Design system reference (so a continuation doesn't start from zero)

From `docs/aura-hirobius-core.md` (warm skin — authoritative):
- **EB palette:** bg `#F4EFE7`, surface `#FAF6EE`, ink `#26251F`, muted `#6E685C`,
  accent deep-sage `#5E6B47`, dark bands olive-green `#2E3626`, border `#E4DDCF`.
- **Meridian:** paper `#F4F1EA`, ink `#141210`, clay `#C6613F`, dark `#171612`.
- **IRONRIDGE:** bg `#100F0D`, ink `#EDE7DA`, ember `#C7501E`, lines `#2A2720`.
- **Type roles:** high-contrast serif display (EB) / bold grotesk display
  (Meridian, IRONRIDGE) / mono UPPERCASE letter-spaced eyebrows / clean sans body.
- **Signature patterns:** bracket & numbered mono eyebrows · roman+italic emphasis
  word · stat rail w/ mono captions · label↔value spec list · inversion CTA band ·
  live status line · big wrap-headline moments. (EB uses credentials AS the stat
  rail — a nice move.)
- **Realtor sections** (`docs/realtor-template.md`): Hero → Featured listings →
  Agent bio → Stats → Neighborhoods → Testimonials → Valuation CTA →
  Contact/footer w/ **fair-housing disclaimer** (required).

---

## 8. Recommended next steps (for the new thread to decide)

1. **Finish the previews:** get real photos from Adrian → wire into the slots;
   get the EB Selling screenshot → replace the reconstruction. Small, mechanical.
2. **Decide Elizabeth Beard's real goal:**
   - (a) **Live client** → harvest into the Astro factory per **#23**: real
     `apps/elizabeth-beard`, wire the `realtor` ClientConfig extension
     (`docs/realtor-template.md`), add a `realtor` palette preset, fill
     `client.config.ts` via the `generate-client-config` skill, real photos/IDX.
   - (b) **Portfolio showcase** to win realtor clients → polish the standalone
     HTML previews (current path; the kit is a showcase play since realtors were
     dropped as a lead niche). Likely (b) — confirm with Adrian.
3. **Meridian / IRONRIDGE** are speculative brand concepts — keep as range demos
   unless a real client adopts one.
4. **Housekeeping:** recover `docs/realtor-preview-kit.md` (v3) if it exists in
   another artifact/thread; #24 is blocked on a photo-source decision.

---

## 9. Constraints for any continuation

- **Never fabricate business facts** — EB uses her real published details;
  Meridian/IRONRIDGE use obvious placeholders (555-style / .homes / .co) and are
  labelled speculative concepts.
- Build env **blocks stock image hosts** and **Fontshare** — commit images;
  fonts load via Google in the browser.
- `packages/*` and `.astro` components are **fleet-shared** — the realtor template
  family is an additive, deliberate `packages/template` change, not a per-client edit.
- Realtor sites need the **fair-housing / equal-opportunity disclaimer**; SEO
  limits (title ≤70, desc ≤180); keep gated until live.

---

## 10. File / branch index

```
site-engine @ claude/real-estate-work-recovery-j4coq1
├── docs/previews/
│   ├── elizabeth-beard.html   ← 7-page, warm-serif (Cormorant Garamond)
│   ├── meridian.html          ← 5-page, grotesk (Space Grotesk)
│   ├── ironridge.html         ← 5-page, rugged dark (Archivo)
│   ├── README.md              ← provenance
│   └── REAL-ESTATE-RECOVERY-HANDOFF.md   ← THIS DOC
├── docs/realtor-template.md         ← recovered (sections + ClientConfig ext)
├── docs/aura-hirobius-core.md       ← recovered (BEST design reference)
├── docs/hirobius-core-brief.md      ← recovered (prose brief, font names)
└── claude-config/skills/generate-client-config/SKILL.md  ← recovered

Unmerged source branch: claude/realtor-starter (origin)
Tracking issues: site-engine #23 (harvest to Astro), #24 (Meridian/grotesk spec)
Originals: claude.ai Artifacts only (UUIDs §2) — unreachable by agents; rebuilt from screenshots
```
