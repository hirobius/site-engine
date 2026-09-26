import { describe, expect, it } from "vitest";
import { isPlausibleConfigured, telClickTrackingScript } from "./analytics.js";
import type { ClientConfig } from "@hirobius/schema";

// se#84: tel-click / form-submit conversion events. Form-submit has no custom
// JS — the existing /thanks redirect (se#95) already produces a pageview once
// BaseHead's Plausible script is present, so that's the form-conversion
// signal (a Plausible pageview goal on /thanks, configured in the dashboard —
// see README § Plausible goals). Only tel-click needs script.

const withoutAnalytics = {} as Pick<ClientConfig, "analytics">;
const withPlausible = {
  analytics: { provider: "plausible", domain: "example.com" },
} as Pick<ClientConfig, "analytics">;

describe("isPlausibleConfigured", () => {
  it("is false when analytics is unset (zero JS should be emitted)", () => {
    expect(isPlausibleConfigured(withoutAnalytics as ClientConfig)).toBe(false);
  });

  it("is true when analytics.provider is plausible", () => {
    expect(isPlausibleConfigured(withPlausible as ClientConfig)).toBe(true);
  });
});

describe("telClickTrackingScript", () => {
  const script = telClickTrackingScript();

  it("delegates a single document-level click listener (no per-component wiring)", () => {
    expect(script).toContain('addEventListener("click"');
  });

  it("matches tel: links via closest(), covering nested markup", () => {
    expect(script).toContain('closest(\'a[href^="tel:"]\')');
  });

  it("fires the Call Click Plausible event", () => {
    expect(script).toContain("Call Click");
  });

  it("guards on window.plausible existing (no throw before the script tag loads)", () => {
    expect(script).toContain("window.plausible");
  });

  it("is a non-empty string regardless of config (the caller gates emission, not this function)", () => {
    expect(script.length).toBeGreaterThan(0);
  });
});
