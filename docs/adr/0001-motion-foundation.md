# ADR-0001 — Motion foundation for the client factory

**Status:** Accepted (2026-07-09)
**Scope:** `packages/template` (all client sites), `packages/schema` (`brand.motion`)
**Issue:** clients#22 · **Follow-ups:** clients#33 (section scrub → enrich), HDS token promotion

## Context

We wanted scroll motion in the factory (reveal-on-enter, hero entrance, map
pulse) prototyped in `hirobius/access-tech`. That prototype *feels* right but is
a hand-tuned Carrd page: the numbers are undocumented magic and it ships two real
defects — **no `prefers-reduced-motion` guard** and **content hidden by default**
(`.reveal { opacity: 0 }`), so a no-JS/blocked-script visitor sees a blank page.

We did not want to copy magic numbers. The rule this ADR sets: **every motion
value is a token, and every token traces to an established motion principle.**

## Grounding (why the values are what they are)

The access-tech values were kept where they land inside recognised ranges, and
tokenised. Basis:

| Token | Value | Principle | Source |
|---|---|---|---|
| `--motion-ease-entrance` | `cubic-bezier(0.16,0.84,0.44,1)` | Entrances **decelerate** (arrive at speed, settle to rest) — not raw `ease` | Material 3 *emphasized-decelerate* |
| `--motion-duration-entrance` | `700ms` | Expressive end of the entrance range | Material 3 duration scale; NN/g animation-duration guidance |
| `--motion-duration-hero` | `850ms` | Hero cascade beat | access-tech source; MD3 long-duration band |
| `--motion-travel` | `24px` | **Small** displacement, not a big slide (≈ HDS `--primitive-space-6`) | Material 3 motion; Disney "staging" |
| `--motion-travel-hero` | `20px` | Hero-rise displacement | access-tech source |
| `--motion-stagger` | `80ms` (cap 4) | **Choreography** — sequence items, cap the cascade | Material 3 choreography |
| `--motion-pulse-duration` | `2.4s` | Radar-ring ping period (decorative, must be stoppable) | access-tech source; WCAG 2.2.2 |

Non-negotiable rules layered on top of the prototype:

- **Reduced motion** — `@media (prefers-reduced-motion: reduce)` disables all
  non-essential motion; nothing is conveyed by motion alone. *(WCAG 2.3.3)*
- **No-JS-safe** — content is fully visible by default. The hide-then-reveal
  only arms when `<html>` carries `data-motion` **and** the `.motion-ready` class
  (added by an inline `<head>` script only when reduced motion is off). No-JS,
  unsupported-browser, and reduced-motion visitors all get static, visible
  content — never a stuck-hidden state. This fixes the access-tech blank-page bug.
- **Performance** — transform/opacity only (GPU-friendly, no layout thrash);
  entrance motion never gates the LCP element; zero CLS.

## Decisions we made to start

- **One dial:** `brand.motion: "none" | "subtle" | "rich"` on `BrandSchema`.
  - `none` — fully static.
  - `subtle` — section/card reveal-on-enter + hero-rise cascade.
  - `rich` — `subtle` **plus** per-card stagger (`(i%4)·80ms`) and the
    radar-ring pulse on service-area pins.
- **Default = `rich`.** The factory starts expressive; we dial *down* per client.
  (Chosen over `subtle`-default after feeling all three tiers live, 2026-07-09.)
- **Radar-ring pulse**, not a scale pulse — an expanding box-shadow that fades,
  matching the access-tech source (better read for a map "pin").
- **Applied via** `Hero` (rise), `Section` header + `ServicesGrid`/`Reviews`
  cards (reveal, `data-reveal-group` for stagger), `ServiceAreaMap` pins (pulse).
- **Tokens live in the template for now**; promoting them into HDS
  `hirobius.tokens.json` (shared spine) is a tracked follow-up.

## The knobs we started tweaking (open for enrichment)

These are the levers already exposed as tokens or flagged for later:

- **Durations** `--motion-duration-entrance` (700ms), `--motion-duration-hero` (850ms)
- **Easing** `--motion-ease-entrance` (decelerate curve)
- **Travel** `--motion-travel` (24px), `--motion-travel-hero` (20px)
- **Stagger** `--motion-stagger` (80ms) + 4-item cap
- **Pulse** `--motion-pulse-duration` (2.4s), ring size/opacity
- **Deferred:** per-preset motion defaults (e.g. a calmer default for one trade);
  reveal `threshold`/`rootMargin` tuning; promotion of tokens into HDS.

## Grading criteria (what "correct" motion means here)

1. **Grounded** — no inline magic numbers; value → token → cited principle.
2. **Accessible** — reduced-motion kills non-essential motion; nothing motion-only.
3. **Robust** — visible by default; motion is pure enhancement (no-JS-safe).
4. **Performant** — transform/opacity only, off the LCP path, no CLS.
5. **Restrained** — entrance ≤ ~700ms, small travel, stagger capped, one-shot reveals.
6. **Verified** — browser-tested (headless render): reveals fire, reduced-motion
   static, no overflow/FOUC.
7. **Tunable** — one `brand.motion` dial, consistent across sections and presets.

## Consequences

- A `packages/template` change is a **fleet event** — shipped as a template minor
  bump (ties to clients#12). Non-ejected preview apps pick it up; ejected client
  sites are frozen.
- `brand.motion` is a **canonical schema change** — re-synced to ops's vendored
  `lib/schema` (clients#21).
- Enrichment (more section types + their motion) is intentionally deferred until
  after the section scrub (clients#33), tracked in a new issue.
