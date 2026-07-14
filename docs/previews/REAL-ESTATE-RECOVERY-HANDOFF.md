# Real-Estate Work — Recovery & Rebuild Handoff (Elizabeth Beard / Meridian / IRONRIDGE)

**Purpose of this doc:** a complete, self-contained context export of everything
covered in the recovery thread, written to be hand-delivered into a new thread
that's consolidating context docs and deciding what to do next. Read top to
bottom; you should not need the original chat.

- **Date:** 2026-07-14
- **Repo:** `hirobius/site-engine` (public)
- **Working branch:** `claude/real-estate-work-recovery-j4coq1` (pushed)
- **Owner:** Adrian (adrian@hirobius.com)
- **Status:** Realtor kit docs recovered ✅ · three previews rebuilt from spec ✅ ·
  **original artifact HTML NOT recovered** (blocked) ❌ · **Adrian's verdict on
  the rebuilds: not good enough** ("they're horrible honestly") ⚠️

---

## 1. What Adrian asked for

> "I'm looking for my real estate work I was building out (Elizabeth Beard) and
> the couple other sites… I want to port the warm-serif multipage over here
> as-is. I also want to grab the Meridian and Iron Ridge work and get it over
> here as well."

Three real-estate site directions built earlier as **claude.ai Artifacts**, to be
brought into the `site-engine` repo. The intent word was **"as-is"** — he wanted
the *exact* originals, not reinterpretations.

---

## 2. What these three things are

