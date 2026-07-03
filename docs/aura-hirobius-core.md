# Hirobius core — aura.build DESIGN.md

Paste this into aura as the design system. **The structure is the reusable
Hirobius core; the `colors:` + font families are the per-client skin — swap only
those.** Below is skinned for a warm-editorial realtor (Elizabeth). Structural
values come from `@hirobius/design-system` tokens (spacing/radius/roles); the
skin is chosen to match the SERENE reference direction.

> Supersedes the prose `hirobius-core-brief.md` — aura consumes this structured
> format, not a vibe paragraph.

```yaml
---
name: "Hirobius Core — Editorial (warm skin)"
description: "Premium editorial site system: cinematic imagery, high-contrast serif display, mono eyebrows, generous whitespace, one restrained accent. Structure is fixed (Hirobius core); colors + fonts are the per-client skin."

# ── SKIN — swap per client (colors + font families only) ──────────────────
colors:                          # example: warm-editorial realtor
  background: "#F4EFE7"          # warm cream ground
  surface:    "#FBF8F2"          # lighter cream for raised blocks
  primary:    "#2B2A26"          # warm near-black — text + dark sections
  text-primary:   "#2B2A26"
  text-secondary: "#6B655A"      # warm grey
  accent:     "#4A5443"          # ONE accent — deep sage (links, eyebrows, focus)
  border:     "#E4DDD0"          # warm hairline

typography:
  display-lg:                    # CORE role; family is skin
    fontFamily: "Canela, 'Cormorant Garamond', Georgia, serif"   # serif for warm clients
    fontSize: "64px"
    fontWeight: 400
    lineHeight: "1.05"
    letterSpacing: "-0.01em"     # allow italic on the emphasis word (roman + italic mix)
  body-md:                       # CORE role; family is skin
    fontFamily: "Satoshi, system-ui, sans-serif"   # clean body under the serif display
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "1.6"
  label-md:                      # CORE role — the eyebrow. mono, UPPERCASE, tracked
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "1.2"
    letterSpacing: "0.14em"
    textTransform: "uppercase"

# ── CORE — Hirobius structure, keep across every client ───────────────────
spacing:
  base: "8px"                    # 4px underlying grid; 8 is the working unit
  gap: "16px"
  card-padding: "24px"
  section-padding: "96px"        # sections breathe (96–128 desktop)
rounded:
  card: "8px"
  control: "8px"
  pill: "9999px"                 # pills only for small tags
components:
  card:
    background: "Use surface; hairline border in border-token; no heavy shadows"
    radius: "card token"
  button:
    background: "primary or accent for the main action; generous padding"
    radius: "control (or pill for small tags)"
---
```

## Composition (CORE)
Full-bleed cinematic imagery alternating with cream editorial text sections.
First viewport: one strong image + a mono eyebrow + a big serif line + a one-line
sub. Left-align text in content sections; center only the hero. Generous
whitespace carries the layout — not cards.

## Colors (skin note)
Monochrome-warm ground + **one** accent used sparingly (eyebrows, links, focus,
one highlighted number). No secondary brand colors, no decorative gradients. For
a different client, change only the `colors:` block.

## Typography (CORE roles)
- **Display:** high-contrast serif, large, tight leading; mix **roman + italic**
  on the emphasis word ("Nowhere, *perfected*").
- **Body:** clean and readable, ~66ch measure.
- **Eyebrow (label):** mono, uppercase, letter-spaced — the signature that keeps
  output looking crafted. Family is skinnable, the *role* is not.

## Layout (CORE)
Deliberate, stable spacing. Big type hierarchy with clear steps. Use the
**label ↔ value spec list** pattern for stats/details (label left, serif value
right, thin divider) — great for "by the numbers" / listing details.

## Motion (CORE)
Restrained: masked reveals, staggered entrance, gentle hover lift, scroll-
triggered fades. Smooth easing. Never decorative.

## Guardrails (CORE — do not violate)
- Do NOT flatten into a generic SaaS card grid.
- Preserve the first-viewport image + focal line.
- One accent only; keep radius + eyebrow language consistent everywhere.
- Imagery is large and editorial, never small floating thumbnails.
- Sections breathe — don't crowd text into color bands.
```

## Signature patterns — the "opened-up editorial" system (CORE)
Bank these into the section library. They're what make output feel systematic
and premium, and they work **light or dark** (the ground is skin):
- **Bracket / numbered eyebrows:** `[ EDITORIAL SYSTEM ]`, `01 / DIRECTION`, `Mood / 01` — mono, letter-spaced.
- **Numbered process sections:** big display heading + `NN / LABEL` eyebrow + one-line description, thin dividers between.
- **Stat rail:** 2–4 big numbers, each with a mono caption ("218 / HOMES SOLD", "11 days / AVG ON MARKET").
- **Mono checklist:** an uppercase letter-spaced list ("WHAT'S INCLUDED").
- **Inversion CTA block:** flip to the opposite ground (dark-on-cream or cream-on-dark) for booking/valuation — solid primary button + outlined secondary + a bordered stat stack.
- **Crop-mark details:** small `+` corner marks + a hairline frame on hero imagery.
- **Live status line:** "● TAKING 2 NEW LISTINGS THIS MONTH" with a small dot — honest scarcity signal.
- **Big wrap-headline moments:** a display line that fills the viewport.

## Direction (2026-07 — Adrian)
Keep this editorial *system* but **lighter**: light ground (cream/off-white),
near-black text, one accent; reserve the cream↔dark **inversion** for CTA
moments only. The **display font is the swing variable** — a bold grotesk gives
NOIRFRAME's sharp energy; a high-contrast serif gives SERENE's warmth. Same
bones either way. (For Elizabeth: serif. For a modern/fashion client: grotesk.)
