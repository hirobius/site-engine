# Secrets & secret-ownership — `hirobius/clients`

> Follows the org-wide **[Hirobius Secrets Management Standard](https://github.com/hirobius/ops/blob/main/standards/secrets-management.md)** (canonical copy in `hirobius/ops`). This file records how the standard applies to **this multi-tenant monorepo**, where the key risk is one client's secret leaking into another client's app. Adoption tracked in [#27](https://github.com/hirobius/clients/issues/27).

## The model here: one app = one client = one Vercel project

- Each client site is `apps/<slug>`, deployed as its **own separate Vercel project** (`hirobius-<slug>`).
- The preview-gate vars `PREVIEW_USER` / `PREVIEW_PASS` (+ platform `VERCEL_ENV`) are read by every app's `middleware.ts` — **same variable name, but each Vercel project sets its own value.** Same name ≠ shared value. These are **Hirobius-Internal** (our preview gate), one value per project.
- There is **no shared credential store** across apps, and **no client key is reused across tenants**.

## The rule that keeps clients isolated

- **Client-specific keys are never hardcoded as literals in `client.config.ts`.** Today the demo/preview apps carry placeholder values inline (Web3Forms `accessKey`, hCaptcha `siteKey` = all-zeros) — fine for fake data. **The moment a value is a real client's key it must become a per-project env var**, set on that client's Vercel project only, and recorded in **that client's Bitwarden collection** — never committed to this shared, repo-readable monorepo.
- **One owner per key.** A client's Web3Forms / hCaptcha / other keys → that client's Bitwarden collection. Hirobius build/lead-gen tooling → `Hirobius — Internal`.

## Env-var names (names only — values live per-Vercel-project + in Bitwarden)

Per-client app (`apps/<slug>`), set on each app's own Vercel project:

| Name | Owner | Purpose |
|------|-------|---------|
| `PREVIEW_USER` | Internal | preview-gate basic-auth user (one value per project) |
| `PREVIEW_PASS` | Internal | preview-gate basic-auth pass (one value per project) |
| `VERCEL_ENV` | Internal (platform) | injected by Vercel; not a secret |
| _(future, per real client)_ | that client | their Web3Forms access key + hCaptcha site key — as env vars, **not** `client.config.ts` literals |

Root tooling (developer machine / the `hirobius/ops` dashboard — **not** client-app runtime) — all **Hirobius-Internal**:

| Name | Where | Purpose |
|------|-------|---------|
| `ANTHROPIC_API_KEY` | `packages/agent` | site-gen agent |
| `GOOGLE_PLACES_API_KEY` | `scripts/lead-gen` | lead sourcing |

## Before onboarding the first real client

- [ ] Add `apps/_template/.env.example` (names-only: `PREVIEW_USER`, `PREVIEW_PASS`) so every scaffolded app declares its env surface. _(Human-applied — agents don't create `.env*` files.)_
- [ ] Decide + implement: move client-specific keys (Web3Forms / hCaptcha) out of `client.config.ts` literals into **per-project env vars**, so a real client key is never committed to the monorepo.
- [ ] `.gitignore` covers `.env*` repo-wide — already ✅ (root `.env` / `.env.*` / `!.env.example`).

## Status today

**Clean, but undocumented-until-now** — every app in `apps/` is a demo or fictional preview; no real client secret has ever been committed, and the shared preview-gate var *names* are Internal and per-project-scoped (not a shared value). The two items above are the pre-production owner-split work, tracked in [#27](https://github.com/hirobius/clients/issues/27).