All three are spec/showcase real-estate site concepts from the **realtor preview
kit** (tracked in site-engine issues **#23** and **#24**). The kit is a bespoke
editorial design system meant to win real-estate + adjacent local clients.

| Direction | Skin | Notes |
|---|---|---|
| **Elizabeth Beard — Spokane Real Estate** | Warm-serif editorial (Fraunces/serif + Inter, cream `#F4EFE7` + deep-sage `#4A5443`) | The "stake in the ground." Multi-page: Home / About / Buying / Selling / Referrals / Journal / Contact, hash-routed. Editorial hero + static gallery + buyer's-guide lead magnet. Spec client = Elizabeth Beard, a Spokane agent. |
| **Meridian — Modern Real Estate** | Modern-grotesk (Archivo + Inter, paper + clay accent, near-black inversion) | Speculative modern brand, home-forward (large exterior/interior imagery, spec-sheet lockups). Issue #24. |
| **IRONRIDGE — Residential Real Estate** | Rugged / masculine, **no photography**, type-forward | Parked direction. Issue #23. |

### Source artifacts (published, still live in Adrian's account)

- Elizabeth Beard (latest, 2026-07-05): `https://claude.ai/code/artifact/c9adf062-1ad3-480f-87d1-a2947f616734`
  - earlier iterations: `7fe253b0-b988-4139-9e62-a6bbc955fbdb` (07-03),
    `f67a085c-5f4c-42fc-b6ab-9b9f2c75c4f7` (preview), `c9eed9ce-...` (Direction 3),
    `6b6b499a-...` (Direction 2)
- Meridian (latest, 2026-07-05): `https://claude.ai/code/artifact/c903fc21-598f-4ceb-859b-4fb6f2d2070c`
  - earlier (07-03): `b896ef45-8cc2-45eb-a2ea-8bf0e24d1748`
- IRONRIDGE (latest, 2026-07-05): `https://claude.ai/code/artifact/a016dada-e51a-4161-8e7d-5a7c7ed7f96a`
  - earlier (07-03): `1a79c476-...`, `ddf63076-...`

---

## 3. Where the surviving source material lives

### 3a. Recovered onto the working branch (committed)

Pulled from the **unmerged `claude/realtor-starter` branch** (these existed
nowhere else and were never merged to `main`):

- `docs/realtor-template.md` — realtor section vocabulary + the `ClientConfig`
  extension spec (`ListingSchema`, `AgentSchema`, `StatSchema`,
  `NeighborhoodSchema`, `ValuationSchema`) + build order.
- `docs/aura-hirobius-core.md` — **the structured aura.build DESIGN.md**, skinned
  warm-editorial. Contains the *exact* palette, type roles, spacing, and the
  "signature pattern" library (bracket/numbered mono eyebrows, roman+italic
  emphasis word, stat rail, label↔value spec list, inversion CTA, crop-mark hero
  frame, live status line). **This is the single best design reference.**
- `docs/hirobius-core-brief.md` — the prose design brief (Editorial Enterprise;
  monochrome + one electric-blue accent; Clash Display / Satoshi / Geist Mono).
- `claude-config/skills/generate-client-config/SKILL.md` — the in-session
  ClientConfig generation skill.

### 3b. Tracking issues

- **site-engine #23** — "Realtor preview kit — harvest to Astro + evolve into a
  multi-vertical showcase." Open. First unchecked step: harvest the warm-serif
  multi-page direction into the Astro factory (real routes, `realtor`
  ClientConfig extension, `realtor` palette preset, scaffold `apps/elizabeth-beard`).
- **site-engine #24** — "Grotesk skin → speculative modern realtor spec." Open.
  Blocked on a photo-source decision (stock hosts blocked by env proxy).
- Both labeled `enhancement` / `design-system` / `needs-human` / `p3`.

### 3c. Referenced but MISSING

- `docs/realtor-preview-kit.md` (v3) — referenced by #23 but exists on **no
  branch**. Never pushed. The Artifacts + `aura-hirobius-core.md` are the only
  surviving record of that kit.
- Original **realtor lead data** (Outscraper batch) — lost; realtors were
  formally dropped as a prospecting niche (see ops `docs/prospecting/`), so
  Elizabeth Beard continued purely as a **showcase/spec** play, not lead-gen.

---

## 4. The blocker — why the originals could not be retrieved

**Bottom line: the exact original artifact HTML is unreachable from any agent
environment, and was never committed anywhere.** Confirmed exhaustively:

1. A claude.ai artifact page (`/code/artifact/<id>`) is an **empty loader shell**.
   The real HTML is fetched at runtime from a separate host:
   **`<uuid>.frame.claudeusercontent.com`**.
2. That content host is **hard-blocked by the sandbox network egress policy** —
   the proxy refuses with `403 CONNECT tunnel failed (policy denial)` before the
   connection opens. Not Cloudflare, not auth — a firewall rule the agent cannot
   change from inside.
3. The harness's authenticated artifact fetch (WebFetch) returns **HTTP 403 for
   every artifact**, including brand-new ones — so it's a session-credential
   limitation, not specific to these three.
4. Every `/public/artifacts/<id>/{content,raw,data,embed}` variant returns the
   same empty shell; `/api/frame/<id>` hits a Cloudflare bot challenge.
5. A real headless browser (pre-installed Chromium, proxy CA installed) gets TLS
   resets through the egress proxy, and the app JS host
   (`assets-proxy.anthropic.com`) is egress-blocked too, so the viewer can't boot.
6. Swept **every branch** of site-engine, ops, hds, Ralph by filename AND content
   — the HTML was never committed.

### The only known ways to get the true originals (all require Adrian, from a
logged-in browser — NOT the agent):

- **DevTools → Network → Copy response**: open artifact → F12 → Network tab →
  reload → click the `…frame.claudeusercontent.com` **document** row → Response →
  Copy response. (Adrian tried; reported "not working.")
- **Screenshots** (proposed, not yet done): Cmd+Shift+4 per section, upload the
  images — lets a rebuild *match the real visual* instead of guessing from spec.
- Download control in the artifact viewer: **does not exist** in Adrian's current
  viewer version.
- Opening `<uuid>.frame.claudeusercontent.com` directly: returns **"not found"**
  (content host requires the viewer's authenticated, param'd request).
- **Permanent fix:** loosen this environment's network egress policy / allowlist
  `claudeusercontent.com`, after which the agent could fetch artifacts directly.

