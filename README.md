# hirobius-clients

The **engine + reference factory** for **mass-producing one-page marketing
sites** for local service businesses (landscaping, junk removal, pressure
washing, concrete/fencing). A typed `ClientConfig` is the contract; a render
target turns it into a live site.

## Orientation (start here)

The 15-second map so you don't have to hold it all in your head:

- **This repo = the render layer + the contract:** Astro website templates
  (`packages/template`, `apps/*`) and the `ClientConfig` data shape
  (`packages/schema`).
- **The AI engine lives here for now** (`packages/agent` = lead → site config;
  `scripts/lead-gen` = find businesses). It runs from the `hirobius/ops`
  dashboard and is slated to **move to `ops`** so each repo has one job.
- **Building a client site?** Edit one file — `apps/<slug>/client.config.ts` —
  and drop in photos. That's the whole job (see `CLAUDE.md`).
- **Production sites ship on self-hosted Astro** (this repo), one Vercel project
  per client.
- **Why any of this exists / the strategy:** `docs/PROJECT-CONTEXT.md`.

> **Delivery architecture:** production sites ship on **self-hosted Astro** (this
> repo) — already built, free, and the most direct path from a generated
> `ClientConfig` to a live site. The moat is the platform-agnostic **engine**:
> `packages/schema` (contract) + lead sourcing + `packages/agent` (AI pipeline).
> The `ClientConfig` contract is render-agnostic, so the delivery platform is a
> swappable detail if we ever outgrow self-hosting.

**Stack (production = Astro):** Astro 5 (static output) · Tailwind v4 ·
TypeScript · pnpm workspaces · Turborepo · Zod · astro:assets · Web3Forms +
hCaptcha · Vercel. **Engine:** `@anthropic-ai/sdk` · Zod · Places API.

---

## TL;DR

```bash
pnpm install
pnpm build          # builds every app (static) — fails loudly on invalid config
pnpm dev            # turbo dev across apps
pnpm check          # tsc (packages) + astro check (apps)
pnpm test           # turbo run test: vitest acceptance suites + demo Playwright smoke
pnpm new-client <slug> --name "Business" --preset pressure-washing
pnpm eject-client <slug>     # flatten to a standalone handoff repo
```

Acceptance status: `pnpm install && pnpm build` is green; the demo
(`apps/demo-pressure-pros`) is deployable static output; pages ship no framework
runtime except the small islands (lazy map embed, hCaptcha when enabled).

---

## Structure

```
packages/
  schema/      @hirobius/schema   — Zod ClientConfig + defineClient() + palette presets
  template/    @hirobius/template — Astro section components, theming, SEO/JSON-LD helpers
apps/
  _template/                   canonical client app (copied by new-client)
  _gallery/                    internal component/preset preview (design-system head start)
  demo-pressure-pros/          working demo proving the system (Playwright smoke test)
  monroe-street-power-wash/    cold-outreach preview (has an acceptance test suite)
  preview-clearout-junk/       cold-outreach preview
  preview-evergreen-lawn/      cold-outreach preview
  preview-solidline-concrete/  cold-outreach preview
scripts/
  new-client.ts   scaffold a client + print Vercel CLI commands
  eject-client.ts flatten one client into a standalone repo for handoff
docs/
  INTAKE.md            per-client intake worksheet (maps 1:1 to client.config.ts)
  GO-LIVE-CHECKLIST.md the facts a site needs before SITE_LIVE=true (issue #151)
  HANDOFF.md           one-page client handoff (the 7-day window + change fee)
```

### How a page is composed

`apps/<slug>/src/pages/index.astro` imports the section components from
`@hirobius/template` and renders them in the order set by
`client.config.ts → layout.sectionOrder`. **There is zero hardcoded business
content in the components** — everything reads from the validated config object.

### Theming

Semantic CSS custom properties (`--color-primary/accent/bg/fg/muted/on-primary`,
`--font-heading/body`, `--radius-theme`) are mapped to Tailwind v4 via `@theme`
in `packages/template/src/styles/theme.css`. Each client's resolved palette
(preset + `brand.cssVarOverrides`) is injected as an **inline style on `<html>`**,
so it always wins the cascade. Four trade presets ship today: `landscaping`,
`junk-removal`, `pressure-washing`, `concrete-fencing`.

