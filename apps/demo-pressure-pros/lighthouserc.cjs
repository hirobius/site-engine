/**
 * Perf/a11y/SEO budgets (issue #88) for the built demo, run in CI by
 * .github/workflows/lighthouse.yml. Mobile emulation + simulated throttling
 * are Lighthouse's defaults; set explicitly here so the budget doesn't
 * silently change if that default ever does.
 */
module.exports = {
  ci: {
    collect: {
      staticDistDir: "./dist",
      url: ["/index.html"],
      // 3 runs, not 1 — simulated-throttling perf scores have enough run-to-run
      // variance on a shared runner that a single run flakes. lhci's default
      // "optimistic" aggregation takes the best minScore run of the 3, which
      // absorbs that measurement noise without hiding a real regression (a
      // genuine regression drags every run down, not just one).
      numberOfRuns: 3,
      settings: {
        // formFactor: "mobile" + throttlingMethod: "simulate" are Lighthouse's
        // own defaults (including the matching screenEmulation); named here so
        // the budget doesn't silently change if that default ever does.
        formFactor: "mobile",
        throttlingMethod: "simulate",
        // --no-sandbox/--disable-dev-shm-usage: CI runs Chrome as root in a
        // container; sandboxing needs a privileged container we don't have,
        // so disable it the same way chrome-launcher docs recommend for
        // root/CI environments.
        // --force-prefers-reduced-motion: brand.motion defaults to "rich" —
        // `.reveal` sections fade in on scroll/load. Lighthouse never scrolls,
        // so a section still mid-entrance-transition when the accessibility
        // audit samples it can read as a false-positive low-contrast
        // violation. Forcing reduced motion renders every `.reveal` in its
        // final, fully-visible state — same flake guard as apps/_gallery's
        // visual regression (clients#22/#74). (lhci wants a space-separated
        // string here, not an array.)
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --force-prefers-reduced-motion",
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.95 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./.lighthouseci",
    },
  },
};
