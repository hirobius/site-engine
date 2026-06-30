# Duda delivery — the future scale option + `ClientConfig` → Duda mapping spike

> **Status: FUTURE OPTION, not the current plan.** Production currently ships on
> **self-hosted Astro** (this repo). This doc is the **playbook for switching to
> Duda** (managed, white-label, client editor) *if/when* maintenance at volume
> (≈15–20+ clients) justifies its monthly fee. Don't build any of this until that
> decision is triggered — but keep the `ClientConfig` contract render-agnostic so
> the switch stays cheap.
>
> It contains (1) the Duda delivery architecture and (2) the **spike plan** to
> prove Duda can render a `ClientConfig` faithfully *before* committing to it.
>
> ⚠️ Duda endpoint/field names below are written at the **concept** level. The
> whole point of the spike is to confirm them against the current Duda API docs +
> a real account — treat every "verify" as a real TODO, not decoration.
>
> Last updated: 2026-06-18.

---

## When to trigger the switch (why this exists)

Self-hosting an Astro fleet is the right call *now* (built, free, full control),
but it carries maintenance that compounds with client count — the trigger signals
to switch to Duda:

- **Fleet-rebuild drift** — README calls it "the most expensive mistake": one
  `packages/*` edit can silently restyle every live site on next deploy.
- **Photo repo bloat** — unsolved (PROJECT-CONTEXT HC-16); multi-GB by ~client 20.
- **Per-client ops** — a Vercel project, domain, env vars, and basic-auth preview
  middleware *per site*, plus the `eject-client` dance to make a site standalone.
- **We become the hosting + support desk** for every client on a care plan.

Duda removes all of it and adds a **client editor** (clients fix their own
hours/prices → the `HANDOFF.md` change-fee friction mostly disappears). And
because the schema deliberately has **no free-form HTML escape hatch**
(`CLAUDE.md` — "the one rule"), we give up almost nothing by rendering templated
config through Duda instead of Astro.

The constant across both paths is the **engine** and its contract: the agent
emits a validated `ClientConfig` (`packages/schema`); a *render target* turns
that config into a live site. Astro is the production target today; Duda is the
target this doc would switch to at scale.

```
lead → enrich → generate → judge  ──►  ClientConfig  (the contract, packages/schema)
                                          │
                                          ├─► Astro factory   (PRODUCTION today + demo/portfolio)
                                          └─► Duda Site API    (deferred scale option)  ◄── this doc
```

---

## The Duda delivery model (standard agency pattern)

