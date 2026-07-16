# Production go-live runbook

Turns an **approved preview** (`apps/<slug>`, gated behind `middleware.ts` —
see README → "Preview gating") into a **live, indexable site on the client's
own domain.** This is the *per-client, repeatable* production flip. It is
**not** the same thing as:

- **[#112](https://github.com/hirobius/site-engine/issues/112)** — the
  one-time *launch-week* human runbook (grant GitHub App scopes, seed visual
  baselines, prove the gate once, delete unused preview Vercel projects).
  Do that once for the fleet; do this doc once **per client**.
- **`scripts/eject-client.ts`** (README → "Handoff") — flattening the repo
  into a standalone handoff copy for the client to own going forward. Ejecting
  is about *code ownership*; this doc is about *making the site public*. Go
  live first (this doc), eject later at handoff.

Everything below is grounded in what actually runs today —
`packages/template/src/build-gate.ts`, `packages/template/src/acceptance.ts`,
`scripts/go-live.ts`, `scripts/verify-live.ts`, and `apps/<slug>/middleware.ts`.
Where a step needs a real human-supplied value, the exact field name is called
out — nothing below is invented.

---

## 0. Prerequisites

- [ ] Intake is complete (`docs/INTAKE.md` filled in) and the preview deploy
      has been reviewed/approved.
- [ ] The client's Vercel project already exists and is linked (`new-client`
      prints this; see README → "New client in 10 minutes", step 5). Project
      name convention: `hirobius-<slug>` (`SECRETS.md`).
- [ ] You have (or can get) the client's real **Web3Forms** access key and
      **hCaptcha** site key (step 1), and the domain is registered at
      **Porkbun** (step 3).

---

## 1. Real keys in place

Edit `apps/<slug>/client.config.ts` — the `form` block
(`packages/schema/src/index.ts` → `FormSchema`):

```ts
form: {
  provider: "web3forms",
  accessKey: "REPLACE_WITH_WEB3FORMS_ACCESS_KEY",   // <- real Web3Forms key
  hcaptchaSiteKey: "REPLACE_WITH_HCAPTCHA_SITE_KEY", // <- real hCaptcha site key, uncomment
},
```

