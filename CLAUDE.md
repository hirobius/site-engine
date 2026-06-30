# CLAUDE.md — working rules for this repo

This is **hirobius-clients**: the **engine + reference factory** for one-page
marketing sites for local service businesses. The engine (schema + lead-gen + AI
agent) is the moat; the Astro app is one render target. Read this before doing
anything; it exists to keep automated builds from wandering.

## Delivery architecture (read first)

**Production client sites ship on self-hosted Astro** (this repo), one Vercel
project per client. The factory is already built, free, and the most direct path
from a generated `ClientConfig` to a live site — the right call at our volume.

The contract is `ClientConfig` (`packages/schema`): the agent emits it, a render
target turns it into a site. Keeping the contract render-agnostic means we're never
locked to one delivery platform if that ever changes. The config-only rules below
apply **whenever you build a client site** — they keep that path clean.

## The one rule that matters

**A client site is built by editing ONE file — `apps/<slug>/client.config.ts` —
plus dropping in photos.** Everything visual is a fixed, shared component reading
from that config. If a request can't be expressed in the config schema, that is a
**custom-component engagement (different price tier), not a config edit** — STOP
and flag it. Do not invent an escape hatch.

## Golden rules for building a client

1. **Scaffold with the script**, never by hand-copying files:
   ```bash
   pnpm new-client <slug> --name "Business Name" --preset <preset>
   ```
   Presets: `landscaping`, `junk-removal`, `pressure-washing`, `concrete-fencing`.
2. **Edit only** `apps/<slug>/client.config.ts` and `apps/<slug>/src/assets/photos`
   (+ `apps/<slug>/public` for og image / favicon).
3. **Do NOT modify** anything under `packages/*` or any `.astro` component while
   building a client. Those are shared across the whole fleet — a change there
   restyles every site (see README → "Fleet rebuild drift").
4. **Do NOT add dependencies.** The stack is fixed (Astro 5, Tailwind v4, Zod,
   astro:assets, @vercel/functions). New deps require explicit human approval.
5. **Never invent business facts.** Phone numbers, hours, service areas, reviews,
   and addresses come from intake only. If a field is unknown, leave the stub and
   list it as a TODO — do not fabricate.
6. **If it doesn't fit the schema, STOP and ask.** Don't bend a component.

## Verify before you're done (both must pass)

```bash
pnpm install
pnpm --filter @hirobius/<slug> check    # tsc + astro check, 0 errors
pnpm --filter @hirobius/<slug> build    # invalid config FAILS here (Zod)
```

A green build is the gate: `astro build` imports `client.config.ts`, which runs
`defineClient()` → Zod validation. A bad config throws and the build fails, so you
cannot ship a malformed site by accident.

## Where things live

| Path | What it is | Touch when building a client? |
|---|---|---|
| `packages/schema` | Zod `ClientConfig` + `defineClient()` + presets | ❌ No |
| `packages/template` | Astro components, theming, SEO/JSON-LD | ❌ No |
| `apps/_template` | Canonical client app (copied by `new-client`) | ❌ No |
| `apps/_gallery` | Internal component/preset preview | ❌ No |
| `apps/<slug>` | A client site | ✅ Yes — config + photos only |
| `scripts/` | `new-client`, `eject-client` | ❌ No |

## Content rules

- **Photos:** optimized images (1600px max edge, ~200KB) go in
  `src/assets/photos`; verbatim files (og image, favicon, video) in `public`.
  Name files to match the config paths.
- **SEO:** `seo.title` ≤ 70 chars, `seo.description` ≤ 180 chars, `siteUrl` is the
  real production URL.
- **Spam:** set `form.hcaptchaSiteKey` for production clients. The honeypot is
  automatic; hCaptcha renders only when a key is present.

## Handoff & fleet policy (don't skip)

- Handing a site to a client means **ejecting** it:
  `pnpm eject-client <slug>` → a standalone repo with no workspace deps.
- Handed-off sites are **frozen**. A `packages/*` change does NOT get redeployed
  to live client sites except as an intentional, paid update.
- See README for the full template-versioning and scope policy.

## Deploy

Static Astro, one Vercel project per client, Root Directory `apps/<slug>`,
Ignored Build Step `npx turbo-ignore`. Preview deploys are basic-auth gated by
`apps/<slug>/middleware.ts` (Vercel Routing Middleware — NOT Astro middleware).
`new-client` prints the exact Vercel CLI commands.