1. **Pre-build one Duda template per preset** (4: `landscaping`, `junk-removal`,
   `pressure-washing`, `concrete-fencing`) once, by hand, in the Duda editor.
   Each template:
   - carries the canonical section layout (hero → services → gallery → reviews →
     service-area map → contact → footer);
   - exposes **named, injectable regions** for every text/image slot;
   - binds the repeating sections (services, gallery, reviews) to **Duda
     Collections** (Duda's built-in CMS); and
   - carries the preset's colors + font as the template's global theme.
2. **Create a site from the matching template** via the API (`template_id` → new
   site keyed by `slug`).
3. **Inject content** from the `ClientConfig`: business data, text regions,
   uploaded images, and collection rows.
4. **Set SEO + domain, enable the native form, publish** — or leave unpublished
   for free spec-site outreach.

This is the lever that makes the cold **"spec site"** motion cheap: an unpublished
Duda site is free, so the agent can generate a tailored preview per lead and we
only pay + publish on "yes" (PROJECT-CONTEXT §1).

---

## Field-by-field mapping (`ClientConfig` → Duda)

Source of truth for the left column: `packages/schema/src/index.ts`.

### `business` → Duda Business Data (a.k.a. "InSite"/site business profile)

| `ClientConfig` | Duda mechanism | Notes / verify |
|---|---|---|
| `business.name` | Business data `name` (+ site `name`/slug) | clean map |
| `business.phone` | Business data `phone`; drives click-to-call | clean |
| `business.email` | Business data `email` | clean |
| `business.address?` | Business data `address`/location | optional; many clients are mobile-only — leave empty |
| `business.hours[]` `{days, hours}` | Business data **schedule** | our `days`/`hours` are free-form strings; Duda's schedule may be structured per-weekday → **verify** whether to push strings or normalize |
| `business.serviceAreas[]` | Business data service areas + copy + `areaServed` schema | drives LocalBusiness `areaServed`; **verify** how Duda exposes multi-area |

### `brand` → Duda global theme (template-level)

| `ClientConfig` | Duda mechanism | Notes / verify |
|---|---|---|
| `brand.palettePreset` | Selects which of the 4 pre-built Duda templates | preset = template choice |
| `brand.cssVarOverrides` (`--brand-*` hex) | Site global colors via design/theme API **if available**, else per-client template tweak | ⚠️ **highest risk** — Duda theming is largely editor-side; confirm the API can set the 6 brand tokens per site |
| `brand.font` | Site global font | map our 5 font ids → Duda font names; **verify** API sets fonts |
| `brand.radius` (`none`..`xl`) | Template CSS | ⚠️ likely **not** API-settable per site → bake into template or drop from the Duda path |

### `layout` → template structure

| `ClientConfig` | Duda mechanism | Notes / verify |
|---|---|---|
| `layout.variant` (`A`/`B`) | Template choice (A = image hero, B = video hero) | 4 presets × 2 variants = up to 8 templates, or one template with a swappable hero |
| `layout.sectionOrder[]` | Fixed in the template's canonical order | ⚠️ per-site reordering via API is limited → if reordering must stay dynamic, that's a **risk**; pragmatic call: freeze the canonical order on Duda |

### Repeating content → Duda Collections (native CMS)

| `ClientConfig` | Duda mechanism | Notes / verify |
|---|---|---|
| `services[]` `{title, description, icon?, image?}` | Collection `services`, bound to a repeating section | upload `image`; map `icon` id → template icon set |
| `gallery[]` `{src, alt}` | Collection `gallery` (or native gallery widget) bound to images | upload each `src`; `alt` → image alt field |
| `reviews[]` `{author, rating, text, source?}` | Collection `reviews` bound to a reviews/testimonial section | clean map |

### Singletons → content injection into named regions

| `ClientConfig` | Duda mechanism | Notes / verify |
|---|---|---|
| `copy.heroHeadline` / `heroSub` / `ctaLabel` / `about` | Text injection into named regions | Content Library / Content Injection; **verify** region-naming approach |
| `hero.image` / `videoSrc` / `videoPoster` | Upload assets → hero widget media | variant B uses video |
| `map.staticImage?` / `embedQuery?` | Duda map widget (driven by business location) | Duda's native map likely supersedes both → **simplify** |

### `form` → **replace** with Duda native form (a win, not a map)

| `ClientConfig` | Duda mechanism | Notes / verify |
|---|---|---|
| `form.provider: web3forms` | **Drop** — use Duda's native form widget | no Web3Forms account per client |
| `form.accessKey` | **Drop** | — |
| `form.hcaptchaSiteKey?` + honeypot | **Drop** — Duda built-in spam protection | one less integration per site |
| `form.redirectUrl?` | Duda form "thank-you"/redirect setting | **verify** API sets it |
| (notifications) | Duda form email-notification recipient = `business.email` | **verify** API sets recipient |

### `seo` → Duda SEO + domain + schema

| `ClientConfig` | Duda mechanism | Notes / verify |
|---|---|---|
| `seo.title` / `description` | Per-page SEO (title/meta description) | **verify** API path for SEO fields |
| `seo.ogImage?` | Open Graph image | upload + set |
| `seo.city` / `region` | LocalBusiness schema + copy | from business data |
| `seo.siteUrl` | Custom domain attach + publish | domain add via API or dashboard |
| LocalBusiness JSON-LD (today emitted by `packages/template/src/lib/seo.ts`) | Duda business-data-driven schema **or** custom header HTML | ⚠️ **verify** — if Duda's auto-schema is insufficient, inject our JSON-LD via site-wide custom code (confirm API supports header injection) |

---

## What gets simpler on Duda (the wins)

- **Forms:** delete Web3Forms + hCaptcha + the honeypot entirely.
- **Images:** delete `astro:assets` *and* the repo photo-bloat problem (HC-16) —
  upload to Duda's CDN; responsive variants are automatic.
- **Hosting/SSL/domains:** managed; no per-client Vercel project, no preview
  middleware (Duda has native staging + site password).
- **Client edits:** clients self-serve hours/prices → change-fee friction mostly
  gone.
- **Fleet drift:** Duda sites are independent once created — a template change
  does **not** restyle live sites. The README's "most expensive mistake" stops
  being possible.

---

## What's at risk — must be answered by the spike

Ranked by how likely it is to bite:

1. **Per-site theming via API** (`brand.cssVarOverrides`, `brand.font`,
   `brand.radius`) — can the API set the 6 brand tokens + font per site, or is
   color/font effectively frozen at the template? If frozen, per-client color is
   lost (acceptable?) or needs more templates.
2. **Custom JSON-LD** — does Duda's auto schema cover LocalBusiness well enough,
   or do we need header-HTML injection (and does the API allow it)?
3. **`sectionOrder` dynamism** — confirmed-frozen on Duda is fine; if a client
   ever needs a different order, that's a manual editor task, not an API call.
4. **Collection binding** — can repeating sections be bound to API-populated
   collections cleanly, including images + per-row alt text?
5. **Form notifications + redirect** — set the recipient and thank-you behavior
   per site via API.

---

## The spike

**Goal:** prove **one** real `ClientConfig` — the demo
(`apps/demo-pressure-pros/client.config.ts`) — renders faithfully on Duda, end to
end, via the API.

**Shape** (illustrative — not built yet; this is the plan):

```ts
// lives in ops as a render target, framework-agnostic TS: ops/lib/render-duda/
// (same home as the moved engine — ops/lib/lead-gen + ops/lib/agent).
import type { ClientConfig } from "@/lib/schema"; // ClientConfig contract, vendored into ops

const TEMPLATE_BY_PRESET: Record<ClientConfig["brand"]["palettePreset"], string> = {
  landscaping: "DUDA_TEMPLATE_ID_LANDSCAPING",
  "junk-removal": "DUDA_TEMPLATE_ID_JUNK",
  "pressure-washing": "DUDA_TEMPLATE_ID_PRESSURE",
  "concrete-fencing": "DUDA_TEMPLATE_ID_CONCRETE",
};

export async function renderToDuda(config: ClientConfig): Promise<{ siteName: string; previewUrl: string }> {
  // 1. create site from preset template          → POST create-from-template (verify path)
  // 2. set business data                          → name/phone/email/address/hours/serviceAreas
  // 3. apply brand theme (colors/font)            → ⚠️ risk #1, verify API
  // 4. upload assets (hero, service/gallery imgs, ogImage)
  // 5. populate collections (services, gallery, reviews)
  // 6. inject singleton copy (hero*, about, ctaLabel)
  // 7. configure native form (recipient=business.email, redirect)
  // 8. set SEO (title/description/og) + JSON-LD    → ⚠️ risk #2
  // 9. leave UNPUBLISHED → return preview URL for spec-site outreach
}
```

Auth: Duda white-label API (HTTP Basic — API user + password). Secret lives
server-side only, same rule as `ANTHROPIC_API_KEY`/`GOOGLE_PLACES_API_KEY`
(AGENTS.md "secrets are server-only").

**Acceptance criteria — the spike is done when:**

- [ ] A Duda site is created from a preset template via the API.
- [ ] Business data (name/phone/email/hours/areas) is correct.
- [ ] Services, gallery, and reviews render from injected collection rows.
- [ ] Colors + font match the preset (or risk #1 is documented as a known loss).
- [ ] Hero + copy slots are correct (variant A image / B video).
- [ ] The native form submits and notifies `business.email`.
- [ ] SEO title/description/og present; LocalBusiness schema present (or risk #2
      documented).
- [ ] Side-by-side with the Astro demo, the Duda render is faithful (human
      judgment, not pixel-exact).

**Open questions to confirm against current Duda API docs + the account:**

1. Exact endpoints/fields for: create-from-template, business data, collections,
   content injection, SEO, custom code, publish.
2. Can global colors + fonts be set **per site** via API (risk #1)?
3. Is site-wide custom header HTML injectable via API (for JSON-LD, risk #2)?
4. Plan tier required for API + white-label + the site volume we expect, and the
   **per-site monthly cost** (this is the number the care plan must cover).

**Estimated effort:** ~half a day once a Duda white-label/API account exists.
This is a spike to *de-risk the platform bet*, not the production integration.

---

## If the spike fails

- **Partial failure** (e.g. theming/schema gaps): accept the limitation, or keep
  the **Astro path for the rare client** that truly needs it (a different price
  tier, consistent with the scope policy). The engine is unchanged either way.
- **Platform mismatch:** evaluate **GoHighLevel** — it bundles CRM + site builder
  + email/SMS outreach, which would also absorb parts of `hirobius-ops`. Trade-off:
  heavier lock-in and a weaker AI-engineering portfolio story. Decide deliberately;
  don't drift into it.

---

## Where this sits in the architecture

- **Contract (stays in this repo):** `packages/schema` (`ClientConfig`). `ops`
  vendors a copy.
- **Runtime engine (moves to `ops`):** `scripts/lead-gen`, `packages/agent` →
  `ops/lib/` (single home). Migration brief: `docs/OPS-HANDOFF.md`.
- **Render targets:** Astro (this repo, reference/portfolio) + **Duda
  (production, this doc; `ops/lib/render-duda`)**.
- **Command center:** `hirobius/ops` runs the engine and calls `renderToDuda` from
  a "Render site" / "Publish" action — see `docs/OPS-HANDOFF.md` for the full wiring.