- **`form.accessKey`** — get it from Web3Forms: <https://web3forms.com/> →
  "Create Access Key" → email the key comes back to. Web3Forms keys are
  UUID-shaped (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`); the acceptance checker
  (`isPlaceholderFormKey` in `acceptance.ts`) rejects anything else, including
  the all-zeros scaffold value and the literal
  `REPLACE_WITH_WEB3FORMS_ACCESS_KEY` stub.
- **`form.hcaptchaSiteKey`** — get it from the hCaptcha dashboard:
  <https://dashboard.hcaptcha.com/sites> → "Add Site" → add the production
  domain (step 3) under Domains → the sitekey is on the site's detail page.
  `ContactForm.astro` only renders the hCaptcha widget/script when this field
  is set (README → "Spam protection"); the acceptance checker also **requires**
  it once real data is live (`missing-hcaptcha-key`).
- `form.accessKey` is a client-side-safe public key (comment in
  `FormSchema`) — it is meant to ship in the built HTML. **Known gap:**
  today both keys are literal fields in `client.config.ts`, i.e. committed to
  this shared, repo-readable monorepo rather than a per-project Vercel env
  var. `SECRETS.md` → "Before onboarding the first real client" already flags
  moving them to env vars (tracked in #27) — that migration hasn't landed, so
  for now the real key does land in the commit. Don't invent an env var for
  this yet; it isn't wired up in `ContactForm.astro` or the schema.
- **Do not fabricate a value for either field.** If a key isn't available
  yet, leave the stub and list it as a blocking TODO — this is exactly what
  `checkClientAcceptance` (`packages/template/src/acceptance.ts`) exists to
  catch (`placeholder-form-key`, `missing-hcaptcha-key`).

---

## 2. Arm the gate — `SITE_LIVE=true`

Two gates, both real code, both must pass:

1. **The build gate** (`packages/template/src/build-gate.ts` →
   `armAcceptanceGate`, wired into every `apps/<slug>/astro.config.ts`). It
   runs `checkClientAcceptance` with `realData: true` whenever
   `SITE_LIVE === "true"` **or** `VERCEL_ENV === "production"` — i.e. every
   real production build, automatically, with nothing to remember to flip.
   With `realData: true` it rejects (among other things): a `.example`/
   `example.com` email or `seo.siteUrl`, a `555`-area-code/`555-01xx` phone,
   a non-UUID or all-zeros `form.accessKey`, a missing `form.hcaptchaSiteKey`,
   a stub business name (`acme` / `new client` / `test business`), and a
   non-`https://` `seo.siteUrl`. It also checks `hero.image` resolves to an
   optimized file under `src/assets/photos/` (not just `public/`).
2. **The preview-gate middleware** (`apps/<slug>/middleware.ts`) — closed by
   default on *every* environment, including Vercel production, until
   `process.env.SITE_LIVE === "true"` on that project. That single env var is
   the production/preview switch.

Run the orchestrator (`scripts/go-live.ts`, `pnpm go-live` in `package.json`):

```bash
pnpm go-live <slug>          # armed build (SITE_LIVE=true astro build) -> prints the Vercel steps
pnpm go-live <slug> --yes    # armed build -> executes the flip + prod deploy -> runs verify-live
```

- It first runs `SITE_LIVE=true astro build` for `apps/<slug>` **locally** —
  the exact gate from step 2.1 — so placeholder intake data fails here,
  before anything touches Vercel. A failure here means: go back to step 1 (or
  whatever `checkClientAcceptance` flagged) and fix the config; don't route
  around it.
- Without `--yes` it prints (does not run):
  ```bash
  echo "true" | vercel env add SITE_LIVE production --cwd apps/<slug>
  vercel deploy --prod --cwd apps/<slug>
  ```
- With `--yes` it runs those two commands, then calls `verifyLive()` (step 4)
  against `seo.siteUrl` read straight out of `client.config.ts`, and fails
  loudly if any check doesn't pass.

---

## 3. Domain: Porkbun → Vercel

Do this once the armed build (step 2) is green, so you're not pointing a real
domain at a site that will fail its own gate.

1. **Confirm the domain is registered at Porkbun.** Domain list / DNS entry
   point: <https://porkbun.com/account/domainsSpeedy> (Porkbun's "Domain
   Management" screen — from any page, ACCOUNT menu → Domain Management).
   Register it there first if it isn't already.
2. **Add the domain to the Vercel project:**
   ```bash
   vercel domains add <domain> hirobius-<slug>
   ```
   (README already shows this pattern:
   `vercel domains add mikesjunk.com hirobius-mikes-junk`.) Or via the
   dashboard: Vercel project → **Settings → Domains** → Add.
3. **Get the exact DNS records Vercel wants** — don't hand-type remembered
   values, ask Vercel for this project's actual ones:
   ```bash
   vercel domains inspect <domain>
   ```
   or in the dashboard, the same **Settings → Domains** page shows the
   record(s) to add once the domain is pending verification. As of this
   writing Vercel's documented values are an **A record** `@` →
   `76.76.21.21` for the apex domain, and a **CNAME record** `www` →
   `cname.vercel-dns.com` for the `www` subdomain — but some projects get a
   project-specific CNAME target, so trust what `vercel domains inspect`
   /the dashboard actually prints over this doc.
4. **Add those records in Porkbun:** <https://porkbun.com/account/domainsSpeedy>
   → your domain's **DNS** button (or Details → DNS Records) → **Add
   Record** → enter the type/host/answer Vercel gave you in step 3.
5. **Wait for propagation, then verify:**
   ```bash
   vercel domains inspect <domain>    # or: vercel domains verify <domain>
   ```
   until Vercel reports the domain as verified/assigned to the project.
6. If the client wants the client to keep ownership of the domain
   registration (common), that's a Porkbun-account-sharing conversation, not
   a code step — note the arrangement in `docs/HANDOFF.md`'s
   `{{HOSTING_NOTE}}` field for this client.

**Follow-up, not now:** Porkbun has an API
(<https://porkbun.com/api/json/v3/documentation>) — the DNS-record step above
is semi-automatable later. Out of scope for this doc; do it manually until
that's built.

---

## 4. Verify live

If you ran `pnpm go-live <slug> --yes`, this already happened as the last
step. To run it standalone (e.g. after step 3's DNS propagates, or to
re-check later):

```bash
pnpm verify-live https://<domain>
```

`scripts/verify-live.ts` → `verifyLive()` asserts, against the real deploy:

- home page returns **200**
- **no** `X-Robots-Tag: noindex` header (the preview gate is actually off)
- a `LocalBusiness` JSON-LD block is present (`packages/template/src/lib/seo.ts`)
- `/sitemap-index.xml`, `/robots.txt`, `/llms.txt`, and `/thanks` all return 200

To confirm a *preview* deploy is still correctly gated (the opposite check,
useful as a pre-flight sanity check on a sibling preview or before flipping
this one):

```bash
pnpm verify-live https://<preview-url> --expect-gated
```

expects **401** with a `WWW-Authenticate` header and `X-Robots-Tag: noindex`.

Once **[#104](https://github.com/hirobius/site-engine/issues/104)**'s
`--expect-gated` mode is your standard proof, use it in place of the manual
`curl` commands **#112** still documents for the one-time fleet-wide gate
proof.

---

## Done-state checklist

- [ ] `form.accessKey` / `form.hcaptchaSiteKey` are the client's real keys
      (step 1).
- [ ] `pnpm go-live <slug>` (armed build) passes with zero
      `checkClientAcceptance` issues.
- [ ] `SITE_LIVE=true` is set on the Vercel project's **production**
      environment and a prod deploy has shipped.
- [ ] The domain resolves through Porkbun → Vercel (step 3) and
      `vercel domains inspect <domain>` shows it verified.
- [ ] `pnpm verify-live https://<domain>` is all-green.
- [ ] `docs/HANDOFF.md` is filled in for this client (launch date, template
      version, hosting/domain ownership note) and sent.
