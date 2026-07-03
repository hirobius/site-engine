---
name: generate-client-config
description: "Generate a validated ClientConfig for a client site IN-SESSION (no ANTHROPIC_API_KEY, no server agent) — the Claude Code session is the generation engine. Use whenever the user says 'generate a config for <lead/agent>', 'build a preview for <business>', 'turn this Outscraper lead into a site', or hands over lead/agent details to turn into a site. Follows the same enrich→generate→judge contract as lib/agent, executed by hand so it's free and high-touch. For volume/unattended runs, the server API path (lib/agent + ANTHROPIC_API_KEY) is the v2 upgrade — not this."
---

# Generate ClientConfig — in-session

The session IS the engine. Given a lead (Outscraper row, a URL, or details the
user pastes), produce a validated `apps/<slug>/client.config.ts` to the same bar
the `lib/agent` pipeline would — enrich → generate → judge — without the API key.

## Contract
- Source of truth for the shape: `packages/schema` (`defineClient` / the Zod
  schemas). Never invent fields the schema can't express; a site that needs that
  is a custom engagement, not a generated config.
- Brand comes from a **palette preset** (`brand.palettePreset`) + `--brand-*`
  overrides — never free-form styling. Realtors use the `realtor` preset
  (monochrome + electric-blue accent).

## Steps

**1. Enrich** — normalize the lead into a brief. Pull: business/agent name, market
+ neighborhoods, contact (email/phone), brokerage + license #, any existing site
copy or reviews. Note gaps; do NOT fabricate facts (no invented awards, stats,
or listings). If a required fact is missing, flag it for the user, don't guess.

**2. Generate** — write the copy + fill the sections for the target template
family (e.g. realtor: hero, featuredListings, agentBio, stats, neighborhoods,
testimonials, valuation, contact). Rules:
- Plain, warm, specific. No jargon, no "we leverage synergies." Local-expert voice.
- Every image needs real `alt` text (SEO + a11y).
- SEO title ≤70 chars, description ≤180.
- CTA present and concrete ("What's your home worth?" / "Book a call").
- License #, brokerage, and fair-housing disclaimer present (realtor compliance).
- Photos: reference asset paths under the app's `public/`; the user drops the
  real images. Never hotlink.

**3. Validate** — the config must satisfy the Zod schema (`defineClient`). If a
field is optional and unknown, omit it rather than stub a fake value.

**4. Judge** (self-review before handing back) — pass only if all hold:
- Clarity: a stranger understands what this agent does + who for in 5 seconds.
- Specificity: real market/neighborhoods/numbers, nothing generic.
- No fabrication: every claim traces to the lead or is clearly a placeholder the
  user must confirm.
- Complete: CTA, contact, compliance, alt text, SEO limits all satisfied.
If any fail, revise and re-judge. Surface any placeholders the user must fill.

## Output
Write `apps/<agent-slug>/client.config.ts` (scaffold the app with `new-client`
first). Then the Astro factory renders it → preview. Tell the user exactly which
fields are placeholders awaiting real data (photos, license #, stats).