> **Tailwind v4 gotcha (handled):** Tailwind ignores `node_modules` when scanning
> for class names, and the template is a symlinked workspace package. Each app's
> `src/styles/global.css` therefore opts the template source in with an explicit
> `@source "../../../../packages/template/src"`. `eject-client` rewrites this to
> the inlined path.

---

## New client in 10 minutes

1. **Scaffold** (≈1 min)
   ```bash
   pnpm new-client mikes-junk --name "Mike's Junk Removal" --preset junk-removal
   ```
   This copies `apps/_template → apps/mikes-junk`, stubs the config, and prints
   the exact Vercel CLI commands.

2. **Fill in the config** (≈4 min) — `apps/mikes-junk/client.config.ts`:
   business name/phone/email/hours/serviceAreas, copy, services, reviews, SEO
   (title/description/city/region/siteUrl), and the Web3Forms `accessKey`
   (+ `hcaptchaSiteKey`).

3. **Add photos** (≈3 min) — optimized photos go in `src/assets/photos`
   (astro:assets makes responsive WebP), verbatim assets (og image, favicon) in
   `public`. See **Images** below for the intake rule. `new-client` already
   generated a brand-colored monogram `favicon.svg` (business initial on the
   preset primary) — drop a real logo file over it if the client has one.

4. **Verify** (≈1 min)
   ```bash
   pnpm install
   pnpm --filter @hirobius/mikes-junk build
   ```

5. **Ship on Vercel** (≈1 min) — run the commands `new-client` printed:
   ```bash
   vercel link --cwd apps/mikes-junk --project hirobius-mikes-junk --yes
   # Root Directory = apps/mikes-junk ; Ignored Build Step = npx turbo-ignore
   vercel env add PREVIEW_USER preview --cwd apps/mikes-junk
   vercel env add PREVIEW_PASS preview --cwd apps/mikes-junk
   vercel deploy --cwd apps/mikes-junk          # preview (basic-auth gated)
   vercel deploy --prod --cwd apps/mikes-junk
   vercel domains add mikesjunk.com hirobius-mikes-junk
   ```

---

## Preview gating

Previews are gated by **Vercel Routing Middleware** (formerly "Edge Middleware")
at `apps/<slug>/middleware.ts` — **not** Astro middleware, which does not run on
static output. This is a platform feature that runs on the edge for every
request regardless of framework, which is why it works on a static Astro site.

- **Tokenized link — the sales artifact.** `https://<preview>/?key=<PREVIEW_TOKEN>`
  is the one link to send in cold outreach: no Basic auth prompt, no credentials
  to share mid-funnel. A matching `?key=` sets an httpOnly cookie so every later
  request on that browser passes with no query param. Set the per-site secret
  with `vercel env add PREVIEW_TOKEN preview --cwd apps/<slug>` (`new-client`
  prints this). If `PREVIEW_TOKEN` isn't set, this path is inert and behavior is
  Basic-auth-only, unchanged.
- HTTP Basic auth via `PREVIEW_USER` / `PREVIEW_PASS` stays the operator path —
  always available, only when `VERCEL_ENV !== "production"`. Production passes
  straight through.