---

## 5. What was actually built and shipped this thread

Because the originals were unreachable and Adrian said "just rebuild it," three
**faithful reconstructions to the recovered design spec** were built and pushed
(they are NOT the original bytes):

- `docs/previews/elizabeth-beard.html` — warm-serif editorial, 7-page hash-routed,
  ~32 KB, self-contained.
- `docs/previews/meridian.html` — modern-grotesk, paper + clay, dark inversion,
  ~25 KB.
- `docs/previews/ironridge.html` — rugged / no-photo, ember accent, hairline-grid
  texture, ~23 KB.
- `docs/previews/README.md` — provenance + swap-in instructions.

Implementation detail: Google Fonts (Fraunces/Archivo/Inter/IBM Plex Mono),
inline CSS, hash-routing JS. Photography rendered as CSS gradient treatments with
labelled photo slots (stock hosts always blocked). Content is **sample/curated
copy with placeholder contacts** (`555-01xx`, sample addresses) — per repo rule,
no fabricated real business facts. Each carries a visible "spec preview /
reconstruction" tag.

**Commits on `claude/real-estate-work-recovery-j4coq1`:**
- `5cb9eb8` — recover realtor kit docs from `claude/realtor-starter`; stage previews dir
- `c25cde3` — rebuild EB / Meridian / IRONRIDGE previews from recovered spec

### ⚠️ Critical status: Adrian rejected the rebuilds

Adrian's verdict: **"No, they're horrible honestly."** The reconstructions do NOT
meet his bar. Root cause diagnosed: they were designed **blind from a written
spec**, so proportions / type scale / spacing / overall feel are guesses and read
as generic. **Do not treat the current preview HTML as the deliverable.** It is a
placeholder at best.

---

## 6. The recovered design system (so a rebuild doesn't start from zero)

From `docs/aura-hirobius-core.md` (warm skin) — the authoritative reference:

**Skin (warm-editorial, Elizabeth):**
- background `#F4EFE7` (warm cream) · surface `#FBF8F2` · primary/text `#2B2A26`
  (warm near-black) · text-secondary `#6B655A` · **one accent** deep sage
  `#4A5443` · border `#E4DDD0`.
- Display: high-contrast serif (Canela/Cormorant/Fraunces family), 64px, weight
  400, line-height 1.05, **mix roman + italic on the emphasis word**
  ("Nowhere, *perfected*").
- Body: clean sans (Satoshi/Inter), 17px, 1.6, ~66ch measure.
- Eyebrow/label: **mono, UPPERCASE, letter-spaced 0.14em** — the signature.

**Core structure (fixed across clients; only colors + fonts are the per-client skin):**
- spacing base 8px, section padding 96–128px, generous whitespace carries the
  layout (not cards). card/control radius 8px, pill only for small tags.
