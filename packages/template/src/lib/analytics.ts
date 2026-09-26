import type { ClientConfig } from "@hirobius/schema";

/**
 * se#84: analytics is opt-in per client (`config.analytics`, schema in
 * `packages/schema`). This is the single predicate BaseHead.astro gates both
 * the Plausible script tag *and* the tel-click tracking script on — keeping
 * the "zero JS when unset" guarantee in one place instead of two `?.`
 * chains that could drift apart.
 */
export function isPlausibleConfigured(config: ClientConfig): boolean {
  return config.analytics?.provider === "plausible";
}

/**
 * Inline, event-delegated tel-click tracker. One `document`-level listener
 * (not per-CTA wiring) so it covers every `tel:` link — Hero, StickyCTA,
 * ContactForm, Footer — without each component knowing analytics exists.
 * Emitted as a literal `<script>` body (see BaseHead.astro), so this stays
 * plain, dependency-free JS: no imports, no TS, nothing bundler-transformed.
 *
 * Fires Plausible's custom-event goal `Call Click` — see README § Plausible
 * goal setup for how to add it in the dashboard. Guards on `window.plausible`
 * existing so this is inert if BaseHead's script tag is ever reordered after
 * it, or hasn't finished loading yet.
 *
 * Form-submit conversion is intentionally *not* handled here: the `/thanks`
 * redirect (se#95) already fires a pageview once this same Plausible script
 * is present on every page, so the form-conversion signal is a Plausible
 * pageview goal on `/thanks` configured in the dashboard, not custom JS.
 */
export function telClickTrackingScript(): string {
  return `document.addEventListener("click",function(e){var t=e.target;if(!t||typeof t.closest!=="function")return;var a=t.closest('a[href^="tel:"]');if(!a)return;if(window.plausible)window.plausible("Call Click");});`;
}