- Previews (both paths) also get `X-Robots-Tag: noindex`. This lives in the
  middleware, **not `vercel.json`**, because `vercel.json` headers can't be
  scoped to an environment (they'd noindex production too). A token grants
  *viewing*, never indexing — and the token (like Basic auth) stops mattering
  the moment `SITE_LIVE=true`, since that flip bypasses the gate entirely.
- Fails closed: if neither a valid token nor creds are presented, the site
  returns 503 (nothing configured) or 401 (wrong Basic auth).

**Verification:** the pattern is confirmed against Vercel's `routing-middleware`
docs (a non-Next project exports a default `(request: Request) => Response` and
uses `next()` from `@vercel/functions` to continue to the static asset). Before
relying on it across the fleet, do one real preview deploy and confirm the 401
prompt appears. If it ever fights the platform, the fallback is Vercel's built-in
**Deployment Protection → Vercel Authentication** (Project Settings) — note the
swap here if you make it.

---

## Deploy

Going live used to be a hand-run ritual: flip `SITE_LIVE` in the Vercel
dashboard, redeploy, and hope. `pnpm go-live` + `pnpm verify-live` replace that
with a scripted flip that refuses to proceed on a bad config, plus a real
post-deploy check:

```bash
pnpm go-live mikes-junk            # armed build -> print the Vercel steps
pnpm go-live mikes-junk --yes      # armed build -> execute the flip + prod deploy -> verify
```

- `go-live` first runs `SITE_LIVE=true astro build` for the app locally — the
  same armed `checkClientAcceptance` gate described above — so placeholder
  intake data fails **here**, before anything touches Vercel. Work through
  `docs/GO-LIVE-CHECKLIST.md` before running it — it walks the intake facts
  the armed gate checks (contrast/video-hero checks are separate and covered
  there too, but aren't intake facts).
- Without `--yes` it prints the exact `vercel env add SITE_LIVE production` +
  `vercel deploy --prod` commands (same print/execute pattern as `new-client`).
  With `--yes` it runs them, then verifies the live result.
- `pnpm verify-live <url>` asserts a live site works: 200, no
  `X-Robots-Tag: noindex`, a LocalBusiness JSON-LD block, `/sitemap-index.xml`
  + `robots.txt` + `llms.txt` reachable, `/thanks` renders.
- `pnpm verify-live <preview-url> --expect-gated` asserts the opposite — 401
  with `WWW-Authenticate` + noindex — the behavioral proof of the preview gate
  above, runnable against any real preview deploy.

**Full runbook (real Web3Forms/hCaptcha keys, arming `SITE_LIVE`, pointing a
Porkbun domain at Vercel, and verifying the result):** `docs/GO-LIVE.md`.

---

## Images

- **Intake convention: 1600px max edge, ~200KB per file.** Compress at intake;
  don't commit phone-camera originals.
- Optimizable photos → `src/assets/photos` (astro:assets emits responsive
  `srcset` + WebP/AVIF, hashed, long-cached). Verbatim files (og image, favicon,
  hero video/poster, static map) → `public`.
- `ResponsiveImage.astro` resolves a config path against `src/assets/photos`
  first (optimized) and falls back to a plain `<img>` for `public` paths.

> **Repo-bloat watch (decide before ~client 20):** 100 clients × 15 photos in
> git is multi-GB. The 1600px/200KB rule buys runway, but plan to move photos to
> object storage (e.g. an S3/R2 bucket or Vercel Blob) and reference them as
> remote images before the repo gets heavy. `**/photos-original/` is gitignored
> so raw originals never land in history.

---

## Spam protection

Day one, not later: every form ships a **honeypot** (`botcheck`, hidden; Web3Forms
drops anything that fills it) **and an hCaptcha slot**. Set
`form.hcaptchaSiteKey` in each production client's config — the widget and script
only render when a key is present. Skipping this fills the client's inbox and
they call you.

---

## Ops & fleet management

### Build pipeline

`turbo.json` defines the `build`/`check`/`test`/`dev` pipeline. Use
**`npx turbo-ignore`** as each Vercel project's **Ignored Build Step** so a
client project only rebuilds when its app (or a shared package) actually changes.

> ⚠️ **Fleet rebuild drift:** a change to `packages/*` rebuilds **ALL** apps and
> can silently restyle live client sites on their next deploy. See the policy
> below — this is the most expensive mistake to make casually, and a **real
> production risk since we self-host on Astro.** Mitigate with template versioning +
> freezing handed-off (ejected) sites.

### Template-update policy (read before touching `packages/*`)

- **Handed-off / paid sites are frozen.** They are not re-deployed because the
  template changed. Treat a live client site as a release artifact.
- **Version template releases.** Tag `@hirobius/template` releases
  (`vX.Y.Z`) and record which template version each client shipped on. A
  template change is a *fleet event*, not a routine commit.
- **Rebuilds only on paid changes.** If a client wants the new look or fix, that's
  a scheduled, paid update — redeploy that one app intentionally.
- The cleanest guarantee that a client is insulated from fleet drift is to
  **eject** them (below): an ejected site has no link back to the template.

### Handoff (the eject script is not optional)

Client apps use `workspace:*` deps on `@hirobius/template` and
`@hirobius/schema`, so **they are not standalone** — "the client owns their site"
is only true after ejecting.

```bash
pnpm eject-client mikes-junk          # -> ejected/mikes-junk (standalone)
cd ejected/mikes-junk && pnpm install && pnpm build
git init && git add -A && git commit -m "Initial commit"
```

`eject-client` inlines both packages into `src/_vendor`, rewrites every
`@hirobius/*` import to a relative path, pins real dependency versions, drops the
monorepo wiring, and writes a handoff README. The result builds with a plain
`npm install` and zero workspace context (verified).

Hand the client `docs/HANDOFF.md` too — it states the **7-day post-launch change
window** and the change fee after that, so stale hours/prices on a site with your
name on it become *their* responsibility on a clear timeline.

### Visual regression (fleet-drift guard)

The most expensive mistake in this product is a `packages/*` change that silently
restyles every site. The `.github/workflows/visual.yml` job screenshots the
**gallery** (`apps/_gallery`) — which renders all 4 presets, both hero variants,
and every section on deterministic pages — and pixel-diffs against committed
baselines. A diff = the template's rendering changed; the PR shows expected /
actual / diff PNGs so you decide if it's intended. The browser context forces
`prefers-reduced-motion: reduce`, so scroll-reveal motion never arms and the
baselines stay deterministic regardless of a preset's `brand.motion`.

Baselines are platform-specific, so they're seeded in the same **pinned
Playwright container** CI uses. **To reseed, run the workflow**: Actions →
`Visual Baseline Seed` → Run workflow. It builds the gallery, regenerates
snapshots, and opens a PR with the updated images — review the diffs, then
merge; baselines are never pushed straight to main.

Fallback (manual container run, e.g. if the workflow itself needs debugging):

```bash
docker run --rm -it --ipc=host -v "$PWD":/work -w /work \
  mcr.microsoft.com/playwright:v1.60.0-noble \
  bash -lc "corepack enable && pnpm install --frozen-lockfile \
            && pnpm --filter @hirobius/gallery build \
            && pnpm --filter @hirobius/gallery test:visual:update"
git add apps/_gallery/tests/**/*-snapshots && git commit -m "Seed visual baselines"
```

After baselines are seeded, every PR touching `packages/**` or
`apps/_gallery/**` runs the diff automatically. (You can also trigger
`visual.yml` manually with `update: true` to refresh baselines and download
them as an artifact, without opening a PR.)

### Performance & accessibility budgets

The factory's pitch is "green Core Web Vitals by default" — the
`.github/workflows/lighthouse.yml` job proves it on every PR touching
`packages/**`, `apps/_template/**`, or `apps/demo-pressure-pros/**`. It builds
`demo-pressure-pros`, serves the static output, and enforces budgets against `/`:

- **Lighthouse CI** (mobile, simulated throttling): Performance ≥ 95,
  Accessibility = 100, SEO = 100, LCP < 2.5s. 3 runs per URL; lhci's `optimistic`
  aggregation (its default) takes the best-scoring run, which absorbs simulated-
  throttling measurement noise without hiding a real regression — a genuine
  regression drags every run down, not just one.
- **axe-core scan** (`playwright.a11y.config.ts`): zero accessibility violations.

Both run in the same pinned Playwright container as the visual regression job,
for the same reason — Lighthouse's perf scoring is sensitive to whatever Chrome
build a generic runner happens to have. Both also force
`--force-prefers-reduced-motion` / `reducedMotion: "reduce"`: Lighthouse and axe
never scroll the page, so a below-the-fold `.reveal` section can still be mid
fade-in when they sample it, reading as a false-positive contrast violation —
same flake guard as the visual regression job (clients#22/#74).

### Scope policy

Pricing assumes **config-only customization**. The schema is the contract: if a
request fits the config, it's in scope. The first **custom component** for one
client is a **different price tier**, not a favor — keep that boundary at the
schema. (There is deliberately no free-form HTML escape hatch in the config.)

---

## Conventions & commands

| Command | What it does |
| --- | --- |
| `pnpm build` | Turbo build of all apps (static). Invalid config → build fails (Zod). |
| `pnpm check` | `tsc --noEmit` (packages) + `astro check` (apps). |
| `pnpm test` | `turbo run test`: vitest acceptance suites (schema, template, scripts, apps) + demo Playwright smoke. |
| `pnpm new-client <slug>` | Scaffold a client + print Vercel commands. |
| `pnpm eject-client <slug>` | Flatten a client into a standalone repo. |

**Why builds fail on bad config:** `astro.config.ts` and every page import
`client.config.ts`, which calls `defineClient()` → Zod `safeParse`. A bad config
throws at build time, so CI and Vercel both refuse to ship it.

CI (`.github/workflows/ci.yml`): install (frozen lockfile) → build → typecheck →
`pnpm test` (vitest acceptance suites + demo Playwright chromium smoke test).