- Signature patterns to bank: bracket/numbered eyebrows · numbered process
  sections · stat rail (2–4 big numbers + mono captions) · mono checklist ·
  **inversion CTA block** (flip cream↔dark for booking/valuation) · crop-mark +
  hairline frame on hero imagery · live status line ("● TAKING 2 NEW LISTINGS
  THIS MONTH") · big wrap-headline moments.
- Guardrails: don't flatten to a SaaS card grid; keep the first-viewport image +
  focal line; one accent only; large editorial imagery, never floating thumbnails;
  sections breathe.
- Direction note (Adrian, 2026-07): keep the editorial system but **lighter**
  (light ground, near-black text, one accent); reserve inversion for CTA moments.
  **Display font is the swing variable** — bold grotesk = sharp/modern energy
  (Meridian); high-contrast serif = warmth (Elizabeth).

**Realtor sections (from `docs/realtor-template.md`), top→bottom:**
Hero (agent + market + "What's my home worth?") → Featured listings (3–6 cards,
Active/Pending/Sold) → Agent bio (headshot, story, credentials, license #,
brokerage) → Proof/stats rail (homes sold, avg days on market, list-to-sale %,
years) → Neighborhoods → Testimonials → Home-valuation CTA / lead capture →
Contact/footer with **fair-housing + equal-opportunity disclaimer** (compliance).

---

## 7. Recommended next steps (for the consolidating thread to decide)

Ordered by likely value:

1. **Get the real originals in front of the model.** The rebuild failed because it
   was blind. Best unblock: Adrian uploads **screenshots** of each artifact
   (whole page, a few scroll-captures each). With eyes on the actual design, a
   rebuild can match layout/type/color/spacing instead of inventing them. This is
   the highest-leverage single action.
   - Alt (exact bytes): DevTools → Network → Copy response (retry — it should work
     from a desktop browser; earlier attempt reported "not working").
   - Alt (permanent): allowlist `claudeusercontent.com` in the environment's
     egress policy so agents can fetch artifacts directly in future.
2. **Decide the real goal for Elizabeth Beard.** Is she (a) a *live client* (then
   harvest the winning direction into the Astro factory per #23 — real
   `apps/elizabeth-beard`, `realtor` ClientConfig extension + palette preset, and
   real photography/IDX), or (b) a *portfolio showcase* to win realtor clients
   (then polish the standalone HTML previews)? The whole kit is currently a
   showcase play (realtors dropped as a lead niche), which points to (b) — confirm.
3. **If keeping as previews:** do NOT ship the current rebuilds. Either replace
   with the recovered originals, or do a proper iterative design pass *with Adrian
   reviewing screenshots each round*, not a one-shot from spec.
4. **If harvesting to Astro (#23):** follow the documented build order — aura swing
   → port winner into `packages/template` as realtor components → wire the
   ClientConfig extension in `docs/realtor-template.md` → add `realtor` preset →
   scaffold `apps/elizabeth-beard` → fill `client.config.ts` via the
   `generate-client-config` skill. Note repo rule: `packages/*` changes are
   fleet-shared (a deliberate, tested change, not a per-client edit).
5. **Housekeeping:** `docs/realtor-preview-kit.md` (v3) is referenced by #23 but
   missing — if it exists in another of Adrian's artifacts/threads, recover it too.

---

## 8. Constraints / rules that apply to any continuation

- **Never fabricate business facts** (phones, hours, reviews, addresses, license
  #). Elizabeth's real details come from intake; previews use obvious placeholders.
- Preview/build env **blocks stock image hosts** (Unsplash/Pexels/etc.); only font
  CDNs + `raw.githubusercontent.com` are reachable. Real listing imagery needs a
  curated drop from Adrian or an IDX/MLS feed.
- `packages/*` and `.astro` components are **fleet-shared** — the realtor template
  family is an additive, deliberate `packages/template` change, not a per-client edit.
- Site must stay gated until live; SEO limits (title ≤70, desc ≤180); fair-housing
  disclaimer required on realtor sites.

---

## 9. File / branch index (quick reference)

```
site-engine @ claude/real-estate-work-recovery-j4coq1
├── docs/previews/
│   ├── elizabeth-beard.html        ← rebuilt (REJECTED by Adrian — placeholder)
│   ├── meridian.html               ← rebuilt (REJECTED — placeholder)
│   ├── ironridge.html              ← rebuilt (REJECTED — placeholder)
│   ├── README.md                   ← provenance
│   └── REAL-ESTATE-RECOVERY-HANDOFF.md  ← THIS DOC
├── docs/realtor-template.md        ← recovered (sections + ClientConfig ext)
├── docs/aura-hirobius-core.md      ← recovered (BEST design reference)
├── docs/hirobius-core-brief.md     ← recovered (prose brief)
└── claude-config/skills/generate-client-config/SKILL.md  ← recovered

Unmerged source branch: claude/realtor-starter  (origin)
Tracking: site-engine #23 (harvest to Astro), #24 (grotesk/Meridian spec)
Originals: claude.ai Artifacts only (UUIDs in §2) — unreachable by agents
```
