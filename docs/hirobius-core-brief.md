# Hirobius Core — design brief for aura.build swings

Paste the block below into aura.build (or any AI site builder) as the design
system for a swing. It captures the Hirobius look well enough that output reads
as *our* work, not generic AI. **It is not a token import** — exact fidelity
(precise hex, type scale, spacing) is enforced later when the winning concept is
harvested into the Astro factory (`packages/template` + real
`hirobius.tokens.json`). Aim aura at the *vibe*; the factory locks the tokens.

Values below are the real published `@hirobius/design-system@0.8.x` tokens.

---

## PASTE INTO AURA

> **Design system — "Editorial Enterprise."** Premium, restrained, authored — not
> templated. Enterprise rigor with editorial pacing: sharp hierarchy, generous
> whitespace, disciplined monochrome, one electric accent. Layouts feel designed,
> like a magazine, not a component dump.
>
> **Color — monochrome + a single accent.**
> - Neutrals (the whole palette): near-black `#0a0a0a` / `#111111` for text and
>   dark surfaces; `#262626`, `#404040`, `#525252`, `#737373` for secondary text
>   and lines; `#e5e5e5` / `#f5f5f5` / `#fafafa` for light surfaces; pure white
>   `#ffffff`.
> - **One accent only: electric blue `#1E2EFD`** (hover a touch darker). Use it
>   sparingly — primary buttons, links, focus rings, one highlighted stat. Never
>   flood a section with it. No secondary brand colors, no gradients-as-decoration.
>
> **Type.**
> - Headlines/display: **Clash Display** — large, tight tracking, confident.
> - Body/UI: **Satoshi** (fallback system-ui). Base size ~17px, comfortable
>   measure (~66ch), real line-height.
> - Small labels / metadata / eyebrows: **Geist Mono**, uppercase, letter-spaced.
> - Strong size hierarchy: big headlines, clear steps down. Don't shout everywhere.
>
> **Spacing & rhythm.** 4px base scale (8/12/16/24/32/48/64/96/128). Sections
> breathe — 96–128px vertical padding on desktop. Whitespace carries the layout.
>
> **Radius.** Subtle: 8–12px on cards/inputs; pill (`9999px`) only for small tags.
> Not bubbly, not fully square.
>
> **Structure.** Prefer open bands, dividers, rails, and whitespace over heavy
> outlined cards. Cards used sparingly, for genuinely discrete repeated objects.
> Large editorial imagery. Status/metadata in consistent slots, never decorative
> badges glued onto prose.
>
> **Motion.** Subtle and purposeful — teaches or clarifies, never decorates.
>
> **Voice for a realtor site:** warm, local-expert, trustworthy, unfussy. Big
> property photography. Clear buy / sell / "what's my home worth" paths.

---

## Reskin note for a specific person (e.g. Elizabeth's refresh)
Keep the accent + Clash Display + monochrome discipline constant; let the
*photography and copy* carry their personality. The core is the frame; the
client is the content.
